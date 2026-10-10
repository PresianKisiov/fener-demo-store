import type { Metadata } from "next";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders, shipments } from "@/db/schema";
import { refreshTrackingAction, syncOfficesAction } from "@/app/actions/shipping";
import { ShippingButton } from "@/components/admin/ShippingForms";
import { formatDateTime } from "@/lib/dates";
import { COURIERS, type CourierId } from "@/lib/settings";
import { requireAdmin } from "@/server/auth";
import { officeStats } from "@/server/couriers";
import { getCourier, MODE_LABEL, MODE_NOTE } from "@/server/shipping";
import { econtConfig, senderConfig } from "@/server/shipping/config";

export const metadata: Metadata = { title: "Куриери" };

function describe(courier: CourierId) {
  try {
    const mode = getCourier(courier).mode;
    return { mode, error: null };
  } catch (error) {
    return { mode: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export default async function CouriersPage() {
  await requireAdmin();
  const db = await getDb();
  const [stats, [active]] = await Promise.all([
    officeStats(),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(shipments)
      .innerJoin(orders, eq(orders.id, shipments.orderId))
      .where(and(isNull(shipments.cancelledAt), inArray(orders.status, ["packed", "shipped"]))),
  ]);
  const sender = senderConfig();

  return (
    <>
      <h1 className="text-[2rem] font-extrabold tracking-tight">Куриери</h1>
      <p className="mt-2 max-w-3xl text-sm text-adm-muted">
        Магазинът пази копие от списъка с офиси на всеки куриер, за да не чака куриера при всяка поръчка. Товарителниците се създават от
        страницата на поръчката. Статусите на пратките се питат от куриера с бутона долу.
      </p>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {(Object.keys(COURIERS) as CourierId[]).map((courier) => {
          const { mode, error } = describe(courier);
          const rows = stats.filter((s) => s.courier === courier);
          const count = (kind: string) => rows.find((r) => r.kind === kind)?.count ?? 0;
          const synced = rows.map((r) => r.syncedAt).filter(Boolean).sort().at(-1);
          return (
            <section key={courier} className="adm-card p-5 text-sm sm:p-6" aria-labelledby={`c-${courier}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id={`c-${courier}`} className="text-lg font-extrabold">{COURIERS[courier]}</h2>
                {mode && <span className="rounded-full bg-adm-blue-soft px-3 py-1 text-xs font-bold text-adm-blue">{MODE_LABEL[mode]}</span>}
              </div>
              {error && <p role="alert" className="mt-3 font-semibold text-adm-down">{error}</p>}
              {mode && <p className="mt-3 text-adm-muted">{MODE_NOTE[mode]}</p>}

              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
                <dt className="text-adm-muted">Офиси</dt>
                <dd className="font-bold tabular" data-testid={`offices-${courier}`}>{count("office")}</dd>
                <dt className="text-adm-muted">Автомати</dt>
                <dd className="font-bold tabular">{count("locker")}</dd>
                <dt className="text-adm-muted">Последно обновяване</dt>
                <dd>{synced ? formatDateTime(new Date(synced)) : "още не е обновяван, това е демо списъкът"}</dd>
                {courier === "econt" && mode && mode !== "mock" && (
                  <>
                    <dt className="text-adm-muted">Изпращаш от офис</dt>
                    <dd className="tabular">{safe(() => econtConfig().senderOfficeCode)} (ECONT_SENDER_OFFICE_CODE)</dd>
                  </>
                )}
                <dt className="text-adm-muted">Подател</dt>
                <dd>{sender.name}, {sender.phone}</dd>
              </dl>

              {mode && (
                <div className="mt-5">
                  <ShippingButton
                    action={syncOfficesAction}
                    fields={{ courier }}
                    label={`Обнови офисите от ${COURIERS[courier]}`}
                    pendingText="Тегля списъка..."
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="adm-card mt-6 p-5 text-sm sm:p-6" aria-labelledby="tracking">
        <h2 id="tracking" className="text-lg font-extrabold">Статуси на пратките</h2>
        <p className="mt-2 text-adm-muted">
          Активни пратки: <span className="font-bold text-adm-ink tabular">{active.n}</span>. Проверката пита куриерите и сама мести поръчките: взета от
          куриера става „Изпратена“, доставена става „Доставена“ (и наложеният платеж се записва като получен), върната става „Отказана при доставка“.
        </p>
        <div className="mt-4">
          <ShippingButton action={refreshTrackingAction} label="Провери статусите сега" pendingText="Питаме куриерите..." />
        </div>
      </section>
    </>
  );
}

function safe(read: () => string) {
  try {
    return read();
  } catch {
    return "не е настроено";
  }
}
