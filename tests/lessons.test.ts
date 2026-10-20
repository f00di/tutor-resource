import { describe, expect, it } from "vitest";

import { blackoutHits, blackoutIntervals, currentPresets, nextBlackoutDate } from "@/lib/blackouts";
import { findClashes, invoiceableLessons, isBillable, isTaught, nextLesson, packageUsage, unfinishedTopics } from "@/lib/lessons";
import { combine, timeKey } from "@/lib/time";
import type { Blackout, Lesson, LessonPackage } from "@/lib/types";

const ZONE = "Asia/Dubai";
const NOW = combine("2026-10-20", "12:00", ZONE);

let next = 0;
function lesson(day: string, time: string, patch: Partial<Lesson> = {}): Lesson {
  const start = combine(day, time, ZONE);
  return {
    id: `l${++next}`,
    studentId: "sara",
    start: new Date(start).toISOString(),
    end: new Date(start + 60 * 60_000).toISOString(),
    mode: "online",
    location: "",
    status: "planned",
    plan: [],
    covered: "",
    homework: "",
    privateNote: "",
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

const pack = (id: string, size: number, startDate: string): LessonPackage => ({ id, studentId: "sara", size, price: 100000, currency: "AED", startDate, createdAt: `2026-01-0${size}` });

describe("lessons", () => {
  it("counts ended lessons as taught unless cancelled", () => {
    expect(isTaught(lesson("2026-10-19", "17:00"), NOW)).toBe(true);
    expect(isTaught(lesson("2026-10-21", "17:00"), NOW)).toBe(false);
    expect(isBillable(lesson("2026-10-19", "17:00", { status: "cancelledFree" }), NOW)).toBe(false);
    // A late cancellation the tutor charges for is billable even before its time.
    expect(isBillable(lesson("2026-10-21", "17:00", { status: "cancelledCharged" }), NOW)).toBe(true);
  });

  it("finds clashes, ignoring cancelled lessons and the lesson itself", () => {
    const a = lesson("2026-10-21", "17:00");
    const b = lesson("2026-10-21", "17:30", { studentId: "omar" });
    const c = lesson("2026-10-21", "17:15", { status: "cancelledFree" });
    const start = combine("2026-10-21", "17:45", ZONE);
    expect(findClashes([a, b, c], start, start + 30 * 60_000).map((item) => item.id)).toEqual([a.id, b.id]);
    expect(findClashes([a, b, c], start, start + 30 * 60_000, new Set([a.id])).map((item) => item.id)).toEqual([b.id]);
  });

  it("uses packages up oldest lesson first, then leaves the rest to invoice", () => {
    const lessons = ["2026-10-01", "2026-10-05", "2026-10-08", "2026-10-12", "2026-10-15"].map((day) => lesson(day, "17:00"));
    const invoiced = { ...lesson("2026-10-02", "17:00"), invoiceId: "inv1" };
    const packages = [pack("p1", 2, "2026-10-01"), pack("p2", 1, "2026-10-10")];
    const { byPackage, covered } = packageUsage(packages, [...lessons, invoiced], NOW, ZONE);
    expect(byPackage.get("p1")).toMatchObject({ used: 2, remaining: 0, lessonIds: [lessons[0]!.id, lessons[1]!.id] });
    // p2 starts on the 10th, so the 8 October lesson isn't covered by it.
    expect(byPackage.get("p2")).toMatchObject({ used: 1, remaining: 0, lessonIds: [lessons[3]!.id] });
    expect(covered.has(invoiced.id)).toBe(false);
    const ready = invoiceableLessons([...lessons, invoiced], packages, "sara", "2026-10-01", "2026-10-31", NOW, ZONE);
    expect(ready.map((item) => item.id)).toEqual([lessons[2]!.id, lessons[4]!.id]);
  });

  it("only invoices lessons inside the period", () => {
    const lessons = [lesson("2026-09-30", "17:00"), lesson("2026-10-01", "17:00"), lesson("2026-10-19", "17:00")];
    expect(invoiceableLessons(lessons, [], "sara", "2026-10-01", "2026-10-31", NOW, ZONE)).toHaveLength(2);
  });

  it("knows the next lesson and the topics left over", () => {
    const past = lesson("2026-10-19", "17:00", { plan: [{ id: "a", text: "Vectors", done: false }, { id: "b", text: "Matrices", done: true }, { id: "c", text: "Moved", done: false, movedOn: true }] });
    const upcoming = lesson("2026-10-22", "17:00");
    const cancelled = lesson("2026-10-21", "17:00", { status: "cancelledFree" });
    expect(nextLesson([past, upcoming, cancelled], "sara", NOW)?.id).toBe(upcoming.id);
    expect(unfinishedTopics(past).map((item) => item.text)).toEqual(["Vectors"]);
  });
});

const blackout = (patch: Partial<Blackout>): Blackout => ({ id: "b", title: "Busy", days: null, startTime: null, endTime: null, startDate: null, endDate: null, createdAt: "", ...patch });

describe("blackouts", () => {
  const weekStart = combine("2026-10-18", "00:00", ZONE);
  const weekEnd = combine("2026-10-25", "00:00", ZONE);

  it("expands a weekly blackout over a week", () => {
    const friday = blackout({ days: [5], startTime: "12:00", endTime: "14:00" });
    const intervals = blackoutIntervals(friday, weekStart, weekEnd, ZONE);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]!.map((ms) => timeKey(ms, ZONE))).toEqual(["12:00", "14:00"]);
  });

  it("covers whole days for a date range", () => {
    const travel = blackout({ startDate: "2026-10-20", endDate: "2026-10-21" });
    const intervals = blackoutIntervals(travel, weekStart, weekEnd, ZONE);
    expect(intervals).toHaveLength(2);
    expect(intervals[0]![1] - intervals[0]![0]).toBe(24 * 60 * 60_000);
  });

  it("combines dates with daily times (Ramadan evenings)", () => {
    const ramadan = blackout({ startDate: "2026-10-19", endDate: "2026-10-21", startTime: "17:30", endTime: "19:30" });
    expect(blackoutIntervals(ramadan, weekStart, weekEnd, ZONE)).toHaveLength(3);
    const lessonStart = combine("2026-10-20", "18:00", ZONE);
    expect(blackoutHits([ramadan], lessonStart, lessonStart + 3600_000, ZONE)).toHaveLength(1);
    const later = combine("2026-10-22", "18:00", ZONE);
    expect(blackoutHits([ramadan], later, later + 3600_000, ZONE)).toHaveLength(0);
  });

  it("finds when a blackout next applies, and drops presets that are over", () => {
    expect(nextBlackoutDate(blackout({ days: [5] }), "2026-10-19")).toBe("2026-10-23");
    expect(nextBlackoutDate(blackout({ startDate: "2026-01-01", endDate: "2026-01-02" }), "2026-10-19")).toBeNull();
    expect(currentPresets("2026-10-19").map((preset) => preset.id)).toContain("ramadan2027");
    expect(currentPresets("2027-06-01").map((preset) => preset.id)).not.toContain("ramadan2027");
  });
});
