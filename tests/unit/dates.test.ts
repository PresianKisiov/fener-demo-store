import { describe, expect, it } from "vitest";
import { addWorkingDays, formatDayRange, isWorkingDay } from "@/lib/dates";

describe("working days", () => {
  it("skips the weekend", () => {
    // Friday 09.10.2026 12:00 Sofia time + 1 working day = Monday 12.10.2026
    const friday = new Date("2026-10-09T09:00:00Z");
    const result = addWorkingDays(friday, 1);
    expect(result.toISOString().slice(0, 10)).toBe("2026-10-12");
  });

  it("skips Bulgarian public holidays", () => {
    expect(isWorkingDay(new Date("2026-09-22T09:00:00Z"))).toBe(false);
    expect(isWorkingDay(new Date("2026-09-23T09:00:00Z"))).toBe(true);
  });

  it("formats a range in Bulgarian", () => {
    expect(formatDayRange(new Date("2026-10-13T09:00:00Z"), new Date("2026-10-15T09:00:00Z"))).toBe("13-15 октомври");
  });
});

import { sofiaDayStart, sofiaMonthStart } from "@/lib/dates";

describe("Sofia day boundaries", () => {
  it("finds local midnight in summer time (UTC+3)", () => {
    // 08.10.2026 22:49 Sofia = 19:49 UTC; the day started at 07.10 21:00 UTC.
    expect(sofiaDayStart(new Date("2026-10-08T19:49:00Z")).toISOString()).toBe("2026-10-07T21:00:00.000Z");
  });
  it("finds local midnight in winter time (UTC+2)", () => {
    expect(sofiaDayStart(new Date("2026-12-15T10:00:00Z")).toISOString()).toBe("2026-12-14T22:00:00.000Z");
  });
  it("uses the Sofia date, not the UTC date, just after midnight", () => {
    // 09.10.2026 00:30 Sofia is still 08.10 in UTC.
    expect(sofiaDayStart(new Date("2026-10-08T21:30:00Z")).toISOString()).toBe("2026-10-08T21:00:00.000Z");
  });
  it("finds the start of a month", () => {
    expect(sofiaMonthStart("2026-11").toISOString()).toBe("2026-10-31T22:00:00.000Z");
  });
});
