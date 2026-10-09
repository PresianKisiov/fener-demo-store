import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartForm } from "@/components/AddToCartForm";
import { LampArt } from "@/components/LampArt";
import { PriceBlock } from "@/components/PriceBlock";
import { addWorkingDays, formatDayRange } from "@/lib/dates";
import { SHOP } from "@/lib/settings";
import { getPublishedProduct } from "@/server/catalog";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getPublishedProduct((await params).slug);
  return product ? { title: product.name, description: product.shortDescription } : {};
}

export default async function ProductPage({ params }: Props) {
  const product = await getPublishedProduct((await params).slug);
  if (!product) notFound();

  const now = new Date();
  const delivery = formatDayRange(
    addWorkingDays(now, SHOP.deliveryWorkingDays.min),
    addWorkingDays(now, SHOP.deliveryWorkingDays.max),
  );

  return (
    <>
      <nav aria-label="Път" className="text-sm text-ink-soft">
        <Link href="/katalog" className="hover:underline">Лампи</Link>
        <span aria-hidden="true"> / </span>
        <Link href={`/katalog?k=${encodeURIComponent(product.category)}`} className="hover:underline">{product.category}</Link>
      </nav>

      <div className="mt-6 grid gap-10 md:grid-cols-2">
        <div className="glow-plate aspect-square rounded-[36px] p-10 md:sticky md:top-6 md:self-start">
          <LampArt kind={product.illustration} className="h-full w-full" title={`Рисунка: ${product.name}`} />
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
            <AddToCartForm productId={product.id} stock={product.stock} />
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
