// The tutor's data, in this browser's IndexedDB (via Dexie). Nothing here is ever sent anywhere;
// Settings → Your data makes a backup file the tutor keeps.
import Dexie, { type EntityTable } from "dexie";

import type { Blackout, DayNote, Invoice, Lesson, LessonPackage, MetaRow, Student } from "./types";

export const DB_NAME = "tutorcat-desk";

export class DeskDB extends Dexie {
  students!: EntityTable<Student, "id">;
  lessons!: EntityTable<Lesson, "id">;
  blackouts!: EntityTable<Blackout, "id">;
  notes!: EntityTable<DayNote, "id">;
  invoices!: EntityTable<Invoice, "id">;
  packages!: EntityTable<LessonPackage, "id">;
  meta!: EntityTable<MetaRow, "key">;

  constructor(name = DB_NAME) {
    super(name);
    // Only fields the app looks things up by are indexed. A schema change needs a new version() here.
    this.version(1).stores({
      students: "id, name",
      lessons: "id, studentId, start, seriesId, invoiceId",
      blackouts: "id",
      notes: "id, date",
      invoices: "id, studentId, issueDate",
      packages: "id, studentId",
      meta: "key",
    });
  }
}

export const db = new DeskDB();

/** Every table, in the order backups list them. */
export const DATA_TABLES = ["students", "lessons", "blackouts", "notes", "invoices", "packages"] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/** Ask the browser not to clear this app's storage when space runs low (installed apps usually get this). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
