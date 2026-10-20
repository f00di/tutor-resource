// Short readable summaries ("Every Fri · 12:00 pm – 2:00 pm"), in the app's language.
import type { Translator } from "./i18n";
import { combine, todayKey } from "./time";
import type { Blackout } from "./types";

const timeLabel = (tr: Translator, time: string) => tr.time(combine(todayKey(), time));

export function blackoutTimes(tr: Translator, blackout: Blackout): string {
  if (!blackout.startTime || !blackout.endTime) return tr.t("blackout.allDayShort");
  return tr.t("range.times", { from: timeLabel(tr, blackout.startTime), to: timeLabel(tr, blackout.endTime) });
}

export function dateRange(tr: Translator, from: string, to: string): string {
  if (from === to) return tr.day(from, "medium");
  return tr.t("range.dates", { from: tr.day(from, from.slice(0, 4) === to.slice(0, 4) ? "short" : "medium"), to: tr.day(to, "medium") });
}

export function describeBlackout(tr: Translator, blackout: Blackout, weekStart: number): string {
  const parts: string[] = [];
  if (blackout.days) {
    const ordered = [...blackout.days].sort((a, b) => ((a - weekStart + 7) % 7) - ((b - weekStart + 7) % 7));
    parts.push(ordered.length === 7 ? tr.t("blackout.everyDay") : tr.t("blackout.every", { days: tr.list(ordered.map((day) => tr.weekday(day, "short"))) }));
  }
  if (blackout.startDate && blackout.endDate) parts.push(dateRange(tr, blackout.startDate, blackout.endDate));
  parts.push(blackoutTimes(tr, blackout));
  return parts.join(" · ");
}
