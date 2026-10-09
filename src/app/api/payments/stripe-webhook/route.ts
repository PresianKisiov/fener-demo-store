/**
 * Webhook for Stripe. Configure it in the Stripe dashboard or with `stripe listen`.
 */
import { handlePaymentEvent } from "@/server/payments/handle-event";
import { parseStripeWebhook } from "@/server/payments/stripe";

export async function POST(request: Request) {
  const raw = await request.text();
  let event;
  try {
    event = parseStripeWebhook(raw, request.headers.get("stripe-signature"));
  } catch {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }
  if (!event) return Response.json({ result: "ignored" });
  const result = await handlePaymentEvent(event);
  return Response.json({ result });
}
