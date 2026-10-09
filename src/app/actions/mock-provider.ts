"use server";
/**
 * This action plays the role of the payment provider's server.
 * In real life this code runs at Stripe or the bank, not in your shop.
 * It sends a signed webhook to our shop, then sends the customer back.
 */
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders, payments } from "@/db/schema";
import { getBaseUrl } from "@/server/base-url";
import { signMockPayload, type MockEvent } from "@/server/payments/mock";

export async function mockProviderAction(formData: FormData) {
  const paymentId = String(formData.get("paymentId") ?? "");
  const outcome = formData.get("outcome") === "succeeded" ? "succeeded" : "failed";

  const db = await getDb();
  const [row] = await db
    .select({ payment: payments, token: orders.publicToken })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(eq(payments.id, paymentId));
  if (!row) redirect("/");

  if (row.payment.status === "pending") {
    const event: MockEvent = {
      id: `evt_${crypto.randomUUID()}`,
      type: outcome === "succeeded" ? "payment.succeeded" : "payment.failed",
      data: { paymentId, amountCents: row.payment.amountCents },
    };
    const body = JSON.stringify(event);
    const baseUrl = await getBaseUrl();
    // A real HTTP call to our own webhook, exactly like the provider would make.
    const response = await fetch(`${baseUrl}/api/payments/mock-webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-mock-signature": signMockPayload(body) },
      body,
    });
    if (!response.ok) throw new Error(`Webhook failed with ${response.status}`);
  }

  redirect(`/poruchka/blagodarim/${row.token}`);
}
