/**
 * Orders: creation and every status change.
 *
 * Two rules hold everywhere in this file:
 * 1. Prices are read from the database and recalculated here, never taken from the browser.
 * 2. Status changes go through transitionOrderTx(), which checks the state machine,
 *    writes the audit log and runs the side effects (stock, emails, timestamps).
 */
import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { Tx } from "@/db/types";
import { orderItems, orders, payments, products, shipments, withdrawals, type Order } from "@/db/schema";
import { canTransition, WITHDRAWABLE, type OrderStatus } from "@/lib/order-status";
import { priceCart } from "@/lib/pricing";
import { SHOP, type CourierId, type DeliveryType, type PaymentMethod } from "@/lib/settings";
import { audit } from "./audit";
import {
  orderConfirmationEmail,
  refundEmail,
  sendEmail,
  shippedEmail,
  withdrawalAcknowledgmentEmail,
} from "./email";

export class OrderError extends Error {}

export type NewOrderInput = {
  customerName: string;
  phone: string;
  email: string;
  courier: CourierId;
  deliveryType: DeliveryType;
  officeId: string | null;
  deliveryLabel: string;
  city: string;
  postCode: string | null;
  addressLine: string | null;
  paymentMethod: PaymentMethod;
  marketingConsent: boolean;
  lines: { productId: number; quantity: number }[];
};

export async function createOrder(input: NewOrderInput, baseUrl: string) {
  if (input.lines.length === 0) throw new OrderError("Количката е празна.");
  const db = await getDb();

  return db.transaction(async (tx) => {
    // Read current prices and stock from the database.
    const rows = await tx
      .select()
      .from(products)
      .where(inArray(products.id, input.lines.map((l) => l.productId)));

    const pricingLines = input.lines.map((line) => {
      const product = rows.find((p) => p.id === line.productId);
      if (!product || !product.isPublished) throw new OrderError("Един от продуктите вече не се предлага.");
      if (product.stock < line.quantity) {
        throw new OrderError(`Наличността на „${product.name}“ е ${product.stock} бр. Промени количеството в количката.`);
      }
      return {
        productId: product.id,
        name: product.name,
        unitPriceCents: product.priceCents,
        vatRate: product.vatRate,
        quantity: line.quantity,
      };
    });

    const totals = priceCart({ lines: pricingLines, deliveryType: input.deliveryType, paymentMethod: input.paymentMethod });

    const [created] = await tx
      .insert(orders)
      .values({
        number: `tmp-${crypto.randomUUID()}`,
        status: input.paymentMethod === "card" ? "pending_payment" : "pending_confirmation",
        customerName: input.customerName,
        phone: input.phone,
        email: input.email,
        courier: input.courier,
        deliveryType: input.deliveryType,
        officeId: input.officeId,
        deliveryLabel: input.deliveryLabel,
        city: input.city,
        postCode: input.postCode,
        addressLine: input.addressLine,
        paymentMethod: input.paymentMethod,
        subtotalCents: totals.subtotalCents,
        shippingCents: totals.shippingCents,
        codFeeCents: totals.codFeeCents,
        totalCents: totals.totalCents,
        vatCents: totals.vatCents,
        marketingConsent: input.marketingConsent,
        termsAcceptedAt: new Date(),
      })
      .returning();

    // Human-friendly number from the database id: 2026-000012.
    const number = `${new Date().getFullYear()}-${String(created.id).padStart(6, "0")}`;
    const [order] = await tx.update(orders).set({ number }).where(eq(orders.id, created.id)).returning();

    const items = await tx
      .insert(orderItems)
      .values(
        totals.lines.map((l) => ({
          orderId: order.id,
          productId: l.productId,
          productName: l.name,
          unitPriceCents: l.unitPriceCents,
          vatRate: l.vatRate,
          quantity: l.quantity,
          lineTotalCents: l.lineTotalCents,
        })),
      )
      .returning();

    // Reserve stock now, so two customers cannot buy the last piece.
    for (const l of totals.lines) {
      await tx
        .update(products)
        .set({ stock: sql`${products.stock} - ${l.quantity}` })
        .where(eq(products.id, l.productId));
    }

    let paymentId: string | null = null;
    if (input.paymentMethod === "card") {
      const [payment] = await tx
        .insert(payments)
        .values({
          orderId: order.id,
          provider: process.env.PAYMENT_PROVIDER === "stripe" ? "stripe" : "mock",
          status: "pending",
          amountCents: order.totalCents,
        })
        .returning({ id: payments.id });
      paymentId = payment.id;
    }

    await audit(tx, { entity: "order", entityId: order.id, action: "created", toStatus: order.status, actor: "customer" });
    const mail = orderConfirmationEmail(order, items, baseUrl);
    await sendEmail(tx, order.email, mail.subject, mail.body, order.id);

    return { order, paymentId };
  });
}

async function restoreStock(tx: Tx, orderId: number) {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  for (const item of items) {
    await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${item.quantity}` })
      .where(eq(products.id, item.productId));
  }
}

/**
 * Moves an order to a new status inside an existing transaction.
 * Throws OrderError if the move is not allowed or someone else changed the order first.
 */
export async function transitionOrderTx(tx: Tx, orderId: number, to: OrderStatus, actor: string): Promise<Order> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new OrderError("Поръчката не съществува.");
  const from = order.status as OrderStatus;
  if (!canTransition(from, to)) throw new OrderError(`Поръчка в статус „${from}“ не може да стане „${to}“.`);

  const patch: Partial<Order> = { status: to };
  if (to === "shipped") patch.shippedAt = new Date();
  if (to === "delivered") patch.deliveredAt = new Date();

  // "AND status = from" makes the update fail if another request changed the order
  // a moment ago (two admins clicking at once, or a repeated webhook).
  const [updated] = await tx
    .update(orders)
    .set(patch)
    .where(and(eq(orders.id, orderId), eq(orders.status, from)))
    .returning();
  if (!updated) throw new OrderError("Поръчката току-що беше променена. Презареди страницата.");

  // Side effects of the new status.
  if (to === "payment_failed" || to === "returned" || to === "withdrawal_received") await restoreStock(tx, orderId);
  if (to === "cancelled" && from !== "payment_failed") await restoreStock(tx, orderId);
  if (to === "shipped") {
    const mail = shippedEmail(updated);
    await sendEmail(tx, updated.email, mail.subject, mail.body, updated.id);
  }
  if (to === "delivered" && updated.paymentMethod === "cod") {
    // With cash on delivery the courier collects the money and transfers it later.
    await tx.insert(payments).values({
      orderId,
      provider: "cod",
      status: "succeeded",
      amountCents: updated.totalCents,
    });
  }
  if (to === "withdrawal_received") {
    await tx.update(withdrawals).set({ goodsReceivedAt: new Date() }).where(eq(withdrawals.orderId, orderId));
  }
  if (to === "refunded") {
    await tx.update(withdrawals).set({ refundedAt: new Date() }).where(eq(withdrawals.orderId, orderId));
    await tx.update(payments).set({ status: "refunded", updatedAt: new Date() }).where(and(eq(payments.orderId, orderId), eq(payments.status, "succeeded")));
    const mail = refundEmail(updated);
    await sendEmail(tx, updated.email, mail.subject, mail.body, updated.id);
  }

  await audit(tx, { entity: "order", entityId: orderId, action: "status_changed", fromStatus: from, toStatus: to, actor });
  return updated;
}

export async function transitionOrder(orderId: number, to: OrderStatus, actor: string) {
  const db = await getDb();
  return db.transaction((tx) => transitionOrderTx(tx, orderId, to, actor));
}

/**
 * "Предадена на куриера": the parcel with its waybill left the shop.
 * The waybill itself is created earlier, from the order page (src/server/shipping/service.ts).
 */
export async function shipOrder(orderId: number, actor: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [active] = await tx
      .select()
      .from(shipments)
      .where(and(eq(shipments.orderId, orderId), isNull(shipments.cancelledAt)));
    if (!active?.trackingNumber) throw new OrderError("Първо създай товарителница (секцията „Товарителница“ по-долу).");
    return transitionOrderTx(tx, orderId, "shipped", actor);
  });
}

export async function getOrderByToken(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.publicToken, token));
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  return { order, items };
}

/** Finds an order only if the number AND the email match, so numbers alone reveal nothing. */
export async function findCustomerOrder(number: string, email: string) {
  const db = await getDb();
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.number, number.trim()), sql`lower(${orders.email}) = ${email.trim().toLowerCase()}`));
  return order ?? null;
}

export function withdrawalDeadline(order: Order): Date | null {
  if (!order.deliveredAt) return null; // not delivered yet: withdrawal is possible
  return new Date(order.deliveredAt.getTime() + SHOP.withdrawalDays * 24 * 60 * 60 * 1000);
}

export function canWithdraw(order: Order, now = new Date()): boolean {
  if (!WITHDRAWABLE.includes(order.status as OrderStatus)) return false;
  const deadline = withdrawalDeadline(order);
  return deadline === null || now <= deadline;
}

export async function requestWithdrawal(input: { number: string; email: string; customerName: string; reason: string | null }) {
  const order = await findCustomerOrder(input.number, input.email);
  if (!order) throw new OrderError("Не намерихме поръчка с този номер и имейл. Провери ги в имейла с потвърждението.");
  if (!canWithdraw(order)) {
    throw new OrderError("За тази поръчка вече няма активен срок за отказ или отказът вече е заявен. Пиши ни, ако мислиш, че е грешка.");
  }

  const db = await getDb();
  return db.transaction(async (tx) => {
    const [withdrawal] = await tx
      .insert(withdrawals)
      .values({ orderId: order.id, customerName: input.customerName, contactEmail: input.email, reason: input.reason })
      .returning();
    const updated = await transitionOrderTx(tx, order.id, "withdrawal_requested", "customer");
    const mail = withdrawalAcknowledgmentEmail(updated, input.customerName, withdrawal.requestedAt, input.reason);
    await sendEmail(tx, input.email, mail.subject, mail.body, order.id);
    return { order: updated, requestedAt: withdrawal.requestedAt };
  });
}
