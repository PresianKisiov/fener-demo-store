import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { orders, withdrawals } from "@/db/schema";
import { StatusPill } from "@/components/admin/StatusPill";
import { formatDateTime } from "@/lib/dates";
import { formatEur } from "@/lib/money";
import { SHOP } from "@/lib/settings";
import { requireAdmin } from "@/server/auth";

const DAY = 24 * 60 * 60 * 1000;

export default async function WithdrawalsPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db
    .select({ w: withdrawals, o: orders })
    .from(withdrawals)
    .innerJoin(orders, eq(orders.id, withdrawals.orderId))
    .orderBy(desc(withdrawals.requestedAt));

  return (
    <>
      <h1 className="text-[2rem] font-extrabold tracking-tight">Откази от договора</h1>
      <p className="mt-2 max-w-[75ch] text-sm text-adm-muted">
        Парите се връщат до {SHOP.withdrawalDays} дни от заявката. Може да изчакаш, докато стоката пристигне. Стъпките („стоката е получена“, „парите са върнати“) се отбелязват от страницата на поръчката.
      </p>
      {rows.length === 0 ? (
        <p className="adm-card mt-6 p-8 text-center text-adm-muted">Няма заявени откази.</p>
      ) : (
        <div className="adm-card mt-6 overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead>
              <tr>
                <th className="adm-th">Поръчка</th>
                <th className="adm-th">Клиент</th>
                <th className="adm-th">Заявен на</th>
                <th className="adm-th">Срок за връщане на парите</th>
                <th className="adm-th text-right">Сума</th>
                <th className="adm-th">Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ w, o }) => {
                const deadline = new Date(w.requestedAt.getTime() + SHOP.withdrawalDays * DAY);
                const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / DAY);
                return (
                  <tr key={w.id} data-testid={`withdrawal-${o.number}`}>
                    <td className="adm-td"><Link href={`/admin/poruchki/${o.id}`} className="font-bold text-adm-blue hover:underline">{o.number}</Link></td>
                    <td className="adm-td">{w.customerName}<span className="block text-xs text-adm-muted">{w.reason || "без посочена причина"}</span></td>
                    <td className="adm-td whitespace-nowrap tabular">{formatDateTime(w.requestedAt)}</td>
                    <td className="adm-td tabular">
                      {w.refundedAt ? (
                        `Върнати на ${formatDateTime(w.refundedAt)}`
                      ) : daysLeft >= 0 ? (
                        <span className={daysLeft <= 3 ? "font-bold text-[#a15300]" : ""}>{daysLeft} дни остават</span>
                      ) : (
                        <span className="font-bold text-adm-down">Просрочено с {-daysLeft} дни</span>
                      )}
                    </td>
                    <td className="adm-td text-right font-bold tabular">{formatEur(o.totalCents)}</td>
                    <td className="adm-td"><StatusPill status={o.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
