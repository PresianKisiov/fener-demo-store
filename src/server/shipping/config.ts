/**
 * Courier settings, read from environment variables (Netlify: Project configuration >
 * Environment variables). Nothing secret is needed for the demo modes.
 *
 * ECONT_MODE   demo (default) | live | mock
 *   demo: Econt's public test system with its public test account. Real API calls,
 *         real waybill numbers and PDF labels, but no courier ever comes.
 *   live: your own e-Econt account (ECONT_USERNAME, ECONT_PASSWORD). Real parcels, real money.
 *   mock: no network at all. Used by the automated tests.
 *
 * SPEEDY_MODE  mock (default) | live
 *   Speedy gives API accounts on request (api.registration@speedy.bg).
 *   With SPEEDY_USERNAME and SPEEDY_PASSWORD set, use live.
 */
import type { CourierId } from "../../lib/settings";
import { CourierError, type CourierMode } from "./types";

const env = (name: string) => process.env[name]?.trim() || undefined;

function modeOf(name: string, fallback: CourierMode, allowed: CourierMode[]): CourierMode {
  const value = env(name) as CourierMode | undefined;
  if (!value) return fallback;
  if (!allowed.includes(value)) throw new CourierError(`${name}=${value} не е позволено. Възможности: ${allowed.join(", ")}.`);
  return value;
}

export function courierMode(courier: CourierId): CourierMode {
  return courier === "econt" ? modeOf("ECONT_MODE", "demo", ["demo", "live", "mock"]) : modeOf("SPEEDY_MODE", "mock", ["live", "mock"]);
}

/** Who sends the parcels. Printed on the label as the sender. */
export function senderConfig() {
  return {
    name: env("SHIPPING_SENDER_NAME") ?? "Фенер Демо",
    phone: env("SHIPPING_SENDER_PHONE") ?? "+359888000000",
  };
}

export function econtConfig() {
  const mode = courierMode("econt");
  if (mode === "live") {
    const username = env("ECONT_USERNAME");
    const password = env("ECONT_PASSWORD");
    if (!username || !password) throw new CourierError("ECONT_MODE=live изисква ECONT_USERNAME и ECONT_PASSWORD (данните за вход в e-Econt).");
    return { baseUrl: "https://ee.econt.com/services", username, password, ...econtShared() };
  }
  // Econt's public test account, published in their API documentation.
  return {
    baseUrl: "https://demo.econt.com/ee/services",
    username: env("ECONT_USERNAME") ?? "iasp-dev",
    password: env("ECONT_PASSWORD") ?? "1Asp-dev",
    ...econtShared(),
  };
}

function econtShared() {
  return {
    // The office where you hand over the parcels. 5306 = Econt Габрово, ул. Доктор Заменхоф 3.
    senderOfficeCode: env("ECONT_SENDER_OFFICE_CODE") ?? "5306",
    // How the shop pays Econt: "cash" at the office, or "credit" with a contract and monthly invoice.
    paymentMethod: env("ECONT_PAYMENT_METHOD") ?? "cash",
  };
}

export function speedyConfig() {
  const username = env("SPEEDY_USERNAME");
  const password = env("SPEEDY_PASSWORD");
  if (!username || !password) throw new CourierError("SPEEDY_MODE=live изисква SPEEDY_USERNAME и SPEEDY_PASSWORD.");
  return {
    baseUrl: "https://api.speedy.bg/v1",
    username,
    password,
    // 505 is Speedy's standard domestic service in their examples. Check yours with the /services method.
    serviceId: Number(env("SPEEDY_SERVICE_ID") ?? 505),
    // Optional: the Speedy office where you drop off parcels. Without it Speedy uses the address in your contract.
    senderOfficeId: env("SPEEDY_SENDER_OFFICE_ID") ? Number(env("SPEEDY_SENDER_OFFICE_ID")) : null,
  };
}

/** Public tracking pages, for emails and the customer tracking page. */
export function publicTrackingUrl(courier: string, trackingNumber: string): string | null {
  if (courier === "econt") return `https://www.econt.com/services/track-shipment/${encodeURIComponent(trackingNumber)}`;
  if (courier === "speedy") return `https://www.speedy.bg/bg/track-shipment?shipmentNumber=${encodeURIComponent(trackingNumber)}`;
  return null;
}
