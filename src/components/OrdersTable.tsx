import Link from "next/link";
import type { Order } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { formatEur } from "@/lib/money";
import { StatusPill } from "./admin/StatusPill";

export function OrdersTable({ rows }: { rows: Order[] }) {
  return (
    <div className="adm-card overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr>
            <th className="adm-th">Номер</th>
            <th className="adm-th">Клиент</th>
            <th className="adm-th">Град</th>
            <th className="adm-th">Дата</th>
            <th className="adm-th">Плащане</th>
            <th className="adm-th text-right">Сума</th>
            <th className="adm-th">Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} className="hover:bg-[#fafbfd]">
              <td className="adm-td">
                <Link href={`/admin/poruchki/${o.id}`} className="font-bold text-adm-blue underline-offset-4 hover:underline">{o.number}</Link>
              </td>
              <td className="adm-td">{o.customerName}</td>
              <td className="adm-td">{o.city}</td>
              <td className="adm-td whitespace-nowrap tabular">{formatDateTime(o.createdAt)}</td>
              <td className="adm-td">{o.paymentMethod === "cod" ? "Наложен платеж" : "Карта"}</td>
              <td className="adm-td text-right font-bold tabular">{formatEur(o.totalCents)}</td>
              <td className="adm-td"><StatusPill status={o.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
