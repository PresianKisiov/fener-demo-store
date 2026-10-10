/**
 * Speedy adapter. Speedy's API is JSON over POST, with the user name and password
 * inside every request body (not in a header):
 *   POST https://api.speedy.bg/v1/{method}
 * Documentation: https://api.speedy.bg/web-api.html
 *
 * NOT TESTED against Speedy yet: Speedy gives API accounts only on request
 * (e-mail api.registration@speedy.bg with name, company and phone). The field
 * names follow their documentation. Until you have an account, SPEEDY_MODE stays
 * "mock". The first real test: Куриери > Обнови офисите, then one waybill.
 */
import { speedyConfig } from "./config";
import { postJson, readJson, workingHours } from "./http";
import {
  amountToCents,
  centsToAmount,
  CourierError,
  type CourierAdapter,
  type ShipmentRequest,
  type ShipmentState,
  type SyncedOffice,
  type TrackingResult,
} from "./types";

type SpeedyError = { message?: string; code?: number; context?: string };

/** Speedy writes place names in capitals ("ВЕЛИКО ТЪРНОВО"). */
export function titleCase(value: string): string {
  if (value !== value.toUpperCase()) return value;
  return value.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep: string, letter: string) => sep + letter.toUpperCase());
}

type SpeedyOffice = {
  id: number;
  name: string;
  type?: "OFFICE" | "APT";
  address?: { siteName?: string; postCode?: string; localAddressString?: string; fullAddressString?: string };
  workingTimeFrom?: string;
  workingTimeTo?: string;
  workingTimeHalfFrom?: string;
  workingTimeHalfTo?: string;
};

export function parseSpeedyOffices(json: { offices?: SpeedyOffice[] }): SyncedOffice[] {
  return (json.offices ?? [])
    .filter((o) => o.id && o.address?.siteName)
    .map((o) => ({
      code: String(o.id),
      kind: o.type === "APT" ? ("locker" as const) : ("office" as const),
      city: titleCase(o.address!.siteName!.trim()),
      postCode: o.address?.postCode ?? "",
      name: o.name.trim(),
      address: (o.address?.localAddressString || o.address?.fullAddressString || "").trim(),
      hours: workingHours(o.workingTimeFrom ?? null, o.workingTimeTo ?? null, o.workingTimeHalfFrom ?? null, o.workingTimeHalfTo ?? null),
    }));
}

export function buildSpeedyShipment(request: ShipmentRequest, serviceId = 505, senderOfficeId: number | null = null) {
  const d = request.delivery;
  return {
    ...(senderOfficeId ? { sender: { dropoffOfficeId: senderOfficeId } } : {}),
    recipient: {
      phone1: { number: request.receiver.phone },
      clientName: request.receiver.name.slice(0, 60),
      email: request.receiver.email,
      privatePerson: true,
      ...(d.type === "address"
        ? { address: { countryId: 100, siteName: d.city, postCode: d.postCode, addressNote: d.addressLine } }
        : { pickupOfficeId: Number(d.officeCode) }),
    },
    service: {
      serviceId,
      autoAdjustPickupDate: true,
      ...(request.codAmountCents
        ? { additionalServices: { cod: { amount: centsToAmount(request.codAmountCents), processingType: "CASH" } } }
        : {}),
    },
    content: {
      parcelsCount: 1,
      totalWeight: Math.max(0.1, request.weightGrams / 1000),
      contents: request.description.slice(0, 100),
      package: "BOX",
    },
    payment: { courierServicePayer: "SENDER" },
    ref1: request.orderNumber,
  };
}

type SpeedyOperation = { dateTime?: string; operationCode?: number; description?: string; place?: string };

/** Operation codes from Speedy's documentation, Appendix 1. */
export function speedyState(operations: SpeedyOperation[]): ShipmentState {
  const codes = operations.map((o) => o.operationCode);
  if (codes.some((c) => c === 111 || c === 124 || c === 123)) return "returned";
  if (codes.includes(-14)) return "delivered";
  if (codes.includes(128)) return "cancelled";
  if (codes.every((c) => c === 148)) return "created";
  return "in_transit";
}

export function speedyAdapter(): CourierAdapter {
  const cfg = speedyConfig();
  const login = { userName: cfg.username, password: cfg.password, language: "BG" };

  async function call<T>(path: string, body: Record<string, unknown>, timeoutMs?: number): Promise<T> {
    const response = await postJson("Спиди", `${cfg.baseUrl}/${path}`, { ...login, ...body }, {}, timeoutMs);
    const json = (await readJson("Спиди", response)) as T & { error?: SpeedyError };
    // Speedy returns errors inside the JSON, often with HTTP 200.
    if (json.error) throw new CourierError(`Спиди: ${json.error.message ?? "непозната грешка"}`);
    if (!response.ok) throw new CourierError(`Спиди върна HTTP ${response.status}.`);
    return json;
  }

  return {
    courier: "speedy",
    mode: "live",

    async fetchOffices() {
      return parseSpeedyOffices(await call<{ offices?: SpeedyOffice[] }>("location/office", { countryId: 100 }, 25_000));
    },

    async createShipment(request) {
      const json = await call<{ id?: string; price?: { total?: number; currency?: string } }>(
        "shipment",
        buildSpeedyShipment(request, cfg.serviceId, cfg.senderOfficeId),
      );
      if (!json.id) throw new CourierError("Спиди не върна номер на товарителница.");
      return {
        trackingNumber: json.id,
        labelUrl: null,
        costCents: typeof json.price?.total === "number" ? amountToCents(json.price.total) : null,
        costCurrency: json.price?.currency ?? null,
      };
    },

    async cancelShipment(trackingNumber) {
      await call("shipment/cancel", { shipmentId: trackingNumber, comment: "Анулирана от магазина" });
    },

    async track(items) {
      const results: TrackingResult[] = [];
      // Speedy allows up to 10 parcels per request. For a one-parcel shipment the parcel id equals the shipment id.
      for (let i = 0; i < items.length; i += 10) {
        const chunk = items.slice(i, i + 10);
        const json = await call<{ parcels?: { parcelId: string; operations?: SpeedyOperation[]; error?: SpeedyError }[] }>("track", {
          parcels: chunk.map((c) => ({ id: c.trackingNumber })),
        });
        for (const parcel of json.parcels ?? []) {
          const operations = parcel.operations ?? [];
          if (parcel.error || operations.length === 0) continue;
          const last = operations[operations.length - 1];
          results.push({
            trackingNumber: parcel.parcelId,
            state: speedyState(operations),
            statusText: last.description ?? "Няма информация",
            events: operations.map((o) => ({
              time: o.dateTime ? new Date(o.dateTime).toISOString() : new Date().toISOString(),
              text: o.description ?? "",
              place: o.place ?? null,
            })),
          });
        }
      }
      return results;
    },

    async label(trackingNumber) {
      const response = await postJson("Спиди", `${cfg.baseUrl}/print`, {
        ...login,
        paperSize: "A6",
        parcels: [{ parcel: { id: trackingNumber } }],
      });
      // A PDF on success, JSON with an error otherwise.
      if ((response.headers.get("content-type") ?? "").includes("application/pdf")) {
        return { contentType: "application/pdf", body: await response.arrayBuffer() };
      }
      const json = (await readJson("Спиди", response)) as { error?: SpeedyError };
      throw new CourierError(`Спиди: ${json.error?.message ?? "етикетът не може да се отпечата"}`);
    },
  };
}
