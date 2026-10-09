/**
 * Webhook for the built-in test payment provider.
 * The provider (not the customer's browser) calls this URL after a payment.
 */
import { handlePaymentEvent } from "@/server/payments/handle-event";
import { verifyMockSignature, type MockEvent } from "@/server/payments/mock";

export async function POST(request: Request) {
  // Read the raw text: the signature is calculated over the exact bytes.
  const raw = await request.text();
  if (!verifyMockSignature(raw, request.headers.get("x-mock-signature"))) {
    return Response.json({ error: "invalid_signature" }, { status: 400 });
  }

  const event = JSON.parse(raw) as MockEvent;
  const result = await handlePaymentEvent({
    provider: "mock",
    eventId: event.id,
    outcome: event.type === "payment.succeeded" ? "succeeded" : "failed",
    paymentId: event.data.paymentId,
    amountCents: event.data.amountCents,
    payload: event,
  });

  // Always answer 200 for events we understood, even duplicates, so the provider stops retrying.
  return Response.json({ result });
}
