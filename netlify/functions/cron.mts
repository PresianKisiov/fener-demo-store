/**
 * Netlify Scheduled Function: once an hour it calls the shop's /api/cron.
 * That sends emails left in the outbox and checks the courier statuses, so orders
 * move to "Изпратена" / "Доставена" even when nobody presses a button.
 *
 * It runs on Netlify only (not on your computer). Logs: Netlify > Logs > Functions > cron.
 * The key is derived from SESSION_SECRET the same way as in src/app/api/cron/route.ts.
 */
import { createHmac } from "node:crypto";

export default async function cron() {
  const secret = process.env.SESSION_SECRET;
  // URL is the site's main address, set by Netlify.
  const base = process.env.URL;
  if (!secret || !base) {
    console.log("[cron] SESSION_SECRET or URL missing, nothing to do");
    return new Response("not configured");
  }
  const key = createHmac("sha256", secret).update("cron").digest("hex");
  const response = await fetch(`${base}/api/cron`, { method: "POST", headers: { authorization: `Bearer ${key}` } });
  console.log("[cron]", response.status, (await response.text()).slice(0, 500));
  return new Response("ok");
}

export const config = { schedule: "@hourly" };
