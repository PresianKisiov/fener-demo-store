/**
 * Database schema. This file is the single source of truth for the tables.
 * `npm run db:generate` turns it into SQL migrations in src/db/migrations.
 *
 * Money is always stored as integer cents (2490 = 24,90 €). Never floats.
 */
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  shortDescription: text("short_description").notNull(),
  description: text("description").notNull(),
  // Which SVG drawing to show (the demo has no real photos).
  illustration: text("illustration").notNull(),
  // Current selling price, VAT included.
  priceCents: integer("price_cents").notNull(),
  // Set only while a price reduction is announced: the lowest price
  // of the 30 days before the reduction (EU Omnibus rule).
  priorPriceCents: integer("prior_price_cents"),
  reductionStartedAt: timestamp("reduction_started_at", { withTimezone: true }),
  vatRate: integer("vat_rate").notNull().default(20),
  // Unit price rule: goods sold by length, weight or volume also show the price per unit.
  // Example: a 2 m LED strip has measureUnit "м" and measureQuantityMilli 2000.
  measureUnit: text("measure_unit"),
  measureQuantityMilli: integer("measure_quantity_milli"),
  stock: integer("stock").notNull().default(0),
  specs: jsonb("specs").$type<[string, string][]>().notNull().default([]),
  isPublished: boolean("is_published").notNull().default(false),
  // Product safety (GPSR). Publishing is blocked while these are incomplete.
  modelNumber: text("model_number").notNull().default(""),
  manufacturerName: text("manufacturer_name").notNull().default(""),
  manufacturerAddress: text("manufacturer_address").notNull().default(""),
  manufacturerEmail: text("manufacturer_email").notNull().default(""),
  manufacturerInEu: boolean("manufacturer_in_eu").notNull().default(true),
  euResponsibleName: text("eu_responsible_name").notNull().default(""),
  euResponsibleAddress: text("eu_responsible_address").notNull().default(""),
  euResponsibleEmail: text("eu_responsible_email").notNull().default(""),
  safetyWarnings: text("safety_warnings").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Every price a product has ever had. The Omnibus "prior price" is
// calculated from here, never typed by hand.
export const priceHistory = pgTable("price_history", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  priceCents: integer("price_cents").notNull(),
  validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
  changedBy: text("changed_by").notNull(),
});

export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: createdAt(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.cartId, t.productId] })],
);

export const courierOffices = pgTable("courier_offices", {
  id: text("id").primaryKey(),
  courier: text("courier").notNull(), // "econt" | "speedy"
  kind: text("kind").notNull(), // "office" | "locker"
  city: text("city").notNull(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  hours: text("hours").notNull(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  // Human-friendly number shown to the customer, e.g. 2026-000012.
  number: text("number").notNull().unique(),
  // Unguessable id for the customer's thank-you page, so nobody can
  // read someone else's order by changing a number in the URL.
  publicToken: uuid("public_token").notNull().unique().defaultRandom(),
  status: text("status").notNull(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  courier: text("courier").notNull(),
  deliveryType: text("delivery_type").notNull(), // "office" | "address"
  officeId: text("office_id"),
  deliveryLabel: text("delivery_label").notNull(), // office name or full address, as shown to people
  city: text("city").notNull(),
  paymentMethod: text("payment_method").notNull(), // "cod" | "card"
  subtotalCents: integer("subtotal_cents").notNull(),
  shippingCents: integer("shipping_cents").notNull(),
  codFeeCents: integer("cod_fee_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  vatCents: integer("vat_cents").notNull(),
  marketingConsent: boolean("marketing_consent").notNull().default(false),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
  trackingNumber: text("tracking_number"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// A snapshot of each line at the moment of purchase. Old orders never
// change when a product's name or price changes later.
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  vatRate: integer("vat_rate").notNull(),
  quantity: integer("quantity").notNull(),
  lineTotalCents: integer("line_total_cents").notNull(),
});

export const payments = pgTable("payments", {
  // Also used as the payment session id at the provider.
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // "mock" | "stripe"
  providerRef: text("provider_ref"),
  status: text("status").notNull(), // "pending" | "succeeded" | "failed"
  amountCents: integer("amount_cents").notNull(),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Each webhook event is stored once. The unique index makes a replayed
// event a no-op instead of a second "payment succeeded".
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webhook_events_provider_event_id").on(t.provider, t.eventId)],
);

export const withdrawals = pgTable("withdrawals", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  reason: text("reason"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
  goodsReceivedAt: timestamp("goods_received_at", { withTimezone: true }),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
});

// Outbox: in the demo, emails are stored here instead of being sent.
// A real provider (Resend, Postmark) would plug into src/lib/email.ts.
export const emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  orderId: integer("order_id"),
  createdAt: createdAt(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  entity: text("entity").notNull(),
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  actor: text("actor").notNull(),
  createdAt: createdAt(),
});

export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type CourierOffice = typeof courierOffices.$inferSelect;

// Admin accounts. The password is never stored, only a scrypt hash of it (see src/lib/password.ts).
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export type Admin = typeof admins.$inferSelect;
