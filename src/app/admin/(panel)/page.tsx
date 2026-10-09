import Link from "next/link";
import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orderItems, orders, products } from "@/db/schema";
import { LampArt } from "@/components/LampArt";
import { MonthSelect } from "@/components/admin/MonthSelect";
import { SalesChart, type SalesPoint } from "@/components/admin/SalesChart";
import { StatCard, delta } from "@/components/admin/StatCard";
import { StatusPill } from "@/components/admin/StatusPill";
import { formatDateTime, formatDayMonth, formatMonth, formatShortDate, sofiaDayStart, sofiaIsoDay, sofiaMonthStart } from "@/lib/dates";
import { formatEur } from "@/lib/money";
import { REVENUE_STATUSES } from "@/lib/order-status";
import { requireAdmin } from "@/server/auth";

const DAY = 24 * 60 * 60 * 1000;

function monthKey(d: Date) {
  return sofiaIsoDay(d).slice(0, 7);
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireAdmin();
  const db = await getDb();
  const now = new Date();

  // Periods. "Today" and "yesterday" are calendar days in Sofia time.
  const todayStart = sofiaDayStart(now);
  const yesterdayStart = sofiaDayStart(new Date(todayStart.getTime() - 1));
  const sameTimeYesterday = new Date(now.getTime() - DAY);
  const weekStart = new Date(now.getTime() - 7 * DAY);
  const prevWeekStart = new Date(now.getTime() - 14 * DAY);

  const countBetween = async (from: Date, to: Date) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(gte(orders.createdAt, from), lt(orders.createdAt, to)));
    return row.n;
  };
  const salesBetween = async (from: Date, to: Date) => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` })
      .from(orders)
      .where(and(gte(orders.createdAt, from), lt(orders.createdAt, to), inArray(orders.status, REVENUE_STATUSES)));
    return row;
  };

  const [today, yesterday, week, prevWeek] = await Promise.all([
    countBetween(todayStart, now),
    countBetween(yesterdayStart, sameTimeYesterday),
    salesBetween(weekStart, now),
    salesBetween(prevWeekStart, weekStart),
  ]);
  const [waiting] = await db
    .select({ n: sql<number>`count(*)::int`, oldest: sql<string | null>`min(${orders.createdAt})` })
    .from(orders)
    .where(eq(orders.status, "pending_confirmation"));

  const avg = week.n ? Math.round(week.sum / week.n) : 0;
  const prevAvg = prevWeek.n ? Math.round(prevWeek.sum / prevWeek.n) : 0;

  // Chart: daily sales for the last 30 days or a chosen month.
  const currentMonth = monthKey(now);
  const monthKeys = [0, 1, 2].map((back) => monthKey(new Date(sofiaMonthStart(currentMonth).getTime() - back * 28 * DAY + 3 * DAY)));
  const rangeOptions = [
    { value: "30", label: "Последните 30 дни" },
    ...monthKeys.map((key) => ({ value: key, label: formatMonth(sofiaMonthStart(key)) })),
  ];
  const { m } = await searchParams;
  const selected = rangeOptions.some((o) => o.value === m) ? m! : "30";
  let rangeStart: Date;
  let rangeEnd: Date;
  if (selected === "30") {
    rangeStart = sofiaDayStart(new Date(todayStart.getTime() - 29 * DAY + 12 * 60 * 60 * 1000));
    rangeEnd = new Date(todayStart.getTime() + DAY);
  } else {
    const [y, mo] = selected.split("-").map(Number);
    rangeStart = sofiaMonthStart(selected);
    rangeEnd = sofiaMonthStart(mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`);
  }
  const lastDay = Math.min(rangeEnd.getTime(), todayStart.getTime() + DAY);
  const rangeOrders = await db
    .select({ createdAt: orders.createdAt, totalCents: orders.totalCents })
    .from(orders)
    .where(and(gte(orders.createdAt, rangeStart), lt(orders.createdAt, rangeEnd), inArray(orders.status, REVENUE_STATUSES)));

  // One point per calendar day. Stepping from noon keeps us inside the right day across summer/winter time.
  const points: SalesPoint[] = [];
  for (let t = rangeStart.getTime() + 12 * 60 * 60 * 1000; t < lastDay; t += DAY) {
    const date = new Date(t);
    const day = sofiaIsoDay(date);
    if (points.some((p) => p.day === day)) continue;
    const dayOrders = rangeOrders.filter((o) => sofiaIsoDay(o.createdAt) === day);
    points.push({
      day,
      tick: formatShortDate(date),
      label: formatDayMonth(date),
      revenueCents: dayOrders.reduce((s, o) => s + o.totalCents, 0),
      orders: dayOrders.length,
    });
  }
  const chartTitle = selected === "30" ? "Продажби по дни, последните 30 дни" : `Продажби по дни, ${formatMonth(rangeStart)}`;

  // Latest orders with their first product.
  const recent = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6);
  const recentItems = recent.length
    ? await db
        .select({ orderId: orderItems.orderId, name: orderItems.productName, quantity: orderItems.quantity, illustration: products.illustration })
        .from(orderItems)
        .leftJoin(products, eq(products.id, orderItems.productId))
        .where(inArray(orderItems.orderId, recent.map((o) => o.id)))
    : [];

  // Best sellers of the last 30 days.
  const top = await db
    .select({
      productId: orderItems.productId,
      name: orderItems.productName,
      quantity: sql<number>`sum(${orderItems.quantity})::int`,
      revenue: sql<number>`sum(${orderItems.lineTotalCents})::int`,
      illustration: sql<string>`max(${products.illustration})`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(products, eq(products.id, orderItems.productId))
    .where(and(gte(orders.createdAt, new Date(now.getTime() - 30 * DAY)), inArray(orders.status, REVENUE_STATUSES)))
    .groupBy(orderItems.productId, orderItems.productName)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(5);

  return (
    <>
      <h1 className="text-[2rem] font-extrabold tracking-tight">Табло</h1>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Поръчки днес" value={String(today)} icon="box" tone="yellow" change={delta(today, yesterday, "от вчера по това време")} />
        <StatCard label="Оборот за 7 дни" value={formatEur(week.sum)} icon="trend" tone="green" change={delta(week.sum, prevWeek.sum, "от предишните 7 дни")} />
        <StatCard label="Средна поръчка" value={avg ? formatEur(avg) : "0 €"} icon="receipt" tone="purple" change={delta(avg, prevAvg, "от предишните 7 дни")} />
        <StatCard
          label="Чакат потвърждение"
          value={String(waiting.n)}
          icon="clock"
          tone="orange"
          note={waiting.n && waiting.oldest ? `Най-старата е от ${formatDateTime(new Date(waiting.oldest))}` : "Няма чакащи поръчки"}
        />
      </div>

      <section className="adm-card mt-6 min-w-0 p-5 sm:p-7" aria-labelledby="sales-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 id="sales-title" className="text-xl font-extrabold">Продажби по дни</h2>
          <MonthSelect value={selected} options={rangeOptions} />
        </div>
        <SalesChart points={points} title={chartTitle} />
      </section>

      <div className="mt-6 grid min-w-0 gap-6">
        <section className="adm-card min-w-0 p-5 sm:p-7" aria-labelledby="recent-title">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 id="recent-title" className="text-xl font-extrabold">Последни поръчки</h2>
            <Link href="/admin/poruchki" className="adm-btn-ghost whitespace-nowrap">Всички поръчки</Link>
          </div>
          <div className="-mx-5 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr>
                  <th className="adm-th min-w-[240px] rounded-l-xl">Продукт</th>
                  <th className="adm-th">Клиент</th>
                  <th className="adm-th">Дата</th>
                  <th className="adm-th text-right">Сума</th>
                  <th className="adm-th rounded-r-xl">Статус</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((o) => {
                  const items = recentItems.filter((i) => i.orderId === o.id);
                  const first = items[0];
                  return (
                    <tr key={o.id}>
                      <td className="adm-td">
                        <Link href={`/admin/poruchki/${o.id}`} className="flex items-center gap-3 font-semibold hover:underline">
                          <span className="glow-plate size-10 shrink-0 rounded-full p-1.5">
                            <LampArt kind={first?.illustration ?? "clip"} className="h-full w-full" />
                          </span>
                          <span>
                            {first?.name ?? "Поръчка"}
                            {items.length > 1 && <span className="text-adm-muted"> и още {items.length - 1}</span>}
                            <span className="block text-xs font-normal text-adm-muted">{o.number}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="adm-td">{o.customerName}<span className="block text-xs text-adm-muted">{o.city}</span></td>
                      <td className="adm-td whitespace-nowrap tabular">{formatDateTime(o.createdAt)}</td>
                      <td className="adm-td text-right font-bold tabular">{formatEur(o.totalCents)}</td>
                      <td className="adm-td"><StatusPill status={o.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="adm-card min-w-0 p-5 sm:p-7" aria-labelledby="top-title">
          <h2 id="top-title" className="text-xl font-extrabold">Най-продавани за 30 дни</h2>
          {top.length === 0 ? (
            <p className="mt-4 text-adm-muted">Още няма продажби.</p>
          ) : (
            <ol className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
              {top.map((t) => (
                <li key={t.productId} className="flex items-center gap-3">
                  <span className="glow-plate size-11 shrink-0 rounded-xl p-1.5">
                    <LampArt kind={t.illustration ?? "clip"} className="h-full w-full" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{t.name}</span>
                    <span className="block text-sm text-adm-muted">
                      {t.quantity} бр. за <span className="font-bold text-adm-ink">{formatEur(t.revenue)}</span>
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
