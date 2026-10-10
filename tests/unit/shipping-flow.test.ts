/**
 * The whole courier flow against a real (in-memory) Postgres and the mock courier:
 * order -> waybill -> courier picks it up -> delivered -> cash on delivery recorded.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";

process.env.PGLITE_DATA_DIR = "memory://";
process.env.ECONT_MODE = "mock";
process.env.SPEEDY_MODE = "mock";
process.env.SEED_DEMO_ORDERS = "false";

const { getDb } = await import("@/db/client");
const schema = await import("@/db/schema");
const { createOrder, transitionOrder, OrderError } = await import("@/server/orders");
const { cancelShipment, createShipmentForOrder, refreshTracking, syncOffices } = await import("@/server/shipping/service");

async function newOrder(paymentMethod: "cod" | "card" = "cod") {
  const db = await getDb();
  const [product] = await db.select().from(schema.products).where(eq(schema.products.slug, "lampa-s-shtipka-stranitsa"));
  const { order } = await createOrder(
    {
      customerName: "Иван Петров",
      phone: "+359888123456",
      email: "ivan@example.com",
      courier: "econt",
      deliveryType: "office",
      officeId: "econt-5306",
      deliveryLabel: "Габрово",
      city: "Габрово",
      postCode: null,
      addressLine: null,
      paymentMethod,
      marketingConsent: false,
      lines: [{ productId: product.id, quantity: 2 }],
    },
    "http://localhost",
  );
  return order;
}

describe("shipping flow with the mock courier", () => {
  beforeAll(async () => {
    await getDb();
  });

  it("creates one waybill, follows the parcel and records the cash on delivery", async () => {
    const order = await newOrder("cod");
    await transitionOrder(order.id, "confirmed", "admin");

    const shipment = await createShipmentForOrder(order.id, { weightGrams: 500, description: "Лампи" }, "admin");
    expect(shipment.trackingNumber).toMatch(/^EC\d{10}$/);
    expect(shipment.mode).toBe("mock");

    const db = await getDb();
    let [current] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    // A printed label means the order is packed.
    expect(current.status).toBe("packed");
    expect(current.trackingNumber).toBe(shipment.trackingNumber);

    // A second waybill for the same order is refused.
    await expect(createShipmentForOrder(order.id, { weightGrams: 500, description: "Лампи" }, "admin")).rejects.toBeInstanceOf(OrderError);

    // The mock parcel moves with time (2 minutes per step). Checking right away changes nothing.
    let summary = await refreshTracking("courier", order.id);
    expect(summary.changedOrders).toEqual([]);
    const backdate = (minutes: number) =>
      db.update(schema.shipments).set({ createdAt: new Date(Date.now() - minutes * 60_000) }).where(eq(schema.shipments.id, shipment.id));
    // 3 minutes later: picked up -> shipped (and the customer gets an email).
    await backdate(3);
    summary = await refreshTracking("courier", order.id);
    expect(summary.changedOrders).toEqual([`${order.number}: shipped`]);
    // 5 minutes later: delivered. A second check at the same moment does not move it again.
    await backdate(5);
    summary = await refreshTracking("courier", order.id);
    expect(summary.changedOrders).toEqual([`${order.number}: delivered`]);

    [current] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(current.status).toBe("delivered");
    const cod = await db.select().from(schema.payments).where(and(eq(schema.payments.orderId, order.id), eq(schema.payments.provider, "cod")));
    expect(cod).toHaveLength(1);
    expect(cod[0].amountCents).toBe(order.totalCents);
    const mails = await db.select().from(schema.emails).where(eq(schema.emails.orderId, order.id));
    expect(mails.some((m) => m.subject.includes("изпратена") && m.body.includes(shipment.trackingNumber!))).toBe(true);
  });

  it("cancels a waybill and allows a new one", async () => {
    const order = await newOrder("card");
    await transitionOrder(order.id, "confirmed", "webhook:mock");
    const first = await createShipmentForOrder(order.id, { weightGrams: 300, description: "Лампа" }, "admin");
    await cancelShipment(order.id, "admin");
    const second = await createShipmentForOrder(order.id, { weightGrams: 300, description: "Лампа" }, "admin");
    expect(second.trackingNumber).not.toBe(first.trackingNumber);

    const db = await getDb();
    const rows = await db.select().from(schema.shipments).where(eq(schema.shipments.orderId, order.id));
    expect(rows.filter((r) => r.cancelledAt)).toHaveLength(1);
    expect(rows.filter((r) => !r.cancelledAt)).toHaveLength(1);
  });

  it("refuses a waybill for an order that is not confirmed yet", async () => {
    const order = await newOrder("cod");
    await expect(createShipmentForOrder(order.id, { weightGrams: 300, description: "Лампа" }, "admin")).rejects.toThrow(/потвърдена/);
  });

  it("replaces the office list in one go", async () => {
    const count = await syncOffices("speedy");
    expect(count).toBe(6);
    const db = await getDb();
    const rows = await db.select().from(schema.courierOffices).where(eq(schema.courierOffices.courier, "speedy"));
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.syncedAt !== null && r.id === `speedy-${r.code}`)).toBe(true);
  });
});
