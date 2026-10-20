import { Archive, ArchiveRestore, ArrowLeft, CalendarPlus, FileText, MessageCircle, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { useDialogs } from "@/components/dialog-host";
import { LessonRow } from "@/components/lesson-row";
import { deleteStudent, setStudentArchived } from "@/lib/actions";
import { useInvoices, useLessons, useNow, usePackages, useStudents } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { invoiceTotals, isOverdue } from "@/lib/invoices";
import { byStart, isCancelled, isTaught, packageUsage, startMs } from "@/lib/lessons";
import { whatsappLink } from "@/lib/messages";
import { hrefFor, navigate } from "@/lib/router";
import { useSettings } from "@/lib/settings";
import { todayKey, zoneName, zonePlace } from "@/lib/time";
import { usePageTitle } from "./page-title";
import { initials, useStudentLine } from "./students";

export function StudentPage({ id }: { id: string }) {
  const i18n = useI18n();
  const { t } = i18n;
  const dialogs = useDialogs();
  const settings = useSettings();
  const students = useStudents();
  const lessons = useLessons();
  const packages = usePackages();
  const invoices = useInvoices();
  const now = useNow();
  const line = useStudentLine();
  const [logCount, setLogCount] = useState(10);
  const student = students?.find((item) => item.id === id);
  usePageTitle(student?.name ?? t("nav.students"));

  const own = useMemo(() => lessons.filter((lesson) => lesson.studentId === id).sort(byStart), [lessons, id]);
  const upcoming = own.filter((lesson) => startMs(lesson) > now && !isCancelled(lesson));
  const past = own.filter((lesson) => startMs(lesson) <= now).reverse();
  const ownPackages = packages.filter((pack) => pack.studentId === id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const usage = useMemo(() => packageUsage(ownPackages, own, now).byPackage, [ownPackages, own, now]);
  const ownInvoices = invoices.filter((invoice) => invoice.studentId === id);
  const taughtCount = own.filter((lesson) => isTaught(lesson, now)).length;

  if (students === undefined) return null;
  if (!student) {
    return (
      <div className="page">
        <a className="back-link" href={hrefFor({ name: "students" })}>
          <ArrowLeft className="dir-icon" />
          {t("nav.students")}
        </a>
        <div className="empty">{t("student.notFound")}</div>
      </div>
    );
  }

  const remove = async () => {
    const ok = await dialogs.confirm({ title: t("student.deleteTitle", { name: student.name }), body: t("student.deleteBody", { count: own.length }), confirmLabel: t("common.delete"), danger: true });
    if (!ok) return;
    await deleteStudent(student.id);
    dialogs.toast(t("student.deleted", { name: student.name }));
    navigate({ name: "students" });
  };

  return (
    <div className={`page tone-${student.tone}`}>
      <a className="back-link" href={hrefFor({ name: "students" })}>
        <ArrowLeft className="dir-icon" />
        {t("nav.students")}
      </a>
      <div className="page-head">
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="avatar" style={{ width: 52, height: 52, fontSize: 18 }} aria-hidden="true">
            {initials(student.name)}
          </span>
          <div>
            <h1>
              <bdi>{student.name}</bdi> {student.archived && <span className="badge">{t("students.archivedBadge")}</span>}
            </h1>
            <p className="page-sub">{[line(student), student.subjects].filter(Boolean).join(" · ") || t("students.noDetails")}</p>
          </div>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => dialogs.openLesson({ studentId: student.id })}>
            <CalendarPlus />
            {t("today.addLesson")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => dialogs.openNewInvoice({ studentId: student.id })}>
            <FileText />
            {t("today.newInvoice")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => dialogs.openStudent({ id: student.id })}>
            <Pencil />
            {t("common.edit")}
          </button>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <section className="card">
            <div className="card-head">
              <h2>{t("student.upcoming", { count: upcoming.length })}</h2>
            </div>
            {upcoming.length ? (
              <ul className="list">
                {upcoming.slice(0, 8).map((lesson) => (
                  <li key={lesson.id}>
                    <LessonRow lesson={lesson} student={student} tutorName={settings.tutorName} onOpen={() => dialogs.openLesson({ id: lesson.id })} showDate now={now} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card-note">{t("students.noNext")}</p>
            )}
            {upcoming.length > 8 && <p className="card-note">{t("today.more", { count: upcoming.length - 8 })}</p>}
          </section>
          <section className="card">
            <div className="card-head">
              <h2>{t("student.log")}</h2>
              <span className="muted small">{t("student.taught", { count: taughtCount })}</span>
            </div>
            {past.length ? (
              <ul className="list">
                {past.slice(0, logCount).map((lesson) => (
                  <li key={lesson.id} className="log-entry">
                    <h3>
                      <button type="button" className="link-button" onClick={() => dialogs.openLesson({ id: lesson.id })}>
                        {i18n.date(startMs(lesson), "weekdayShort")} · {i18n.time(startMs(lesson))}
                      </button>
                      {lesson.status !== "planned" && <span className="badge">{lesson.status === "cancelledCharged" ? t("status.cancelledCharged") : t("status.cancelledFree")}</span>}
                      {lesson.invoiceId && <span className="badge badge-green">{t("student.invoiced")}</span>}
                    </h3>
                    {lesson.plan.length > 0 && (
                      <p>
                        <span className="label">{t("lesson.plan")}: </span>
                        {lesson.plan.map((item) => `${item.done ? "✓" : "○"} ${item.text}`).join("   ")}
                      </p>
                    )}
                    {lesson.covered && (
                      <p className="pre-line">
                        <span className="label">{t("lesson.covered")}: </span>
                        {lesson.covered}
                      </p>
                    )}
                    {lesson.homework && (
                      <p className="pre-line">
                        <span className="label">{t("lesson.homework")}: </span>
                        {lesson.homework}
                      </p>
                    )}
                    {lesson.privateNote && (
                      <p className="pre-line muted">
                        <span className="label">{t("lesson.privateNote")}: </span>
                        {lesson.privateNote}
                      </p>
                    )}
                    {!lesson.plan.length && !lesson.covered && !lesson.homework && !lesson.privateNote && (
                      <p className="muted">
                        <button type="button" className="link-button" onClick={() => dialogs.openLesson({ id: lesson.id })}>
                          {t("student.addLog")}
                        </button>
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card-note">{t("student.noLog")}</p>
            )}
            {past.length > logCount && (
              <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 10 }} onClick={() => setLogCount((count) => count + 20)}>
                {t("student.showMore")}
              </button>
            )}
          </section>
        </div>
        <div>
          <section className="card">
            <div className="card-head">
              <h2>{t("student.details")}</h2>
            </div>
            <dl className="details">
              {student.parentName && (
                <>
                  <dt>{t("student.parent")}</dt>
                  <dd>{student.parentName}</dd>
                </>
              )}
              {student.phone && (
                <>
                  <dt>{t("student.phone")}</dt>
                  <dd>
                    <a href={whatsappLink(student.phone, "")} target="_blank" rel="noopener noreferrer" dir="ltr">
                      <MessageCircle width={13} height={13} style={{ verticalAlign: "-2px", marginInlineEnd: 4 }} />
                      {student.phone}
                    </a>
                  </dd>
                </>
              )}
              {student.email && (
                <>
                  <dt>{t("student.email")}</dt>
                  <dd>
                    <a href={`mailto:${student.email}`} dir="ltr">
                      {student.email}
                    </a>
                  </dd>
                </>
              )}
              <dt>{t("student.zone")}</dt>
              <dd>
                {zonePlace(student.timeZone, i18n.lang)} · {zoneName(student.timeZone, i18n.locale)}
              </dd>
              <dt>{t("student.messageLang")}</dt>
              <dd>{student.messageLang === "ar" ? "العربية" : "English"}</dd>
              <dt>{t("student.rate")}</dt>
              <dd>{i18n.money(student.rate, student.currency)}</dd>
              <dt>{t("lesson.where")}</dt>
              <dd>{[student.mode === "online" ? t("mode.online") : t("mode.inPerson"), student.location].filter(Boolean).join(" · ")}</dd>
            </dl>
            {student.notes && (
              <>
                <hr className="divider" style={{ margin: "14px 0" }} />
                <p className="field-label" style={{ margin: "0 0 4px" }}>
                  {t("student.notes")}
                </p>
                <p className="card-note pre-line" style={{ color: "var(--foreground)" }}>
                  {student.notes}
                </p>
              </>
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <h2>{t("student.packages")}</h2>
              <button type="button" className="link-button" onClick={() => dialogs.openPackage({ studentId: student.id })}>
                <Plus width={13} height={13} style={{ verticalAlign: "-2px" }} /> {t("package.add")}
              </button>
            </div>
            {ownPackages.length ? (
              <ul className="list">
                {ownPackages.map((pack) => {
                  const use = usage.get(pack.id) ?? { used: 0, remaining: pack.size, lessonIds: [] };
                  return (
                    <li key={pack.id} style={{ padding: "10px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <button type="button" className="link-button" style={{ color: "var(--foreground)" }} onClick={() => dialogs.openPackage({ studentId: student.id, id: pack.id })}>
                          <Package width={14} height={14} style={{ verticalAlign: "-2px", marginInlineEnd: 6, color: "var(--primary)" }} />
                          {t("package.line", { count: pack.size })} · {i18n.money(pack.price, pack.currency)}
                        </button>
                        {pack.invoiceId ? (
                          <a className="badge badge-green" href={hrefFor({ name: "invoice", id: pack.invoiceId })}>
                            {t("student.invoiced")}
                          </a>
                        ) : (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => dialogs.openNewInvoice({ studentId: student.id, packageId: pack.id })}>
                            {t("package.invoice")}
                          </button>
                        )}
                      </div>
                      <div className="package-bar" role="progressbar" aria-valuemin={0} aria-valuemax={pack.size} aria-valuenow={use.used} aria-label={t("package.used", { used: use.used, size: pack.size })}>
                        <span style={{ width: `${Math.min(100, (use.used / pack.size) * 100)}%` }} />
                      </div>
                      <div className="small muted" style={{ marginTop: 4 }}>
                        {t("package.used", { used: use.used, size: pack.size })} · {t("package.fromDate", { date: i18n.day(pack.startDate, "medium") })}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="card-note">{t("student.noPackages")}</p>
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <h2>{t("nav.invoices")}</h2>
            </div>
            {ownInvoices.length ? (
              <ul className="list">
                {ownInvoices.map((invoice) => (
                  <li key={invoice.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0" }}>
                    <a href={hrefFor({ name: "invoice", id: invoice.id })} dir="ltr">
                      {invoice.number}
                    </a>
                    <span className="nowrap">
                      {i18n.money(invoiceTotals(invoice).total, invoice.currency)}{" "}
                      <span className={`badge ${invoice.status === "paid" ? "badge-green" : isOverdue(invoice, todayKey()) ? "badge-red" : ""}`}>
                        {invoice.status === "paid" ? t("invoice.paid") : isOverdue(invoice, todayKey()) ? t("invoice.overdue") : t("invoice.unpaid")}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card-note">{t("student.noInvoices")}</p>
            )}
          </section>
          <div className="page-actions" style={{ marginTop: 16 }}>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => void setStudentArchived(student.id, !student.archived)}>
              {student.archived ? <ArchiveRestore /> : <Archive />}
              {student.archived ? t("student.unarchive") : t("student.archive")}
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={remove}>
              <Trash2 />
              {t("student.delete")}
            </button>
          </div>
          <p className="field-hint" style={{ marginTop: 8 }}>
            {t("student.archiveHint")}
          </p>
        </div>
      </div>
    </div>
  );
}
