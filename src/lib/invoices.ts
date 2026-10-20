// Invoice sums and numbering. Amounts are minor units; each line is rounded once, then added up,
// so the printed lines always add up to the printed total.
import type { Invoice, InvoiceItem, Settings } from "./types";

export const itemAmount = (item: Pick<InvoiceItem, "quantity" | "unitPrice">) => Math.round(item.quantity * item.unitPrice);

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
  const hours = invoice.items.filter((item) => item.kind === "lesson").reduce((sum, item) => sum + item.quantity, 0);
  return { subtotal, discount, taxable, tax, total: taxable + tax, hours };
}

/** "INV-2026-007": the prefix, the year and the running number. */
export function formatInvoiceNumber(settings: Pick<Settings, "invoicePrefix">, number: number, issueDate: string): string {
  return `${settings.invoicePrefix}${issueDate.slice(0, 4)}-${String(number).padStart(3, "0")}`;
}

/** Overdue: unpaid and past the due date. */
export const isOverdue = (invoice: Invoice, today: string) => invoice.status === "unpaid" && invoice.dueDate < today;

/** Hours as a short number: 1.5, 2, 0.75. */
export const roundHours = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
