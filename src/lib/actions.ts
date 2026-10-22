// Every change to the tutor's data goes through here, so related records stay in step
// (a deleted invoice frees its lessons, a moved series keeps the student's time, and so on).
import { db, newId, nowIso, requestPersistentStorage } from "./db";
import { formatInvoiceNumber } from "./invoices";
import { byStart, endMs, minutesOf, nextLesson, startMs, unfinishedTopics } from "./lessons";
import { getSettings, saveSettings } from "./settings";
import { addDays, dateKey, deviceZone, MINUTE, shiftInZone, todayKey, wallDelta, weeklySeries } from "./time";
import type { Blackout, DayNote, Invoice, InvoiceItem, InvoiceSpan, Lesson, LessonPackage, Mode, PlanItem, Student } from "./types";

let askedForPersistence = false;
const touched = () => {
  // The first save asks the browser to keep this app's storage (no prompt in most browsers).
  if (!askedForPersistence) {
    askedForPersistence = true;
    void requestPersistentStorage();
  }
};

/* Students */

export type StudentDraft = Omit<Student, "id" | "createdAt" | "updatedAt" | "archived"> & { id?: string; archived?: boolean };

export async function saveStudent(draft: StudentDraft): Promise<string> {
  touched();
  const now = nowIso();
  if (draft.id) {
    const existing = await db.students.get(draft.id);
    if (existing) {
      await db.students.put({ ...existing, ...draft, id: existing.id, updatedAt: now });
      return existing.id;
    }
  }
  const id = draft.id ?? newId();
  await db.students.add({ ...draft, id, archived: draft.archived ?? false, createdAt: now, updatedAt: now });
  return id;
}

export const setStudentArchived = (id: string, archived: boolean) => db.students.update(id, { archived, updatedAt: nowIso() });

/** Deletes a student with their lessons, day notes and packages. Invoices stay: they're records of what was billed. */
export async function deleteStudent(id: string): Promise<void> {
  await db.transaction("rw", [db.students, db.lessons, db.notes, db.packages], async () => {
    await db.lessons.where("studentId").equals(id).delete();
    await db.packages.where("studentId").equals(id).delete();
    await db.notes.filter((note) => note.studentId === id).delete();
    await db.students.delete(id);
  });
}

/* Lessons */

export interface NewLessons {
  studentId: string;
  start: number;
  minutes: number;
  mode: Mode;
  location: string;
  plan: PlanItem[];
  /** The zone whose wall-clock time a repeating series keeps (the student's). */
  zone: string;
  repeat?: { everyWeeks: number; count?: number | undefined; until?: string | undefined } | undefined;
  sample?: boolean;
}

export async function createLessons(input: NewLessons): Promise<string[]> {
  touched();
  const now = nowIso();
  const times = input.repeat ? weeklySeries(input.start, input.minutes, input.zone, input.repeat) : [{ start: input.start, end: input.start + input.minutes * MINUTE }];
  const seriesId = times.length > 1 ? newId() : undefined;
  const lessons: Lesson[] = times.map((time, index) => ({
    id: newId(),
    studentId: input.studentId,
    start: new Date(time.start).toISOString(),
    end: new Date(time.end).toISOString(),
    mode: input.mode,
    location: input.location,
    status: "planned",
    ...(seriesId ? { seriesId } : {}),
    // The plan belongs to the first lesson; later ones start empty.
    plan: index === 0 ? input.plan : [],
    covered: "",
    homework: "",
    privateNote: "",
    ...(input.sample ? { sample: true } : {}),
    createdAt: now,
    updatedAt: now,
  }));
  await db.lessons.bulkAdd(lessons);
  return lessons.map((lesson) => lesson.id);
}

export async function updateLesson(id: string, patch: Partial<Omit<Lesson, "id" | "createdAt">>): Promise<void> {
  touched();
  await db.lessons.update(id, { ...patch, updatedAt: nowIso() });
}

export type Scope = "one" | "following";

/** Lessons in the same series from this one on (just this one when it isn't in a series). */
async function scopeLessons(lesson: Lesson, scope: Scope): Promise<Lesson[]> {
  if (scope === "one" || !lesson.seriesId) return [lesson];
  const series = await db.lessons.where("seriesId").equals(lesson.seriesId).toArray();
  return series.filter((item) => startMs(item) >= startMs(lesson)).sort(byStart);
}

/**
 * Moves or resizes a lesson. With "following", later lessons in the series move by the same days and
 * minutes on the student's clock, and take the new length.
 */
export async function moveLesson(id: string, newStart: number, newEnd: number, scope: Scope, zone: string, extra: Partial<Pick<Lesson, "mode" | "location">> = {}): Promise<void> {
  touched();
  const lesson = await db.lessons.get(id);
  if (!lesson) return;
  const now = nowIso();
  const delta = wallDelta(startMs(lesson), newStart, zone);
  const minutes = Math.round((newEnd - newStart) / MINUTE);
  const targets = await scopeLessons(lesson, scope);
  await db.transaction("rw", db.lessons, async () => {
    for (const target of targets) {
      const start = target.id === id ? newStart : shiftInZone(startMs(target), zone, delta.days, delta.minutes);
      await db.lessons.update(target.id, { ...extra, start: new Date(start).toISOString(), end: new Date(start + minutes * MINUTE).toISOString(), updatedAt: now });
    }
  });
}

export async function deleteLessons(id: string, scope: Scope): Promise<number> {
  const lesson = await db.lessons.get(id);
  if (!lesson) return 0;
  const targets = await scopeLessons(lesson, scope);
  await db.lessons.bulkDelete(targets.map((target) => target.id));
  return targets.length;
}

/** Moves a past lesson's unfinished topics to the student's next lesson. Returns that lesson's id, or null if there's none. */
export async function carryOverTopics(id: string): Promise<string | null> {
  touched();
  return db.transaction("rw", db.lessons, async () => {
    const lesson = await db.lessons.get(id);
    if (!lesson) return null;
    const topics = unfinishedTopics(lesson);
    if (!topics.length) return null;
    const lessons = await db.lessons.where("studentId").equals(lesson.studentId).toArray();
    const next = nextLesson(lessons, lesson.studentId, Math.max(endMs(lesson), Date.now() - 1));
    if (!next) return null;
    const now = nowIso();
    const moved = new Set(topics.map((topic) => topic.id));
    await db.lessons.update(next.id, {
      plan: [...next.plan, ...topics.map((topic) => ({ id: newId(), text: topic.text, done: false, carriedFrom: lesson.start }))],
      updatedAt: now,
    });
    await db.lessons.update(lesson.id, { plan: lesson.plan.map((item) => (moved.has(item.id) ? { ...item, movedOn: true } : item)), updatedAt: now });
    return next.id;
  });
}

/* Blackouts and day notes */

export type BlackoutDraft = Omit<Blackout, "id" | "createdAt"> & { id?: string };

export async function saveBlackout(draft: BlackoutDraft): Promise<string> {
  touched();
  const existing = draft.id ? await db.blackouts.get(draft.id) : undefined;
  const id = existing?.id ?? newId();
  await db.blackouts.put({ ...draft, id, createdAt: existing?.createdAt ?? nowIso() });
  return id;
}

export const deleteBlackout = (id: string) => db.blackouts.delete(id);

export type NoteDraft = Omit<DayNote, "id" | "createdAt" | "done"> & { id?: string; done?: boolean };

export async function saveNote(draft: NoteDraft): Promise<string> {
  touched();
  const existing = draft.id ? await db.notes.get(draft.id) : undefined;
  const id = existing?.id ?? newId();
  await db.notes.put({ ...existing, ...draft, id, done: draft.done ?? existing?.done ?? false, createdAt: existing?.createdAt ?? nowIso() });
  return id;
}

export const setNoteDone = (id: string, done: boolean) => db.notes.update(id, { done });
export const deleteNote = (id: string) => db.notes.delete(id);

/* Packages */

export type PackageDraft = Omit<LessonPackage, "id" | "createdAt"> & { id?: string };

export async function savePackage(draft: PackageDraft): Promise<string> {
  touched();
  const existing = draft.id ? await db.packages.get(draft.id) : undefined;
  const id = existing?.id ?? newId();
  await db.packages.put({ ...existing, ...draft, id, createdAt: existing?.createdAt ?? nowIso() });
  return id;
}

export const deletePackage = (id: string) => db.packages.delete(id);

/* Invoices */

export interface NewInvoice {
  student: Student;
  lessons: Lesson[];
  packages?: LessonPackage[];
  periodStart?: string | undefined;
  periodEnd?: string | undefined;
  /** 1 = monthly (one page); 3 or 6 = a cover with each month's total, then a page per month. */
  span?: InvoiceSpan;
  sample?: boolean;
}

/** Makes an invoice from lessons and/or packages, numbers it and marks them as invoiced. */
export async function createInvoice({ student, lessons, packages = [], periodStart, periodEnd, span = 1, sample }: NewInvoice): Promise<string> {
  touched();
  const settings = await getSettings();
  const id = newId();
  const issueDate = todayKey();
  const zone = deviceZone();
  const items: InvoiceItem[] = [
    ...packages.map((pack) => ({ id: newId(), kind: "package" as const, description: "", quantity: 1, unitPrice: pack.price, packageId: pack.id, date: pack.startDate, size: pack.size })),
    ...[...lessons].sort(byStart).map((lesson) => ({
      id: newId(),
      kind: "lesson" as const,
      date: dateKey(startMs(lesson), zone),
      description: student.subjects.trim(),
      quantity: Math.round((minutesOf(lesson) / 60) * 100) / 100,
      unitPrice: student.rate,
      lessonId: lesson.id,
    })),
  ];
  const now = nowIso();
  const invoice: Invoice = {
    id,
    number: formatInvoiceNumber(settings, settings.nextInvoiceNumber),
    studentId: student.id,
    issueDate,
    dueDate: addDays(issueDate, settings.dueDays),
    ...(periodStart ? { periodStart } : {}),
    ...(periodEnd ? { periodEnd } : {}),
    span,
    level: student.level.trim() || student.curriculum.trim(),
    subject: student.subjects.trim(),
    rate: student.rate,
    currency: packages[0]?.currency ?? student.currency,
    language: student.messageLang,
    billTo: student.parentName.trim() || student.name,
    studentName: student.name,
    items,
    discount: 0,
    taxRate: settings.taxRate,
    taxLabel: settings.taxLabel,
    notes: settings.paymentDetails,
    status: "unpaid",
    ...(sample ? { sample: true } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction("rw", [db.invoices, db.lessons, db.packages, db.meta], async () => {
    await db.invoices.add(invoice);
    for (const lesson of lessons) await db.lessons.update(lesson.id, { invoiceId: id });
    for (const pack of packages) await db.packages.update(pack.id, { invoiceId: id });
    await saveSettings({ nextInvoiceNumber: settings.nextInvoiceNumber + 1 });
  });
  return id;
}

/** Saves invoice edits. Lessons or a package taken off the invoice can be invoiced again. */
export async function updateInvoice(id: string, patch: Partial<Omit<Invoice, "id" | "createdAt">>): Promise<void> {
  touched();
  await db.transaction("rw", [db.invoices, db.lessons, db.packages], async () => {
    const current = await db.invoices.get(id);
    if (!current) return;
    if (patch.items) {
      const kept = new Set(patch.items.flatMap((item) => [item.lessonId, item.packageId]).filter(Boolean));
      for (const item of current.items) {
        if (item.lessonId && !kept.has(item.lessonId)) await db.lessons.update(item.lessonId, { invoiceId: undefined });
        if (item.packageId && !kept.has(item.packageId)) await db.packages.update(item.packageId, { invoiceId: undefined });
      }
    }
    await db.invoices.update(id, { ...patch, updatedAt: nowIso() });
  });
}

export async function deleteInvoice(id: string): Promise<void> {
  await db.transaction("rw", [db.invoices, db.lessons, db.packages], async () => {
    await db.lessons.where("invoiceId").equals(id).modify({ invoiceId: undefined });
    await db.packages.filter((pack) => pack.invoiceId === id).modify({ invoiceId: undefined });
    await db.invoices.delete(id);
  });
}
