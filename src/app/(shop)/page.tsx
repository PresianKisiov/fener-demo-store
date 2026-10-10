import Link from "next/link";
import { LampArt } from "@/components/LampArt";
import { ProductCard } from "@/components/ProductCard";
import { formatEur } from "@/lib/money";
import { SHOP } from "@/lib/settings";
import { getPublishedProducts } from "@/server/catalog";
import { imagesFor } from "@/server/images";

export default async function HomePage() {
  const products = await getPublishedProducts();
  const images = await imagesFor(products.map((p) => p.id));

  return (
    <>
      <section className="grid items-center gap-8 pb-14 pt-6 md:grid-cols-[1.1fr_1fr] md:pt-10">
        <div>
          <h1 className="font-display text-4xl font-medium leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
            Светлина точно върху страницата
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg text-ink-soft">
            Лампи за четене и работа вкъщи. Плащаш, когато получиш пратката, и имаш {SHOP.withdrawalDays} дни да размислиш.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/katalog" className="btn-primary">
              Разгледай лампите
            </Link>
            <Link href="/produkt/lampa-s-shtipka-stranitsa" className="btn-secondary">
              Най-купуваната
            </Link>
          </div>
        </div>
        <div className="relative mx-auto aspect-square w-full max-w-md">
          <div className="glow-plate switch-on absolute inset-0 rounded-full" />
          <LampArt kind="clip" className="relative h-full w-full p-10" title="Лампа с щипка над отворена книга" />
        </div>
      </section>

      <section aria-label="Защо да поръчаш оттук" className="grid gap-4 border-y border-line py-6 sm:grid-cols-3">
        <p><span className="font-semibold">Плащане при доставка.</span> С Еконт или Спиди, до офис, автомат или адрес.</p>
        <p><span className="font-semibold">Безплатна доставка над {formatEur(SHOP.shipping.freeFromCents)}.</span> Под тази сума от {formatEur(SHOP.shipping.officeCents)}.</p>
        <p><span className="font-semibold">{SHOP.withdrawalDays} дни за връщане.</span> Без да обясняваш защо.</p>
      </section>

      <section className="pt-14">
        <h2 className="font-display text-2xl font-medium">Всички лампи</h2>
        <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} image={images.get(p.id)?.[0]} />
          ))}
        </div>
      </section>

      <section className="mt-16 max-w-2xl">
        <h2 className="font-display text-2xl font-medium">Чести въпроси</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {[
            ["Кога ще получа поръчката?", `Обикновено за ${SHOP.deliveryWorkingDays.min} до ${SHOP.deliveryWorkingDays.max} работни дни. Точният срок пише на страницата на всеки продукт.`],
            ["Мога ли да прегледам пратката преди да платя?", "В демото това е настройка на куриера. В истински магазин се избира в договора с Еконт или Спиди."],
            ["Как връщам продукт?", "Натисни „Отказ от договора тук“ в долната част на страницата, въведи номера на поръчката и имейла. Ще получиш потвърждение на имейла си."],
          ].map(([q, a]) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">
                {q}
              </summary>
              <p className="mt-2 text-ink-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
