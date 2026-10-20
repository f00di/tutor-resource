import { AlertTriangle, CalendarOff, CalendarPlus, Clock, FileText, HardDriveDownload, Package, Plus, Sparkles, StickyNote, Users, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { useDialogs } from "@/components/dialog-host";
import { LessonRow } from "@/components/lesson-row";
import { carryOverTopics, setNoteDone } from "@/lib/actions";
import { saveBackupFile } from "@/lib/backup";
import { nextBlackoutDate } from "@/lib/blackouts";
import { useBlackouts, useInvoices, useLessons, useNotes, useNow, usePackages, useStudentMap, useStudents } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { isOverdue, invoiceTotals } from "@/lib/invoices";
import { byStart, invoiceableLessons, isCancelled, minutesOf, nextLesson, packageUsage, startMs, unfinishedTopics } from "@/lib/lessons";
import { sumByCurrency } from "@/lib/money";
import { hrefFor } from "@/lib/router";
import { loadSampleData, removeSampleData } from "@/lib/sample";
import { useLastBackup, useSettings } from "@/lib/settings";
import { addDays, combine, dateKey, DAY, daysBetween, startOfWeek, todayKey } from "@/lib/time";
import { usePageTitle } from "./page-title";

export function TodayPage() {
  const i18n = useI18n();
  const { t } = i18n;
  usePageTitle(t("nav.today"));
  const dialogs = useDialogs();
  const settings = useSettings();
  const students = useStudents();
  const studentMap = useStudentMap(students);
  const lessons = useLessons();
  const notes = useNotes();
  const invoices = useInvoices();
  const packages = usePackages();
  const blackouts = useBlackouts();
  const lastBackup = useLastBackup();
  const now = useNow();
  const today = todayKey();
  const [loadingSample, setLoadingSample] = useState(false);

  const todays = useMemo(() => lessons.filter((lesson) => dateKey(startMs(lesson)) === today).sort(byStart), [lessons, today]);
  const soon = useMemo(() => {
    const until = combine(addDays(today, 8), "00:00");
    return lessons.filter((lesson) => !isCancelled(lesson) && dateKey(startMs(lesson)) > today && startMs(lesson) < until).sort(byStart);
  }, [lessons, today]);

  const weekStart = startOfWeek(today, settings.weekStart);
  const weekEnd = addDays(weekStart, 6);
  const week = lessons.filter((lesson) => !isCancelled(lesson) && dateKey(startMs(lesson)) >= weekStart && dateKey(startMs(lesson)) <= weekEnd);
  const weekMinutes = week.reduce((sum, lesson) => sum + minutesOf(lesson), 0);

  const unpaid = invoices.filter((invoice) => invoice.status === "unpaid");
  const unpaidTotals = sumByCurrency(unpaid.map((invoice) => ({ currency: invoice.currency, amount: invoiceTotals(invoice).total })));
  const overdue = unpaid.filter((invoice) => isOverdue(invoice, today)).length;
  const activeStudents = (students ?? []).filter((student) => !student.archived);

  const ready = useMemo(
    () =>
      activeStudents
        .map((student) => ({ student, count: invoiceableLessons(lessons, packages, student.id, "0000-01-01", today, now).length }))
        .filter((entry) => entry.count > 0),
    [activeStudents, lessons, packages, today, now]
  );

  // Past lessons (last 30 days) with topics left to do, when the student has another lesson booked.
  const unfinished = useMemo(
    () =>
      lessons
        .filter((lesson) => startMs(lesson) < now && startMs(lesson) > now - 30 * DAY && !isCancelled(lesson) && unfinishedTopics(lesson).length > 0 && nextLesson(lessons, lesson.studentId, now))
        .sort(byStart)
        .reverse()
        .slice(0, 5),
    [lessons, now]
  );

  const lowPackages = useMemo(() => {
    const { byPackage } = packageUsage(packages, lessons, now);
    return packages
      .map((pack) => ({ pack, use: byPackage.get(pack.id) }))
      .filter((entry) => entry.use && entry.use.remaining <= 2 && studentMap.get(entry.pack.studentId) && !studentMap.get(entry.pack.studentId)?.archived)
      .slice(0, 4);
  }, [packages, lessons, now, studentMap]);

  const dayNotes = notes.filter((note) => note.date === today || (note.date < today && !note.done)).sort((a, b) => a.date.localeCompare(b.date));
  const upcomingBlackouts = blackouts
    .map((blackout) => ({ blackout, next: nextBlackoutDate(blackout, today) }))
    .filter((entry): entry is { blackout: typeof entry.blackout; next: string } => Boolean(entry.next && daysBetween(today, entry.next) <= 14))
    .sort((a, b) => a.next.localeCompare(b.next))
    .slice(0, 4);

  const hasData = (students?.length ?? 0) > 0;
  const hasSample = (students ?? []).some((student) => student.sample);
  const backupDue = hasData && lastBackup !== undefined && (!lastBackup || daysBetween(lastBackup.slice(0, 10), today) >= 14);

  const hour = new Date(now).getHours();
  const greetingKey = hour < 12 ? "today.morning" : hour < 18 ? "today.afternoon" : "today.evening";
  const name = settings.tutorName.trim().split(/\s+/)[0];

  const loadSample = async () => {
    setLoadingSample(true);
    try {
      await loadSampleData(i18n);
      dialogs.toast(t("sample.loaded"));
    } finally {
      setLoadingSample(false);
    }
  };

  const removeSample = async () => {
    if (!(await dialogs.confirm({ title: t("sample.removeTitle"), body: t("sample.removeBody"), confirmLabel: t("sample.remove"), danger: true }))) return;
    await removeSampleData();
    dialogs.toast(t("sample.removed"));
  };

  if (students === undefined) return null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{name ? t(`${greetingKey}Name`, { name }) : t(greetingKey)}</h1>
          <p className="page-sub">{i18n.day(today, "long")}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => dialogs.openLesson()}>
            <CalendarPlus />
            {t("today.addLesson")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => dialogs.openNote({ date: today })}>
            <StickyNote />
            {t("today.addNote")}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => dialogs.openNewInvoice()}>
            <FileText />
            {t("today.newInvoice")}
          </button>
        </div>
      </div>

      {!hasData && (
        <section className="welcome">
          <div>
            <h2>{t("welcome.title")}</h2>
            <p>{t("welcome.body")}</p>
            <div className="page-actions">
              <button type="button" className="btn btn-primary" onClick={() => dialogs.openStudent()}>
                <Plus />
                {t("student.add")}
              </button>
              <button type="button" className="btn btn-outline" onClick={loadSample} disabled={loadingSample}>
                <Sparkles />
                {t("sample.load")}
              </button>
            </div>
          </div>
          <ol>
            <li>
              <a href={hrefFor({ name: "settings" })}>{t("welcome.step1")}</a>
            </li>
            <li>{t("welcome.step2")}</li>
            <li>{t("welcome.step3")}</li>
            <li>{t("welcome.step4")}</li>
          </ol>
        </section>
      )}

      {hasSample && (
        <div className="notice notice-info" style={{ marginBottom: 16 }}>
          <Sparkles />
          <span>
            {t("sample.showing")}{" "}
            <button type="button" className="link-button" onClick={removeSample}>
              {t("sample.remove")}
            </button>
          </span>
        </div>
      )}

      {backupDue && (
        <div className="notice notice-warn" style={{ marginBottom: 16 }}>
          <HardDriveDownload />
          <span>
            {lastBackup ? t("backup.dueSince", { date: i18n.date(Date.parse(lastBackup), "medium") }) : t("backup.never")}{" "}
            <button type="button" className="link-button" onClick={() => void saveBackupFile().then((saved) => saved && dialogs.toast(t("backup.saved")))}>
              {t("backup.now")}
            </button>
          </span>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">
            <Clock />
            {t("today.thisWeek")}
          </div>
          <div className="stat-value">
            {t("today.lessonsCount", { count: week.length })} <small>{t("today.hoursCount", { hours: i18n.hours(weekMinutes) })}</small>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">
            <Wallet />
            {t("today.unpaid")}
          </div>
          <div className="stat-value">
            {unpaidTotals.length ? unpaidTotals.map((entry) => i18n.money(entry.amount, entry.currency)).join(" · ") : i18n.money(0, settings.defaultCurrency)}
            {overdue > 0 && <small style={{ color: "var(--destructive)" }}> {t("today.overdue", { count: overdue })}</small>}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">
            <Users />
            {t("today.students")}
          </div>
          <div className="stat-value">{i18n.number(activeStudents.length)}</div>
        </div>
        <div className="stat">
          <div className="stat-label">
            <CalendarOff />
            {t("today.nextBlackout")}
          </div>
          <div className="stat-value" style={{ fontSize: 15 }}>
            {upcomingBlackouts[0] ? `${upcomingBlackouts[0].blackout.title} · ${i18n.day(upcomingBlackouts[0].next, "short")}` : t("today.none")}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div>
          <section className="card">
            <div className="card-head">
              <h2>{t("today.todaysLessons")}</h2>
              <a href={hrefFor({ name: "schedule" })}>{t("today.openSchedule")}</a>
            </div>
            {todays.length ? (
              <ul className="list">
                {todays.map((lesson) => (
                  <li key={lesson.id}>
                    <LessonRow lesson={lesson} student={studentMap.get(lesson.studentId)} tutorName={settings.tutorName} onOpen={() => dialogs.openLesson({ id: lesson.id })} now={now} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty">{hasData ? t("today.noLessons") : t("today.noLessonsYet")}</div>
            )}
          </section>
          <section className="card">
            <div className="card-head">
              <h2>{t("today.comingUp")}</h2>
            </div>
            {soon.length ? (
              <ul className="list">
                {soon.slice(0, 6).map((lesson) => (
                  <li key={lesson.id}>
                    <LessonRow lesson={lesson} student={studentMap.get(lesson.studentId)} tutorName={settings.tutorName} onOpen={() => dialogs.openLesson({ id: lesson.id })} showDate now={now} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card-note">{t("today.nothingSoon")}</p>
            )}
            {soon.length > 6 && <p className="card-note">{t("today.more", { count: soon.length - 6 })}</p>}
          </section>
        </div>
        <div>
          <section className="card">
            <div className="card-head">
              <h2>{t("today.notes")}</h2>
              <button type="button" className="link-button" onClick={() => dialogs.openNote({ date: today })}>
                {t("today.addNote")}
              </button>
            </div>
            {dayNotes.length ? (
              <ul className="checklist">
                {dayNotes.map((note) => (
                  <li key={note.id} className={note.done ? "is-done" : undefined}>
                    <input type="checkbox" checked={note.done} onChange={(event) => void setNoteDone(note.id, event.target.checked)} aria-label={note.text} />
                    <span>
                      <button type="button" className="link-button" style={{ color: "inherit", fontWeight: 500, textAlign: "start" }} onClick={() => dialogs.openNote({ id: note.id })}>
                        <bdi>{note.text}</bdi>
                      </button>
                      {note.studentId && studentMap.get(note.studentId) && <span className="carried"> · <bdi>{studentMap.get(note.studentId)?.name}</bdi></span>}
                      {note.date < today && <span className="carried"> · {i18n.day(note.date, "short")}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="card-note">{t("today.noNotes")}</p>
            )}
          </section>
          {ready.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>{t("today.readyToInvoice")}</h2>
                <a href={hrefFor({ name: "invoices" })}>{t("nav.invoices")}</a>
              </div>
              <ul className="list">
                {ready.map(({ student, count }) => (
                  <li key={student.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0" }}>
                    <span>
                      <strong><bdi>{student.name}</bdi></strong> <span className="muted small">{t("today.lessonsCount", { count })}</span>
                    </span>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => dialogs.openNewInvoice({ studentId: student.id })}>
                      {t("invoice.create")}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {unfinished.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>{t("today.unfinished")}</h2>
              </div>
              <ul className="list">
                {unfinished.map((lesson) => (
                  <li key={lesson.id} style={{ padding: "9px 0" }}>
                    <div className="small muted">
                      <bdi>{studentMap.get(lesson.studentId)?.name}</bdi> · {i18n.date(startMs(lesson), "weekdayShort")}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <span>{i18n.list(unfinishedTopics(lesson).map((item) => item.text))}</span>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={async () => {
                          const nextId = await carryOverTopics(lesson.id);
                          dialogs.toast(nextId ? t("today.carried") : t("lesson.noNextLesson", { name: studentMap.get(lesson.studentId)?.name ?? "" }));
                        }}
                      >
                        {t("today.moveOn")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {lowPackages.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>{t("today.packages")}</h2>
              </div>
              <ul className="list">
                {lowPackages.map(({ pack, use }) => (
                  <li key={pack.id} style={{ padding: "9px 0", display: "flex", gap: 10, alignItems: "center" }}>
                    <Package width={16} height={16} style={{ color: "var(--primary)", flex: "none" }} />
                    <a href={hrefFor({ name: "student", id: pack.studentId })} style={{ color: "inherit" }}>
                      <strong><bdi>{studentMap.get(pack.studentId)?.name}</bdi></strong>{" "}
                      <span className="muted small">{use && use.remaining > 0 ? t("package.left", { count: use.remaining }) : t("package.usedUp")}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {upcomingBlackouts.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h2>{t("today.blackouts")}</h2>
                <a href={hrefFor({ name: "blackouts" })}>{t("nav.blackouts")}</a>
              </div>
              <ul className="list">
                {upcomingBlackouts.map(({ blackout, next }) => (
                  <li key={blackout.id} style={{ padding: "8px 0", display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <span>
                      <bdi>{blackout.title}</bdi>
                      {blackout.estimated && (
                        <span className="badge badge-amber" style={{ marginInlineStart: 6 }}>
                          <AlertTriangle />
                          {t("blackout.estimated")}
                        </span>
                      )}
                    </span>
                    <span className="muted small nowrap">{next === today ? t("today.todayWord") : i18n.day(next, "weekdayShort")}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
