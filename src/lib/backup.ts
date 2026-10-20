// Backups: one JSON file with everything, which the tutor saves wherever they like (Downloads, a USB
// stick, their own cloud drive). Restoring replaces what's on this device. Browser storage can be
// cleared (a new laptop, a cleared browser), so the app reminds tutors to back up.
import { DATA_TABLES, db, nowIso } from "./db";
import { LAST_BACKUP_KEY, normaliseSettings, SETTINGS_KEY } from "./settings";
import { todayKey } from "./time";

export const BACKUP_APP = "tutorcat-desk";
export const BACKUP_VERSION = 1;

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  settings: unknown;
  students: unknown[];
  lessons: unknown[];
  blackouts: unknown[];
  notes: unknown[];
  invoices: unknown[];
  packages: unknown[];
}

export async function exportBackup(): Promise<Backup> {
  return db.transaction("r", [...DATA_TABLES.map((name) => db.table(name)), db.meta], async () => {
    const [students, lessons, blackouts, notes, invoices, packages, settings] = await Promise.all([
      db.students.toArray(),
      db.lessons.toArray(),
      db.blackouts.toArray(),
      db.notes.toArray(),
      db.invoices.toArray(),
      db.packages.toArray(),
      db.meta.get(SETTINGS_KEY),
    ]);
    return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: nowIso(), settings: settings?.value ?? null, students, lessons, blackouts, notes, invoices, packages };
  });
}

export const backupFileName = (date = todayKey()) => `tutorcat-desk-backup-${date}.json`;

export class BackupError extends Error {
  constructor(public readonly reason: "notBackup" | "newer" | "damaged") {
    super(reason);
  }
}

const isRecordList = (value: unknown): value is Array<{ id: string }> =>
  Array.isArray(value) && value.every((item) => item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string");

/** Checks a file is one of our backups before anything is replaced. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("notBackup");
  }
  if (!data || typeof data !== "object" || (data as { app?: unknown }).app !== BACKUP_APP) throw new BackupError("notBackup");
  const backup = data as Backup;
  if (typeof backup.version !== "number" || backup.version > BACKUP_VERSION) throw new BackupError("newer");
  if (!DATA_TABLES.every((name) => isRecordList(backup[name]))) throw new BackupError("damaged");
  return backup;
}

export const backupCounts = (backup: Backup) => ({ students: backup.students.length, lessons: backup.lessons.length, invoices: backup.invoices.length });

/** Replaces everything on this device with the backup. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction("rw", [...DATA_TABLES.map((name) => db.table(name)), db.meta], async () => {
    for (const name of DATA_TABLES) {
      const table = db.table(name);
      await table.clear();
      await table.bulkAdd(backup[name] as object[]);
    }
    await db.meta.put({ key: SETTINGS_KEY, value: normaliseSettings(backup.settings) });
  });
}

export async function markBackedUp(): Promise<void> {
  await db.meta.put({ key: LAST_BACKUP_KEY, value: nowIso() });
}

/** Saves the backup file: a "Save as" window where the browser has one (Chrome, Edge), else a normal download. */
export async function saveBackupFile(): Promise<boolean> {
  const backup = await exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const name = backupFileName();
  const picker = (window as Window & { showSaveFilePicker?: (options: unknown) => Promise<FileSystemFileHandle> }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({ suggestedName: name, types: [{ description: "Tutorcat Desk backup", accept: { "application/json": [".json"] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      await markBackedUp();
      return true;
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return false;
      // Anything else (e.g. not allowed in this window): fall back to a download.
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  await markBackedUp();
  return true;
}

/** Removes everything this app stored on this device. */
export async function deleteAllData(): Promise<void> {
  await db.transaction("rw", [...DATA_TABLES.map((name) => db.table(name)), db.meta], async () => {
    for (const name of DATA_TABLES) await db.table(name).clear();
    await db.meta.clear();
  });
}

export async function hasAnyData(): Promise<boolean> {
  const counts = await Promise.all([db.students.count(), db.lessons.count(), db.invoices.count()]);
  return counts.some((count) => count > 0);
}
