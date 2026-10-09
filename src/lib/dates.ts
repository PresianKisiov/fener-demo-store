/**
 * Dates shown to customers, in Bulgarian and in Sofia time.
 */
const TZ = "Europe/Sofia";

const dateTime = new Intl.DateTimeFormat("bg-BG", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const dayMonth = new Intl.DateTimeFormat("bg-BG", { timeZone: TZ, day: "numeric", month: "long" });
const dayOnly = new Intl.DateTimeFormat("bg-BG", { timeZone: TZ, day: "numeric" });
const monthOnly = new Intl.DateTimeFormat("bg-BG", { timeZone: TZ, month: "numeric" });
const isoDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const weekday = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });

/** "08.10.2026, 22:17" (Intl may add " ч." depending on Node's ICU data). */
export function formatDateTime(d: Date): string {
  return dateTime.format(d);
}

/**
 * Bulgarian public holidays as YYYY-MM-DD. Fixed dates plus Orthodox Easter for 2026-2027.
 * Days moved by government decision are not included: add them each year.
 */
const HOLIDAYS = new Set([
  "2026-01-01", "2026-03-03", "2026-04-10", "2026-04-11", "2026-04-12", "2026-04-13",
  "2026-05-01", "2026-05-06", "2026-05-24", "2026-09-06", "2026-09-22",
  "2026-12-24", "2026-12-25", "2026-12-26",
  "2027-01-01", "2027-03-03", "2027-04-30", "2027-05-01", "2027-05-02", "2027-05-03",
  "2027-05-06", "2027-05-24", "2027-09-06", "2027-09-22",
  "2027-12-24", "2027-12-25", "2027-12-26",
]);

export function isWorkingDay(d: Date): boolean {
  const wd = weekday.format(d);
  if (wd === "Sat" || wd === "Sun") return false;
  return !HOLIDAYS.has(isoDay.format(d));
}

export function addWorkingDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setTime(d.getTime() + 24 * 60 * 60 * 1000);
    if (isWorkingDay(d)) added++;
  }
  return d;
}

/** "13-15 октомври" or "30 октомври - 2 ноември". */
export function formatDayRange(from: Date, to: Date): string {
  if (monthOnly.format(from) === monthOnly.format(to)) {
    return `${dayOnly.format(from)}-${dayMonth.format(to)}`;
  }
  return `${dayMonth.format(from)} - ${dayMonth.format(to)}`;
}

const offsetFormat = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" });

/** Minutes Sofia is ahead of UTC at a given moment (120 in winter, 180 in summer). */
function sofiaOffsetMinutes(d: Date): number {
  const name = offsetFormat.formatToParts(d).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!m) return 0;
  return (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** The moment the calendar day of `d` started in Sofia (00:00 local time). */
export function sofiaDayStart(d: Date): Date {
  const [y, mo, day] = isoDay.format(d).split("-").map(Number);
  const utcMidnight = Date.UTC(y, mo - 1, day);
  return new Date(utcMidnight - sofiaOffsetMinutes(new Date(utcMidnight)) * 60_000);
}

/** "2026-10-08" in Sofia time. */
export function sofiaIsoDay(d: Date): string {
  return isoDay.format(d);
}

/** Start of a month in Sofia, from "2026-10". */
export function sofiaMonthStart(yearMonth: string): Date {
  const [y, mo] = yearMonth.split("-").map(Number);
  const utcMidnight = Date.UTC(y, mo - 1, 1);
  return new Date(utcMidnight - sofiaOffsetMinutes(new Date(utcMidnight)) * 60_000);
}

const monthName = new Intl.DateTimeFormat("bg-BG", { timeZone: TZ, month: "long", year: "numeric" });
export function formatMonth(d: Date): string {
  return monthName.format(d);
}

const shortDate = new Intl.DateTimeFormat("bg-BG", { timeZone: TZ, day: "numeric", month: "short" });
export function formatShortDate(d: Date): string {
  return shortDate.format(d);
}

const dayLong = new Intl.DateTimeFormat("bg-BG", { timeZone: TZ, day: "numeric", month: "long" });
/** "6 октомври" */
export function formatDayMonth(d: Date): string {
  return dayLong.format(d);
}
