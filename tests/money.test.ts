import { describe, expect, it } from "vitest";

import { invoiceTotals } from "@/lib/invoices";
import { formatMoney, lessonAmount, minorToInput, sumByCurrency, toMinor } from "@/lib/money";

describe("money", () => {
  it("reads amounts as typed, including Arabic digits", () => {
    expect(toMinor("1,200.5", "AED")).toBe(120050);
    expect(toMinor("200", "SAR")).toBe(20000);
    expect(toMinor("١٢٠٠٫٥", "AED")).toBe(120050);
    expect(toMinor("12.345", "KWD")).toBe(12345);
    expect(toMinor("", "AED")).toBeNull();
    expect(toMinor("abc", "AED")).toBeNull();
  });

  it("uses three decimals for the Kuwaiti and Bahraini dinars and the Omani rial", () => {
    expect(minorToInput(1500, "KWD")).toBe("1.500");
    expect(minorToInput(1500, "BHD")).toBe("1.500");
    expect(minorToInput(1500, "OMR")).toBe("1.500");
    expect(minorToInput(1500, "AED")).toBe("15.00");
    expect(formatMoney(1500, "KWD", "en-GB")).toContain("1.500");
    expect(formatMoney(120050, "AED", "en-GB")).toContain("1,200.50");
    // Arabic text keeps Western digits.
    expect(formatMoney(120050, "AED", "ar-AE-u-nu-latn")).toMatch(/1,200\.50/);
  });

  it("prices lessons by the minute and adds up per currency", () => {
    expect(lessonAmount(20000, 90)).toBe(30000);
    expect(lessonAmount(10000, 45)).toBe(7500);
    expect(sumByCurrency([
      { currency: "AED", amount: 100 },
      { currency: "SAR", amount: 50 },
      { currency: "AED", amount: 25 },
    ])).toEqual([
      { currency: "AED", amount: 125 },
      { currency: "SAR", amount: 50 },
    ]);
  });

  it("totals an invoice: lines rounded once, discount, then tax", () => {
    const totals = invoiceTotals({
      items: [
        { id: "a", kind: "lesson", description: "", quantity: 1.5, unitPrice: 20000 },
        { id: "b", kind: "lesson", description: "", quantity: 1, unitPrice: 20000 },
        { id: "c", kind: "custom", description: "Past papers", quantity: 2, unitPrice: 1525 },
      ],
      discount: 5000,
      taxRate: 5,
    });
    expect(totals).toEqual({ subtotal: 53050, discount: 5000, taxable: 48050, tax: 2403, total: 50453, hours: 2.5 });
  });

  it("never discounts below zero", () => {
    expect(invoiceTotals({ items: [{ id: "a", kind: "custom", description: "", quantity: 1, unitPrice: 100 }], discount: 500, taxRate: 0 }).total).toBe(0);
  });
});
