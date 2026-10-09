import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { products } from "@/db/schema";
import { LampArt } from "@/components/LampArt";
import { Icon } from "@/components/admin/Icon";
import { NewProductForm } from "@/components/admin/NewProductForm";
import { missingSafetyFields } from "@/lib/gpsr";
import { formatEur } from "@/lib/money";
import { requireAdmin } from "@/server/auth";

export default async function ProductsPage() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db.select().from(products).orderBy(asc(products.id));
  const categories = [...new Set(rows.map((p) => p.category))];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[2rem] font-extrabold tracking-tight">Продукти</h1>
      </div>

      <details className="adm-card mt-6 p-5 [&[open]>summary]:mb-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-extrabold text-adm-blue">
          <Icon name="plus" />
          Добави продукт
        </summary>
        <NewProductForm categories={categories} />
        <p className="mt-3 text-sm text-adm-muted">Новият продукт е скрит, докато не попълниш описанието и данните за безопасност.</p>
      </details>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {rows.map((p) => {
          const missing = missingSafetyFields(p);
          return (
            <article key={p.id} className="adm-card flex flex-col overflow-hidden">
              <div className="glow-plate relative aspect-[4/3] p-8">
                <LampArt kind={p.illustration} className="h-full w-full" />
                <span className={`absolute left-3 top-3 rounded-md px-2.5 py-1 text-xs font-bold ${p.isPublished ? "bg-[#ccf0eb] text-[#006b5b]" : "bg-[#eceef2] text-[#5e6470]"}`}>
                  {p.isPublished ? "В магазина" : "Скрит"}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-extrabold leading-snug">{p.name}</h2>
                <p className="mt-1 text-sm text-adm-muted">{p.category}</p>
                <p className="mt-2 text-lg font-extrabold text-adm-blue tabular">
                  {formatEur(p.priceCents)}
                  {p.priorPriceCents && <span className="ml-2 text-sm font-semibold text-adm-down">намаление от {formatEur(p.priorPriceCents)}</span>}
                </p>
                <p className="mt-1 text-sm">{p.stock > 0 ? `${p.stock} бр. в наличност` : <span className="font-semibold text-adm-down">Няма наличност</span>}</p>
                {missing.length > 0 && (
                  <p className="mt-2 text-sm font-semibold text-[#a15300]">Липсват {missing.length} полета за безопасност</p>
                )}
                <Link href={`/admin/produkti/${p.id}`} className="adm-btn-ghost mt-4 self-start">Редактирай</Link>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
