// Everything the app stores. All of it lives in this browser's IndexedDB (src/lib/db.ts); nothing is
// sent anywhere. Times are UTC instants (ISO strings); dates are "YYYY-MM-DD" in the tutor's own
// calendar; money is in minor units (fils, halalas, baisa...) so totals never drift.

export type Lang = "en" | "ar";
export type CurrencyCode = "AED" | "SAR" | "QAR" | "KWD" | "BHD" | "OMR" | "USD" | "GBP" | "EUR";
export type Mode = "online" | "inPerson";
/** "planned" lessons count as taught once they have ended, unless marked cancelled. */
export type LessonStatus = "planned" | "cancelledCharged" | "cancelledFree";
export type Tone = "sage" | "peach" | "lavender" | "sky" | "rose" | "sunshine";

export interface Student {
  id: string;
  name: string;
  parentName: string;
  /** WhatsApp number with country code, e.g. +971 50 123 4567. */
  phone: string;
  email: string;
  /** IANA zone, e.g. Asia/Dubai. Repeating lessons keep the same time for the student. */
  timeZone: string;
  /** Language for WhatsApp messages and invoices to this family. */
  messageLang: Lang;
  curriculum: string;
  level: string;
  subjects: string;
  /** Minor units per hour. */
  rate: number;
  currency: CurrencyCode;
  mode: Mode;
  /** Meeting link (online) or address (in person) used for new lessons. */
  location: string;
  tone: Tone;
  notes: string;
  archived: boolean;
  sample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlanItem {
  id: string;
  text: string;
  done: boolean;
  /** Start of the lesson this topic was carried over from. */
  carriedFrom?: string;
  /** Not done here but moved on to the next lesson. */
  movedOn?: boolean;
}

export interface Lesson {
  id: string;
  studentId: string;
  start: string;
  end: string;
  mode: Mode;
  location: string;
  status: LessonStatus;
  /** Lessons made together as a repeating series share this id. */
  seriesId?: string;
  /** What to teach. */
  plan: PlanItem[];
  /** After the lesson: what was covered and the homework (can be shared with the parent). */
  covered: string;
  homework: string;
  /** Only the tutor sees this. */
  privateNote: string;
  invoiceId?: string;
  sample?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * A time the tutor isn't available. One shape covers every case:
 * every Friday 12:00-14:00 (days + times), 1-10 Dec (dates, all day), Ramadan evenings (dates + times).
 * Times are the tutor's own local time.
 */
export interface Blackout {
  id: string;
  title: string;
  /** Days of the week (0 = Sunday ... 6 = Saturday); null = every day. */
  days: number[] | null;
  /** "HH:MM"; null = the whole day. */
  startTime: string | null;
  endTime: string | null;
  /** Inclusive "YYYY-MM-DD"; null = no limit. */
  startDate: string | null;
  endDate: string | null;
  /** Holiday presets whose dates depend on the moon sighting. */
  estimated?: boolean;
  sample?: boolean;
  createdAt: string;
}

/** A note for a day ("Print the IGCSE past paper"), optionally about one student. */
export interface DayNote {
  id: string;
  date: string;
  text: string;
  studentId?: string;
  done: boolean;
  sample?: boolean;
  createdAt: string;
}

/** A prepaid bundle ("10 lessons"). Taught lessons from startDate on use it up, oldest first. */
export interface LessonPackage {
  id: string;
  studentId: string;
  size: number;
  /** Minor units for the whole package. */
  price: number;
  currency: CurrencyCode;
  startDate: string;
  invoiceId?: string;
  sample?: boolean;
  createdAt: string;
}

export type InvoiceItemKind = "lesson" | "package" | "custom";

export interface InvoiceItem {
  id: string;
  kind: InvoiceItemKind;
  /** Lesson date ("YYYY-MM-DD"). */
  date?: string;
  /** Written by the tutor (e.g. "Maths"); never translated. */
  description: string;
  /** Hours for lessons, a count otherwise. */
  quantity: number;
  /** Minor units per hour or per item. */
  unitPrice: number;
  lessonId?: string;
  packageId?: string;
  /** Lessons in a package line. */
  size?: number;
}

export interface Invoice {
  id: string;
  number: string;
  studentId: string;
  issueDate: string;
  dueDate: string;
  periodStart?: string;
  periodEnd?: string;
  currency: CurrencyCode;
  /** The invoice's own language, which can differ from the app's. */
  language: Lang;
  billTo: string;
  studentName: string;
  items: InvoiceItem[];
  /** Minor units. */
  discount: number;
  /** Percent, e.g. 5. 0 = no tax line. */
  taxRate: number;
  taxLabel: string;
  notes: string;
  status: "unpaid" | "paid";
  paidOn?: string;
  paymentMethod?: string;
  sample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  tutorName: string;
  businessName: string;
  email: string;
  phone: string;
  address: string;
  /** VAT or tax registration number, if the tutor has one. */
  taxNumber: string;
  paymentDetails: string;
  invoiceFooter: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  dueDays: number;
  taxLabel: string;
  taxRate: number;
  defaultCurrency: CurrencyCode;
  /** Minor units per hour. */
  defaultRate: number;
  defaultDuration: number;
  defaultMode: Mode;
  /** 0 = Sunday, 1 = Monday, 6 = Saturday. */
  weekStart: 0 | 1 | 6;
  hour12: boolean;
  dayStart: string;
  dayEnd: string;
}

export interface MetaRow {
  key: string;
  value: unknown;
}
