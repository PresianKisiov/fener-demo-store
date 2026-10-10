import Link from "next/link";
import { getCartCount } from "@/server/cart";
import { SHOP } from "@/lib/settings";
import { ConsentBanner, ConsentSettingsLink } from "@/components/ConsentBanner";
import { MetaPixel } from "@/components/MetaPixel";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const cartCount = await getCartCount();
  return (
    <>
      <MetaPixel pixelId={process.env.META_PIXEL_ID?.trim() || null} />
      <ConsentBanner />
      <div className="bg-night px-4 py-2 text-center text-sm text-white">
        Това е демо магазин. Продуктите и фирмата са измислени, поръчките не се изпращат.
      </div>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
          Фенер
        </Link>
        <nav aria-label="Основно меню" className="flex items-center gap-1 text-sm sm:gap-4 sm:text-base">
          <Link href="/katalog" className="rounded-full px-3 py-2 hover:bg-mist">
            Лампи
          </Link>
          <Link href="/prosledyavane" className="hidden rounded-full px-3 py-2 hover:bg-mist sm:inline-block">
            Проследи поръчка
          </Link>
          <Link
            href="/kolichka"
            className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-night px-4 py-2 font-medium hover:bg-mist"
          >
            Количка
            <span
              className="tabular inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-night px-1.5 text-xs text-white"
              aria-label={`${cartCount} продукта`}
              data-testid="cart-count"
            >
              {cartCount}
            </span>
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">{children}</main>
      <footer className="border-t border-line bg-mist">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm sm:grid-cols-3 sm:px-6">
          <div>
            <p className="font-display text-lg">Фенер</p>
            <p className="mt-2 text-ink-soft">
              {SHOP.trader.company}
              <br />
              ЕИК {SHOP.trader.eik}
              <br />
              {SHOP.trader.address}
              <br />
              {SHOP.trader.email}, {SHOP.trader.phone}
            </p>
          </div>
          <ul className="space-y-2">
            <li><Link className="underline-offset-4 hover:underline" href="/usloviya">Общи условия и доставка</Link></li>
            <li><Link className="underline-offset-4 hover:underline" href="/prosledyavane">Проследяване на поръчка</Link></li>
            <li><Link className="font-semibold underline underline-offset-4" href="/otkaz">Отказ от договора тук</Link></li>
            <li><ConsentSettingsLink /></li>
          </ul>
          <div className="text-ink-soft">
            <p>Плащане при доставка или с карта. Доставка с Еконт и Спиди.</p>
            <p className="mt-3">
              <Link className="underline underline-offset-4" href="/admin">Админ панел</Link>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
