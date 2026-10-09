import { describe, expect, it } from "vitest";
import { priceCart } from "@/lib/pricing";
import { formatEur, parseEurToCents, vatPortion } from "@/lib/money";

const lamp = { productId: 1, name: "Лампа", unitPriceCents: 2490, vatRate: 20, quantity: 1 };

describe("priceCart", () => {
  it("adds office shipping and the COD fee below the free shipping threshold", () => {
    const r = priceCart({ lines: [lamp], deliveryType: "office", paymentMethod: "cod" });
    expect(r.subtotalCents).toBe(2490);
    expect(r.shippingCents).toBe(390);
    expect(r.codFeeCents).toBe(100);
    expect(r.totalCents).toBe(2980);
    expect(r.freeShippingRemainingCents).toBe(2510);
  });

  it("makes shipping free from 50 € and charges no COD fee for card payments", () => {
    const r = priceCart({ lines: [{ ...lamp, quantity: 3 }], deliveryType: "address", paymentMethod: "card" });
    expect(r.subtotalCents).toBe(7470);
    expect(r.shippingCents).toBe(0);
    expect(r.codFeeCents).toBe(0);
    expect(r.totalCents).toBe(7470);
  });

  it("calculates the VAT contained in the total", () => {
    const r = priceCart({ lines: [lamp], deliveryType: "office", paymentMethod: "cod" });
    // 2490 * 20/120 = 415; (390 + 100) * 20/120 = 81.67 -> 82
    expect(r.vatCents).toBe(415 + 82);
  });

  it("rejects zero, negative and fractional quantities", () => {
    for (const quantity of [0, -1, 1.5]) {
      expect(() => priceCart({ lines: [{ ...lamp, quantity }], deliveryType: null, paymentMethod: null })).toThrow();
    }
  });
});

describe("money", () => {
  it("formats euro the Bulgarian way", () => {
    expect(formatEur(2490).replace(/\s/g, " ")).toBe("24,90 €");
  });
  it("parses admin input into cents", () => {
    expect(parseEurToCents("24,90")).toBe(2490);
    expect(parseEurToCents("24.9")).toBe(2490);
    expect(parseEurToCents("7")).toBe(700);
    expect(parseEurToCents("abc")).toBeNull();
    expect(parseEurToCents("1,234")).toBeNull();
  });
  it("extracts VAT from a gross amount", () => {
    expect(vatPortion(1200, 20)).toBe(200);
  });
});
