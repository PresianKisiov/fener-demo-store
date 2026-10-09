/**
 * Price calculation. This is a pure function: same input, same output, no database.
 * The checkout page uses it to show a preview in the browser, and the server
 * runs it again on submit with prices read from the database. Only the server
 * result is saved, so a manipulated browser cannot change what the customer pays.
 */
import { vatPortion } from "./money";
import { SHOP, type DeliveryType, type PaymentMethod } from "./settings";

export type PricingLine = {
  productId: number;
  name: string;
  unitPriceCents: number;
  vatRate: number;
  quantity: number;
};

export type PricingInput = {
  lines: PricingLine[];
  deliveryType: DeliveryType | null;
  paymentMethod: PaymentMethod | null;
};

export type PricingResult = {
  lines: (PricingLine & { lineTotalCents: number })[];
  subtotalCents: number;
  shippingCents: number;
  codFeeCents: number;
  totalCents: number;
  vatCents: number;
  /** How much more the customer must add for free shipping (0 if already free). */
  freeShippingRemainingCents: number;
};

export function shippingPrice(deliveryType: DeliveryType | null, subtotalCents: number): number {
  if (deliveryType === null) return 0;
  if (subtotalCents >= SHOP.shipping.freeFromCents) return 0;
  if (deliveryType === "office") return SHOP.shipping.officeCents;
  if (deliveryType === "locker") return SHOP.shipping.lockerCents;
  return SHOP.shipping.addressCents;
}

export function priceCart(input: PricingInput): PricingResult {
  const lines = input.lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error(`Invalid quantity for product ${line.productId}`);
    }
    return { ...line, lineTotalCents: line.unitPriceCents * line.quantity };
  });

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const shippingCents = shippingPrice(input.deliveryType, subtotalCents);
  const codFeeCents = input.paymentMethod === "cod" ? SHOP.codFeeCents : 0;
  const totalCents = subtotalCents + shippingCents + codFeeCents;

  const vatCents =
    lines.reduce((sum, l) => sum + vatPortion(l.lineTotalCents, l.vatRate), 0) +
    vatPortion(shippingCents + codFeeCents, SHOP.shippingVatRate);

  return {
    lines,
    subtotalCents,
    shippingCents,
    codFeeCents,
    totalCents,
    vatCents,
    freeShippingRemainingCents: Math.max(0, SHOP.shipping.freeFromCents - subtotalCents),
  };
}
