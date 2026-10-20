// WhatsApp messages to families, in the family's own language (Student.messageLang). They open
// WhatsApp (app or web) with the text ready; the tutor checks it and presses send. Nothing is sent
// by the app itself, and no WhatsApp Business account is needed.
import type { Translator } from "./i18n";
import { invoiceTotals } from "./invoices";
import { startMs } from "./lessons";
import { zonePlace } from "./time";
import type { Invoice, Lesson, Student } from "./types";

/** Digits only, in international form: "+971 50 123 4567" → "971501234567"; "00971…" → "971…". */
export function waNumber(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "").replace(/^\+/, "").replace(/^00/, "");
  return /^\d{7,15}$/.test(digits) ? digits : "";
}

/** A wa.me link with the message filled in. Without a usable number, WhatsApp asks who to send it to. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
}

const greeting = ({ t }: Translator, student: Student | undefined) =>
  student?.parentName.trim() ? t("msg.hello", { name: student.parentName.trim() }) : t("msg.helloPlain");
const signoff = ({ t }: Translator, tutorName: string) => (tutorName.trim() ? t("msg.signoff", { name: tutorName.trim() }) : t("msg.signoffPlain"));

/** "Reminder: Sara's lesson is on Tuesday 21 October at 5:00 pm (Dubai time)." */
export function reminderMessage(tr: Translator, student: Student, lesson: Lesson, tutorName: string): string {
  const { t } = tr;
  const zone = student.timeZone;
  const start = startMs(lesson);
  const lines = [greeting(tr, student), t("msg.reminder", { student: student.name, day: tr.date(start, "weekday", zone), time: tr.time(start, zone), place: zonePlace(zone, tr.lang) })];
  const where = lesson.location.trim();
  if (where) lines.push(lesson.mode === "online" ? t("msg.link", { link: where }) : t("msg.address", { address: where }));
  lines.push(signoff(tr, tutorName));
  return lines.join("\n");
}

/** What was covered, the homework and what's next. The tutor's private note is never included. */
export function summaryMessage(tr: Translator, student: Student, lesson: Lesson, next: Lesson | undefined, tutorName: string): string {
  const { t } = tr;
  const zone = student.timeZone;
  const lines = [greeting(tr, student), t("msg.summaryIntro", { student: student.name, day: tr.date(startMs(lesson), "weekday", zone) })];
  if (lesson.covered.trim()) lines.push("", `${t("msg.covered")}:`, lesson.covered.trim());
  if (lesson.homework.trim()) lines.push("", `${t("msg.homework")}:`, lesson.homework.trim());
  if (next) {
    lines.push("", t("msg.next", { day: tr.date(startMs(next), "weekday", zone), time: tr.time(startMs(next), zone) }));
    lines.push(...next.plan.filter((item) => !item.done && item.text.trim()).map((item) => `• ${item.text.trim()}`));
  }
  lines.push("", signoff(tr, tutorName));
  return lines.join("\n");
}

/** Sent with the PDF: number, total and due date. */
export function invoiceMessage(tr: Translator, student: Student | undefined, invoice: Invoice, tutorName: string): string {
  const { t } = tr;
  const total = invoiceTotals(invoice).total;
  return [
    greeting(tr, student),
    t("msg.invoice", { number: invoice.number, total: tr.money(total, invoice.currency), due: tr.day(invoice.dueDate, "medium") }),
    t("msg.invoicePdf"),
    signoff(tr, tutorName),
  ].join("\n");
}

export const hasSummary = (lesson: Lesson) => Boolean(lesson.covered.trim() || lesson.homework.trim());
