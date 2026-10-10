import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { priceHistory, products } from "@/db/schema";
import { ProductForm } from "@/components/ProductForm";
import { formatDateTime } from "@/lib/dates";
import { formatEur } from "@/lib/money";
import { lowestPriceBefore } from "@/lib/omnibus";
import { requireAdmin } from "@/server/auth";
import { ImageManager } from "@/components/admin/ImageManager";
import { imagesFor } from "@/server/images";

export default async function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const db = await getDb();
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) notFound();
  const history = await db.select().from(priceHistory).where(eq(priceHistory.productId, id)).orderBy(asc(priceHistory.validFrom));
  const lowest30 = lowestPriceBefore(history, new Date());
  const images = (await imagesFor([id])).get(id) ?? [];

  return (
    <>
      <Link href="/admin/produkti" className="text-sm font-semibold text-adm-blue hover:underline">Всички продукти</Link>
      <h1 className="mt-2 text-[2rem] font-extrabold tracking-tight">{product.name}</h1>
      {product.isPublished && (
        <Link href={`/produkt/${product.slug}`} className="mt-1 inline-block text-sm font-semibold text-adm-blue hover:underline">Виж в магазина</Link>
      )}
      <div className="mt-6">
        <ImageManager productId={product.id} productName={product.name} images={images} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <ProductForm product={product} />
        <aside className="adm-card h-fit p-5 text-sm sm:p-6">
          <h2 className="text-lg font-extrabold">Ценова история</h2>
          <ol className="tabular mt-3 space-y-1.5">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between gap-3">
                <span>{formatDateTime(h.validFrom)}</span>
                <span className="font-semibold">{formatEur(h.priceCents)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-adm-line pt-3">
            Най-ниска цена за последните 30 дни: <span className="font-semibold">{lowest30 ? formatEur(lowest30) : "няма"}</span>
          </p>
          <p className="mt-1 text-adm-muted">Спрямо нея се смята всяко ново обявено намаление.</p>
          {product.priorPriceCents && product.reductionStartedAt && (
            <p className="mt-3 border-t border-adm-line pt-3">
              Сега е обявено намаление от {formatDateTime(product.reductionStartedAt)}. В магазина се показва спрямо{" "}
              <span className="font-semibold">{formatEur(product.priorPriceCents)}</span>, най-ниската цена от 30-те дни преди него.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
