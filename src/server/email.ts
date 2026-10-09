/**
 * Emails. In the demo, sendEmail() writes to the `emails` table (the "outbox")
 * and you can read them in the admin panel. In a real store, this is the only
 * function that changes: it would call Resend or Postmark here.
 */
import "server-only";
import type { DB, Tx } from "@/db/types";
import { emails, type Order, type OrderItem } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { formatEur } from "@/lib/money";
import { COURIERS, PAYMENT_METHODS, SHOP, type CourierId, type PaymentMethod } from "@/lib/settings";

export async function sendEmail(db: DB | Tx, to: string, subject: string, body: string, orderId?: number) {
  await db.insert(emails).values({ toAddress: to, subject, body, orderId });
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
  return {
    subject: `Поръчка ${order.number} е изпратена`,
    body: `Здравей, ${order.customerName}!\n\nПоръчка ${order.number} е предадена на ${COURIERS[order.courier as CourierId]}.\nНомер на товарителницата: ${order.trackingNumber}\nДоставка: ${order.deliveryLabel}${signature}`,
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
