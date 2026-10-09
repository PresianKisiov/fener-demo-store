import { describe, expect, it } from "vitest";
import { discountPercent, lowestPriceBefore } from "@/lib/omnibus";

const day = (n: number) => new Date(Date.UTC(2026, 9, 1) + n * 86_400_000);

describe("lowestPriceBefore", () => {
  it("uses the lowest price of the 30 days before the reduction, not the old high price", () => {
    const history = [
      { priceCents: 5990, validFrom: day(-90) },
      { priceCents: 5490, validFrom: day(-25) },
      { priceCents: 4490, validFrom: day(0) },
    ];
    expect(lowestPriceBefore(history, day(0))).toBe(5490);
  });

  it("counts a price that started before the window but was still valid inside it", () => {
    const history = [
      { priceCents: 3990, validFrom: day(-60) },
      { priceCents: 4990, validFrom: day(-5) },
    ];
    expect(lowestPriceBefore(history, day(0))).toBe(3990);
  });

  it("ignores prices that ended before the window", () => {
    const history = [
      { priceCents: 1990, validFrom: day(-80) },
      { priceCents: 4990, validFrom: day(-40) },
    ];
    expect(lowestPriceBefore(history, day(0))).toBe(4990);
  });

  it("catches the trick of raising the price just before a sale", () => {
    const history = [
      { priceCents: 2990, validFrom: day(-50) },
      { priceCents: 4990, validFrom: day(-3) },
    ];
    // A "-40% from 49,90" banner would be misleading: the reference price is 29,90.
    expect(lowestPriceBefore(history, day(0))).toBe(2990);
  });

  it("returns null when the product had no price in the window", () => {
    expect(lowestPriceBefore([{ priceCents: 1000, validFrom: day(0) }], day(0))).toBeNull();
  });
});

describe("discountPercent", () => {
  it("rounds down", () => {
    expect(discountPercent(5490, 4490)).toBe(18);
  });
  it("is zero when the price is not lower", () => {
    expect(discountPercent(4490, 4490)).toBe(0);
  });
});
