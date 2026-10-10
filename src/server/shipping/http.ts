import { CourierError } from "./types";

/**
 * POST with JSON and a time limit. Online the whole request must finish in about
 * 10 seconds (Netlify's limit), so a courier that hangs must not hang the shop.
 */
export async function postJson(
  courierName: string,
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
  timeoutMs = 20_000,
): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8", Accept: "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new CourierError(
      timedOut
        ? `${courierName} не отговори за ${timeoutMs / 1000} секунди. Опитай пак след малко.`
        : `Няма връзка с ${courierName}. Опитай пак след малко.`,
    );
  }
}

export async function readJson(courierName: string, response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new CourierError(`${courierName} върна неочакван отговор (HTTP ${response.status}).`);
  }
}

export function formatHourMinute(epochMs: number | null | undefined): string | null {
  if (typeof epochMs !== "number") return null;
  const parts = new Intl.DateTimeFormat("bg-BG", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Sofia" }).formatToParts(new Date(epochMs));
  const h = parts.find((p) => p.type === "hour")?.value;
  const m = parts.find((p) => p.type === "minute")?.value;
  return h && m ? `${h}:${m}` : null;
}

export function workingHours(weekFrom: string | null, weekTo: string | null, satFrom: string | null, satTo: string | null): string {
  if (!weekFrom || !weekTo) return "";
  if (weekFrom <= "00:01" && weekTo >= "23:59") return "24/7";
  const week = `пон-пет ${weekFrom}-${weekTo}`;
  return satFrom && satTo ? `${week}, съб ${satFrom}-${satTo}` : week;
}
