/**
 * Econt adapter. Econt's API is JSON over POST with HTTP Basic login:
 *   POST {baseUrl}/{Service}/{Class}.{method}.json
 * Documentation: https://ee.econt.com/services/ (test system: https://demo.econt.com/ee/services/)
 *
 * The request and response shapes below were checked against Econt's test system
 * on 10.10.2026 (offices, calculate, create, status, delete, error answers).
 * The pure functions (build..., parse...) are exported so tests can check them without network.
 */
import type { CourierMode } from "./types";
import { econtConfig, senderConfig } from "./config";
import { formatHourMinute, postJson, readJson, workingHours } from "./http";
import {
  amountToCents,
  centsToAmount,
  CourierError,
  type CourierAdapter,
  type ShipmentRequest,
  type ShipmentState,
  type SyncedOffice,
  type TrackingEvent,
  type TrackingResult,
} from "./types";

type EcontError = { type?: string; message?: string; innerErrors?: EcontError[] };

/** Econt nests errors: "получател:" > "" > "Невалидно населено място." This joins the parts that say something. */
export function econtErrorMessage(error: EcontError): string {
  const parts: string[] = [];
  const walk = (e: EcontError) => {
    const m = e.message?.trim();
    if (m) parts.push(m);
    for (const inner of e.innerErrors ?? []) walk(inner);
  };
  walk(error);
  return parts.join(" ") || "Еконт отказа заявката без обяснение.";
}

type EcontOffice = {
  code: string;
  isAPS?: boolean;
  isMPS?: boolean;
  name: string;
  address?: { city?: { name?: string; postCode?: string }; fullAddress?: string };
  normalBusinessHoursFrom?: number | null;
  normalBusinessHoursTo?: number | null;
  halfDayBusinessHoursFrom?: number | null;
  halfDayBusinessHoursTo?: number | null;
};

export function parseEcontOffices(json: { offices?: EcontOffice[] }): SyncedOffice[] {
  return (json.offices ?? [])
    // Mobile post stations visit a village for an hour a week; not useful for an online shop.
    .filter((o) => !o.isMPS && o.code && o.address?.city?.name)
    .map((o) => {
      const city = o.address!.city!.name!.trim();
      // fullAddress starts with the city name: " Габрово ул. Доктор Заменхоф №3"
      let address = (o.address?.fullAddress ?? "").trim();
      if (address.startsWith(city)) address = address.slice(city.length).trim();
      return {
        code: String(o.code),
        kind: o.isAPS ? ("locker" as const) : ("office" as const),
        city,
        postCode: o.address?.city?.postCode ?? "",
        name: o.name.trim(),
        address,
        hours: workingHours(
          formatHourMinute(o.normalBusinessHoursFrom),
          formatHourMinute(o.normalBusinessHoursTo),
          formatHourMinute(o.halfDayBusinessHoursFrom),
          formatHourMinute(o.halfDayBusinessHoursTo),
        ),
      };
    });
}

export function buildEcontLabel(request: ShipmentRequest, sender = senderConfig(), shared = { senderOfficeCode: "5306", paymentMethod: "cash" }) {
  const d = request.delivery;
  return {
    senderClient: { name: sender.name, phones: [sender.phone] },
    senderOfficeCode: shared.senderOfficeCode,
    receiverClient: { name: request.receiver.name, phones: [request.receiver.phone] },
    ...(d.type === "address"
      ? {
          // Econt needs city + post code; the rest of the address goes into "other" as typed by the customer.
          receiverAddress: { city: { country: { code3: "BGR" }, name: d.city, postCode: d.postCode }, other: d.addressLine },
        }
      : { receiverOfficeCode: d.officeCode }),
    packCount: 1,
    shipmentType: "PACK",
    weight: Math.max(0.1, request.weightGrams / 1000),
    shipmentDescription: request.description.slice(0, 50),
    orderNumber: request.orderNumber,
    ...(request.codAmountCents
      ? { services: { cdAmount: centsToAmount(request.codAmountCents), cdType: "get", cdCurrency: "EUR" } }
      : {}),
    // The shop pays Econt; the customer already paid the shipping price to the shop.
    paymentSenderMethod: shared.paymentMethod,
  };
}

type EcontStatus = {
  shipmentNumber?: string;
  shortDeliveryStatus?: string | null;
  shortDeliveryStatusEn?: string | null;
  pdfURL?: string | null;
  trackingEvents?: {
    destinationType?: string;
    destinationDetails?: string | null;
    officeName?: string | null;
    cityName?: string | null;
    time?: number | null;
  }[];
};

const RETURN_TYPES = ["return", "is_returning_to_sender", "returned_to_sender"];

/** Econt has about 15 statuses; we need to know only whether the parcel moved, arrived or came back. */
export function econtState(status: EcontStatus): ShipmentState {
  const en = (status.shortDeliveryStatusEn ?? "").toLowerCase();
  const types = (status.trackingEvents ?? []).map((e) => e.destinationType ?? "");
  if (en.includes("returned to sender") || en.includes("returning to sender") || types.some((t) => RETURN_TYPES.includes(t))) return "returned";
  if (en === "delivered" || types.includes("client")) return "delivered";
  if (en.startsWith("cancelled")) return "cancelled";
  if (types.length === 0 || types.every((t) => t === "prepared") || en.includes("prepared") || en.includes("awaiting")) return "created";
  return "in_transit";
}

export function econtEvents(status: EcontStatus): TrackingEvent[] {
  return (status.trackingEvents ?? []).map((e) => ({
    time: new Date(e.time ?? Date.now()).toISOString(),
    text: e.destinationDetails?.trim() || e.destinationType || "",
    place: e.officeName?.trim() || e.cityName?.trim() || null,
  }));
}

export const toHttps = (url: string) => url.replace(/^http:\/\//, "https://");

export function econtAdapter(mode: Extract<CourierMode, "demo" | "live">): CourierAdapter {
  const cfg = econtConfig();
  const auth = "Basic " + Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64");

  async function call<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
    const response = await postJson("Еконт", `${cfg.baseUrl}/${path}`, body, { Authorization: auth }, timeoutMs);
    const json = (await readJson("Еконт", response)) as T & EcontError;
    // Econt answers errors with HTTP 517 (yes, 517) and a nested error object.
    if (!response.ok) throw new CourierError(`Еконт: ${econtErrorMessage(json)}`);
    return json;
  }

  async function statuses(numbers: string[]) {
    const json = await call<{ shipmentStatuses?: { status?: EcontStatus | null; error?: EcontError | null }[] }>(
      "Shipments/ShipmentService.getShipmentStatuses.json",
      { shipmentNumbers: numbers },
    );
    return json.shipmentStatuses ?? [];
  }

  return {
    courier: "econt",
    mode,

    async fetchOffices() {
      const json = await call<{ offices?: EcontOffice[] }>("Nomenclatures/NomenclaturesService.getOffices.json", { countryCode: "BGR" }, 25_000);
      return parseEcontOffices(json);
    },

    async createShipment(request) {
      const label = buildEcontLabel(request, senderConfig(), cfg);
      const json = await call<{ label?: { shipmentNumber?: string; pdfURL?: string; totalPrice?: number; currency?: string } }>(
        "Shipments/LabelService.createLabel.json",
        { label, mode: "create" },
      );
      const created = json.label;
      if (!created?.shipmentNumber) throw new CourierError("Еконт не върна номер на товарителница.");
      return {
        trackingNumber: created.shipmentNumber,
        labelUrl: created.pdfURL ? toHttps(created.pdfURL) : null,
        costCents: typeof created.totalPrice === "number" ? amountToCents(created.totalPrice) : null,
        costCurrency: created.currency ?? null,
      };
    },

    async cancelShipment(trackingNumber) {
      const json = await call<{ results?: { error?: EcontError | null }[] }>("Shipments/LabelService.deleteLabels.json", {
        shipmentNumbers: [trackingNumber],
      });
      const error = json.results?.[0]?.error;
      if (error) throw new CourierError(`Еконт: ${econtErrorMessage(error)}`);
    },

    async track(items) {
      const results: TrackingResult[] = [];
      for (let i = 0; i < items.length; i += 50) {
        const chunk = items.slice(i, i + 50);
        const answer = await statuses(chunk.map((c) => c.trackingNumber));
        answer.forEach((row, index) => {
          // A missing status (for example a deleted label) is skipped; the shipment keeps its last known state.
          if (!row.status) return;
          results.push({
            trackingNumber: row.status.shipmentNumber ?? chunk[index].trackingNumber,
            state: econtState(row.status),
            statusText: row.status.shortDeliveryStatus?.trim() || "Няма информация",
            events: econtEvents(row.status),
          });
        });
      }
      return results;
    },

    async label(trackingNumber) {
      const [row] = await statuses([trackingNumber]);
      if (!row?.status?.pdfURL) throw new CourierError("Еконт не върна етикет за тази товарителница.");
      const response = await fetch(toHttps(row.status.pdfURL), { signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new CourierError("Етикетът от Еконт не може да се изтегли.");
      return { contentType: "application/pdf", body: await response.arrayBuffer() };
    },
  };
}
