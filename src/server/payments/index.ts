/**
 * Starts a card payment with whichever provider is configured.
 * Returns the URL where the customer should be sent to pay.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { payments, type Order } from "@/db/schema";
import { mockCheckoutUrl } from "./mock";
import { createStripeCheckout } from "./stripe";

export async function startCardPayment(paymentId: string, order: Order, baseUrl: string): Promise<string> {
  if (process.env.PAYMENT_PROVIDER === "stripe") {
    const { redirectUrl, providerRef } = await createStripeCheckout(paymentId, order, baseUrl);
    const db = await getDb();
    await db.update(payments).set({ providerRef }).where(eq(payments.id, paymentId));
    return redirectUrl;
  }
  return mockCheckoutUrl(baseUrl, paymentId);
}
