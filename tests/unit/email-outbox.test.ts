/**
 * Emails wait in the outbox until the order is saved, then go out through Resend.
 * Resend is replaced by a fake fetch here.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

process.env.PGLITE_DATA_DIR = "memory://";
process.env.ECONT_MODE = "mock";
process.env.SEED_DEMO_ORDERS = "false";
process.env.RESEND_API_KEY = "re_test";
process.env.EMAIL_FROM = "Фенер <poruchki@example.bg>";

const { getDb } = await import("@/db/client");
const schema = await import("@/db/schema");
const { createOrder } = await import("@/server/orders");
const { deliverEmails } = await import("@/server/email");

async function placeOrder() {
  const db = await getDb();
  const [product] = await db.select().from(schema.products).limit(1);
  const { order } = await createOrder(
    {
      customerName: "Иван Петров", phone: "+359888123456", email: "ivan@example.bg", courier: "econt", deliveryType: "office",
      officeId: "econt-5306", deliveryLabel: "Габрово", city: "Габрово", postCode: null, addressLine: null,
      paymentMethod: "cod", marketingConsent: false, lines: [{ productId: product.id, quantity: 1 }],
    },
    "http://localhost",
  );
  return order;
}

describe("email outbox", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the confirmation right after the order is saved", async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json({ id: "resend-1" }));
    vi.stubGlobal("fetch", fetchMock);
    const order = await placeOrder();
    const db = await getDb();
    const [mail] = await db.select().from(schema.emails).where(eq(schema.emails.orderId, order.id));
    expect(mail).toMatchObject({ status: "sent", providerId: "resend-1", attempts: 1 });
    expect(mail.sentAt).toBeInstanceOf(Date);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(init.body as string)).toMatchObject({ to: ["ivan@example.bg"], subject: `Поръчка ${order.number} е приета` });
  });

  it("keeps a refused email for the next try and never breaks the order", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ message: "Domain not verified" }, { status: 403 })));
    const order = await placeOrder(); // the order still succeeds
    const db = await getDb();
    let [mail] = await db.select().from(schema.emails).where(eq(schema.emails.orderId, order.id));
    expect(mail).toMatchObject({ status: "pending", attempts: 1, lastError: "Domain not verified" });

    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "resend-2" })));
    await deliverEmails();
    [mail] = await db.select().from(schema.emails).where(eq(schema.emails.orderId, order.id));
    expect(mail).toMatchObject({ status: "sent", providerId: "resend-2", attempts: 2, lastError: null });
  });
});
