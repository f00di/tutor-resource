// Dates, times and time zones without a date library. Lessons are stored as UTC instants; the
// calendar shows them in the tutor's own zone (the device's), and each student can have their own
// zone. Repeating lessons keep the same wall-clock time for the student, so when the tutor's
// clocks change for daylight saving (the Gulf has none), the lesson moves for the tutor, not the family.

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const deviceZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export interface Wall {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const partFormatters = new Map<string, Intl.DateTimeFormat>();
const partFormatter = (zone: string) => {
  let formatter = partFormatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partFormatters.set(zone, formatter);
  }
  return formatter;
};

/** The wall-clock time in a zone at an instant (weekday 0 = Sunday). */
export function toWall(ms: number, zone: string): Wall & { second: number; weekday: number } {
  const parts = partFormatter(zone).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

/** How far a zone is ahead of UTC at an instant, in ms. */
export function zoneOffset(ms: number, zone: string): number {
  const whole = Math.floor(ms / 1000) * 1000;
  const wall = toWall(whole, zone);
  return Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second) - whole;
}

/** The instant a wall-clock time happens in a zone. A time skipped by a clock change lands an hour later. */
export function wallToMs(wall: Wall, zone: string): number {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  let ms = guess - zoneOffset(guess, zone);
  const corrected = guess - zoneOffset(ms, zone);
  if (corrected !== ms) ms = corrected;
  return ms;
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

/** "YYYY-MM-DD" for an instant in a zone. */
export function dateKey(ms: number, zone: string = deviceZone()): string {
  const wall = toWall(ms, zone);
  return `${pad(wall.year, 4)}-${pad(wall.month)}-${pad(wall.day)}`;
}

/** "HH:MM" (24-hour) for an instant in a zone. */
export function timeKey(ms: number, zone: string = deviceZone()): string {
  const wall = toWall(ms, zone);
  return `${pad(wall.hour)}:${pad(wall.minute)}`;
}

export function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  return { year, month, day };
}

export function parseTimeKey(key: string): { hour: number; minute: number } {
  const [hour = 0, minute = 0] = key.split(":").map(Number);
  return { hour, minute };
}

export const isDateKey = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
export const isTimeKey = (value: unknown): value is string => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** A date and time in a zone, as an instant. */
export function combine(date: string, time: string, zone: string = deviceZone()): number {
  return wallToMs({ ...parseDateKey(date), ...parseTimeKey(time) }, zone);
}

/** Calendar arithmetic on date keys (no zone involved). */
export function addDays(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addMonths(key: string, months: number): string {
  const { year, month } = parseDateKey(key);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-01`;
}

export function daysBetween(from: string, to: string): number {
  const a = parseDateKey(from);
  const b = parseDateKey(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(key: string): number {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function startOfWeek(key: string, weekStart: number): string {
  return addDays(key, -((weekdayOf(key) - weekStart + 7) % 7));
}

export const startOfMonth = (key: string) => `${key.slice(0, 7)}-01`;
export const endOfMonth = (key: string) => addDays(addMonths(key, 1), -1);
export const todayKey = (zone: string = deviceZone()) => dateKey(Date.now(), zone);

/** Moves an instant by whole days and minutes on a zone's wall clock (used to move a series). */
export function shiftInZone(ms: number, zone: string, dayDelta: number, minuteDelta: number): number {
  const wall = toWall(ms, zone);
  const total = wall.hour * 60 + wall.minute + minuteDelta;
  const carry = Math.floor(total / 1440);
  const minutes = ((total % 1440) + 1440) % 1440;
  const key = addDays(dateKey(ms, zone), dayDelta + carry);
  return wallToMs({ ...parseDateKey(key), hour: Math.floor(minutes / 60), minute: minutes % 60 }, zone);
}

/** The day and minute difference between two instants on a zone's wall clock. */
export function wallDelta(fromMs: number, toMs: number, zone: string): { days: number; minutes: number } {
  const a = toWall(fromMs, zone);
  const b = toWall(toMs, zone);
  return {
    days: daysBetween(dateKey(fromMs, zone), dateKey(toMs, zone)),
    minutes: b.hour * 60 + b.minute - (a.hour * 60 + a.minute),
  };
}

export const MAX_SERIES_LESSONS = 104;

/**
 * Start/end instants for a weekly series, at the same wall-clock time in `zone` (the student's).
 * Stops after `count` lessons or on `until` (inclusive, a date in `zone`), whichever comes first.
 */
export function weeklySeries(
  firstStart: number,
  minutes: number,
  zone: string,
  { everyWeeks = 1, count, until }: { everyWeeks?: number; count?: number | undefined; until?: string | undefined }
): Array<{ start: number; end: number }> {
  const wall = toWall(firstStart, zone);
  const firstKey = dateKey(firstStart, zone);
  const limit = Math.min(count ?? MAX_SERIES_LESSONS, MAX_SERIES_LESSONS);
  const lessons: Array<{ start: number; end: number }> = [];
  for (let index = 0; index < limit; index++) {
    const key = addDays(firstKey, index * 7 * Math.max(1, everyWeeks));
    if (until && key > until) break;
    const start = wallToMs({ ...parseDateKey(key), hour: wall.hour, minute: wall.minute }, zone);
    lessons.push({ start, end: start + minutes * MINUTE });
  }
  return lessons;
}

/** A readable name for a zone: "Gulf Standard Time", "توقيت الخليج"… Falls back to the city part. */
export function zoneName(zone: string, locale: string): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: "longGeneric" }).formatToParts(new Date());
    const name = parts.find((part) => part.type === "timeZoneName")?.value;
    if (name) return name;
  } catch {
    // Unknown zone or an old browser: use the city.
  }
  return zoneCity(zone);
}

/** "Asia/Dubai" → "Dubai". */
export const zoneCity = (zone: string) => (zone.split("/").pop() ?? zone).replace(/_/g, " ");

// Zone names are English in every browser, so the places families most often live in get Arabic names here.
const ARABIC_PLACES: Record<string, string> = {
  "Asia/Dubai": "دبي",
  "Asia/Riyadh": "الرياض",
  "Asia/Qatar": "الدوحة",
  "Asia/Kuwait": "الكويت",
  "Asia/Bahrain": "البحرين",
  "Asia/Muscat": "مسقط",
  "Asia/Amman": "عمّان",
  "Asia/Beirut": "بيروت",
  "Africa/Cairo": "القاهرة",
  "Asia/Karachi": "كراتشي",
  "Asia/Kolkata": "كولكاتا",
  "Europe/London": "لندن",
  "America/New_York": "نيويورك",
  "America/Los_Angeles": "لوس أنجلوس",
};

/** The zone's place name in a language: "Dubai" / "دبي". */
export const zonePlace = (zone: string, lang: "en" | "ar") => (lang === "ar" ? ARABIC_PLACES[zone] : undefined) ?? zoneCity(zone);

/** "GMT+4" for a zone right now. */
export function zoneOffsetLabel(zone: string, locale = "en-GB"): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(new Date());
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Gulf zones first, then everything the browser knows. */
export const GULF_ZONES = ["Asia/Dubai", "Asia/Riyadh", "Asia/Qatar", "Asia/Kuwait", "Asia/Bahrain", "Asia/Muscat"];
export function allZones(): string[] {
  let zones: string[] = [];
  try {
    zones = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    zones = [];
  }
  const rest = zones.filter((zone) => !GULF_ZONES.includes(zone));
  return [...GULF_ZONES, ...rest];
}

/** The week starts the way the tutor's country does: Sunday in Saudi, Qatar, Kuwait, Bahrain and Oman, Monday in the UAE and most places. */
export function defaultWeekStart(zone: string = deviceZone()): 0 | 1 | 6 {
  return ["Asia/Riyadh", "Asia/Qatar", "Asia/Kuwait", "Asia/Bahrain", "Asia/Muscat"].includes(zone) ? 0 : 1;
}
