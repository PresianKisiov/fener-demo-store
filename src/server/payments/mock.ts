/**
 * Built-in test payment provider. It imitates how Stripe and Bulgarian card
 * gateways work, so you can see every step without an account:
 *
 * 1. Our server creates a payment (status "pending") and sends the customer to
 *    the provider's page (/test-plashtane/<paymentId>).
 * 2. The customer pays or cancels on that page.
 * 3. The provider calls our webhook (/api/payments/mock-webhook) with a signed message.
 * 4. Our webhook checks the signature and only then marks the order as paid.
 *
 * The redirect back to the shop is NOT proof of payment. Only the signed webhook is.
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 300;

function webhookSecret(): string {
  return process.env.MOCK_WEBHOOK_SECRET || "mock-webhook-secret-dev";
}

export function mockCheckoutUrl(baseUrl: string, paymentId: string): string {
  return `${baseUrl}/test-plashtane/${paymentId}`;
}

/** Header value "t=<unix seconds>,v1=<hmac>", same idea as Stripe-Signature. */
export function signMockPayload(body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const mac = createHmac("sha256", webhookSecret()).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

export function verifyMockSignature(body: string, header: string | null, now = Math.floor(Date.now() / 1000)): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", webhookSecret()).update(`${timestamp}.${body}`).digest("hex");
  const given = Buffer.from(parts.v1 ?? "", "utf8");
  const wanted = Buffer.from(expected, "utf8");
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export type MockEvent = {
  id: string;
  type: "payment.succeeded" | "payment.failed";
  data: { paymentId: string; amountCents: number };
};
