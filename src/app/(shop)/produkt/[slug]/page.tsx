import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartForm } from "@/components/AddToCartForm";
import { ProductGallery } from "@/components/ProductGallery";
import { MetaEvent } from "@/components/MetaPixel";
import { PriceBlock } from "@/components/PriceBlock";
import { addWorkingDays, formatDayRange } from "@/lib/dates";
import { SHOP } from "@/lib/settings";
import { getPublishedProduct } from "@/server/catalog";
import { imagesFor } from "@/server/images";
import { getBaseUrl } from "@/server/base-url";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getPublishedProduct((await params).slug);
  if (!product) return {};
  const base = await getBaseUrl();
  const first = (await imagesFor([product.id])).get(product.id)?.[0];
  return {
    title: product.name,
    description: product.shortDescription,
    alternates: { canonical: `${base}/produkt/${product.slug}` },
    // What Facebook, Viber and Google show when someone shares the link.
    openGraph: {
      type: "website",
      title: product.name,
      description: product.shortDescription,
      url: `${base}/produkt/${product.slug}`,
      ...(first ? { images: [{ url: `${base}/api/images/${first.id}`, width: first.width, height: first.height }] } : {}),
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getPublishedProduct((await params).slug);
  if (!product) notFound();
  const images = (await imagesFor([product.id])).get(product.id) ?? [];
  const base = await getBaseUrl();
  // Structured data: lets Google show price and availability under the search result.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    sku: product.modelNumber || String(product.id),
    image: images.map((i) => `${base}/api/images/${i.id}`),
    offers: {
      "@type": "Offer",
      url: `${base}/produkt/${product.slug}`,
      priceCurrency: "EUR",
      price: (product.priceCents / 100).toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };

  const now = new Date();
  const delivery = formatDayRange(
    addWorkingDays(now, SHOP.deliveryWorkingDays.min),
    addWorkingDays(now, SHOP.deliveryWorkingDays.max),
  );

  return (
    <>
      <script
        type="application/ld+json"
        // "<" is escaped so a product name can never close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <MetaEvent
        name="ViewContent"
        params={{ content_ids: [String(product.id)], content_type: "product", content_name: product.name, currency: "EUR", value: product.priceCents / 100 }}
      />
      <nav aria-label="Път" className="text-sm text-ink-soft">
        <Link href="/katalog" className="hover:underline">Лампи</Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/katalog?k=${encodeURIComponent(product.category)}`} className="hover:underline">{product.category}</Link>
      </nav>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="md:sticky md:top-6 md:self-start">
          <ProductGallery name={product.name} illustration={product.illustration} images={images} />
        </div>

        <div>
          <h1 className="font-display text-3xl font-medium leading-tight sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-lg text-ink-soft">{product.shortDescription}</p>

          <div className="mt-6">
            <PriceBlock
              size="lg"
              priceCents={product.priceCents}
              priorPriceCents={product.priorPriceCents}
              measureUnit={product.measureUnit}
              measureQuantityMilli={product.measureQuantityMilli}
            />
            <p className="mt-1 text-sm text-ink-soft">Цената е с ДДС.</p>
          </div>

          <p className="mt-6">
            <span className="font-semibold">Доставка: {delivery}</span>
            <span className="text-ink-soft">, ако поръчаш днес</span>
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {product.stock > 5 ? "В наличност" : product.stock > 0 ? `Остават ${product.stock} бр.` : "Няма наличност"}
          </p>

          <div className="mt-6">
            <AddToCartForm productId={product.id} stock={product.stock} priceCents={product.priceCents} />
          </div>

          <ul className="mt-6 space-y-1 border-t border-line pt-5 text-sm">
            <li>Плащаш при доставка или с карта</li>
            <li>Еконт и Спиди: офис, автомат или адрес</li>
            <li>{SHOP.withdrawalDays} дни право на отказ без обяснение</li>
          </ul>

          <section className="mt-10">
            <h2 className="font-display text-xl font-medium">Описание</h2>
            <p className="mt-3 max-w-[65ch]">{product.description}</p>
          </section>

          <section className="mt-10">
            <h2 className="font-display text-xl font-medium">Характеристики</h2>
            <dl className="mt-3 divide-y divide-line border-y border-line">
              {product.specs.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[10rem_1fr] gap-4 py-2.5">
                  <dt className="text-ink-soft">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[10rem_1fr] gap-4 py-2.5">
                <dt className="text-ink-soft">Модел</dt>
                <dd>{product.modelNumber}</dd>
              </div>
            </dl>
          </section>

          <section className="mt-10" aria-labelledby="safety">
            <h2 id="safety" className="font-display text-xl font-medium">Информация за безопасност</h2>
            <div className="mt-3 space-y-3 text-sm">
              <p>
                <span className="font-semibold">Производител:</span> {product.manufacturerName}, {product.manufacturerAddress},{" "}
                {product.manufacturerEmail}
              </p>
              {!product.manufacturerInEu && (
                <p>
                  <span className="font-semibold">Отговорно лице в ЕС:</span> {product.euResponsibleName}, {product.euResponsibleAddress},{" "}
                  {product.euResponsibleEmail}
                </p>
              )}
              <p>
                <span className="font-semibold">Предупреждения:</span> {product.safetyWarnings}
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
