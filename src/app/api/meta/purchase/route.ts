/**
 * POST /api/meta/purchase  body: {"token": "<order public token>"}
 * Called by the thank-you page right after the browser Pixel reported the purchase.
 * The server then reports the same purchase to Meta (Conversions API).
 *
 * The order is found by its unguessable public token, and only orders that are
 * really placed count (not "waiting for card payment" or "payment failed").
 */
import { and, eq, like } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { REVENUE_STATUSES, type OrderStatus } from "@/lib/order-status";
import { audit } from "@/server/audit";
import { getDb } from "@/db/client";
import { auditLog } from "@/db/schema";
import { getBaseUrl } from "@/server/base-url";
import { buildPurchaseEvent, metaConfigured, sendToMeta } from "@/server/meta";
import { getOrderByToken } from "@/server/orders";

export async function POST(request: Request) {
  const jar = await cookies();
  if (parseConsent(jar.get(CONSENT_COOKIE)?.value) !== "all") return NextResponse.json({ result: "no_consent" });
  if (!metaConfigured()) return NextResponse.json({ result: "not_configured" });

  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const data = await getOrderByToken(String(body.token ?? ""));
  if (!data) return NextResponse.json({ result: "unknown_order" }, { status: 404 });
  // Only real sales count (the same list the dashboard uses): not waiting for card, failed, cancelled or refunded.
  if (!REVENUE_STATUSES.includes(data.order.status as OrderStatus)) return NextResponse.json({ result: "not_a_purchase" });

  // Once per order: refreshing the thank-you page must not report the purchase again.
  const db = await getDb();
  const [already] = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.entity, "order"), eq(auditLog.entityId, String(data.order.id)), like(auditLog.action, "meta purchase: ok%")));
  if (already) return NextResponse.json({ result: "already_sent" });

  const h = await headers();
  const event = buildPurchaseEvent(data.order, data.items, {
    // Netlify puts the visitor's real IP in this header; elsewhere x-forwarded-for.
    ip: h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
    userAgent: h.get("user-agent"),
    fbp: jar.get("_fbp")?.value ?? null,
    fbc: jar.get("_fbc")?.value ?? null,
    url: `${await getBaseUrl()}/poruchka/blagodarim/${data.order.publicToken}`,
  });
  const result = await sendToMeta(event);
  await audit(db, { entity: "order", entityId: data.order.id, action: `meta purchase: ${result}`.slice(0, 200), actor: "system" });
  return NextResponse.json({ result: result.startsWith("ok") ? "sent" : "failed" });
}
