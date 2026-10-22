// Invoice sums, months and numbering. Amounts are minor units; each line is rounded once, then added
// up, so the printed lines always add up to the printed total (and the months to the final total).
import { addMonths, endOfMonth, isDateKey } from "./time";
import type { Invoice, InvoiceItem, InvoiceSpan, Settings } from "./types";

export const itemAmount = (item: Pick<InvoiceItem, "quantity" | "unitPrice">) => Math.round(item.quantity * item.unitPrice);

const roundQuantity = (value: number) => Math.round(value * 100) / 100;

export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxable: number;
  tax: number;
  total: number;
  hours: number;
}

export function invoiceTotals(invoice: Pick<Invoice, "items" | "discount" | "taxRate">): InvoiceTotals {
  const subtotal = invoice.items.reduce((sum, item) => sum + itemAmount(item), 0);
  const discount = Math.min(Math.max(0, invoice.discount || 0), subtotal);
  const taxable = subtotal - discount;
  const tax = invoice.taxRate > 0 ? Math.round((taxable * invoice.taxRate) / 100) : 0;
  const hours = roundQuantity(invoice.items.filter((item) => item.kind === "lesson").reduce((sum, item) => sum + item.quantity, 0));
  return { subtotal, discount, taxable, tax, total: taxable + tax, hours };
}

/** "2034": the prefix (empty unless the tutor sets one) and the running number, as on the tutor's own invoices. */
export const formatInvoiceNumber = (settings: Pick<Settings, "invoicePrefix">, number: number): string => `${settings.invoicePrefix}${number}`;

export const INVOICE_SPANS: InvoiceSpan[] = [1, 3, 6];
export const isInvoiceSpan = (value: unknown): value is InvoiceSpan => value === 1 || value === 3 || value === 6;

/** The dates a 1-, 3- or 6-month invoice covers: whole calendar months, ending with the month `month` is in. */
export function spanRange(month: string, span: InvoiceSpan): { from: string; to: string } {
  return { from: addMonths(month, 1 - span), to: endOfMonth(month) };
}

/** "YYYY-MM" of a date key. */
export const monthOf = (key: string) => key.slice(0, 7);

/** Every "YYYY-MM" from one date's month to another's, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  const last = monthOf(to < from ? from : to);
  for (let key = `${monthOf(from)}-01`; monthOf(key) <= last && months.length < 120; key = addMonths(key, 1)) months.push(monthOf(key));
  return months;
}

export interface MonthGroup {
  /** "YYYY-MM". */
  month: string;
  items: InvoiceItem[];
  amount: number;
  hours: number;
}

/**
 * An invoice's lines month by month, oldest first: the cover of a 3- or 6-month invoice lists every
 * month of the period (empty ones too), and each month with lines gets its own page. A line dated
 * outside the period (a package that started earlier) or without a date goes to the nearest month,
 * so the months always add up to the subtotal.
 */
export function groupByMonth(invoice: Pick<Invoice, "items" | "periodStart" | "periodEnd" | "issueDate">): MonthGroup[] {
  const dates = invoice.items
    .map((item) => item.date)
    .filter(isDateKey)
    .sort();
  const first = invoice.periodStart && isDateKey(invoice.periodStart) ? invoice.periodStart : (dates[0] ?? invoice.issueDate);
  const last = invoice.periodEnd && isDateKey(invoice.periodEnd) ? invoice.periodEnd : (dates.at(-1) ?? first);
  const groups: MonthGroup[] = monthsBetween(first, last).map((month) => ({ month, items: [], amount: 0, hours: 0 }));
  for (const item of invoice.items) {
    const month = item.date && isDateKey(item.date) ? monthOf(item.date) : groups.at(-1)!.month;
    const group = groups.find((entry) => entry.month === month) ?? (month < groups[0]!.month ? groups[0]! : groups.at(-1)!);
    group.items.push(item);
    group.amount += itemAmount(item);
    if (item.kind === "lesson") group.hours = roundQuantity(group.hours + item.quantity);
  }
  return groups;
}

/** Rows in every table on the paper, as on the tutor's spreadsheet invoice: shorter tables get empty "AED -" rows. */
export const PAPER_ROWS = 15;
export const paddingRows = (filled: number, rows = PAPER_ROWS) => Math.max(0, rows - filled);

/** The "Charge per hour" on the invoice: its own rate, else (older invoices) the rate of its first lesson line. */
export function chargePerHour(invoice: Pick<Invoice, "rate" | "items">): number | undefined {
  return invoice.rate ?? invoice.items.find((item) => item.kind === "lesson")?.unitPrice;
}

export const BANK_FIELDS = ["beneficiaryName", "iban", "accountNumber", "swiftCode", "routingNumber"] as const;
export type BankField = (typeof BANK_FIELDS)[number];

/** The bank lines an invoice prints: only the ones the tutor filled in, in the spreadsheet's order. */
export const bankLines = (settings: Pick<Settings, BankField>) => BANK_FIELDS.map((field) => ({ field, value: settings[field].trim() })).filter((line) => line.value);
export const hasBankDetails = (settings: Pick<Settings, BankField>) => bankLines(settings).length > 0;

/** Overdue: unpaid and past the due date. */
export const isOverdue = (invoice: Invoice, today: string) => invoice.status === "unpaid" && invoice.dueDate < today;

/** Hours as a short number: 1.5, 2, 0.75. */
export const roundHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
