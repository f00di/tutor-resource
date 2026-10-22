// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import ar from "../i18n/ar.json";
import { InvoicePaper } from "@/components/invoice-paper";
import { createTranslator } from "@/lib/i18n";
import { defaultSettings } from "@/lib/settings";
import type { Invoice, InvoiceItem } from "@/lib/types";

afterEach(cleanup);

const lesson = (id: string, date: string, quantity: number): InvoiceItem => ({ id, kind: "lesson", date, description: "Chemistry", quantity, unitPrice: 3000 });

// Made-up tutor and student: no real names or numbers.
const settings = { ...defaultSettings(), tutorName: "Test Tutor", email: "tutor@example.com", phone: "050 000 0000", beneficiaryName: "Test Tutor", iban: "AE000000000000000000000", swiftCode: "TESTAEAA" };
const base: Invoice = {
  id: "inv",
  number: "2034",
  studentId: "s",
  issueDate: "2026-04-10",
  dueDate: "2026-04-17",
  periodStart: "2026-03-01",
  periodEnd: "2026-03-31",
  span: 1,
  level: "GCE AS Level",
  subject: "AS Chemistry",
  rate: 3000,
  currency: "AED",
  language: "en",
  billTo: "Parent T.",
  studentName: "Student T.",
  items: [lesson("a", "2026-03-07", 2), lesson("b", "2026-03-14", 2), lesson("c", "2026-03-21", 2), lesson("d", "2026-03-28", 2)],
  discount: 0,
  taxRate: 0,
  taxLabel: "VAT",
  notes: "",
  status: "unpaid",
  createdAt: "2026-04-10T08:00:00.000Z",
  updatedAt: "2026-04-10T08:00:00.000Z",
};
const english = createTranslator("en");
const pages = (container: HTMLElement) => [...container.querySelectorAll(".inv-page")] as HTMLElement[];
const text = (element: Element) => (element.textContent ?? "").replace(/\s+/g, " ");

describe("invoice paper", () => {
  it("lays out a monthly invoice like the spreadsheet", () => {
    const { container } = render(<InvoicePaper invoice={base} settings={settings} tr={english} />);
    const [page, ...rest] = pages(container);
    expect(rest).toHaveLength(0);
    const all = text(page!);
    for (const part of ["INVOICE", "2026", "March", "Tutoring", "Phone: 050 000 0000", "STUDENT", "INVOICE #", "DATE", "Student T.", "10-04-26", "DETAILS", "GCE AS Level", "Charge per hour", "30.00"]) {
      expect(all, part).toContain(part);
    }
    // The subject is only on the cover of 3- and 6-month invoices.
    expect(all).not.toContain("AS Chemistry");
    const rows = [...page!.querySelectorAll(".inv-lines tbody tr")];
    expect(rows).toHaveLength(15);
    expect(text(rows[0]!)).toBe("Saturday, March 7, 202607-03-262AED60.00");
    expect(text(rows[4]!)).toBe("AED-");
    expect(text(page!.querySelector(".inv-lines tfoot")!)).toBe("8");
    expect(text(page!.querySelector(".inv-total")!)).toBe("AED240.00");
    expect(page!.querySelector("a[href='mailto:tutor@example.com']")).toBeTruthy();
    expect([...page!.querySelectorAll(".inv-bank > div")].map(text)).toEqual(["Beneficiary names: Test Tutor", "IBAN: AE000000000000000000000", "Swift code: TESTAEAA"]);
    expect(text(page!.querySelector(".inv-footer")!)).toBe("If you have any questions about this invoice, please contactTest Tutor at 050 000 0000 or tutor@example.com");
    expect(page!.querySelector(".inv-adjust")).toBeNull();
  });

  it("shows discount and tax only when there are some", () => {
    const { container } = render(<InvoicePaper invoice={{ ...base, discount: 2000, taxRate: 5 }} settings={settings} tr={english} />);
    const adjust = text(container.querySelector(".inv-adjust")!);
    expect(adjust).toContain("Subtotal");
    expect(adjust).toContain("Discount");
    expect(adjust).toContain("VAT (5%)");
    expect(text(container.querySelector(".inv-total")!)).toBe("AED231.00");
  });

  it("makes a cover, a break-down page and a page per month for a 6-month invoice, newest first", () => {
    const invoice: Invoice = {
      ...base,
      span: 6,
      periodStart: "2025-10-01",
      periodEnd: "2026-03-31",
      items: [lesson("o", "2025-10-04", 9), lesson("n", "2025-11-01", 10), lesson("j", "2026-01-10", 8), ...base.items],
    };
    const { container } = render(<InvoicePaper invoice={invoice} settings={settings} tr={english} />);
    const [cover, breakdown, ...months] = pages(container);
    expect(text(cover!)).toContain("October 2025 - March 2026");
    expect(text(cover!)).toContain("AS Chemistry");
    const rows = [...cover!.querySelectorAll(".inv-months tbody tr")].map(text);
    expect(rows).toHaveLength(15);
    expect(rows.slice(0, 7)).toEqual(["October2025AED270.00", "November2025AED300.00", "December2025AED-", "January2026AED240.00", "February2026AED-", "March2026AED240.00", "AED-"]);
    expect(text(cover!.querySelector(".inv-final")!)).toBe("Final Total:AED1,050.00");
    expect(text(breakdown!)).toBe("Monthly break down");
    // Months without lessons get no page.
    expect(months.map((page) => text(page.querySelector(".inv-month")!))).toEqual(["2026March", "2026January", "2025November", "2025October"]);
    expect(text(months[0]!.querySelector(".inv-total")!)).toBe("AED240.00");
  });

  it("asks for bank details in the preview only", () => {
    const noBank = { ...settings, beneficiaryName: "", iban: "", swiftCode: "" };
    const preview = render(<InvoicePaper invoice={base} settings={noBank} tr={english} preview />);
    expect(preview.container.querySelector(".inv-bank-empty")?.textContent).toBe("Add your bank details in Settings");
    preview.unmount();
    const printed = render(<InvoicePaper invoice={base} settings={noBank} tr={english} />);
    expect(printed.container.querySelector(".inv-bank, .inv-bank-empty")).toBeNull();
  });

  it("mirrors in Arabic with Western digits", () => {
    const arabic = createTranslator("ar", ar as Record<string, unknown>);
    const { container } = render(<InvoicePaper invoice={{ ...base, language: "ar" }} settings={settings} tr={arabic} />);
    const paper = container.querySelector(".invoice-paper")!;
    expect(paper.getAttribute("dir")).toBe("rtl");
    expect(text(paper)).toContain("فاتورة");
    expect(text(paper)).toContain("مارس");
    expect(text(paper.querySelector(".inv-total")!)).toBe("AED240.00");
    expect(text(paper)).not.toMatch(/[٠-٩]/);
  });
});
