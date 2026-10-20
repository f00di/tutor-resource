import { describe, expect, it } from "vitest";

import { addDays, addMonths, combine, dateKey, daysBetween, defaultWeekStart, endOfMonth, shiftInZone, startOfWeek, timeKey, toWall, wallDelta, wallToMs, weekdayOf, weeklySeries, zonePlace } from "@/lib/time";

const utc = (iso: string) => Date.parse(iso);

describe("time zones", () => {
  it("turns a wall-clock time in a zone into the right instant", () => {
    expect(wallToMs({ year: 2026, month: 10, day: 20, hour: 17, minute: 0 }, "Asia/Dubai")).toBe(utc("2026-10-20T13:00:00Z"));
    expect(wallToMs({ year: 2026, month: 10, day: 20, hour: 17, minute: 0 }, "Asia/Riyadh")).toBe(utc("2026-10-20T14:00:00Z"));
    // New York, before and after the clocks go back on 1 Nov 2026.
    expect(wallToMs({ year: 2026, month: 10, day: 30, hour: 9, minute: 0 }, "America/New_York")).toBe(utc("2026-10-30T13:00:00Z"));
    expect(wallToMs({ year: 2026, month: 11, day: 2, hour: 9, minute: 0 }, "America/New_York")).toBe(utc("2026-11-02T14:00:00Z"));
  });

  it("reads the wall clock and date of an instant", () => {
    const ms = utc("2026-10-20T21:30:00Z");
    expect(toWall(ms, "Asia/Dubai")).toMatchObject({ year: 2026, month: 10, day: 21, hour: 1, minute: 30, weekday: 3 });
    expect(dateKey(ms, "Asia/Dubai")).toBe("2026-10-21");
    expect(dateKey(ms, "America/New_York")).toBe("2026-10-20");
    expect(timeKey(ms, "Asia/Dubai")).toBe("01:30");
    expect(combine("2026-10-21", "01:30", "Asia/Dubai")).toBe(ms);
  });

  it("keeps a weekly series at the student's time when the tutor's clocks change", () => {
    // A Dubai family, Mondays 5 pm, taught by a tutor in New York across the 1 Nov clock change.
    const first = combine("2026-10-26", "17:00", "Asia/Dubai");
    const series = weeklySeries(first, 60, "Asia/Dubai", { count: 3 });
    expect(series).toHaveLength(3);
    for (const lesson of series) expect(timeKey(lesson.start, "Asia/Dubai")).toBe("17:00");
    expect(series.map((lesson) => timeKey(lesson.start, "America/New_York"))).toEqual(["09:00", "08:00", "08:00"]);
    expect(series[0]!.end - series[0]!.start).toBe(60 * 60_000);
  });

  it("keeps a series at the tutor's own time when it is anchored there", () => {
    const first = combine("2026-10-26", "17:00", "America/New_York");
    const series = weeklySeries(first, 45, "America/New_York", { count: 2 });
    expect(series.map((lesson) => timeKey(lesson.start, "America/New_York"))).toEqual(["17:00", "17:00"]);
    expect(series.map((lesson) => new Date(lesson.start).toISOString())).toEqual(["2026-10-26T21:00:00.000Z", "2026-11-02T22:00:00.000Z"]);
  });

  it("stops a series on its last date and caps it at two years", () => {
    const first = combine("2026-10-19", "16:00", "Asia/Dubai");
    expect(weeklySeries(first, 60, "Asia/Dubai", { until: "2026-11-09" })).toHaveLength(4);
    expect(weeklySeries(first, 60, "Asia/Dubai", { everyWeeks: 2, until: "2026-11-30" })).toHaveLength(4);
    expect(weeklySeries(first, 60, "Asia/Dubai", { count: 500 })).toHaveLength(104);
  });

  it("moves an instant by days and minutes on a zone's clock", () => {
    const start = combine("2026-10-26", "17:00", "Asia/Dubai");
    expect(dateKey(shiftInZone(start, "Asia/Dubai", 1, 30), "Asia/Dubai")).toBe("2026-10-27");
    expect(timeKey(shiftInZone(start, "Asia/Dubai", 1, 30), "Asia/Dubai")).toBe("17:30");
    // Past midnight carries into the next day.
    expect(dateKey(shiftInZone(start, "Asia/Dubai", 0, 8 * 60), "Asia/Dubai")).toBe("2026-10-27");
    const moved = combine("2026-10-28", "18:15", "Asia/Dubai");
    expect(wallDelta(start, moved, "Asia/Dubai")).toEqual({ days: 2, minutes: 75 });
  });
});

describe("calendar dates", () => {
  it("does date arithmetic without zones", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-01");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(daysBetween("2026-10-19", "2026-11-02")).toBe(14);
    expect(weekdayOf("2026-10-23")).toBe(5);
  });

  it("starts weeks on Saturday, Sunday or Monday", () => {
    expect(startOfWeek("2026-10-21", 1)).toBe("2026-10-19");
    expect(startOfWeek("2026-10-21", 0)).toBe("2026-10-18");
    expect(startOfWeek("2026-10-21", 6)).toBe("2026-10-17");
    expect(defaultWeekStart("Asia/Riyadh")).toBe(0);
    expect(defaultWeekStart("Asia/Dubai")).toBe(1);
  });

  it("names Gulf places in Arabic", () => {
    expect(zonePlace("Asia/Dubai", "en")).toBe("Dubai");
    expect(zonePlace("Asia/Dubai", "ar")).toBe("دبي");
    expect(zonePlace("Europe/Paris", "ar")).toBe("Paris");
  });
});
