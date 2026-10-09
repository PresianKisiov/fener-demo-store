import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { products } from "@/db/schema";
import { updateStockAction } from "@/app/actions/admin";
import { LampArt } from "@/components/LampArt";
import { SubmitButton } from "@/components/SubmitButton";
import { formatEur } from "@/lib/money";
import { requireAdmin } from "@/server/auth";

const LOW = 10;

export default async function StockPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db.select().from(products).orderBy(asc(products.stock), asc(products.name));

  return (
    <>
      <h1 className="text-[2rem] font-extrabold tracking-tight">Наличности</h1>
      <p className="mt-2 text-sm text-adm-muted">Подредени от най-малко към най-много. Поръчките намаляват наличността автоматично, а отказите и върнатите пратки я връщат.</p>
      <div className="adm-card mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead>
            <tr>
              <th className="adm-th">Продукт</th>
              <th className="adm-th">Категория</th>
              <th className="adm-th text-right">Цена</th>
              <th className="adm-th">Състояние</th>
              <th className="adm-th">Наличност</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="adm-td">
                  <Link href={`/admin/produkti/${p.id}`} className="flex items-center gap-3 font-bold hover:underline">
                    <span className="glow-plate size-11 shrink-0 rounded-xl p-1.5"><LampArt kind={p.illustration} className="h-full w-full" /></span>
                    {p.name}
                  </Link>
                </td>
                <td className="adm-td">{p.category}</td>
                <td className="adm-td text-right tabular">{formatEur(p.priceCents)}</td>
                <td className="adm-td">
                  {p.stock === 0 ? (
                    <span className="rounded-md bg-[#fcd7d4] px-3 py-1 text-xs font-bold text-[#b42318]">Изчерпан</span>
                  ) : p.stock < LOW ? (
                    <span className="rounded-md bg-[#ffeddd] px-3 py-1 text-xs font-bold text-[#a15300]">Малко</span>
                  ) : (
                    <span className="rounded-md bg-[#ccf0eb] px-3 py-1 text-xs font-bold text-[#006b5b]">Достатъчно</span>
                  )}
                </td>
                <td className="adm-td">
                  <form action={updateStockAction} className="flex items-center gap-2">
                    <input type="hidden" name="productId" value={p.id} />
                    <input
                      name="stock"
                      type="number"
                      min={0}
                      defaultValue={p.stock}
                      aria-label={`Наличност на ${p.name}`}
                      className="adm-input w-24"
                    />
                    <SubmitButton className="adm-btn-ghost" pendingText="...">Запази</SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
