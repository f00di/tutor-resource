// Live views of the tutor's data: components re-render when anything changes (in any tab).
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";

import { db } from "./db";
import type { Blackout, DayNote, Invoice, Lesson, LessonPackage, Student } from "./types";

const NONE: never[] = [];

/** undefined while loading, so first-run screens don't flash. */
export const useStudents = (): Student[] | undefined => useLiveQuery(() => db.students.orderBy("name").toArray(), []);
export const useLessons = (): Lesson[] => useLiveQuery(() => db.lessons.toArray(), [], NONE as Lesson[]);
export const useBlackouts = (): Blackout[] => useLiveQuery(() => db.blackouts.toArray(), [], NONE as Blackout[]);
export const useNotes = (): DayNote[] => useLiveQuery(() => db.notes.toArray(), [], NONE as DayNote[]);
export const useInvoices = (): Invoice[] => useLiveQuery(() => db.invoices.orderBy("issueDate").reverse().toArray(), [], NONE as Invoice[]);
export const usePackages = (): LessonPackage[] => useLiveQuery(() => db.packages.toArray(), [], NONE as LessonPackage[]);

export function useStudentMap(students: Student[] | undefined): Map<string, Student> {
  return useMemo(() => new Map((students ?? []).map((student) => [student.id, student])), [students]);
}

/** The current time, refreshed every minute (for "now" lines and what counts as taught). */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** True below a width (phones and small tablets). */
export function useNarrow(maxWidth = 900): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const [narrow, setNarrow] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return;
    const update = () => setNarrow(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return narrow;
}
