import Link from "next/link";
import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders } from "@/db/schema";
import { OrdersTable } from "@/components/OrdersTable";
import { isOrderStatus, ORDER_STATUS, type OrderStatus } from "@/lib/order-status";
import { requireAdmin } from "@/server/auth";

const PAGE_SIZE = 25;

type Search = { status?: string; payment?: string; period?: string; q?: string; p?: string };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.status && isOrderStatus(sp.status) ? sp.status : "";
  const payment = sp.payment === "cod" || sp.payment === "card" ? sp.payment : "";
  const period = sp.period === "7" || sp.period === "30" ? sp.period : "";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number(sp.p) || 1);

  // Every filter is a piece of the WHERE clause. Values go in as parameters, never glued into SQL text.
  const where: SQL[] = [];
  if (status) where.push(eq(orders.status, status));
  if (payment) where.push(eq(orders.paymentMethod, payment));
  if (period) where.push(gte(orders.createdAt, new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000)));
  if (q) {
    const like = `%${q.toLowerCase()}%`;
    where.push(sql`(lower(${orders.number}) like ${like} or lower(${orders.customerName}) like ${like} or lower(${orders.email}) like ${like} or ${orders.phone} like ${like})`);
  }

  const db = await getDb();
  const condition = where.length ? and(...where) : undefined;
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(orders).where(condition);
  const rows = await db
    .select()
    .from(orders)
    .where(condition)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: number) => {
    const params = new URLSearchParams({ ...(status && { status }), ...(payment && { payment }), ...(period && { period }), ...(q && { q }), p: String(p) });
    return `/admin/poruchki?${params}`;
  };

  return (
    <>
      <h1 className="text-[2rem] font-extrabold tracking-tight">Поръчки</h1>

      <form className="adm-card mt-6 flex flex-wrap items-end gap-3 p-4" role="search" aria-label="Филтър на поръчките">
        <div className="min-w-[180px] flex-1">
          <label htmlFor="q" className="adm-label">Търсене</label>
          <input id="q" name="q" defaultValue={q} placeholder="Номер, име, имейл, телефон" className="adm-input" />
        </div>
        <div>
          <label htmlFor="status" className="adm-label">Статус</label>
          <select id="status" name="status" defaultValue={status} className="adm-input">
            <option value="">Всички</option>
            {(Object.keys(ORDER_STATUS) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>{ORDER_STATUS[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="payment" className="adm-label">Плащане</label>
          <select id="payment" name="payment" defaultValue={payment} className="adm-input">
            <option value="">Всички</option>
            <option value="cod">Наложен платеж</option>
            <option value="card">Карта</option>
          </select>
        </div>
        <div>
          <label htmlFor="period" className="adm-label">Период</label>
          <select id="period" name="period" defaultValue={period} className="adm-input">
            <option value="">Цялото време</option>
            <option value="7">Последните 7 дни</option>
            <option value="30">Последните 30 дни</option>
          </select>
        </div>
        <button type="submit" className="adm-btn">Филтрирай</button>
        <Link href="/admin/poruchki" className="adm-btn-ghost">Изчисти</Link>
      </form>

      <p className="mt-5 text-sm text-adm-muted" aria-live="polite">
        {total} {total === 1 ? "поръчка" : "поръчки"}
      </p>
      <div className="mt-3">
        {rows.length === 0 ? (
          <p className="adm-card p-8 text-center text-adm-muted">Няма поръчки с тези филтри.</p>
        ) : (
          <OrdersTable rows={rows} />
        )}
      </div>

      {pages > 1 && (
        <nav aria-label="Страници" className="mt-5 flex items-center justify-between text-sm">
          <span className="text-adm-muted">Страница {page} от {pages}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={link(page - 1)} className="adm-btn-ghost">Предишна</Link>}
            {page < pages && <Link href={link(page + 1)} className="adm-btn-ghost">Следваща</Link>}
          </span>
        </nav>
      )}
    </>
  );
}
