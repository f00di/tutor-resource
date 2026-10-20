// Money is stored in minor units. The Kuwaiti dinar, Bahraini dinar and Omani rial have 1,000
// minor units (3 decimal places); the others here have 100.
import type { CurrencyCode } from "./types";

export const CURRENCIES: Record<CurrencyCode, number> = {
  AED: 2,
  SAR: 2,
  QAR: 2,
  KWD: 3,
  BHD: 3,
  OMR: 3,
  USD: 2,
  GBP: 2,
  EUR: 2,
};
export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];
export const isCurrency = (value: unknown): value is CurrencyCode => typeof value === "string" && value in CURRENCIES;
export const decimals = (currency: CurrencyCode) => CURRENCIES[currency] ?? 2;
const factor = (currency: CurrencyCode) => 10 ** decimals(currency);

// Arabic-Indic and Eastern Arabic-Indic digits, as some keyboards type them.
const DIGITS: Record<string, string> = Object.fromEntries(
  [..."٠١٢٣٤٥٦٧٨٩"].map((digit, index) => [digit, String(index)]).concat([..."۰۱۲۳۴۵۶۷۸۹"].map((digit, index) => [digit, String(index)]))
);

/** Reads "1,200.5", "١٢٠٠٫٥" or "1200" as minor units. Empty or invalid → null. */
export function toMinor(value: string | number, currency: CurrencyCode): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * factor(currency)) : null;
  const normalised = value
    .trim()
    .replace(/[٠-٩۰-۹]/g, (digit) => DIGITS[digit] ?? digit)
    .replace(/٫/g, ".")
    .replace(/[,٬\s]/g, "");
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(normalised)) return null;
  const amount = Number(normalised);
  return Number.isFinite(amount) ? Math.round(amount * factor(currency)) : null;
}

/** Minor units as the plain number an input shows: 12000 AED → "120.00", 1500 KWD → "1.500". */
export const minorToInput = (minor: number, currency: CurrencyCode) => (minor / factor(currency)).toFixed(decimals(currency));

const moneyFormatters = new Map<string, Intl.NumberFormat>();
export function formatMoney(minor: number, currency: CurrencyCode, locale: string): string {
  const key = `${locale}|${currency}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    const digits = decimals(currency);
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(minor / factor(currency));
}

/** What a lesson costs at an hourly rate, rounded to the minor unit. */
export const lessonAmount = (ratePerHour: number, minutes: number) => Math.round((ratePerHour * minutes) / 60);

/** Adds up amounts per currency, e.g. for "unpaid" across families billed in different currencies. */
export function sumByCurrency(entries: Array<{ currency: CurrencyCode; amount: number }>): Array<{ currency: CurrencyCode; amount: number }> {
  const totals = new Map<CurrencyCode, number>();
  for (const { currency, amount } of entries) totals.set(currency, (totals.get(currency) ?? 0) + amount);
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}
