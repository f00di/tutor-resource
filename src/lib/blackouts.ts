// Blackouts: times the tutor isn't available. The calendar shades them and warns before a lesson
// lands in one. Times are the tutor's local time (the device's zone).
import { addDays, combine, dateKey, deviceZone, weekdayOf } from "./time";
import type { Blackout } from "./types";

/** The blackout's stretches of time between two instants. */
export function blackoutIntervals(blackout: Blackout, from: number, to: number, zone: string = deviceZone()): Array<[number, number]> {
  const intervals: Array<[number, number]> = [];
  if (to <= from) return intervals;
  const lastKey = dateKey(to, zone);
  // Start a day early so a stretch that began the evening before is caught.
  for (let key = addDays(dateKey(from, zone), -1); key <= lastKey; key = addDays(key, 1)) {
    if (blackout.startDate && key < blackout.startDate) continue;
    if (blackout.endDate && key > blackout.endDate) continue;
    if (blackout.days && !blackout.days.includes(weekdayOf(key))) continue;
    const start = blackout.startTime ? combine(key, blackout.startTime, zone) : combine(key, "00:00", zone);
    const end = blackout.endTime ? combine(key, blackout.endTime, zone) : combine(addDays(key, 1), "00:00", zone);
    if (end > from && start < to && end > start) intervals.push([start, end]);
  }
  return intervals;
}

/** Blackouts that overlap a time (for the "this is in a blackout" warning). */
export function blackoutHits(blackouts: Blackout[], start: number, end: number, zone: string = deviceZone()): Blackout[] {
  return blackouts.filter((blackout) => blackoutIntervals(blackout, start, end, zone).length > 0);
}

export const isAllDay = (blackout: Blackout) => !blackout.startTime || !blackout.endTime;

/** Is the blackout over (its last date has passed)? */
export const isPastBlackout = (blackout: Blackout, today: string) => Boolean(blackout.endDate && blackout.endDate < today);

/** The next date (from today) a blackout applies, if any within a year. */
export function nextBlackoutDate(blackout: Blackout, today: string): string | null {
  for (let offset = 0; offset <= 366; offset++) {
    const key = addDays(today, offset);
    if (blackout.endDate && key > blackout.endDate) return null;
    if (blackout.startDate && key < blackout.startDate) continue;
    if (blackout.days && !blackout.days.includes(weekdayOf(key))) continue;
    return key;
  }
  return null;
}

export type PresetId = "fridayPrayer" | "ramadan2027" | "eidFitr2027" | "eidAdha2027" | "ramadan2028" | "eidFitr2028" | "eidAdha2028";

export interface Preset {
  id: PresetId;
  /** i18n key for the default title. */
  titleKey: string;
  blackout: Pick<Blackout, "days" | "startTime" | "endTime" | "startDate" | "endDate" | "estimated">;
}

// Islamic holidays follow the moon sighting, so these dates are estimates (from astronomical
// calculations, padded by a day) and are marked "estimated" in the app. Tutors should check the
// official announcement in their country and edit the dates.
export const PRESETS: Preset[] = [
  { id: "fridayPrayer", titleKey: "preset.fridayPrayer", blackout: { days: [5], startTime: "12:00", endTime: "14:00", startDate: null, endDate: null } },
  { id: "ramadan2027", titleKey: "preset.ramadan2027", blackout: { days: null, startTime: "17:30", endTime: "19:30", startDate: "2027-02-08", endDate: "2027-03-09", estimated: true } },
  { id: "eidFitr2027", titleKey: "preset.eidFitr2027", blackout: { days: null, startTime: null, endTime: null, startDate: "2027-03-09", endDate: "2027-03-12", estimated: true } },
  { id: "eidAdha2027", titleKey: "preset.eidAdha2027", blackout: { days: null, startTime: null, endTime: null, startDate: "2027-05-15", endDate: "2027-05-19", estimated: true } },
  { id: "ramadan2028", titleKey: "preset.ramadan2028", blackout: { days: null, startTime: "17:30", endTime: "19:30", startDate: "2028-01-27", endDate: "2028-02-25", estimated: true } },
  { id: "eidFitr2028", titleKey: "preset.eidFitr2028", blackout: { days: null, startTime: null, endTime: null, startDate: "2028-02-26", endDate: "2028-02-29", estimated: true } },
  { id: "eidAdha2028", titleKey: "preset.eidAdha2028", blackout: { days: null, startTime: null, endTime: null, startDate: "2028-05-03", endDate: "2028-05-07", estimated: true } },
];

/** Presets still worth offering (not over yet). */
export const currentPresets = (today: string) => PRESETS.filter((preset) => !preset.blackout.endDate || preset.blackout.endDate >= today);
