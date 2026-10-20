// "Try it with sample data": two made-up students with a few weeks of lessons, a package, a
// blackout and a note, so a tutor can see the app working before typing anything. Every sample
// record is flagged `sample: true`, and "Remove sample data" deletes exactly those.
import { createLessons, saveBlackout, saveNote, savePackage, saveStudent, updateLesson } from "./actions";
import { DATA_TABLES, db, newId } from "./db";
import type { Translator } from "./i18n";
import { addDays, combine, startOfWeek, todayKey } from "./time";

export async function loadSampleData(tr: Translator): Promise<void> {
  const { t } = tr;
  const sara = await saveStudent({
    name: "Sara A.",
    parentName: "Mona A.",
    phone: "+971 50 000 0000",
    email: "",
    timeZone: "Asia/Dubai",
    messageLang: "en",
    curriculum: "British (IGCSE/A-Level)",
    level: "Year 10",
    subjects: "IGCSE Maths",
    rate: 20000,
    currency: "AED",
    mode: "online",
    location: "https://meet.google.com/",
    tone: "sage",
    notes: t("sample.saraNotes"),
    sample: true,
  });
  const omar = await saveStudent({
    name: "Omar K.",
    parentName: "Khalid K.",
    phone: "+966 50 000 0000",
    email: "",
    timeZone: "Asia/Riyadh",
    messageLang: "ar",
    curriculum: "American (AP/SAT)",
    level: "Grade 11",
    subjects: "SAT Math",
    rate: 18000,
    currency: "SAR",
    mode: "inPerson",
    location: "Al Olaya, Riyadh",
    tone: "peach",
    notes: t("sample.omarNotes"),
    sample: true,
  });

  // Mondays and Wednesdays for Sara (Dubai time), Thursdays for Omar (Riyadh time), from a few weeks ago.
  const dubaiWeek = addDays(startOfWeek(todayKey("Asia/Dubai"), 1), -21);
  const riyadhWeek = addDays(startOfWeek(todayKey("Asia/Riyadh"), 0), -14);
  const plan = (texts: string[]) => texts.map((text) => ({ id: newId(), text, done: false }));
  const saraMonday = await createLessons({
    studentId: sara, start: combine(dubaiWeek, "17:00", "Asia/Dubai"), minutes: 60, mode: "online", location: "https://meet.google.com/",
    plan: plan([t("sample.topic1")]), zone: "Asia/Dubai", repeat: { everyWeeks: 1, count: 7 }, sample: true,
  });
  await createLessons({
    studentId: sara, start: combine(addDays(dubaiWeek, 2), "17:30", "Asia/Dubai"), minutes: 90, mode: "online", location: "https://meet.google.com/",
    plan: [], zone: "Asia/Dubai", repeat: { everyWeeks: 1, count: 7 }, sample: true,
  });
  const omarLessons = await createLessons({
    studentId: omar, start: combine(addDays(riyadhWeek, 4), "19:00", "Asia/Riyadh"), minutes: 60, mode: "inPerson", location: "Al Olaya, Riyadh",
    plan: [], zone: "Asia/Riyadh", repeat: { everyWeeks: 1, count: 6 }, sample: true,
  });

  // A logged lesson with an unfinished topic, and plans for what's coming.
  const [firstSara] = saraMonday;
  if (firstSara) {
    await updateLesson(firstSara, {
      covered: t("sample.covered"),
      homework: t("sample.homework"),
      plan: [
        { id: newId(), text: t("sample.topic1"), done: true },
        { id: newId(), text: t("sample.topic2"), done: false },
      ],
    });
  }
  const now = Date.now();
  const upcoming = (await db.lessons.where("studentId").equals(omar).toArray()).filter((lesson) => Date.parse(lesson.start) > now).sort((a, b) => a.start.localeCompare(b.start));
  if (upcoming[0]) await updateLesson(upcoming[0].id, { plan: plan([t("sample.topic3"), t("sample.topic4")]) });
  if (omarLessons.length) {
    await savePackage({ studentId: omar, size: 8, price: 130000, currency: "SAR", startDate: riyadhWeek, sample: true });
  }

  await saveBlackout({ title: t("preset.fridayPrayer"), days: [5], startTime: "12:00", endTime: "14:00", startDate: null, endDate: null, sample: true });
  await saveNote({ date: todayKey(), text: t("sample.note"), studentId: sara, sample: true });
}

/** Deletes the sample records, plus anything the tutor made for the sample students (lessons, notes, invoices). */
export async function removeSampleData(): Promise<void> {
  await db.transaction("rw", DATA_TABLES.map((name) => db.table(name)), async () => {
    const sampleStudents = new Set((await db.students.filter((student) => student.sample === true).toArray()).map((student) => student.id));
    for (const name of DATA_TABLES) {
      await db
        .table(name)
        .filter((row: { sample?: boolean; studentId?: string }) => row.sample === true || (row.studentId !== undefined && sampleStudents.has(row.studentId)))
        .delete();
    }
  });
}

export async function hasSampleData(): Promise<boolean> {
  return (await db.students.filter((student) => student.sample === true).count()) > 0;
}
