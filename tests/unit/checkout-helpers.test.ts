import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { filterCities } from "@/components/CityPicker";
import { suggestEmail } from "@/lib/email-typo";
import { emailDomainStatus, resetEmailCheckCache } from "@/server/email-check";
import { sniffImageType } from "@/server/images";
import { buildPurchaseEvent, purchaseEventId } from "@/server/meta";
import { mockState } from "@/server/shipping/mock";
import type { Order, OrderItem } from "@/db/schema";

describe("city search", () => {
  const cities = ["Велико Търново", "Габрово", "Горна Оряховица", "Нова Загора", "Ново село", "София", "Стара Загора"];
  it("puts cities that start with the letters first, then the rest that contain them", () => {
    expect(filterCities(cities, "габ")).toEqual(["Габрово"]);
    expect(filterCities(cities, "заг")).toEqual(["Нова Загора", "Стара Загора"]);
    expect(filterCities(cities, "но")).toEqual(["Нова Загора", "Ново село", "Велико Търново"]);
    expect(filterCities(cities, "  СОФ ")).toEqual(["София"]);
    expect(filterCities(cities, "")).toEqual([]);
  });
});

describe("email typos", () => {
  it("suggests the common domain the customer probably meant", () => {
    expect(suggestEmail("ivan@gmial.com")).toBe("ivan@gmail.com");
    expect(suggestEmail("ivan@abv.bh")).toBe("ivan@abv.bg");
    expect(suggestEmail("ivan@gmail.co")).toBe("ivan@gmail.com");
    expect(suggestEmail("ivan@yaho.com")).toBe("ivan@yahoo.com");
  });
  it("leaves correct and unknown domains alone", () => {
    expect(suggestEmail("ivan@gmail.com")).toBeNull();
    expect(suggestEmail("office@fortuna-auto.bg")).toBeNull();
    expect(suggestEmail("no-at-sign")).toBeNull();
  });
});

describe("email domain check", () => {
  const notFound = () => Promise.reject(Object.assign(new Error("not found"), { code: "ENOTFOUND" }));
  const resolver = (mx: Record<string, string[]>, a: Record<string, string[]> = {}, aaaa: Record<string, string[]> = {}) => ({
    resolveMx: (host: string) => (host in mx ? Promise.resolve(mx[host].map((exchange) => ({ exchange, priority: 10 }))) : notFound()),
    resolve4: (host: string) => (host in a ? Promise.resolve(a[host]) : notFound()),
    resolve6: (host: string) => (host in aaaa ? Promise.resolve(aaaa[host]) : notFound()),
  });
  beforeEach(() => resetEmailCheckCache());

  it("accepts a domain with mail servers and rejects a misspelled one", async () => {
    const dns = resolver({ "gmail.com": ["gmail-smtp-in.l.google.com"], "abv.bg": ["mx.abv.bg"] });
    expect(await emailDomainStatus("ivan@abv.bg", dns)).toBe("accepts");
    expect(await emailDomainStatus("ivan@gmial.com", dns)).toBe("rejects");
  });
  it("rejects a domain that says it never receives email (null MX)", async () => {
    const dns = resolver({ "gmail.com": ["gmail-smtp-in.l.google.com"], "example.com": [""] });
    expect(await emailDomainStatus("ivan@example.com", dns)).toBe("rejects");
  });
  it("accepts a domain without MX but with an address (allowed by the standard)", async () => {
    const dns = resolver({ "gmail.com": ["gmail-smtp-in.l.google.com"] }, { "small-firm.bg": ["1.2.3.4"] });
    expect(await emailDomainStatus("ivan@small-firm.bg", dns)).toBe("accepts");
  });
  it("accepts a domain reachable only over IPv6", async () => {
    const dns = resolver({ "gmail.com": ["gmail-smtp-in.l.google.com"] }, {}, { "v6only.bg": ["2001:db8::1"] });
    expect(await emailDomainStatus("ivan@v6only.bg", dns)).toBe("accepts");
  });
  it("gives up after 3 seconds instead of keeping the customer waiting", async () => {
    vi.useFakeTimers();
    const hang = () => new Promise<never>(() => {});
    const status = emailDomainStatus("ivan@slow.bg", { resolveMx: hang, resolve4: hang, resolve6: hang });
    await vi.advanceTimersByTimeAsync(3001);
    expect(await status).toBe("unknown");
    vi.useRealTimers();
  });
  it("never blocks when DNS itself does not work here", async () => {
    const dns = resolver({});
    expect(await emailDomainStatus("ivan@gmial.com", dns)).toBe("unknown");
  });
});

describe("photo type check", () => {
  it("reads the real type from the first bytes", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });
});

describe("Meta purchase event", () => {
  it("hashes personal data and carries the same event id as the Pixel", () => {
    const order = {
      number: "2026-000123",
      email: " Ivan@Example.com ",
      phone: "+359888123456",
      totalCents: 5470,
      createdAt: new Date("2026-10-10T10:00:00Z"),
    } as Order;
    const items = [{ productId: 1, quantity: 2, unitPriceCents: 2490 }] as OrderItem[];
    const event = buildPurchaseEvent(order, items, { ip: "1.2.3.4", userAgent: "UA", fbp: "fb.1.1.1", fbc: null, url: "https://x/poruchka" });
    expect(event.event_id).toBe(purchaseEventId(order));
    expect(event.event_id).toBe("order-2026-000123");
    // Lowercased and trimmed before hashing, as Meta requires; phone as digits with country code.
    expect(event.user_data.em[0]).toBe(createHash("sha256").update("ivan@example.com").digest("hex"));
    expect(event.user_data.ph[0]).toBe(createHash("sha256").update("359888123456").digest("hex"));
    expect(JSON.stringify(event)).not.toContain("ivan@example.com");
    expect(JSON.stringify(event)).not.toContain("888123456");
    expect(event.user_data).not.toHaveProperty("fbc");
    expect(event.custom_data).toMatchObject({ currency: "EUR", value: 54.7, num_items: 2, content_ids: ["1"] });
  });
});

describe("mock courier timing", () => {
  it("moves the parcel with time, not with the number of checks", () => {
    const created = new Date("2026-10-10T10:00:00Z");
    const at = (minutes: number) => created.getTime() + minutes * 60_000;
    expect(mockState(created, at(1))).toBe("created");
    expect(mockState(created, at(2))).toBe("in_transit");
    expect(mockState(created, at(4))).toBe("delivered");
  });
});
