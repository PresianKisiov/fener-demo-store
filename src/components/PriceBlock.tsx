import { discountPercent } from "@/lib/omnibus";
import { formatEur, unitPriceCents } from "@/lib/money";

type Props = {
  priceCents: number;
  priorPriceCents: number | null;
  measureUnit?: string | null;
  measureQuantityMilli?: number | null;
  size?: "sm" | "lg";
};

/**
 * Price as the law wants it: when a reduction is announced, the reference is the
 * lowest price of the last 30 days, and the percentage is calculated from it.
 */
export function PriceBlock({ priceCents, priorPriceCents, measureUnit, measureQuantityMilli, size = "sm" }: Props) {
  const percent = priorPriceCents ? discountPercent(priorPriceCents, priceCents) : 0;
  const big = size === "lg";
  return (
    <div className="tabular">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={big ? "font-display text-3xl" : "font-semibold text-lg"}>{formatEur(priceCents)}</span>
        {percent > 0 && (
          <span className={`rounded-full bg-sale px-2 py-0.5 font-semibold text-white ${big ? "text-sm" : "text-xs"}`}>
            -{percent}%
          </span>
        )}
      </div>
      {percent > 0 && priorPriceCents && (
        <p className={`text-ink-soft ${big ? "mt-1 text-sm" : "text-xs"}`}>
          Най-ниска цена през последните 30 дни: <span className="line-through">{formatEur(priorPriceCents)}</span>
        </p>
      )}
      {measureUnit && measureQuantityMilli ? (
        <p className={`text-ink-soft ${big ? "mt-1 text-sm" : "text-xs"}`}>
          {formatEur(unitPriceCents(priceCents, measureQuantityMilli))} за {measureUnit}
        </p>
      ) : null}
    </div>
  );
}
