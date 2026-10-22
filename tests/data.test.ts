import { beforeEach, describe, expect, it } from "vitest";

import ar from "../i18n/ar.json";
import { carryOverTopics, createInvoice, createLessons, deleteInvoice, deleteStudent, moveLesson, saveStudent, updateInvoice, type StudentDraft } from "@/lib/actions";
import { BackupError, exportBackup, parseBackup, restoreBackup } from "@/lib/backup";
import { DATA_TABLES, db } from "@/lib/db";
import { createTranslator } from "@/lib/i18n";
import { invoiceableLessons } from "@/lib/lessons";
import { invoiceMessage, reminderMessage, summaryMessage, waNumber, whatsappLink } from "@/lib/messages";
import { loadSampleData, removeSampleData } from "@/lib/sample";
import { getSettings, saveSettings } from "@/lib/settings";
import { combine, dateKey, timeKey } from "@/lib/time";

const sara: StudentDraft = {
  name: "Sara A.",
  parentName: "Mona A.",
  phone: "+971 50 123 4567",
  email: "",
  timeZone: "Asia/Dubai",
  messageLang: "en",
  curriculum: "British (IGCSE/A-Level)",
  level: "Year 10",
  subjects: "IGCSE Maths",
  rate: 20000,
  currency: "AED",
  mode: "online",
  location: "https://meet.example/abc",
  tone: "sage",
  notes: "",
};

beforeEach(async () => {
  await Promise.all([...DATA_TABLES.map((name) => db.table(name).clear()), db.meta.clear()]);
});

describe("lessons in storage", () => {
  it("creates a weekly series and moves this and later lessons on the student's clock", async () => {
    const studentId = await saveStudent(sara);
    const ids = await createLessons({ studentId, start: combine("2026-11-02", "17:00", "Asia/Dubai"), minutes: 60, mode: "online", location: "", plan: [{ id: "p", text: "Vectors", done: false }], zone: "Asia/Dubai", repeat: { everyWeeks: 1, count: 4 } });
    expect(ids).toHaveLength(4);
    const lessons = await db.lessons.orderBy("start").toArray();
    expect(new Set(lessons.map((lesson) => lesson.seriesId)).size).toBe(1);
    expect(lessons[0]!.plan).toHaveLength(1);
    expect(lessons[1]!.plan).toHaveLength(0);

    // Drag the second lesson to Tuesday 6 pm, for it and every later one.
    const second = lessons[1]!;
    const newStart = combine("2026-11-10", "18:00", "Asia/Dubai");
    await moveLesson(second.id, newStart, newStart + 90 * 60_000, "following", "Asia/Dubai");
    const moved = await db.lessons.orderBy("start").toArray();
    expect(moved.map((lesson) => `${dateKey(Date.parse(lesson.start), "Asia/Dubai")} ${timeKey(Date.parse(lesson.start), "Asia/Dubai")}`)).toEqual([
      "2026-11-02 17:00",
      "2026-11-10 18:00",
      "2026-11-17 18:00",
      "2026-11-24 18:00",
    ]);
    expect(moved.slice(1).every((lesson) => Date.parse(lesson.end) - Date.parse(lesson.start) === 90 * 60_000)).toBe(true);
  });

  it("carries unfinished topics to the next lesson", async () => {
    const studentId = await saveStudent(sara);
    const past = Date.now() - 3 * 86400_000;
    const [first] = await createLessons({ studentId, start: past, minutes: 60, mode: "online", location: "", plan: [{ id: "a", text: "Vectors", done: false }, { id: "b", text: "Matrices", done: true }], zone: "Asia/Dubai" });
    const [later] = await createLessons({ studentId, start: Date.now() + 2 * 86400_000, minutes: 60, mode: "online", location: "", plan: [], zone: "Asia/Dubai" });
    expect(await carryOverTopics(first!)).toBe(later);
    expect((await db.lessons.get(later!))!.plan.map((item) => item.text)).toEqual(["Vectors"]);
    expect((await db.lessons.get(first!))!.plan.find((item) => item.text === "Vectors")?.movedOn).toBe(true);
    // Nothing left to move the second time.
    expect(await carryOverTopics(first!)).toBeNull();
  });

  it("deletes a student with their lessons but keeps their invoices", async () => {
    const studentId = await saveStudent(sara);
    const ids = await createLessons({ studentId, start: Date.now() - 86400_000, minutes: 60, mode: "online", location: "", plan: [], zone: "Asia/Dubai" });
    const student = (await db.students.get(studentId))!;
    await createInvoice({ student, lessons: await db.lessons.bulkGet(ids).then((rows) => rows.filter((row) => row !== undefined)) });
    await deleteStudent(studentId);
    expect(await db.lessons.count()).toBe(0);
    expect(await db.invoices.count()).toBe(1);
  });
});

describe("invoices in storage", () => {
  it("numbers invoices, marks their lessons, and frees them when deleted", async () => {
    await saveSettings({ invoicePrefix: "TC-", nextInvoiceNumber: 7, dueDays: 5, paymentDetails: "IBAN AE00 0000" });
    const studentId = await saveStudent(sara);
    await createLessons({ studentId, start: Date.now() - 7 * 86400_000, minutes: 90, mode: "online", location: "", plan: [], zone: "Asia/Dubai", repeat: { everyWeeks: 1, count: 1 } });
    await createLessons({ studentId, start: Date.now() - 2 * 86400_000, minutes: 60, mode: "online", location: "", plan: [], zone: "Asia/Dubai" });
    const student = (await db.students.get(studentId))!;
    const ready = invoiceableLessons(await db.lessons.toArray(), [], studentId, "2000-01-01", "2100-01-01");
    expect(ready).toHaveLength(2);

    const id = await createInvoice({ student, lessons: ready });
    const invoice = (await db.invoices.get(id))!;
    expect(invoice.number).toBe("TC-7");
    expect(invoice.span).toBe(1);
    expect([invoice.level, invoice.subject, invoice.rate]).toEqual(["Year 10", "IGCSE Maths", 20000]);
    expect(invoice.items.map((item) => [item.quantity, item.unitPrice])).toEqual([
      [1.5, 20000],
      [1, 20000],
    ]);
    expect(invoice.notes).toBe("IBAN AE00 0000");
    expect(invoice.billTo).toBe("Mona A.");
    expect((await getSettings()).nextInvoiceNumber).toBe(8);
    expect(invoiceableLessons(await db.lessons.toArray(), [], studentId, "2000-01-01", "2100-01-01")).toHaveLength(0);

    // Taking a line off frees that lesson; deleting the invoice frees the rest.
    await updateInvoice(id, { items: invoice.items.slice(1) });
    expect(invoiceableLessons(await db.lessons.toArray(), [], studentId, "2000-01-01", "2100-01-01")).toHaveLength(1);
    await deleteInvoice(id);
    expect(invoiceableLessons(await db.lessons.toArray(), [], studentId, "2000-01-01", "2100-01-01")).toHaveLength(2);
  });

  it("makes a 3-month invoice covering whole months, numbered like the spreadsheet", async () => {
    await saveSettings({ nextInvoiceNumber: 2034 });
    const studentId = await saveStudent({ ...sara, level: "", curriculum: "British (IGCSE/A-Level)" });
    const student = (await db.students.get(studentId))!;
    const id = await createInvoice({ student, lessons: [], periodStart: "2026-01-01", periodEnd: "2026-03-31", span: 3 });
    const invoice = (await db.invoices.get(id))!;
    expect(invoice.number).toBe("2034");
    expect(invoice.span).toBe(3);
    expect(invoice.level).toBe("British (IGCSE/A-Level)");
    expect((await getSettings()).nextInvoiceNumber).toBe(2035);
  });
});

describe("messages", () => {
  it("writes WhatsApp links with the number in international form", () => {
    expect(waNumber("+971 50 123 4567")).toBe("971501234567");
    expect(waNumber("00966 50 000 0000")).toBe("966500000000");
    expect(waNumber("call me")).toBe("");
    expect(whatsappLink("+971501234567", "Hi there")).toBe("https://wa.me/971501234567?text=Hi%20there");
  });

  it("writes reminders and summaries in the family's language, without the private note", async () => {
    const studentId = await saveStudent({ ...sara, messageLang: "ar" });
    const student = (await db.students.get(studentId))!;
    const [id] = await createLessons({ studentId, start: combine("2026-10-26", "17:00", "Asia/Dubai"), minutes: 60, mode: "online", location: "https://meet.example/abc", plan: [], zone: "Asia/Dubai" });
    const lesson = { ...(await db.lessons.get(id!))!, covered: "Vectors", homework: "Ex 6B", privateNote: "Seemed tired" };
    const arabic = createTranslator("ar", ar as Record<string, unknown>);
    const reminder = reminderMessage(arabic, student, lesson, "Hassan");
    expect(reminder).toContain("تذكير");
    expect(reminder).toContain("دبي");
    expect(reminder).toContain("5:00");
    expect(reminder).toContain("https://meet.example/abc");
    const summary = summaryMessage(createTranslator("en"), student, lesson, undefined, "Hassan");
    expect(summary).toContain("Vectors");
    expect(summary).toContain("Ex 6B");
    expect(summary).not.toContain("tired");
  });

  it("states an invoice's total and due date", async () => {
    const studentId = await saveStudent(sara);
    const student = (await db.students.get(studentId))!;
    const id = await createInvoice({ student, lessons: [] });
    const invoice = { ...(await db.invoices.get(id))!, items: [{ id: "x", kind: "custom" as const, description: "Pack", quantity: 1, unitPrice: 150000 }] };
    // Intl puts a non-breaking space between the code and the amount.
    expect(invoiceMessage(createTranslator("en"), student, invoice, "")).toMatch(/AED\s1,500\.00, due \d+ \w+ \d{4}/);
  });
});

describe("backups", () => {
  it("round-trips everything and refuses other files", async () => {
    await saveSettings({ tutorName: "Hassan" });
    await loadSampleData(createTranslator("en"));
    const backup = await exportBackup();
    const counts = { students: backup.students.length, lessons: backup.lessons.length };
    expect(counts.students).toBe(2);

    await Promise.all(DATA_TABLES.map((name) => db.table(name).clear()));
    await restoreBackup(parseBackup(JSON.stringify(backup)));
    expect(await db.students.count()).toBe(counts.students);
    expect(await db.lessons.count()).toBe(counts.lessons);
    expect((await getSettings()).tutorName).toBe("Hassan");

    expect(() => parseBackup("{}")).toThrow(BackupError);
    expect(() => parseBackup("not json")).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ ...backup, version: 99 }))).toThrow(/newer/);
    expect(() => parseBackup(JSON.stringify({ ...backup, lessons: [{ nope: true }] }))).toThrow(/damaged/);
  });

  it("removes only the sample data", async () => {
    const mine = await saveStudent(sara);
    await loadSampleData(createTranslator("en"));
    expect(await db.students.count()).toBe(3);
    await removeSampleData();
    expect((await db.students.toArray()).map((student) => student.id)).toEqual([mine]);
    expect(await db.lessons.count()).toBe(0);
    expect(await db.blackouts.count()).toBe(0);
    expect(await db.packages.count()).toBe(0);
  });
});
