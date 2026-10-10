/**
 * The common language between the shop and every courier.
 *
 * The rest of the app never talks to Econt or Speedy directly. It talks to a
 * CourierAdapter, and each courier has its own adapter that translates these
 * types into that courier's API. Adding a third courier (BOX NOW, Sameday)
 * means writing one more adapter, nothing else changes.
 */
import type { CourierId } from "../../lib/settings";

/** mock: invented by this app, no network. demo: the courier's test system. live: real parcels and real money. */
export type CourierMode = "mock" | "demo" | "live";

export type SyncedOffice = {
  code: string;
  kind: "office" | "locker";
  city: string;
  postCode: string;
  name: string;
  address: string;
  hours: string;
};

export type ShipmentDelivery =
  | { type: "office" | "locker"; officeCode: string }
  | { type: "address"; city: string; postCode: string; addressLine: string };

export type ShipmentRequest = {
  orderNumber: string;
  receiver: { name: string; phone: string; email: string };
  delivery: ShipmentDelivery;
  weightGrams: number;
  description: string;
  /** Cash on delivery: the amount the courier collects from the customer. null when already paid by card. */
  codAmountCents: number | null;
};

export type CreatedShipment = {
  trackingNumber: string;
  /** A ready PDF link (Econt). null when the label is fetched on demand (Speedy, mock). */
  labelUrl: string | null;
  costCents: number | null;
  costCurrency: string | null;
};

/** Our own small set of states. Each courier has dozens of statuses; we only need these. */
export type ShipmentState = "created" | "in_transit" | "delivered" | "returned" | "cancelled";

export type TrackingEvent = { time: string; text: string; place: string | null };

export type TrackingResult = {
  trackingNumber: string;
  state: ShipmentState;
  statusText: string;
  events: TrackingEvent[];
};

export type LabelFile = { contentType: string; body: ArrayBuffer | string };

export interface CourierAdapter {
  courier: CourierId;
  mode: CourierMode;
  fetchOffices(): Promise<SyncedOffice[]>;
  createShipment(request: ShipmentRequest): Promise<CreatedShipment>;
  cancelShipment(trackingNumber: string): Promise<void>;
  /** `current` lets the mock courier move a parcel one step forward per check. Real couriers ignore it. */
  track(items: { trackingNumber: string; current: ShipmentState }[]): Promise<TrackingResult[]>;
  label(trackingNumber: string): Promise<LabelFile>;
}

/** An error the admin can read and act on, for example "Невалиден пощенски код". */
export class CourierError extends Error {}

export const centsToAmount = (cents: number) => Math.round(cents) / 100;
export const amountToCents = (amount: number) => Math.round(amount * 100);
