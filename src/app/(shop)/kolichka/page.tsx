import type { Metadata } from "next";
import Link from "next/link";
import { updateCartQuantityAction } from "@/app/actions/cart";
import { LampArt } from "@/components/LampArt";
import { QuantitySelect } from "@/components/QuantitySelect";
import { formatEur } from "@/lib/money";
import { priceCart } from "@/lib/pricing";
import { SHOP } from "@/lib/settings";
import { getCartLines } from "@/server/cart";

export const metadata: Metadata = { title: "Количка" };

export default async function CartPage() {
  const lines = await getCartLines();

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-display text-3xl font-medium">Количката е празна</h1>
        <p className="mt-3 text-ink-soft">Добави лампа от каталога и ще я видиш тук.</p>
        <Link href="/katalog" className="btn-primary mt-8">Разгледай лампите</Link>
      </div>
    );
  }

  const totals = priceCart({ lines, deliveryType: null, paymentMethod: null });
  const progress = Math.min(100, Math.round((totals.subtotalCents / SHOP.shipping.freeFromCents) * 100));

  return (
    <>
      <h1 className="font-display text-3xl font-medium">Количка</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <ul className="divide-y divide-line border-y border-line">
          {lines.map((line) => (
            <li key={line.productId} className="flex gap-4 py-5">
              <Link href={`/produkt/${line.slug}`} className="glow-plate size-20 shrink-0 rounded-2xl p-2 sm:size-24">
                <LampArt kind={line.illustration} className="h-full w-full" />
              </Link>
              <div className="flex flex-1 flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/produkt/${line.slug}`} className="font-semibold hover:underline">{line.name}</Link>
                  <p className="tabular text-sm text-ink-soft">{formatEur(line.unitPriceCents)} за брой</p>
                  <form action={updateCartQuantityAction} className="mt-2">
                    <input type="hidden" name="productId" value={line.productId} />
                    <input type="hidden" name="quantity" value={0} />
                    <button type="submit" className="text-sm underline underline-offset-4 hover:text-sale">Премахни</button>
                  </form>
                </div>
                <div className="flex items-center gap-4">
                  <form action={updateCartQuantityAction}>
                    <input type="hidden" name="productId" value={line.productId} />
                    <QuantitySelect quantity={line.quantity} max={line.stock} label={`Брой за ${line.name}`} />
                  </form>
                  <p className="tabular w-24 text-right font-semibold">{formatEur(line.unitPriceCents * line.quantity)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit rounded-3xl bg-white p-6">
          <div className="tabular flex justify-between text-lg">
            <span>Продукти</span>
            <span className="font-semibold">{formatEur(totals.subtotalCents)}</span>
          </div>
          <div className="mt-5">
            {totals.freeShippingRemainingCents > 0 ? (
              <p className="text-sm">Добави още <span className="font-semibold">{formatEur(totals.freeShippingRemainingCents)}</span> за безплатна доставка.</p>
            ) : (
              <p className="text-sm font-semibold text-ok">Доставката е безплатна.</p>
            )}
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-mist" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Път до безплатна доставка">
              <div className="h-full rounded-full bg-glow" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <p className="mt-5 text-sm text-ink-soft">
            Доставката се избира в следващата стъпка: до офис или автомат {formatEur(SHOP.shipping.officeCents)}, до адрес {formatEur(SHOP.shipping.addressCents)}.
          </p>
          <Link href="/poruchka" className="btn-primary mt-6 w-full">Към поръчката</Link>
        </aside>
      </div>
    </>
  );
}
