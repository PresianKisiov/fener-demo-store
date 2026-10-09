/**
 * EU Omnibus rule for announced price reductions: the "prior price" shown next to
 * a reduced price is the LOWEST price the product had during the 30 days before
 * the reduction started. Not the highest, not a made-up "regular" price.
 */
export type PricePoint = { priceCents: number; validFrom: Date };

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Lowest price applied during the `days` before `reductionStart`.
 * A price counts if the period when it was valid overlaps that window.
 * Returns null if the product had no price in the window (e.g. it is brand new).
 */
export function lowestPriceBefore(
  history: PricePoint[],
  reductionStart: Date,
  days = 30,
): number | null {
  const windowStart = reductionStart.getTime() - days * DAY_MS;
  const windowEnd = reductionStart.getTime();
  const sorted = [...history].sort((a, b) => a.validFrom.getTime() - b.validFrom.getTime());

  let lowest: number | null = null;
  sorted.forEach((point, i) => {
    const from = point.validFrom.getTime();
    const to = i + 1 < sorted.length ? sorted[i + 1].validFrom.getTime() : Infinity;
    const overlaps = from < windowEnd && to > windowStart;
    if (overlaps && (lowest === null || point.priceCents < lowest)) {
      lowest = point.priceCents;
    }
  });
  return lowest;
}

/** Discount percentage calculated from the prior price, rounded down so it never overstates. */
export function discountPercent(priorCents: number, currentCents: number): number {
  if (priorCents <= 0 || currentCents >= priorCents) return 0;
  return Math.floor(((priorCents - currentCents) / priorCents) * 100);
}
