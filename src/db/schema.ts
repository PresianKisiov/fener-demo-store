/**
 * Database schema. This file is the single source of truth for the tables.
 * `npm run db:generate` turns it into SQL migrations in src/db/migrations.
 *
 * Money is always stored as integer cents (2490 = 24,90 €). Never floats.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
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
  // Weight with the packaging. Couriers price by weight, so the waybill form adds these up.
  weightGrams: integer("weight_grams").notNull().default(500),
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

// Binary data (the image bytes). PGlite returns Uint8Array, postgres-js a Buffer; both are Uint8Array.
const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({ dataType: () => "bytea" });

// Product photos, stored in Postgres. For 20 products with 4 photos of ~150 KB that is
// about 12 MB, well inside Neon's free 0.5 GB. A big catalog would move them to a file store.
export const productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  contentType: text("content_type").notNull(),
  data: bytea("data").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: createdAt(),
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

// A copy of the couriers' office lists. The checkout reads from here, not from the
// courier API, so it stays fast and works even when the courier API is slow or down.
// "Обнови офисите" in the admin panel (and every online build) replaces the rows.
export const courierOffices = pgTable("courier_offices", {
  // `${courier}-${code}`, for example "econt-5306". Stays the same across syncs.
  id: text("id").primaryKey(),
  courier: text("courier").notNull(), // "econt" | "speedy"
  // The courier's own office code. This is what goes into the waybill.
  code: text("code").notNull().default(""),
  kind: text("kind").notNull(), // "office" | "locker"
  city: text("city").notNull(),
  postCode: text("post_code").notNull().default(""),
  name: text("name").notNull(),
  address: text("address").notNull(),
  hours: text("hours").notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
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
  // Only for delivery to an address. The courier needs the post code to find the right place.
  postCode: text("post_code"),
  addressLine: text("address_line"),
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

// Waybills (товарителници). One order has at most one active shipment; a cancelled
// one stays here for history and a new one can be created.
export const shipments = pgTable(
  "shipments",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    courier: text("courier").notNull(),
    // "mock" (invented by this app), "demo" (courier's test system) or "live" (real parcel).
    mode: text("mode").notNull(),
    // Empty for a moment while the courier API is being called (see createShipmentForOrder).
    trackingNumber: text("tracking_number"),
    labelUrl: text("label_url"),
    weightGrams: integer("weight_grams").notNull(),
    // What the courier charges the shop, as returned by the courier. Not what the customer paid.
    costCents: integer("cost_cents"),
    costCurrency: text("cost_currency"),
    // "creating" | "created" | "in_transit" | "delivered" | "returned" | "cancelled"
    status: text("status").notNull(),
    // The courier's own words for the last status, shown to the admin and the customer.
    statusText: text("status_text"),
    events: jsonb("events").$type<{ time: string; text: string; place: string | null }[]>().notNull().default([]),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: createdAt(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  // The database itself refuses a second active shipment for the same order,
  // so a double click cannot create two waybills.
  (t) => [uniqueIndex("shipments_one_active_per_order").on(t.orderId).where(sql`${t.cancelledAt} is null`)],
);

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

// Outbox: every email is written here first, in the same transaction as the change
// that caused it (order placed, shipped...). It is sent after that transaction is
// saved (src/server/email.ts). So an email never goes out for an order that was
// rolled back, and an email the provider refused is not lost: it waits for a retry.
export const emails = pgTable("emails", {
  id: serial("id").primaryKey(),
  toAddress: text("to_address").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  orderId: integer("order_id"),
  // "demo" (no provider set up, only stored) | "pending" | "sending" | "sent" | "failed"
  status: text("status").notNull().default("demo"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  providerId: text("provider_id"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  // When a sender took it from the queue. Lets a stuck "sending" go back to the queue.
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
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
export type Shipment = typeof shipments.$inferSelect;
export type ProductImage = typeof productImages.$inferSelect;

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
