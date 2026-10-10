import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/CheckoutForm";
import { MetaEvent } from "@/components/MetaPixel";
import { getCartLines } from "@/server/cart";
import { COURIERS, type CourierId } from "@/lib/settings";
import { listOfficeCities } from "@/server/couriers";
import { courierMode } from "@/server/shipping/config";

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
      <MetaEvent
        name="InitiateCheckout"
        params={{
          currency: "EUR",
          value: lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0) / 100,
          num_items: lines.reduce((sum, l) => sum + l.quantity, 0),
          content_ids: lines.map((l) => String(l.productId)),
        }}
      />
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
          simulatedCouriers={(Object.keys(COURIERS) as CourierId[]).filter((c) => {
            try {
              return courierMode(c) === "mock";
            } catch {
              return false;
            }
          })}
        />
      </div>
    </>
  );
}
