/**
 * Mock courier: behaves like a courier API, but everything happens inside this app.
 * Used for Speedy until you have an API account, and for the automated tests.
 *
 * Every status check moves a parcel one step forward:
 * created -> in_transit -> delivered. So you can click through the whole flow in minutes.
 */
import type { CourierId } from "../../lib/settings";
import { DEMO_OFFICES } from "../../db/demo-offices";
import type { CourierAdapter, ShipmentState, TrackingEvent } from "./types";

const NEXT: Record<ShipmentState, ShipmentState> = {
  created: "in_transit",
  in_transit: "delivered",
  delivered: "delivered",
  returned: "returned",
  cancelled: "cancelled",
};

const TEXT: Record<ShipmentState, string> = {
  created: "Очаква предаване към куриера",
  in_transit: "Пътува към офиса на получателя",
  delivered: "Доставена",
  returned: "Върната към подателя",
  cancelled: "Анулирана",
};

function events(state: ShipmentState): TrackingEvent[] {
  const order: ShipmentState[] = ["created", "in_transit", "delivered"];
  const upTo = order.indexOf(state);
  const now = Date.now();
  return order.slice(0, upTo + 1).map((s, i) => ({
    time: new Date(now - (upTo - i) * 60_000).toISOString(),
    text: TEXT[s],
    place: s === "in_transit" ? "Сортировъчен център (демо)" : null,
  }));
}

export function mockAdapter(courier: CourierId): CourierAdapter {
  const prefix = courier === "econt" ? "EC" : "SP";
  return {
    courier,
    mode: "mock",

    async fetchOffices() {
      return DEMO_OFFICES.filter((o) => o.courier === courier).map(({ courier: _c, ...o }) => o);
    },

    async createShipment(request) {
      const digits = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b % 10).join("");
      // A made-up tariff, so the admin sees a cost like with a real courier: 3,50 € + 0,80 € per kg.
      const costCents = 350 + Math.ceil(request.weightGrams / 1000) * 80 + (request.codAmountCents ? 60 : 0);
      return { trackingNumber: `${prefix}${digits}`, labelUrl: null, costCents, costCurrency: "EUR" };
    },

    async cancelShipment() {},

    async track(items) {
      return items.map(({ trackingNumber, current }) => {
        const state = NEXT[current];
        return { trackingNumber, state, statusText: TEXT[state], events: events(state) };
      });
    },

    async label(trackingNumber) {
      const html = `<!doctype html><html lang="bg"><meta charset="utf-8"><title>Етикет ${trackingNumber}</title>
<body style="font-family:system-ui,sans-serif;max-width:10cm;margin:1cm auto;border:2px dashed #333;padding:1cm">
<p style="margin:0;font-size:12px">ДЕМО ЕТИКЕТ, не е истинска товарителница</p>
<h1 style="font-size:28px;letter-spacing:2px">${trackingNumber}</h1>
<p>Куриер: ${courier === "econt" ? "Еконт" : "Спиди"} (симулация)</p>
<p style="font-size:12px">Истинският етикет идва като PDF от куриера и има баркод, който куриерът сканира.</p>
<button onclick="print()">Печат</button></body></html>`;
      return { contentType: "text/html; charset=utf-8", body: html };
    },
  };
}
