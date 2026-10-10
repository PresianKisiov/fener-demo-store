/**
 * Meta Conversions API: the server reports a purchase straight to Meta.
 *
 * Why a second report next to the Pixel: browsers and ad blockers often stop the
 * Pixel, so Meta would miss part of the purchases and learn from wrong numbers.
 * Both reports carry the same event_id, so Meta counts the purchase once.
 *
 * Personal data (email, phone) is never sent in plain text: Meta requires SHA-256
 * hashes. And nothing is sent without the visitor's consent to advertising cookies.
 *
 * Settings: META_PIXEL_ID, META_CAPI_TOKEN (Events Manager > Settings > Conversions API),
 * optional META_TEST_EVENT_CODE (events then show in "Test events" and are not counted).
 */
import "server-only";
import { createHash } from "node:crypto";
import type { Order, OrderItem } from "@/db/schema";
import { centsToAmount } from "./shipping/types";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function metaConfigured() {
  return Boolean(process.env.META_PIXEL_ID && process.env.META_CAPI_TOKEN);
}

export const purchaseEventId = (order: Pick<Order, "number">) => `order-${order.number}`;

export type RequestContext = { ip: string | null; userAgent: string | null; fbp: string | null; fbc: string | null; url: string };

export function buildPurchaseEvent(order: Order, items: OrderItem[], ctx: RequestContext) {
  const phoneDigits = order.phone.replace(/\D/g, ""); // +359888123456 -> 359888123456
  return {
    event_name: "Purchase",
    event_time: Math.floor(order.createdAt.getTime() / 1000),
    event_id: purchaseEventId(order),
    action_source: "website",
    event_source_url: ctx.url,
    user_data: {
      em: [sha256(order.email.trim().toLowerCase())],
      ph: [sha256(phoneDigits)],
      external_id: [sha256(order.email.trim().toLowerCase())],
      ...(ctx.ip ? { client_ip_address: ctx.ip } : {}),
      ...(ctx.userAgent ? { client_user_agent: ctx.userAgent } : {}),
      ...(ctx.fbp ? { fbp: ctx.fbp } : {}),
      ...(ctx.fbc ? { fbc: ctx.fbc } : {}),
    },
    custom_data: {
      currency: "EUR",
      value: centsToAmount(order.totalCents),
      order_id: order.number,
      content_type: "product",
      content_ids: items.map((i) => String(i.productId)),
      contents: items.map((i) => ({ id: String(i.productId), quantity: i.quantity, item_price: centsToAmount(i.unitPriceCents) })),
      num_items: items.reduce((sum, i) => sum + i.quantity, 0),
    },
  };
}

/** Sends one event. Returns a short result for the log; never throws. */
export async function sendToMeta(event: ReturnType<typeof buildPurchaseEvent>): Promise<string> {
  if (!metaConfigured()) return "skipped: META_PIXEL_ID or META_CAPI_TOKEN missing";
  const version = process.env.META_GRAPH_VERSION ?? "v24.0";
  const url = `https://graph.facebook.com/${version}/${process.env.META_PIXEL_ID}/events?access_token=${encodeURIComponent(process.env.META_CAPI_TOKEN!)}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [event], ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await response.json().catch(() => ({}))) as { events_received?: number; error?: { message?: string } };
    return response.ok ? `ok: ${json.events_received ?? 0} received` : `error: ${json.error?.message ?? response.status}`;
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
