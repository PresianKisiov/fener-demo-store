/**
 * POST /api/cron: the shop's hourly chores, called by the Netlify scheduled function
 * (netlify/functions/cron.mts). Nobody else may call it: the request must carry a key
 * derived from SESSION_SECRET, which only the server and the scheduled function know.
 *
 * Chores:
 * 1. Send emails still waiting in the outbox (a send that failed during the day).
 * 2. Ask the couriers for the status of active parcels and move the orders.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverEmails } from "@/server/email";
import { refreshTracking } from "@/server/shipping/service";

// Not exported: a route file may export only route handlers and route settings.
function cronKey(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret ? createHmac("sha256", secret).update("cron").digest("hex") : null;
}

function authorized(request: Request): boolean {
  const expected = cronKey();
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const emails = await deliverEmails({ limit: 50, budgetMs: 6000 });
  const tracking = await refreshTracking("courier").catch((error) => ({ error: error instanceof Error ? error.message : String(error) }));
  return NextResponse.json({ emails, tracking });
}
