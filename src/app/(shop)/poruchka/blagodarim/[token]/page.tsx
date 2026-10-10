import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MetaPurchase } from "@/components/MetaPixel";
import { REVENUE_STATUSES, type OrderStatus } from "@/lib/order-status";
import { formatEur } from "@/lib/money";
import { COURIERS, PAYMENT_METHODS, SHOP, type CourierId, type PaymentMethod } from "@/lib/settings";
import { addWorkingDays, formatDayRange } from "@/lib/dates";
import { getOrderByToken } from "@/server/orders";

export const metadata: Metadata = { title: "Благодарим" };

export default async function ThankYouPage({ params }: { params: Promise<{ token: string }> }) {
  const data = await getOrderByToken((await params).token);
  if (!data) notFound();
  const { order, items } = data;

  const delivery = formatDayRange(
    addWorkingDays(order.createdAt, SHOP.deliveryWorkingDays.min),
    addWorkingDays(order.createdAt, SHOP.deliveryWorkingDays.max),
  );

  const heading =
    order.status === "pending_payment"
      ? "Чакаме потвърждение на плащането"
      : order.status === "payment_failed"
        ? "Плащането не мина"
        : "Поръчката е приета";

  return (
    <div className="mx-auto max-w-2xl py-8">
      {order.status === "pending_payment" && <AutoRefresh seconds={2} />}
      {REVENUE_STATUSES.includes(order.status as OrderStatus) && (
        <MetaPurchase
          token={order.publicToken}
          eventId={`order-${order.number}`}
          params={{
            currency: "EUR",
            value: order.totalCents / 100,
            content_type: "product",
            content_ids: items.map((i) => String(i.productId)),
            num_items: items.reduce((sum, i) => sum + i.quantity, 0),
          }}
        />
      )}
      <p className="text-ink-soft">Поръчка {order.number}</p>
      <h1 className="mt-1 font-display text-3xl font-medium sm:text-4xl" data-testid="thank-you-heading">{heading}</h1>

      {order.status === "payment_failed" ? (
        <p className="mt-4">
          Картата не беше таксувана. Можеш да поръчаш отново с наложен платеж или да ни пишеш на {SHOP.trader.email}.
        </p>
      ) : order.status === "pending_payment" ? (
        <p className="mt-4">Страницата ще се обнови сама, щом банката потвърди. Обикновено отнема няколко секунди.</p>
      ) : (
        <p className="mt-4">
          Изпратихме потвърждение на <span className="font-semibold">{order.email}</span>. Очаквай пратката{" "}
          <span className="font-semibold">{delivery}</span>.
        </p>
      )}

      <dl className="mt-8 divide-y divide-line rounded-3xl bg-white px-6">
        {items.map((i) => (
          <div key={i.id} className="tabular flex justify-between gap-4 py-3">
            <dt>{i.productName} x {i.quantity}</dt>
            <dd>{formatEur(i.lineTotalCents)}</dd>
          </div>
        ))}
        <div className="tabular flex justify-between gap-4 py-3">
          <dt>Доставка</dt>
          <dd>{order.shippingCents === 0 ? "безплатно" : formatEur(order.shippingCents)}</dd>
        </div>
        {order.codFeeCents > 0 && (
          <div className="tabular flex justify-between gap-4 py-3">
            <dt>Такса наложен платеж</dt>
            <dd>{formatEur(order.codFeeCents)}</dd>
          </div>
        )}
        <div className="tabular flex justify-between gap-4 py-3 text-lg font-semibold">
          <dt>Общо</dt>
          <dd>{formatEur(order.totalCents)}</dd>
        </div>
        <div className="py-3 text-sm text-ink-soft">
          {PAYMENT_METHODS[order.paymentMethod as PaymentMethod]}. {COURIERS[order.courier as CourierId]}: {order.deliveryLabel}
        </div>
      </dl>

      <p className="mt-8 text-sm text-ink-soft">
        Можеш да проследиш поръчката от страницата <Link href="/prosledyavane" className="underline">Проследяване</Link> с номера и имейла си.
      </p>
      <Link href="/katalog" className="btn-secondary mt-6">Обратно към лампите</Link>
    </div>
  );
}
