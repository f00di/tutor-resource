import { FileText, Landmark } from "lucide-react";
import { Fragment, useMemo, useState } from "react";

import { createInvoice } from "@/lib/actions";
import { useLessons, usePackages, useStudents } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { BANK_FIELDS, hasBankDetails, monthOf, spanRange } from "@/lib/invoices";
import { invoiceableLessons, lessonCost, minutesOf, startMs } from "@/lib/lessons";
import { navigate } from "@/lib/router";
import { saveSettings, useLoadedSettings } from "@/lib/settings";
import { addMonths, dateKey, isDateKey, startOfMonth, todayKey } from "@/lib/time";
import type { InvoiceSpan } from "@/lib/types";
import { BankFields, type BankDetails } from "./bank-fields";
import { useDialogs, type InvoiceTarget } from "./dialog-host";
import { Dialog } from "./dialog";
import { Field, Group, Segmented } from "./fields";

type Props = InvoiceTarget & { onClose: () => void };
type Kind = "1" | "3" | "6" | "custom";
type Month = "last" | "this";

const emptyBank = (): BankDetails => ({ beneficiaryName: "", iban: "", accountNumber: "", swiftCode: "", routingNumber: "" });

/**
 * Pick a family, the kind of invoice (a month, or 3 or 6 months ending with a month) and the month;
 * the taught (and charged) lessons that aren't invoiced yet fill the invoice. Asks for bank details
 * once, if the tutor hasn't added any.
 */
export function NewInvoiceDialog({ studentId, packageId, onClose }: Props) {
  const i18n = useI18n();
  const { t } = i18n;
  const dialogs = useDialogs();
  const settings = useLoadedSettings();
  const students = useStudents();
  const lessons = useLessons();
  const packages = usePackages();
  const today = todayKey();
  const [kind, setKind] = useState<Kind>("1");
  // Early in the month, last month is the one to invoice.
  const [month, setMonth] = useState<Month>(Number(today.slice(8)) <= 10 ? "last" : "this");
  const [from, setFrom] = useState(startOfMonth(today));
  const [to, setTo] = useState(today);
  const [chosen, setChosen] = useState(studentId ?? "");
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [pickedPackages, setPickedPackages] = useState<Set<string>>(new Set(packageId ? [packageId] : []));
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [saving, setSaving] = useState(false);

  const monthKey = month === "last" ? addMonths(today, -1) : startOfMonth(today);
  const span: InvoiceSpan = kind === "custom" ? 1 : (Number(kind) as InvoiceSpan);
  const range = kind === "custom" ? { from, to } : spanRange(monthKey, span);
  const needsBank = settings !== undefined && !hasBankDetails(settings);
  const active = (students ?? []).filter((student) => !student.archived || student.id === chosen);
  const student = active.find((item) => item.id === chosen) ?? active[0];

  const ready = useMemo(
    () => (student && isDateKey(range.from) && isDateKey(range.to) ? invoiceableLessons(lessons, packages, student.id, range.from, range.to) : []),
    [student, lessons, packages, range.from, range.to]
  );
  const openPackages = packages.filter((pack) => student && pack.studentId === student.id && !pack.invoiceId);
  const selectedLessons = ready.filter((lesson) => !skipped.has(lesson.id));
  const selectedPackages = openPackages.filter((pack) => pickedPackages.has(pack.id) && pack.currency === student?.currency);
  const total = student ? selectedLessons.reduce((sum, lesson) => sum + lessonCost(lesson, student.rate), 0) + selectedPackages.reduce((sum, pack) => sum + pack.price, 0) : 0;
  const canCreate = Boolean(student) && (selectedLessons.length > 0 || selectedPackages.length > 0) && !saving;

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const create = async () => {
    if (!student || !canCreate) return;
    setSaving(true);
    if (bank && BANK_FIELDS.some((field) => bank[field].trim())) await saveSettings(bank);
    const id = await createInvoice({ student, lessons: selectedLessons, packages: selectedPackages, periodStart: range.from, periodEnd: range.to, span });
    dialogs.toast(t("invoice.created"));
    onClose();
    navigate({ name: "invoice", id });
  };

  if (students === undefined) return null;

  return (
    <Dialog
      title={t("invoice.newTitle")}
      description={t("invoice.newIntro")}
      onClose={onClose}
      onSubmit={create}
      footer={
        <>
          {student && <span className="spacer muted small">{t("invoice.newTotal", { total: i18n.money(total, student.currency) })}</span>}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!canCreate}>
            <FileText />
            {t("invoice.create")}
          </button>
        </>
      }
    >
      {!active.length ? (
        <div className="empty">{t("invoice.noStudents")}</div>
      ) : (
        <div className="form">
          <Field label={t("lesson.student")}>
            <select
              value={student?.id ?? ""}
              onChange={(event) => {
                setChosen(event.target.value);
                setSkipped(new Set());
                setPickedPackages(new Set());
              }}
            >
              {active.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          <Group label={t("invoice.kind")} hint={span > 1 ? t("invoice.kindHint") : undefined}>
            <Segmented<Kind>
              value={kind}
              onChange={setKind}
              options={[
                { value: "1", label: t("invoice.span.1") },
                { value: "3", label: t("invoice.span.3") },
                { value: "6", label: t("invoice.span.6") },
                { value: "custom", label: t("invoice.custom") },
              ]}
            />
          </Group>
          {kind !== "custom" && (
            <Group label={span > 1 ? t("invoice.endingWith") : t("invoice.month")} hint={span > 1 ? t("invoice.spanRange", { from: i18n.day(range.from, "month"), to: i18n.day(range.to, "month") }) : undefined}>
              <Segmented<Month>
                value={month}
                onChange={setMonth}
                options={[
                  { value: "last", label: i18n.day(addMonths(today, -1), "month") },
                  { value: "this", label: i18n.day(today, "month") },
                ]}
              />
            </Group>
          )}
          {kind === "custom" && (
            <div className="field-row">
              <Field label={t("blackout.from")}>
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
              </Field>
              <Field label={t("blackout.to")}>
                <input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
              </Field>
            </div>
          )}
          {student && (
            <Group label={t("invoice.lessonsToInclude")} hint={t("invoice.lessonsHint")}>
              {ready.length ? (
                <ul className="list">
                  {ready.map((lesson, index) => {
                    // On 3- and 6-month invoices, the lessons come under their month, as on the invoice's pages.
                    const lessonMonth = monthOf(dateKey(startMs(lesson)));
                    const newMonth = span > 1 && (index === 0 || monthOf(dateKey(startMs(ready[index - 1]!))) !== lessonMonth);
                    return (
                      <Fragment key={lesson.id}>
                        {newMonth && (
                          <li className="section-label" style={{ padding: "10px 0 6px", margin: 0 }}>
                            {i18n.day(`${lessonMonth}-01`, "month")}
                          </li>
                        )}
                        <li style={{ padding: "8px 0" }}>
                          <label className="check" style={{ justifyContent: "space-between" }}>
                            <span style={{ display: "flex", gap: 9 }}>
                              <input type="checkbox" checked={!skipped.has(lesson.id)} onChange={() => setSkipped((set) => toggle(set, lesson.id))} />
                              <span>
                                {i18n.date(startMs(lesson), "weekdayShort")} · {i18n.time(startMs(lesson))} · {t("duration.minutes", { count: minutesOf(lesson) })}
                                {lesson.status === "cancelledCharged" && <span className="badge" style={{ marginInlineStart: 6 }}>{t("status.cancelledCharged")}</span>}
                              </span>
                            </span>
                            <span className="nowrap">{i18n.money(lessonCost(lesson, student.rate), student.currency)}</span>
                          </label>
                        </li>
                      </Fragment>
                    );
                  })}
                </ul>
              ) : (
                <div className="empty">{t("invoice.nothingReady", { name: student.name })}</div>
              )}
            </Group>
          )}
          {openPackages.length > 0 && student && (
            <Group label={t("invoice.packagesToInclude")}>
              {openPackages.map((pack) => (
                <label key={pack.id} className="check">
                  <input type="checkbox" checked={pickedPackages.has(pack.id)} disabled={pack.currency !== student.currency} onChange={() => setPickedPackages((set) => toggle(set, pack.id))} />
                  <span>
                    {t("package.line", { count: pack.size })} · {i18n.money(pack.price, pack.currency)} · {t("package.fromDate", { date: i18n.day(pack.startDate, "short") })}
                    {pack.currency !== student.currency && <small className="field-hint"> {t("invoice.otherCurrency")}</small>}
                  </span>
                </label>
              ))}
            </Group>
          )}
          {needsBank && (
            <div className="field">
              <div className="notice notice-info">
                <Landmark />
                <div>
                  <strong>{t("bank.askTitle")}</strong>
                  <div>{t("bank.askBody")}</div>
                  {!bank && (
                    <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 8 }} onClick={() => setBank(emptyBank())}>
                      {t("bank.add")}
                    </button>
                  )}
                </div>
              </div>
              {bank && <BankFields value={bank} onChange={(patch) => setBank({ ...bank, ...patch })} />}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}
