import { describe, expect, it } from "vitest";

import { bankLines, chargePerHour, formatInvoiceNumber, groupByMonth, hasBankDetails, invoiceTotals, monthsBetween, paddingRows, spanRange } from "@/lib/invoices";
import { formatAmount } from "@/lib/money";
import { defaultSettings, normaliseSettings } from "@/lib/settings";
import type { Invoice, InvoiceItem } from "@/lib/types";

const lesson = (id: string, date: string, quantity = 1, unitPrice = 3000): InvoiceItem => ({ id, kind: "lesson", date, description: "", quantity, unitPrice });

// Six months, October to March, like the spreadsheet example: nothing in December or February.
const sixMonths: Pick<Invoice, "items" | "periodStart" | "periodEnd" | "issueDate" | "discount" | "taxRate"> = {
  periodStart: "2025-10-01",
  periodEnd: "2026-03-31",
  issueDate: "2026-04-10",
  discount: 0,
  taxRate: 0,
  items: [
    lesson("o1", "2025-10-04"),
    lesson("o2", "2025-10-05"),
    lesson("n1", "2025-11-01", 2),
    lesson("j1", "2026-01-10", 1.5),
    lesson("m1", "2026-03-07", 2),
    lesson("m2", "2026-03-14", 2),
  ],
};

describe("invoice numbers", () => {
  it("is a plain running number, with an optional prefix", () => {
    expect(formatInvoiceNumber({ invoicePrefix: "" }, 2034)).toBe("2034");
    expect(formatInvoiceNumber({ invoicePrefix: "TC-" }, 7)).toBe("TC-7");
    expect(defaultSettings().invoicePrefix).toBe("");
  });
});

describe("invoice periods", () => {
  it("covers whole calendar months ending with the chosen month", () => {
    expect(spanRange("2026-03-15", 1)).toEqual({ from: "2026-03-01", to: "2026-03-31" });
    expect(spanRange("2026-03-01", 6)).toEqual({ from: "2025-10-01", to: "2026-03-31" });
    expect(spanRange("2026-01-20", 3)).toEqual({ from: "2025-11-01", to: "2026-01-31" });
    expect(spanRange("2028-02-01", 1).to).toBe("2028-02-29");
  });

  it("lists the months in between, oldest first", () => {
    expect(monthsBetween("2025-11-12", "2026-02-03")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthsBetween("2026-03-01", "2026-03-31")).toEqual(["2026-03"]);
    expect(monthsBetween("2026-03-01", "2026-01-31")).toEqual(["2026-03"]);
  });
});

describe("cumulative invoices", () => {
  it("groups lines by month, keeping empty months", () => {
    const groups = groupByMonth(sixMonths);
    expect(groups.map((group) => [group.month, group.items.length, group.amount, group.hours])).toEqual([
      ["2025-10", 2, 6000, 2],
      ["2025-11", 1, 6000, 2],
      ["2025-12", 0, 0, 0],
      ["2026-01", 1, 4500, 1.5],
      ["2026-02", 0, 0, 0],
      ["2026-03", 2, 12000, 4],
    ]);
  });

  it("adds the months up to the final total, before discount and tax", () => {
    const withExtras = { ...sixMonths, discount: 1500, taxRate: 5 };
    const totals = invoiceTotals(withExtras);
    const months = groupByMonth(withExtras).reduce((sum, group) => sum + group.amount, 0);
    expect(months).toBe(totals.subtotal);
    expect(totals.subtotal).toBe(28500);
    expect(totals.tax).toBe(Math.round((28500 - 1500) * 0.05));
    expect(totals.total).toBe(28500 - 1500 + 1350);
    expect(totals.hours).toBe(9.5);
  });

  it("rounds each line once, so months and pages agree with the total", () => {
    // 45 minutes at 33.33 an hour is 24.9975: 25.00 on the line, in the month and in the total.
    const odd = { ...sixMonths, items: [lesson("a", "2025-10-04", 0.75, 3333), lesson("b", "2025-10-11", 0.75, 3333)] };
    expect(groupByMonth(odd)[0]!.amount).toBe(5000);
    expect(invoiceTotals(odd).total).toBe(5000);
  });

  it("puts a package from before the period in the first month, and an undated line in the last", () => {
    const groups = groupByMonth({
      ...sixMonths,
      items: [
        { id: "p", kind: "package", date: "2025-08-20", description: "", quantity: 1, unitPrice: 100000, size: 8 },
        { id: "c", kind: "custom", description: "Books", quantity: 1, unitPrice: 5000 },
      ],
    });
    expect(groups[0]!.items.map((item) => item.id)).toEqual(["p"]);
    expect(groups.at(-1)!.items.map((item) => item.id)).toEqual(["c"]);
    expect(groups[0]!.hours).toBe(0);
  });

  it("pads every table to 15 rows", () => {
    expect(paddingRows(4)).toBe(11);
    expect(paddingRows(6)).toBe(9);
    expect(paddingRows(15)).toBe(0);
    expect(paddingRows(22)).toBe(0);
  });

  it("shows amounts without the currency, with the currency's decimals", () => {
    expect(formatAmount(159000, "AED", "en-GB")).toBe("1,590.00");
    expect(formatAmount(1500, "KWD", "en-GB")).toBe("1.500");
    expect(formatAmount(24000, "AED", "ar-AE-u-nu-latn")).toMatch(/^240\.00$/);
  });

  it("shows the invoice's own hourly rate, or the first lesson's on older invoices", () => {
    expect(chargePerHour({ rate: 3000, items: [lesson("a", "2026-03-07", 1, 2500)] })).toBe(3000);
    expect(chargePerHour({ items: [lesson("a", "2026-03-07", 1, 2500)] })).toBe(2500);
    expect(chargePerHour({ items: [] })).toBeUndefined();
  });
});

describe("bank details", () => {
  it("prints only the lines that are filled in, in the spreadsheet's order", () => {
    const settings = { ...defaultSettings(), routingNumber: "000000000", beneficiaryName: " Test Tutor ", swiftCode: "  " };
    expect(bankLines(settings)).toEqual([
      { field: "beneficiaryName", value: "Test Tutor" },
      { field: "routingNumber", value: "000000000" },
    ]);
    expect(hasBankDetails(settings)).toBe(true);
    expect(hasBankDetails({ ...defaultSettings(), iban: "   " })).toBe(false);
  });

  it("keeps bank details from saved settings and backups, and ignores anything else", () => {
    const saved = normaliseSettings({ iban: "AE00 0000 0000 0000 0000 000", accountNumber: 123, swiftCode: "TESTAEAA" });
    expect(saved.iban).toBe("AE00 0000 0000 0000 0000 000");
    expect(saved.swiftCode).toBe("TESTAEAA");
    expect(saved.accountNumber).toBe("");
    expect(normaliseSettings(null).beneficiaryName).toBe("");
  });
});
