/**
 * Money helpers. Amounts are integer cents everywhere in the app.
 * Formatting is done only here, with Intl, so "24,90 €" looks the same everywhere.
 */
const eur = new Intl.NumberFormat("bg-BG", { style: "currency", currency: "EUR" });

export function formatEur(cents: number): string {
  return eur.format(cents / 100);
}

/** Parses "24,90" or "24.90" from an admin form into 2490. Returns null if invalid. */
export function parseEurToCents(input: string): number | null {
  const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

/** VAT contained in a VAT-inclusive amount, e.g. 20% of a gross price. */
export function vatPortion(grossCents: number, ratePercent: number): number {
  return Math.round((grossCents * ratePercent) / (100 + ratePercent));
}

/** Price per unit (per metre, kilogram, litre) for goods sold by measure. */
export function unitPriceCents(priceCents: number, measureQuantityMilli: number): number {
  return Math.round((priceCents * 1000) / measureQuantityMilli);
}
