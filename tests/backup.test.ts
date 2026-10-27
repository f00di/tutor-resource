import { beforeEach, describe, expect, it } from "vitest";

import { BACKUP_VERSION, exportBackup, hasOwnData, parseBackup, restoreBackup } from "@/lib/backup";
import { DATA_TABLES, db } from "@/lib/db";
import { getSettings, LAST_BACKUP_KEY, SETTINGS_KEY } from "@/lib/settings";
import type { Blackout, DayNote, Invoice, Lesson, LessonPackage, Settings, Student } from "@/lib/types";

const at = "2026-10-01T08:00:00.000Z";

// Every field set to something other than its default, so a field that's dropped or reset shows up.
const settings: Settings = {
  tutorName: "Tutor T.",
  businessName: "T. Tutoring",
  email: "tutor@example.com",
  phone: "+971 50 000 0000",
  address: "Office 1, Example Street",
  taxNumber: "100000000000003",
  beneficiaryName: "Tutor T.",
  iban: "AE00 0000 0000 0000 0000 000",
  accountNumber: "0000000001",
  swiftCode: "TESTAEAA",
  routingNumber: "000000000",
  paymentDetails: "Cash on the day",
  invoiceFooter: "Thank you",
  invoicePrefix: "T-",
  nextInvoiceNumber: 42,
  dueDays: 14,
  taxLabel: "GST",
  taxRate: 5,
  defaultCurrency: "KWD",
  defaultRate: 12500,
  defaultDuration: 90,
  defaultMode: "inPerson",
  weekStart: 1,
  hour12: false,
  dayStart: "08:00",
  dayEnd: "21:30",
};

const student: Student = {
  id: "s1",
  name: "Student A.",
  parentName: "Parent A.",
  phone: "+971 50 111 1111",
  email: "parent@example.com",
  timeZone: "Asia/Riyadh",
  messageLang: "ar",
  curriculum: "IB",
  level: "DP Year 1",
  subjects: "Maths AA HL",
  rate: 30000,
  currency: "KWD",
  mode: "inPerson",
  location: "Home",
  tone: "lavender",
  notes: "Prefers worked examples",
  archived: true,
  createdAt: at,
  updatedAt: at,
};

const lesson: Lesson = {
  id: "l1",
  studentId: "s1",
  start: "2026-10-05T14:00:00.000Z",
  end: "2026-10-05T15:30:00.000Z",
  mode: "inPerson",
  location: "Home",
  status: "cancelledCharged",
  seriesId: "series-1",
  plan: [
    { id: "p1", text: "Vectors", done: true },
    { id: "p2", text: "Matrices", done: false, carriedFrom: "2026-09-28T14:00:00.000Z", movedOn: true },
  ],
  covered: "Dot product",
  homework: "Exercise 4B",
  privateNote: "Tired today",
  invoiceId: "i1",
  createdAt: at,
  updatedAt: at,
};

const blackout: Blackout = { id: "b1", title: "Ramadan evenings", days: [0, 1, 2, 3, 4], startTime: "18:00", endTime: "20:00", startDate: "2027-02-08", endDate: null, estimated: true, createdAt: at };
const note: DayNote = { id: "n1", date: "2026-10-05", text: "Print the past paper", studentId: "s1", done: true, createdAt: at };
const pack: LessonPackage = { id: "k1", studentId: "s1", size: 10, price: 250000, currency: "KWD", startDate: "2026-10-01", invoiceId: "i1", createdAt: at };
const invoice: Invoice = {
  id: "i1",
  number: "T-41",
  studentId: "s1",
  issueDate: "2026-10-31",
  dueDate: "2026-11-14",
  periodStart: "2026-08-01",
  periodEnd: "2026-10-31",
  span: 3,
  level: "DP Year 1",
  subject: "Maths AA HL",
  rate: 30000,
  currency: "KWD",
  language: "ar",
  billTo: "Parent A.",
  studentName: "Student A.",
  items: [
    { id: "x1", kind: "lesson", date: "2026-10-05", description: "", quantity: 1.5, unitPrice: 30000, lessonId: "l1" },
    { id: "x2", kind: "package", description: "10 lessons", quantity: 1, unitPrice: 250000, packageId: "k1", size: 10 },
  ],
  discount: 5000,
  taxRate: 5,
  taxLabel: "GST",
  notes: "Bank transfer please",
  status: "paid",
  paidOn: "2026-11-02",
  paymentMethod: "Bank transfer",
  createdAt: at,
  updatedAt: at,
};

const wipe = () => Promise.all([...DATA_TABLES.map((name) => db.table(name).clear()), db.meta.clear()]);

beforeEach(wipe);

describe("backups", () => {
  it("keeps every field of every record and setting through a round trip", async () => {
    await db.meta.put({ key: SETTINGS_KEY, value: settings });
    await db.students.add(student);
    await db.lessons.add(lesson);
    await db.blackouts.add(blackout);
    await db.notes.add(note);
    await db.packages.add(pack);
    await db.invoices.add(invoice);

    // Through a file: JSON drops nothing a record holds.
    const file = JSON.stringify(await exportBackup(), null, 2);
    const parsed = parseBackup(file);
    expect(parsed.version).toBe(BACKUP_VERSION);
    expect(parsed.appVersion).toBe("test");

    await wipe();
    await restoreBackup(parsed);
    expect(await getSettings()).toEqual(settings);
    expect(await db.students.toArray()).toEqual([student]);
    expect(await db.lessons.toArray()).toEqual([lesson]);
    expect(await db.blackouts.toArray()).toEqual([blackout]);
    expect(await db.notes.toArray()).toEqual([note]);
    expect(await db.packages.toArray()).toEqual([pack]);
    expect(await db.invoices.toArray()).toEqual([invoice]);
    // The device now holds exactly the file, so it counts as backed up on the file's date.
    expect((await db.meta.get(LAST_BACKUP_KEY))?.value).toBe(parsed.exportedAt);
  });

  it("restores a version 1 backup, filling in what it didn't have", async () => {
    // As version 1 wrote it: no appVersion or prefs, settings from before bank details, an invoice from
    // before 3- and 6-month invoices. The student and lesson also lack fields, as a hand-edited file might.
    const { tone: _tone, archived: _archived, ...oldStudent } = student;
    const { plan: _plan, covered: _covered, ...oldLesson } = lesson;
    const { span: _span, level: _level, subject: _subject, rate: _rate, ...oldInvoice } = invoice;
    const { beneficiaryName: _b, iban: _i, accountNumber: _a, swiftCode: _s, routingNumber: _r, ...oldSettings } = settings;
    const v1 = {
      app: "tutorcat-desk",
      version: 1,
      exportedAt: "2026-06-01T09:00:00.000Z",
      settings: oldSettings,
      students: [oldStudent],
      lessons: [oldLesson],
      blackouts: [blackout],
      notes: [note],
      invoices: [oldInvoice],
      packages: [pack],
    };
    const parsed = parseBackup(JSON.stringify(v1));
    expect(parsed.appVersion).toBeNull();
    expect(parsed.prefs).toBeNull();

    await restoreBackup(parsed);
    const restoredStudent = (await db.students.get("s1"))!;
    expect(restoredStudent).toMatchObject({ ...oldStudent, tone: "sage", archived: false });
    expect((await db.lessons.get("l1"))!).toMatchObject({ ...oldLesson, plan: [], covered: "" });
    const restoredInvoice = (await db.invoices.get("i1"))!;
    expect(restoredInvoice.span).toBeUndefined();
    expect(restoredInvoice.items).toEqual(invoice.items);
    // A blackout's "no end date" (null) stays null.
    expect((await db.blackouts.get("b1"))!.endDate).toBeNull();
    const restoredSettings = await getSettings();
    expect(restoredSettings).toMatchObject(oldSettings);
    expect(restoredSettings.iban).toBe("");
    expect((await db.meta.get(LAST_BACKUP_KEY))?.value).toBe("2026-06-01T09:00:00.000Z");
  });

  it("only counts the tutor's own records, not the sample data, as worth backing up first", async () => {
    expect(await hasOwnData()).toBe(false);
    await db.students.add({ ...student, sample: true });
    expect(await hasOwnData()).toBe(false);
    await db.invoices.add(invoice);
    expect(await hasOwnData()).toBe(true);
  });
});
