/**
 * What happens when a payment provider tells us a payment succeeded or failed.
 * Used by both webhooks (the built-in test provider and Stripe).
 *
 * The order of checks matters:
 * 1. Store the event id. If it is already stored, this is a repeat: do nothing.
 * 2. Find our payment record. The amount must match what we asked for.
 * 3. Only a "pending" payment can change, and the order moves through the state machine.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders, payments, webhookEvents } from "@/db/schema";
import { audit } from "../audit";
import { deliverEmails, paymentReceivedEmail, sendEmail } from "../email";
import { transitionOrderTx } from "../orders";

export type PaymentEvent = {
  provider: "mock" | "stripe";
  eventId: string;
  outcome: "succeeded" | "failed";
  paymentId: string;
  amountCents: number | null;
  payload: unknown;
};

export type PaymentEventResult = "processed" | "duplicate" | "unknown_payment" | "already_final" | "amount_mismatch";

export async function handlePaymentEvent(event: PaymentEvent): Promise<PaymentEventResult> {
  const db = await getDb();
  const result = await db.transaction(async (tx): Promise<PaymentEventResult> => {
    const inserted = await tx
      .insert(webhookEvents)
      .values({ provider: event.provider, eventId: event.eventId, type: event.outcome, payload: event.payload })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });
    if (inserted.length === 0) return "duplicate";

    const [payment] = await tx.select().from(payments).where(eq(payments.id, event.paymentId));
    if (!payment || payment.provider !== event.provider) return "unknown_payment";
    if (payment.status !== "pending") return "already_final";

    if (event.outcome === "succeeded" && event.amountCents !== payment.amountCents) {
      await audit(tx, {
        entity: "payment",
        entityId: payment.id,
        action: `amount_mismatch: expected ${payment.amountCents}, got ${event.amountCents}`,
        actor: `webhook:${event.provider}`,
      });
      return "amount_mismatch";
    }

    await tx
      .update(payments)
      .set({ status: event.outcome, updatedAt: new Date() })
      .where(eq(payments.id, payment.id));

    const actor = `webhook:${event.provider}`;
    if (event.outcome === "succeeded") {
      const order = await transitionOrderTx(tx, payment.orderId, "confirmed", actor);
      const mail = paymentReceivedEmail(order);
      await sendEmail(tx, order.email, mail.subject, mail.body, order.id);
    } else {
      const [order] = await tx.select().from(orders).where(eq(orders.id, payment.orderId));
      if (order?.status === "pending_payment") await transitionOrderTx(tx, payment.orderId, "payment_failed", actor);
    }
    return "processed";
  });
  if (result === "processed") await deliverEmails();
  return result;
}
