import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/CheckoutForm";
import { getCartLines } from "@/server/cart";
import { listOfficeCities } from "@/server/couriers";

export const metadata: Metadata = { title: "Поръчка" };

export default async function CheckoutPage() {
  const [lines, cities] = await Promise.all([getCartLines(), listOfficeCities()]);

  if (lines.length === 0) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-display text-3xl font-medium">Няма какво да поръчаш</h1>
        <p className="mt-3 text-ink-soft">Количката е празна.</p>
        <Link href="/katalog" className="btn-primary mt-8">Разгледай лампите</Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-3xl font-medium">Поръчка</h1>
      <div className="mt-8">
        <CheckoutForm
          lines={lines.map((l) => ({
            productId: l.productId,
            name: l.name,
            unitPriceCents: l.unitPriceCents,
            vatRate: l.vatRate,
            quantity: l.quantity,
          }))}
          cities={cities}
        />
      </div>
    </>
  );
}
