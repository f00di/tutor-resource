// Rules about lessons: what counts as taught, clashes, packages and what can be invoiced.
// Pure functions over plain data, so they're easy to test (tests/lessons.test.ts).
import { lessonAmount } from "./money";
import { dateKey, MINUTE } from "./time";
import type { Lesson, LessonPackage } from "./types";

export const startMs = (lesson: Pick<Lesson, "start">) => Date.parse(lesson.start);
export const endMs = (lesson: Pick<Lesson, "end">) => Date.parse(lesson.end);
export const minutesOf = (lesson: Pick<Lesson, "start" | "end">) => Math.round((endMs(lesson) - startMs(lesson)) / MINUTE);

export const isCancelled = (lesson: Lesson) => lesson.status !== "planned";
/** A planned lesson that has ended counts as taught; nobody has to tick it off. */
export const isTaught = (lesson: Lesson, now = Date.now()) => lesson.status === "planned" && endMs(lesson) <= now;
/** Taught lessons and cancellations the tutor chose to charge for. */
export const isBillable = (lesson: Lesson, now = Date.now()) => isTaught(lesson, now) || lesson.status === "cancelledCharged";

export const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/** Other lessons (not cancelled) that overlap a time. */
export function findClashes(lessons: Lesson[], start: number, end: number, ignore: Set<string> = new Set()): Lesson[] {
  return lessons.filter((lesson) => !ignore.has(lesson.id) && !isCancelled(lesson) && overlaps(start, end, startMs(lesson), endMs(lesson)));
}

export const byStart = (a: Lesson, b: Lesson) => startMs(a) - startMs(b);

export interface PackageUse {
  used: number;
  remaining: number;
  lessonIds: string[];
}

/**
 * Which billable lessons each package covers: oldest lessons first, into the oldest package that
 * had started by then and still has room. Lessons already on a per-lesson invoice are left alone.
 */
export function packageUsage(packages: LessonPackage[], lessons: Lesson[], now = Date.now(), zone?: string): { byPackage: Map<string, PackageUse>; covered: Set<string> } {
  const byPackage = new Map<string, PackageUse>();
  const covered = new Set<string>();
  const sorted = [...packages].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.createdAt.localeCompare(b.createdAt));
  for (const pack of sorted) byPackage.set(pack.id, { used: 0, remaining: pack.size, lessonIds: [] });
  const candidates = lessons.filter((lesson) => isBillable(lesson, now) && !lesson.invoiceId).sort(byStart);
  for (const lesson of candidates) {
    const day = dateKey(startMs(lesson), zone);
    const pack = sorted.find((item) => item.studentId === lesson.studentId && item.startDate <= day && (byPackage.get(item.id)?.remaining ?? 0) > 0);
    if (!pack) continue;
    const use = byPackage.get(pack.id)!;
    use.used += 1;
    use.remaining -= 1;
    use.lessonIds.push(lesson.id);
    covered.add(lesson.id);
  }
  return { byPackage, covered };
}

/** Lessons ready for a per-lesson invoice: billable, not invoiced yet, not paid for by a package, within [from, to] (dates, inclusive). */
export function invoiceableLessons(lessons: Lesson[], packages: LessonPackage[], studentId: string, from: string, to: string, now = Date.now(), zone?: string): Lesson[] {
  const own = lessons.filter((lesson) => lesson.studentId === studentId);
  const { covered } = packageUsage(
    packages.filter((pack) => pack.studentId === studentId),
    own,
    now,
    zone
  );
  return own
    .filter((lesson) => {
      const day = dateKey(startMs(lesson), zone);
      return isBillable(lesson, now) && !lesson.invoiceId && !covered.has(lesson.id) && day >= from && day <= to;
    })
    .sort(byStart);
}

export const lessonCost = (lesson: Lesson, ratePerHour: number) => lessonAmount(ratePerHour, minutesOf(lesson));

/** The student's next lesson after a time (not cancelled). */
export function nextLesson(lessons: Lesson[], studentId: string, after: number): Lesson | undefined {
  return lessons.filter((lesson) => lesson.studentId === studentId && !isCancelled(lesson) && startMs(lesson) > after).sort(byStart)[0];
}

/** Topics planned for a lesson that weren't ticked off or moved on. */
export const unfinishedTopics = (lesson: Lesson) => lesson.plan.filter((item) => !item.done && !item.movedOn && item.text.trim());
