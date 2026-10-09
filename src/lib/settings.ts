/**
 * Store settings. In a real store these would live in a `settings` table
 * and be editable in the admin panel. In the demo they are constants.
 */
export const SHOP = {
  name: "Фенер",
  // Demo trader data. A real store must show its real company data here (Закон за електронната търговия).
  trader: {
    company: "Демо магазин, няма реален търговец",
    eik: "000000000",
    address: "ул. Примерна 1, 5300 Габрово",
    email: "shop@example.com",
    phone: "+359 88 000 0000",
  },
  shipping: {
    officeCents: 390,
    lockerCents: 390,
    addressCents: 590,
    freeFromCents: 5000,
  },
  // Fee charged to the customer for cash on delivery. Shown before the order is placed.
  codFeeCents: 100,
  shippingVatRate: 20,
  withdrawalDays: 14,
  // Working days from order to delivery: min for dispatch + courier, max with buffer.
  deliveryWorkingDays: { min: 1, max: 3 },
} as const;

export const COURIERS = {
  econt: "Еконт",
  speedy: "Спиди",
} as const;
export type CourierId = keyof typeof COURIERS;

export const DELIVERY_TYPES = {
  office: "До офис",
  locker: "До автомат",
  address: "До адрес",
} as const;
export type DeliveryType = keyof typeof DELIVERY_TYPES;

export const PAYMENT_METHODS = {
  cod: "Наложен платеж",
  card: "С карта",
} as const;
export type PaymentMethod = keyof typeof PAYMENT_METHODS;
