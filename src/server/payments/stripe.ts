/**
 * Stripe Checkout. Used when PAYMENT_PROVIDER=stripe and the keys are set.
 * Same flow as the test provider: redirect to Stripe, Stripe calls our webhook,
 * the webhook confirms the order.
 *
 * Not exercised by the demo tests (it needs your Stripe test keys). To try it:
 * 1. Stripe dashboard (test mode): copy the secret key to STRIPE_SECRET_KEY.
 * 2. Run `stripe listen --forward-to localhost:3000/api/payments/stripe-webhook`
 *    and copy the printed signing secret to STRIPE_WEBHOOK_SECRET.
 * 3. Set PAYMENT_PROVIDER=stripe and restart `npm run dev`.
 */
import "server-only";
import Stripe from "stripe";
import type { Order } from "@/db/schema";
import type { PaymentEvent } from "./handle-event";

let client: Stripe | null = null;
function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(key);
  return client;
}

export async function createStripeCheckout(paymentId: string, order: Order, baseUrl: string) {
  const returnUrl = `${baseUrl}/poruchka/blagodarim/${order.publicToken}`;
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    client_reference_id: paymentId,
    customer_email: order.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: order.totalCents,
          product_data: { name: `Поръчка ${order.number}` },
        },
      },
    ],
    metadata: { paymentId, orderNumber: order.number },
    success_url: returnUrl,
    cancel_url: returnUrl,
  });
  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { redirectUrl: session.url, providerRef: session.id };
}

/** Verifies the Stripe-Signature header and turns the event into our PaymentEvent, or null if we do not care about it. */
export function parseStripeWebhook(rawBody: string, signature: string | null): PaymentEvent | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) throw new Error("Missing Stripe webhook secret or signature");
  const event = stripe().webhooks.constructEvent(rawBody, signature, secret);

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded" ||
    event.type === "checkout.session.async_payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object;
    const paymentId = session.client_reference_id;
    if (!paymentId) return null;
    const succeeded =
      event.type === "checkout.session.async_payment_succeeded" ||
      (event.type === "checkout.session.completed" && session.payment_status === "paid");
    const failed = event.type === "checkout.session.async_payment_failed" || event.type === "checkout.session.expired";
    if (!succeeded && !failed) return null; // e.g. completed but bank transfer still pending
    return {
      provider: "stripe",
      eventId: event.id,
      outcome: succeeded ? "succeeded" : "failed",
      paymentId,
      amountCents: session.amount_total,
      payload: event,
    };
  }
  return null;
}
