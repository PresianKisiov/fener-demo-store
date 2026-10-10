/**
 * Emails, in two steps (the "outbox" pattern):
 *
 * 1. sendEmail() only WRITES the email into the `emails` table, inside the same
 *    transaction as the order change. If that transaction fails, the email is gone
 *    too, so a customer never gets "order accepted" for an order that was not saved.
 * 2. deliverEmails() runs right after the transaction is saved and sends what is
 *    waiting, through Resend. A failure leaves the email "pending" for the next try.
 *
 * Without RESEND_API_KEY nothing is sent: emails are only stored (status "demo")
 * and readable in the admin panel, like before.
 *
 * Setup for real sending: an account at resend.com, your domain verified there
 * (DNS records), then RESEND_API_KEY and EMAIL_FROM="Фенер <poruchki@yourdomain.bg>".
 */
import "server-only";
import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { DB, Tx } from "@/db/types";
import { emails, type Order, type OrderItem } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { formatEur } from "@/lib/money";
import { COURIERS, PAYMENT_METHODS, SHOP, type CourierId, type PaymentMethod } from "@/lib/settings";
import { courierMode, publicTrackingUrl } from "./shipping/config";

const MAX_ATTEMPTS = 5;

export function emailProviderConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(db: DB | Tx, to: string, subject: string, body: string, orderId?: number) {
  await db.insert(emails).values({ toAddress: to, subject, body, orderId, status: emailProviderConfigured() ? "pending" : "demo" });
}

/**
 * Sends one email through Resend's HTTP API. Returns Resend's id for the message.
 * The Idempotency-Key makes a repeat of the same email (after a crash between "Resend
 * accepted it" and "we saved that") a no-op at Resend instead of a second email.
 */
async function sendViaResend(emailId: number, to: string, subject: string, text: string, timeoutMs: number): Promise<string> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `fener-email-${emailId}`,
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, reply_to: SHOP.trader.email }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await response.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!response.ok || !json.id) throw new Error(json.message ?? `Resend HTTP ${response.status}`);
  return json.id;
}

/**
 * Sends the emails waiting in the outbox. Called right after every saved change that
 * writes an email, and every hour by the scheduled job (/api/cron).
 *
 * Never throws, and stops after `budgetMs`: the customer is waiting for the thank-you
 * page, and a slow email provider must not make a placed order look failed (they would
 * order again). Whatever is left stays "pending" for the next run (up to 5 tries).
 */
export async function deliverEmails({ limit = 20, budgetMs = 3000 }: { limit?: number; budgetMs?: number } = {}): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  if (!emailProviderConfigured()) return result;
  const deadline = Date.now() + budgetMs;
  try {
    const db = await getDb();
    // An email stuck in "sending" (the server stopped mid-send) goes back to the queue after 5 minutes,
    // or to "failed" when it already used all its tries.
    const stuck = and(eq(emails.status, "sending"), lt(emails.claimedAt, new Date(Date.now() - 5 * 60_000)));
    await db.update(emails).set({ status: "failed", lastError: "Прекъснато изпращане" }).where(and(stuck, gte(emails.attempts, MAX_ATTEMPTS)));
    await db.update(emails).set({ status: "pending" }).where(stuck);
    const waiting = await db.select().from(emails).where(eq(emails.status, "pending")).orderBy(asc(emails.id)).limit(limit);
    for (const mail of waiting) {
      const left = deadline - Date.now();
      if (left < 500) break;
      // Claim it first: two requests finishing at the same moment must not send it twice.
      // The attempt is counted here, so a send that keeps getting cut off still stops after 5 tries.
      const attempts = mail.attempts + 1;
      const [claimed] = await db
        .update(emails)
        .set({ status: "sending", claimedAt: new Date(), attempts })
        .where(and(eq(emails.id, mail.id), eq(emails.status, "pending")))
        .returning({ id: emails.id });
      if (!claimed) continue;
      try {
        const providerId = await sendViaResend(mail.id, mail.toAddress, mail.subject, mail.body, Math.min(left, 8000));
        await db.update(emails).set({ status: "sent", providerId, sentAt: new Date(), lastError: null }).where(eq(emails.id, mail.id));
        result.sent++;
      } catch (error) {
        await db
          .update(emails)
          .set({ status: attempts >= MAX_ATTEMPTS ? "failed" : "pending", lastError: error instanceof Error ? error.message.slice(0, 500) : String(error) })
          .where(eq(emails.id, mail.id));
        result.failed++;
      }
    }
  } catch (error) {
    console.error("[email] delivery stopped:", error);
  }
  return result;
}

/** Admin button: put failed emails back in the queue and send everything that waits. */
export async function retryFailedEmails() {
  const db = await getDb();
  await db.update(emails).set({ status: "pending", attempts: 0 }).where(inArray(emails.status, ["failed"]));
  return deliverEmails({ limit: 50, budgetMs: 20_000 });
}

const signature = `\n\n${SHOP.name}\n${SHOP.trader.company}, ЕИК ${SHOP.trader.eik}\n${SHOP.trader.address}\n${SHOP.trader.email}, ${SHOP.trader.phone}`;

function itemsBlock(items: OrderItem[]) {
  return items.map((i) => `- ${i.productName} x ${i.quantity}: ${formatEur(i.lineTotalCents)}`).join("\n");
}

export function orderConfirmationEmail(order: Order, items: OrderItem[], baseUrl: string) {
  const payment = PAYMENT_METHODS[order.paymentMethod as PaymentMethod];
  return {
    subject: `Поръчка ${order.number} е приета`,
    body: `Здравей, ${order.customerName}!

Получихме поръчка ${order.number} от ${formatDateTime(order.createdAt)}.

${itemsBlock(items)}

Доставка: ${formatEur(order.shippingCents)}${order.codFeeCents ? `\nТакса наложен платеж: ${formatEur(order.codFeeCents)}` : ""}
Общо: ${formatEur(order.totalCents)} (в т.ч. ДДС ${formatEur(order.vatCents)})
Плащане: ${payment}
Доставка с ${COURIERS[order.courier as CourierId]}: ${order.deliveryLabel}

Право на отказ: можеш да се откажеш от договора в срок от ${SHOP.withdrawalDays} дни от получаването на стоката, без да посочваш причина.
Отказ от договора: ${baseUrl}/otkaz
Общи условия: ${baseUrl}/usloviya
Проследяване: ${baseUrl}/prosledyavane${signature}`,
  };
}

export function paymentReceivedEmail(order: Order) {
  return {
    subject: `Плащането за поръчка ${order.number} е получено`,
    body: `Здравей, ${order.customerName}!\n\nПолучихме плащането от ${formatEur(order.totalCents)} за поръчка ${order.number}. Ще ти пишем, когато пратката тръгне.${signature}`,
  };
}

export function shippedEmail(order: Order) {
  // A link to the courier's public tracking page works only for real (live) waybills.
  let link = "";
  try {
    if (order.trackingNumber && courierMode(order.courier as CourierId) === "live") {
      link = `\nПроследи пратката: ${publicTrackingUrl(order.courier, order.trackingNumber)}`;
    }
  } catch {
    // Wrong courier settings must not stop the email.
  }
  return {
    subject: `Поръчка ${order.number} е изпратена`,
    body: `Здравей, ${order.customerName}!\n\nПоръчка ${order.number} е предадена на ${COURIERS[order.courier as CourierId]}.\nНомер на товарителницата: ${order.trackingNumber}${link}\nДоставка: ${order.deliveryLabel}${signature}`,
  };
}

export function withdrawalAcknowledgmentEmail(order: Order, customerName: string, requestedAt: Date, reason: string | null) {
  return {
    subject: `Потвърждение за отказ от договор, поръчка ${order.number}`,
    body: `Здравей, ${customerName}!

Получихме отказа ти от договора.

Поръчка: ${order.number}
Дата и час на отказа: ${formatDateTime(requestedAt)}
Причина: ${reason || "не е посочена (не е задължително)"}

Какво следва: изпрати стоката обратно на адрес ${SHOP.trader.address} в срок от 14 дни. Ще върнем ${formatEur(order.totalCents)}, включително стандартната доставка, до 14 дни от днес. Можем да изчакаме, докато получим стоката или докажеш, че си я изпратил.${signature}`,
  };
}

export function refundEmail(order: Order) {
  return {
    subject: `Върнахме парите за поръчка ${order.number}`,
    body: `Здравей, ${order.customerName}!\n\nВърнахме ${formatEur(order.totalCents)} за поръчка ${order.number}.${signature}`,
  };
}
