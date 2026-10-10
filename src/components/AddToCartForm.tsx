"use client";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { trackMeta } from "@/lib/meta-client";
import { addToCartAction, type AddToCartState } from "@/app/actions/cart";
import { SubmitButton } from "./SubmitButton";

export function AddToCartForm({ productId, stock, priceCents }: { productId: number; stock: number; priceCents: number }) {
  const [state, formAction] = useActionState<AddToCartState, FormData>(addToCartAction, { added: false });

  // Report the add to Meta once per successful add (does nothing without consent).
  useEffect(() => {
    if (state.added) trackMeta("AddToCart", { content_ids: [String(productId)], content_type: "product", currency: "EUR", value: priceCents / 100 });
  }, [state, productId, priceCents]);

  if (stock < 1) {
    return <p className="font-semibold text-sale">Няма наличност в момента.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="quantity" className="label">
            Брой
          </label>
          <select id="quantity" name="quantity" className="field w-24" defaultValue="1">
            {Array.from({ length: Math.min(stock, 10) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton pendingText="Добавям...">Добави в количката</SubmitButton>
      </div>
      <div aria-live="polite" className="min-h-6 text-sm">
        {state.added && (
          <p className="text-ok">
            Добавено в количката.{" "}
            <Link href="/kolichka" className="font-semibold underline underline-offset-4">
              Виж количката
            </Link>
          </p>
        )}
        {state.error && <p className="text-sale">{state.error}</p>}
      </div>
    </form>
  );
}
