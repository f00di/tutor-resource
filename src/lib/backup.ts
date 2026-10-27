// Backups: one JSON file with everything, which the tutor saves wherever they like (Downloads, a USB
// stick, their own cloud drive). Restoring replaces what's on this device. Browser storage can be
// cleared (a new laptop, a cleared browser), and each web address and the desktop app keep their own
// data, so the file is the one way to move everything: back up here, restore there.
import { DATA_TABLES, db, nowIso, type DataTable } from "./db";
import { isLang, LANG_STORAGE_KEY } from "./i18n";
import { LAST_BACKUP_KEY, normaliseSettings, SETTINGS_KEY } from "./settings";
import { THEME_STORAGE_KEY, type ThemeChoice } from "./theme";
import { deviceZone, todayKey } from "./time";
import type { Lang } from "./types";

export const BACKUP_APP = "tutorcat-desk";
/** 2: adds appVersion and prefs. Older files still restore (see readBackup). */
export const BACKUP_VERSION = 2;

/** Choices this browser keeps outside the database (localStorage), so they come back too. */
export interface BackupPrefs {
  lang: Lang | null;
  theme: ThemeChoice | null;
}

export interface Backup {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  /** The app version that made the file; null in version 1 files. */
  appVersion: string | null;
  prefs: BackupPrefs | null;
  settings: unknown;
  students: unknown[];
  lessons: unknown[];
  blackouts: unknown[];
  notes: unknown[];
  invoices: unknown[];
  packages: unknown[];
}

const stored = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

function readPrefs(): BackupPrefs {
  const lang = stored(LANG_STORAGE_KEY);
  const theme = stored(THEME_STORAGE_KEY);
  return { lang: isLang(lang) ? lang : null, theme: theme === "light" || theme === "dark" ? theme : null };
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
    return {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      exportedAt: nowIso(),
      appVersion: __APP_VERSION__,
      prefs: readPrefs(),
      settings: settings?.value ?? null,
      students,
      lessons,
      blackouts,
      notes,
      invoices,
      packages,
    };
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

/**
 * What a record gets when a field is missing: a file from an older version, or one edited by hand.
 * A new required field on a stored shape (types.ts) needs its default here, so older backups keep restoring.
 */
const RECORD_DEFAULTS: Record<DataTable, (at: string) => object> = {
  students: (at) => ({ name: "", parentName: "", phone: "", email: "", timeZone: deviceZone(), messageLang: "en", curriculum: "", level: "", subjects: "", rate: 0, currency: "AED", mode: "online", location: "", tone: "sage", notes: "", archived: false, createdAt: at, updatedAt: at }),
  lessons: (at) => ({ mode: "online", location: "", status: "planned", plan: [], covered: "", homework: "", privateNote: "", createdAt: at, updatedAt: at }),
  blackouts: (at) => ({ title: "", days: null, startTime: null, endTime: null, startDate: null, endDate: null, createdAt: at }),
  notes: (at) => ({ text: "", done: false, createdAt: at }),
  invoices: (at) => ({ billTo: "", studentName: "", currency: "AED", language: "en", items: [], discount: 0, taxRate: 0, taxLabel: "", notes: "", status: "unpaid", createdAt: at, updatedAt: at }),
  packages: (at) => ({ size: 1, price: 0, currency: "AED", createdAt: at }),
};

const withDefaults = (name: DataTable, records: unknown[], at: string) => records.map((record) => ({ ...RECORD_DEFAULTS[name](at), ...(record as object) }));

/** Checks a file is one of our backups before anything is replaced, and brings an older file up to this version's shape. */
export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("notBackup");
  }
  if (!data || typeof data !== "object" || (data as { app?: unknown }).app !== BACKUP_APP) throw new BackupError("notBackup");
  const file = data as Partial<Backup> & Record<string, unknown>;
  if (typeof file.version !== "number" || file.version > BACKUP_VERSION) throw new BackupError("newer");
  if (!DATA_TABLES.every((name) => isRecordList(file[name]))) throw new BackupError("damaged");
  const exportedAt = typeof file.exportedAt === "string" && !Number.isNaN(Date.parse(file.exportedAt)) ? file.exportedAt : nowIso();
  const prefs = file.prefs && typeof file.prefs === "object" ? (file.prefs as Partial<BackupPrefs>) : null;
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt,
    appVersion: typeof file.appVersion === "string" ? file.appVersion : null,
    prefs: prefs ? { lang: isLang(prefs.lang) ? prefs.lang : null, theme: prefs.theme === "light" || prefs.theme === "dark" ? prefs.theme : null } : null,
    settings: file.settings ?? null,
    ...(Object.fromEntries(DATA_TABLES.map((name) => [name, withDefaults(name, file[name] as unknown[], exportedAt)])) as Record<DataTable, unknown[]>),
  };
}

/** Reads a picked file (File.text() where the browser has it). */
export async function readBackupFile(file: Blob): Promise<Backup> {
  const text =
    typeof file.text === "function"
      ? await file.text()
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });
  return parseBackup(text);
}

export const backupCounts = (backup: Backup) => ({ students: backup.students.length, lessons: backup.lessons.length, invoices: backup.invoices.length });

/**
 * Replaces everything on this device with the backup. The data is then exactly what the file holds,
 * so the file's date counts as the last backup (the Today reminder doesn't nag straight after a restore).
 */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction("rw", [...DATA_TABLES.map((name) => db.table(name)), db.meta], async () => {
    for (const name of DATA_TABLES) {
      const table = db.table(name);
      await table.clear();
      await table.bulkAdd(backup[name] as object[]);
    }
    await db.meta.put({ key: SETTINGS_KEY, value: normaliseSettings(backup.settings) });
    await db.meta.put({ key: LAST_BACKUP_KEY, value: backup.exportedAt });
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

/** The tutor's own records (not the sample data): what's worth backing up before a restore replaces it. */
export async function hasOwnData(): Promise<boolean> {
  const own = (row: { sample?: boolean }) => row.sample !== true;
  const counts = await Promise.all([db.students.filter(own).count(), db.lessons.filter(own).count(), db.invoices.filter(own).count()]);
  return counts.some((count) => count > 0);
}
