import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditLog, emails, orderItems, orders, payments, products } from "@/db/schema";
import { LampArt } from "@/components/LampArt";
import { OrderActions } from "@/components/OrderActions";
import { StatusPill } from "@/components/admin/StatusPill";
import { CreateShipmentForm, ShippingButton } from "@/components/admin/ShippingForms";
import { cancelShipmentAction, createShipmentAction, refreshTrackingAction } from "@/app/actions/shipping";
import { getCourier, MODE_LABEL, MODE_NOTE, type CourierMode } from "@/server/shipping";
import { publicTrackingUrl } from "@/server/shipping/config";
import { activeShipment, getOrderShipments, suggestedParcel } from "@/server/shipping/service";
import { formatDateTime } from "@/lib/dates";
import { formatEur } from "@/lib/money";
import { adminTransitions, ORDER_STATUS, type OrderStatus } from "@/lib/order-status";
import { COURIERS, DELIVERY_TYPES, PAYMENT_METHODS, type CourierId, type DeliveryType, type PaymentMethod } from "@/lib/settings";
import { requireAdmin } from "@/server/auth";

const PAYMENT_STATUS: Record<string, string> = { pending: "чака", succeeded: "успешно", failed: "неуспешно", refunded: "върнато" };
const ACTOR: Record<string, string> = {
  customer: "клиент",
  admin: "админ",
  seed: "демо данни",
  "webhook:mock": "webhook от тестовия доставчик",
  "webhook:stripe": "webhook от Stripe",
  "courier:econt": "Еконт, при проверка на статуса",
  "courier:speedy": "Спиди, при проверка на статуса",
};

function money(cents: number, currency: string | null) {
  if (!currency || currency === "EUR" || currency === "€") return formatEur(cents);
  return `${(cents / 100).toFixed(2).replace(".", ",")} ${currency}`;
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) notFound();

  const [items, paymentRows, log, mails, shipmentRows, parcel] = await Promise.all([
    db
      .select({ item: orderItems, illustration: products.illustration })
      .from(orderItems)
      .leftJoin(products, eq(products.id, orderItems.productId))
      .where(eq(orderItems.orderId, id)),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.createdAt)),
    db.select().from(auditLog).where(and(eq(auditLog.entity, "order"), eq(auditLog.entityId, String(id)))).orderBy(asc(auditLog.createdAt)),
    db.select().from(emails).where(eq(emails.orderId, id)).orderBy(asc(emails.createdAt)),
    getOrderShipments(id),
    suggestedParcel(id),
  ]);

  const status = order.status as OrderStatus;
  const courier = order.courier as CourierId;
  const active = activeShipment(shipmentRows);
  const cancelled = shipmentRows.filter((s) => s.cancelledAt);
  // The courier settings can be wrong (for example SPEEDY_MODE=live without a password); show that instead of crashing.
  let mode: CourierMode | null = null;
  let modeError: string | null = null;
  try {
    mode = getCourier(courier).mode;
  } catch (error) {
    modeError = error instanceof Error ? error.message : String(error);
  }
  const trackingUrl = active?.trackingNumber && active.mode === "live" ? publicTrackingUrl(courier, active.trackingNumber) : null;

  return (
    <>
      <Link href="/admin/poruchki" className="text-sm font-semibold text-adm-blue hover:underline">Всички поръчки</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-[2rem] font-extrabold tracking-tight">Поръчка {order.number}</h1>
        <span data-testid="order-status"><StatusPill status={order.status} /></span>
      </div>
      <p className="mt-1 text-sm text-adm-muted">{formatDateTime(order.createdAt)}</p>

      <section className="adm-card mt-6 p-5 sm:p-6" aria-labelledby="next">
        <h2 id="next" className="text-lg font-extrabold">Следваща стъпка</h2>
        <div className="mt-4">
          <OrderActions orderId={order.id} from={order.status} allowed={adminTransitions(status)} />
        </div>
        {status === "pending_payment" && (
          <p className="mt-3 text-sm text-adm-muted">Плащането с карта се потвърждава само от доставчика чрез webhook. Ръчно не може да се маркира като платена.</p>
        )}
      </section>

      <section className="adm-card mt-6 p-5 text-sm sm:p-6" aria-labelledby="waybill">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="waybill" className="text-lg font-extrabold">Товарителница</h2>
          {mode && (
            <span className="rounded-full bg-adm-blue-soft px-3 py-1 text-xs font-bold text-adm-blue">
              {COURIERS[courier]}: {MODE_LABEL[mode]}
            </span>
          )}
        </div>
        {modeError && <p role="alert" className="mt-3 font-semibold text-adm-down">{modeError}</p>}

        {active ? (
          <div className="mt-4 space-y-4">
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
              <dt className="text-adm-muted">Номер</dt>
              <dd className="font-bold tabular" data-testid="tracking-number">{active.trackingNumber ?? "създава се..."}</dd>
              <dt className="text-adm-muted">Статус при куриера</dt>
              <dd data-testid="courier-status">
                {active.statusText ?? "няма информация"}
                {active.lastCheckedAt && <span className="text-adm-muted">, проверено {formatDateTime(active.lastCheckedAt)}</span>}
              </dd>
              <dt className="text-adm-muted">Тегло</dt>
              <dd className="tabular">{(active.weightGrams / 1000).toFixed(2).replace(".", ",")} кг</dd>
              {active.costCents !== null && (
                <>
                  <dt className="text-adm-muted">Куриерът таксува магазина</dt>
                  <dd className="tabular">
                    {money(active.costCents, active.costCurrency)}
                    <span className="text-adm-muted"> (клиентът плати {formatEur(order.shippingCents + order.codFeeCents)} за доставка и наложен платеж)</span>
                  </dd>
                </>
              )}
            </dl>
            <div className="flex flex-wrap items-start gap-2">
              {active.trackingNumber && (
                <a href={`/admin/etiket/${active.id}`} target="_blank" rel="noopener" className="adm-btn">Етикет за печат</a>
              )}
              {trackingUrl && (
                <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="adm-btn-ghost">Виж при куриера</a>
              )}
              <ShippingButton action={refreshTrackingAction} fields={{ orderId: order.id }} label="Провери статуса" pendingText="Питаме куриера..." ghost />
              {status === "packed" && (
                <ShippingButton action={cancelShipmentAction} fields={{ orderId: order.id }} label="Анулирай товарителницата" pendingText="Анулираме..." ghost />
              )}
            </div>
            {active.events.length > 0 && (
              <ol className="space-y-1.5 border-l-2 border-adm-line pl-4">
                {active.events.map((e, i) => (
                  <li key={i}>
                    {e.text}
                    <span className="block text-xs text-adm-muted">
                      {formatDateTime(new Date(e.time))}
                      {e.place ? `, ${e.place}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ) : status === "confirmed" || status === "packed" ? (
          <div className="mt-4">
            <CreateShipmentForm
              action={createShipmentAction}
              orderId={order.id}
              weightKg={(parcel.weightGrams / 1000).toFixed(2).replace(".", ",")}
              description={parcel.description}
              buttonLabel={`Създай товарителница в ${COURIERS[courier]}`}
            />
            <p className="mt-3 text-xs text-adm-muted">
              Теглото е сборът от теглата на продуктите. {order.paymentMethod === "cod" ? `Наложен платеж: куриерът ще събере ${formatEur(order.totalCents)}.` : "Платено с карта: без наложен платеж."}
            </p>
          </div>
        ) : (
          <p className="mt-4 text-adm-muted">
            {active === null && ["shipped", "delivered", "refused", "returned"].includes(status)
              ? `Пратката е изпратена преди връзката с куриерите${order.trackingNumber ? ` (номер ${order.trackingNumber})` : ""}.`
              : "Товарителница се създава, когато поръчката е потвърдена."}
          </p>
        )}

        {mode && <p className="mt-4 text-xs text-adm-muted">{MODE_NOTE[mode]}</p>}
        {cancelled.length > 0 && (
          <p className="mt-2 text-xs text-adm-muted">Анулирани: {cancelled.map((c) => c.trackingNumber).join(", ")}</p>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="adm-card p-5 sm:p-6">
          <h2 className="text-lg font-extrabold">Продукти</h2>
          <ul className="mt-4 space-y-3">
            {items.map(({ item, illustration }) => (
              <li key={item.id} className="flex items-center gap-3">
                <span className="glow-plate size-11 shrink-0 rounded-xl p-1.5"><LampArt kind={illustration ?? "clip"} className="h-full w-full" /></span>
                <span className="flex-1 text-sm">
                  <span className="block font-bold">{item.productName}</span>
                  <span className="text-adm-muted tabular">{item.quantity} x {formatEur(item.unitPriceCents)}</span>
                </span>
                <span className="font-bold tabular">{formatEur(item.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-adm-line pt-4 text-sm tabular">
            <div className="flex justify-between"><dt>Доставка</dt><dd>{formatEur(order.shippingCents)}</dd></div>
            <div className="flex justify-between"><dt>Такса наложен платеж</dt><dd>{formatEur(order.codFeeCents)}</dd></div>
            <div className="flex justify-between text-base font-extrabold"><dt>Общо</dt><dd>{formatEur(order.totalCents)}</dd></div>
            <div className="flex justify-between text-adm-muted"><dt>в т.ч. ДДС</dt><dd>{formatEur(order.vatCents)}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-adm-muted">Цените са записани в момента на поръчката и не се променят, ако после смениш цената на продукта.</p>
        </section>

        <section className="adm-card p-5 text-sm sm:p-6">
          <h2 className="text-lg font-extrabold">Клиент и доставка</h2>
          <p className="mt-4 font-bold">{order.customerName}</p>
          <p><a href={`tel:${order.phone}`} className="text-adm-blue hover:underline">{order.phone}</a></p>
          <p><a href={`mailto:${order.email}`} className="text-adm-blue hover:underline">{order.email}</a></p>
          <p className="mt-4">
            {COURIERS[order.courier as CourierId]}, {DELIVERY_TYPES[order.deliveryType as DeliveryType].toLowerCase()}: {order.deliveryLabel}
          </p>
          <p className="mt-4">Плащане: {PAYMENT_METHODS[order.paymentMethod as PaymentMethod]}</p>
          <p className="mt-1 text-adm-muted">Съгласие за маркетингови имейли: {order.marketingConsent ? "да" : "не"}</p>
        </section>

        <section className="adm-card p-5 text-sm sm:p-6">
          <h2 className="text-lg font-extrabold">Плащания</h2>
          {paymentRows.length === 0 ? (
            <p className="mt-4 text-adm-muted">Няма плащания. При наложен платеж се записва, когато пратката е доставена.</p>
          ) : (
            <ul className="mt-4 space-y-1.5">
              {paymentRows.map((p) => (
                <li key={p.id} className="tabular">
                  {p.provider === "cod" ? "Наложен платеж" : p.provider === "mock" ? "Тестов доставчик" : "Stripe"}: {formatEur(p.amountCents)}, {PAYMENT_STATUS[p.status] ?? p.status}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="adm-card p-5 text-sm sm:p-6">
          <h2 className="text-lg font-extrabold">История</h2>
          <ol className="mt-4 space-y-2 border-l-2 border-adm-line pl-4">
            {log.map((entry) => (
              <li key={entry.id} className="tabular">
                <span className="font-semibold">{entry.toStatus ? ORDER_STATUS[entry.toStatus as OrderStatus] : entry.action}</span>
                <span className="block text-xs text-adm-muted">{formatDateTime(entry.createdAt)}, {ACTOR[entry.actor] ?? entry.actor}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="adm-card mt-6 p-5 text-sm sm:p-6">
        <h2 className="text-lg font-extrabold">Имейли към клиента</h2>
        {mails.length === 0 ? (
          <p className="mt-4 text-adm-muted">Няма изпратени имейли.</p>
        ) : (
          <ul className="mt-3 divide-y divide-adm-line">
            {mails.map((m) => (
              <li key={m.id} className="py-2.5">
                <details>
                  <summary className="cursor-pointer font-semibold">{m.subject} <span className="font-normal text-adm-muted">{formatDateTime(m.createdAt)}</span></summary>
                  <pre className="mt-2 whitespace-pre-wrap font-[inherit] text-adm-muted">{m.body}</pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
