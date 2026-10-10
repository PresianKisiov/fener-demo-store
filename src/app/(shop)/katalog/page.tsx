import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { getPublishedProducts } from "@/server/catalog";
import { imagesFor } from "@/server/images";

export const metadata: Metadata = { title: "Всички лампи" };

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const { k } = await searchParams;
  const all = await getPublishedProducts();
  const images = await imagesFor(all.map((p) => p.id));
  const categories = [...new Set(all.map((p) => p.category))];
  const products = k ? all.filter((p) => p.category === k) : all;

  return (
    <>
      <h1 className="font-display text-3xl font-medium sm:text-4xl">Лампи</h1>
      <nav aria-label="Категории" className="mt-6 flex flex-wrap gap-2">
        <Link href="/katalog" aria-current={!k ? "page" : undefined} className={`rounded-full border-[1.5px] px-4 py-2 text-sm ${!k ? "border-night bg-night text-white" : "border-line hover:border-night"}`}>
          Всички
        </Link>
        {categories.map((c) => (
          <Link
            key={c}
            href={`/katalog?k=${encodeURIComponent(c)}`}
            aria-current={k === c ? "page" : undefined}
            className={`rounded-full border-[1.5px] px-4 py-2 text-sm ${k === c ? "border-night bg-night text-white" : "border-line hover:border-night"}`}
          >
            {c}
          </Link>
        ))}
      </nav>
      {products.length === 0 ? (
        <p className="mt-10 text-ink-soft">
          В тази категория няма продукти. <Link href="/katalog" className="underline">Виж всички лампи</Link>.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} image={images.get(p.id)?.[0]} />
          ))}
        </div>
      )}
    </>
  );
}
