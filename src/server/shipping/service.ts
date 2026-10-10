/**
 * What the shop does with couriers. Admin buttons call these functions.
 *
 * Rule for every function here: the courier API is called OUTSIDE a database
 * transaction. A transaction holds locks; a courier that takes 15 seconds would
 * block other orders for 15 seconds. So: check in the database, call the courier,
 * then write the answer in a short transaction.
 */
import "server-only";
import { and, asc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { replaceOffices } from "@/db/offices";
import { courierOffices, orderItems, orders, products, shipments, type Order, type Shipment } from "@/db/schema";
import type { OrderStatus } from "@/lib/order-status";
import type { CourierId } from "@/lib/settings";
import { audit } from "../audit";
import { OrderError, transitionOrder, transitionOrderTx } from "../orders";
import { getCourier } from "./index";
import { CourierError, type ShipmentRequest, type ShipmentState } from "./types";

/** The adapter for an existing shipment. A demo waybill cannot be tracked in the live system and vice versa. */
function adapterFor(shipment: Shipment) {
  const adapter = getCourier(shipment.courier as CourierId);
  if (adapter.mode !== shipment.mode) {
    throw new CourierError(`Товарителницата е създадена в режим „${shipment.mode}“, а куриерът сега е в режим „${adapter.mode}“.`);
  }
  return adapter;
}

export async function syncOffices(courier: CourierId) {
  const adapter = getCourier(courier);
  const offices = await adapter.fetchOffices();
  if (offices.length === 0) throw new CourierError("Куриерът върна празен списък. Старият списък е запазен.");
  const db = await getDb();
  const count = await replaceOffices(db, courier, offices);
  await audit(db, { entity: "courier", entityId: courier, action: `offices synced: ${count}`, actor: "admin" });
  return count;
}

export async function getOrderShipments(orderId: number) {
  const db = await getDb();
  return db.select().from(shipments).where(eq(shipments.orderId, orderId)).orderBy(asc(shipments.createdAt));
}

export function activeShipment(list: Shipment[]) {
  return list.find((s) => !s.cancelledAt) ?? null;
}

/** Suggested weight for the waybill form: the products' weights added up. */
export async function suggestedParcel(orderId: number) {
  const db = await getDb();
  const rows = await db
    .select({ name: orderItems.productName, quantity: orderItems.quantity, weight: products.weightGrams })
    .from(orderItems)
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(eq(orderItems.orderId, orderId));
  const weightGrams = rows.reduce((sum, r) => sum + (r.weight ?? 500) * r.quantity, 0);
  const description = rows.map((r) => r.name.replace(/[„“"]/g, "")).join(", ").slice(0, 50);
  return { weightGrams: Math.max(100, weightGrams), description: description || "Стоки" };
}

async function deliveryFor(order: Order): Promise<ShipmentRequest["delivery"]> {
  if (order.deliveryType === "address") {
    if (!order.postCode || !order.addressLine) {
      throw new OrderError("Поръчката е от преди полето „Пощенски код“. Обади се на клиента и създай товарителницата от сайта на куриера.");
    }
    return { type: "address", city: order.city, postCode: order.postCode, addressLine: order.addressLine };
  }
  const db = await getDb();
  const [office] = order.officeId ? await db.select().from(courierOffices).where(eq(courierOffices.id, order.officeId)) : [];
  if (!office?.code) {
    throw new OrderError("Офисът от поръчката вече не е в списъка на куриера (списъкът е обновен след поръчката). Обади се на клиента за нов офис.");
  }
  return { type: order.deliveryType as "office" | "locker", officeCode: office.code };
}

const STALE_CREATING_MS = 2 * 60 * 1000;

export async function createShipmentForOrder(orderId: number, parcel: { weightGrams: number; description: string }, actor: string) {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new OrderError("Поръчката не съществува.");
  if (order.status !== "confirmed" && order.status !== "packed") {
    throw new OrderError("Товарителница се създава за потвърдена или опакована поръчка.");
  }
  const courier = order.courier as CourierId;
  const adapter = getCourier(courier);
  const delivery = await deliveryFor(order);

  // A "creating" row left by a crash in the middle of a courier call would block the order forever.
  await db
    .delete(shipments)
    .where(and(eq(shipments.orderId, orderId), eq(shipments.status, "creating"), lt(shipments.createdAt, new Date(Date.now() - STALE_CREATING_MS))));

  // 1. Reserve: the unique index allows only one active shipment per order.
  //    Two clicks at the same time: the second insert fails here, before calling the courier.
  let placeholder: Shipment;
  try {
    [placeholder] = await db
      .insert(shipments)
      .values({ orderId, courier, mode: adapter.mode, status: "creating", weightGrams: parcel.weightGrams })
      .returning();
  } catch {
    throw new OrderError("Тази поръчка вече има товарителница (или в момента се създава). Презареди страницата.");
  }

  // 2. Call the courier, outside any transaction.
  let created;
  try {
    created = await adapter.createShipment({
      orderNumber: order.number,
      receiver: { name: order.customerName, phone: order.phone, email: order.email },
      delivery,
      weightGrams: parcel.weightGrams,
      description: parcel.description,
      codAmountCents: order.paymentMethod === "cod" ? order.totalCents : null,
    });
  } catch (error) {
    await db.delete(shipments).where(eq(shipments.id, placeholder.id));
    throw error;
  }

  // 3. Save the answer. If the order was only confirmed, a printed label means it is packed now.
  return db.transaction(async (tx) => {
    const [saved] = await tx
      .update(shipments)
      .set({
        trackingNumber: created.trackingNumber,
        labelUrl: created.labelUrl,
        costCents: created.costCents,
        costCurrency: created.costCurrency,
        status: "created",
        statusText: "Товарителницата е създадена",
      })
      .where(eq(shipments.id, placeholder.id))
      .returning();
    await tx.update(orders).set({ trackingNumber: created.trackingNumber }).where(eq(orders.id, orderId));
    if (order.status === "confirmed") await transitionOrderTx(tx, orderId, "packed", actor);
    await audit(tx, { entity: "order", entityId: orderId, action: `waybill ${created.trackingNumber} (${courier}, ${adapter.mode})`, actor });
    return saved;
  });
}

export async function cancelShipment(orderId: number, actor: string) {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new OrderError("Поръчката не съществува.");
  if (order.status !== "packed") throw new OrderError("Товарителница се анулира само преди пратката да е предадена на куриера.");
  const shipment = activeShipment(await getOrderShipments(orderId));
  if (!shipment?.trackingNumber) throw new OrderError("Няма активна товарителница.");

  await adapterFor(shipment).cancelShipment(shipment.trackingNumber);

  await db.transaction(async (tx) => {
    await tx.update(shipments).set({ status: "cancelled", statusText: "Анулирана от магазина", cancelledAt: new Date() }).where(eq(shipments.id, shipment.id));
    await tx.update(orders).set({ trackingNumber: null }).where(eq(orders.id, orderId));
    await audit(tx, { entity: "order", entityId: orderId, action: `waybill ${shipment.trackingNumber} cancelled`, actor });
  });
}

/** What our order should become when the courier reports this shipment state. */
function nextOrderStatus(order: OrderStatus, shipment: ShipmentState): OrderStatus[] {
  const moved = shipment === "in_transit" || shipment === "delivered" || shipment === "returned";
  const steps: OrderStatus[] = [];
  if (order === "packed" && moved) steps.push("shipped");
  if ((order === "packed" || order === "shipped") && shipment === "delivered") steps.push("delivered");
  if ((order === "packed" || order === "shipped") && shipment === "returned") steps.push("refused");
  return steps;
}

export type TrackingSummary = { checked: number; changedOrders: string[]; errors: string[] };

/**
 * Asks the couriers for the status of every active shipment and moves the orders:
 * picked up -> "Изпратена", delivered -> "Доставена", returned -> "Отказана при доставка".
 * Pass orderId to check a single order.
 */
export async function refreshTracking(actorPrefix = "courier", orderId?: number): Promise<TrackingSummary> {
  const db = await getDb();
  const rows = await db
    .select({ shipment: shipments, orderStatus: orders.status, orderNumber: orders.number })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(
      and(
        isNull(shipments.cancelledAt),
        inArray(shipments.status, ["created", "in_transit"]),
        inArray(orders.status, ["packed", "shipped"]),
        orderId ? eq(shipments.orderId, orderId) : sql`true`,
      ),
    );

  const summary: TrackingSummary = { checked: 0, changedOrders: [], errors: [] };
  const byCourier = new Map<string, typeof rows>();
  for (const row of rows) byCourier.set(row.shipment.courier, [...(byCourier.get(row.shipment.courier) ?? []), row]);

  for (const [courier, all] of byCourier) {
    let results;
    let list: typeof all;
    try {
      const adapter = getCourier(courier as CourierId);
      // Shipments made in another mode (for example demo, before switching to live) are not sent to the courier.
      list = all.filter((r) => r.shipment.mode === adapter.mode && r.shipment.trackingNumber);
      if (list.length === 0) continue;
      results = await adapter.track(list.map((r) => ({ trackingNumber: r.shipment.trackingNumber!, current: r.shipment.status as ShipmentState })));
    } catch (error) {
      summary.errors.push(error instanceof CourierError ? error.message : `${courier}: неочаквана грешка`);
      if (!(error instanceof CourierError)) console.error(error);
      continue;
    }

    for (const result of results) {
      const row = list.find((r) => r.shipment.trackingNumber === result.trackingNumber);
      if (!row) continue;
      summary.checked++;
      await db
        .update(shipments)
        .set({
          status: result.state,
          statusText: result.statusText,
          events: result.events,
          lastCheckedAt: new Date(),
          ...(result.state === "cancelled" ? { cancelledAt: new Date() } : {}),
        })
        .where(eq(shipments.id, row.shipment.id));

      let current = row.orderStatus as OrderStatus;
      for (const to of nextOrderStatus(current, result.state)) {
        try {
          await transitionOrder(row.shipment.orderId, to, `${actorPrefix}:${courier}`);
          current = to;
          summary.changedOrders.push(`${row.orderNumber}: ${to}`);
        } catch (error) {
          // For example the customer withdrew meanwhile. The admin decides by hand.
          if (!(error instanceof OrderError)) throw error;
          break;
        }
      }
    }
  }
  return summary;
}

export async function labelFor(shipmentId: number) {
  const db = await getDb();
  const [shipment] = await db.select().from(shipments).where(eq(shipments.id, shipmentId));
  if (!shipment?.trackingNumber) return null;
  if (shipment.labelUrl) return { redirect: shipment.labelUrl };
  // Speedy and the mock courier make the label on request.
  const file = await adapterFor(shipment).label(shipment.trackingNumber);
  return { file, trackingNumber: shipment.trackingNumber };
}
