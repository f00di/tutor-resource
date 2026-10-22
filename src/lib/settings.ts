// The tutor's own details and preferences, stored with the rest of their data (and in backups).
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "./db";
import { CURRENCY_CODES, isCurrency } from "./money";
import { defaultWeekStart, isTimeKey } from "./time";
import type { Settings } from "./types";

export const SETTINGS_KEY = "settings";
export const LAST_BACKUP_KEY = "lastBackupAt";

export function defaultSettings(): Settings {
  return {
    tutorName: "",
    businessName: "",
    email: "",
    phone: "",
    address: "",
    taxNumber: "",
    beneficiaryName: "",
    iban: "",
    accountNumber: "",
    swiftCode: "",
    routingNumber: "",
    paymentDetails: "",
    invoiceFooter: "",
    invoicePrefix: "",
    nextInvoiceNumber: 1,
    dueDays: 7,
    taxLabel: "VAT",
    taxRate: 0,
    defaultCurrency: "AED",
    defaultRate: 15000,
    defaultDuration: 60,
    defaultMode: "online",
    weekStart: defaultWeekStart(),
    hour12: true,
    dayStart: "07:00",
    dayEnd: "23:00",
  };
}

/** Saved settings over the defaults, dropping anything that doesn't fit (e.g. from an old backup). */
export function normaliseSettings(value: unknown): Settings {
  const base = defaultSettings();
  if (!value || typeof value !== "object") return base;
  const saved = value as Partial<Record<keyof Settings, unknown>>;
  const text = (key: keyof Settings) => (typeof saved[key] === "string" ? (saved[key] as string) : (base[key] as string));
  const number = (key: keyof Settings, min: number) => {
    const raw = saved[key];
    return typeof raw === "number" && Number.isFinite(raw) && raw >= min ? raw : (base[key] as number);
  };
  const weekStart = saved.weekStart === 0 || saved.weekStart === 1 || saved.weekStart === 6 ? saved.weekStart : base.weekStart;
  const dayStart = isTimeKey(saved.dayStart) ? saved.dayStart : base.dayStart;
  const dayEnd = isTimeKey(saved.dayEnd) && saved.dayEnd > dayStart ? saved.dayEnd : base.dayEnd;
  return {
    tutorName: text("tutorName"),
    businessName: text("businessName"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    taxNumber: text("taxNumber"),
    beneficiaryName: text("beneficiaryName"),
    iban: text("iban"),
    accountNumber: text("accountNumber"),
    swiftCode: text("swiftCode"),
    routingNumber: text("routingNumber"),
    paymentDetails: text("paymentDetails"),
    invoiceFooter: text("invoiceFooter"),
    invoicePrefix: text("invoicePrefix"),
    nextInvoiceNumber: Math.floor(number("nextInvoiceNumber", 1)),
    dueDays: Math.floor(number("dueDays", 0)),
    taxLabel: text("taxLabel"),
    taxRate: number("taxRate", 0),
    defaultCurrency: isCurrency(saved.defaultCurrency) ? saved.defaultCurrency : base.defaultCurrency,
    defaultRate: Math.round(number("defaultRate", 0)),
    defaultDuration: Math.round(number("defaultDuration", 5)),
    defaultMode: saved.defaultMode === "inPerson" ? "inPerson" : saved.defaultMode === "online" ? "online" : base.defaultMode,
    weekStart,
    hour12: typeof saved.hour12 === "boolean" ? saved.hour12 : base.hour12,
    dayStart,
    dayEnd,
  };
}

export async function getSettings(): Promise<Settings> {
  return normaliseSettings((await db.meta.get(SETTINGS_KEY))?.value);
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  await db.transaction("rw", db.meta, async () => {
    const current = await getSettings();
    await db.meta.put({ key: SETTINGS_KEY, value: { ...current, ...patch } });
  });
}

/** Live settings; the defaults until the first read finishes. */
export function useSettings(): Settings {
  const row = useLiveQuery(() => db.meta.get(SETTINGS_KEY), []);
  return normaliseSettings(row?.value);
}

/** Live settings, but undefined until the saved ones are read: for forms that start from them (lesson length, rate). */
export function useLoadedSettings(): Settings | undefined {
  const row = useLiveQuery(async () => (await db.meta.get(SETTINGS_KEY)) ?? null, []);
  return row === undefined ? undefined : normaliseSettings(row?.value);
}

export function useLastBackup(): string | null | undefined {
  const row = useLiveQuery(() => db.meta.get(LAST_BACKUP_KEY), []);
  return row === undefined ? undefined : typeof row?.value === "string" ? row.value : null;
}

export { CURRENCY_CODES };
