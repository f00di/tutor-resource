import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, Clock, FileText, MessageCircle, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { carryOverTopics, createLessons, deleteLessons, moveLesson, updateLesson, type Scope } from "@/lib/actions";
import { blackoutHits } from "@/lib/blackouts";
import { db } from "@/lib/db";
import { useBlackouts, useLessons, useStudents } from "@/lib/hooks";
import { useI18n, useTranslator } from "@/lib/i18n";
import { endMs, findClashes, minutesOf, nextLesson, startMs, unfinishedTopics } from "@/lib/lessons";
import { reminderMessage, summaryMessage, whatsappLink } from "@/lib/messages";
import { navigate } from "@/lib/router";
import { useLoadedSettings } from "@/lib/settings";
import { addDays, combine, dateKey, deviceZone, HOUR, isDateKey, isTimeKey, isValidZone, MINUTE, timeKey, weeklySeries, zonePlace } from "@/lib/time";
import type { Lesson, LessonStatus, Mode, PlanItem, Settings, Student } from "@/lib/types";
import { useDialogs, type LessonTarget } from "./dialog-host";
import { Dialog } from "./dialog";
import { DurationSelect, Field, Group, Segmented } from "./fields";
import { PlanEditor } from "./plan-editor";

type Props = LessonTarget & { onClose: () => void };

/** Waits for the lesson (when editing), the students and the saved settings, so the form starts with the right values. */
export function LessonDialog(props: Props) {
  const students = useStudents();
  const settings = useLoadedSettings();
  const lesson = useLiveQuery(async () => (props.id ? ((await db.lessons.get(props.id)) ?? null) : null), [props.id]);
  if (students === undefined || settings === undefined || lesson === undefined) return null;
  if (props.id && !lesson) return null;
  return <LessonForm {...props} lesson={lesson} students={students} settings={settings} />;
}

type Repeat = "none" | "weekly" | "fortnightly";

const zoneOf = (student: Student | undefined) => (student && isValidZone(student.timeZone) ? student.timeZone : deviceZone());

function LessonForm({ onClose, lesson, students, settings, ...target }: Props & { lesson: Lesson | null; students: Student[]; settings: Settings }) {
  const i18n = useI18n();
  const { t } = i18n;
  const dialogs = useDialogs();
  const lessons = useLessons();
  const blackouts = useBlackouts();
  const active = students.filter((student) => !student.archived || student.id === lesson?.studentId);
  const local = deviceZone();

  // Starting values: the lesson, else the clicked slot, else the next whole hour.
  const initialStart = lesson ? startMs(lesson) : (target.start ?? Math.ceil(Date.now() / HOUR) * HOUR);
  const picked = target.end && target.start ? Math.round((target.end - target.start) / MINUTE) : 0;
  const initialMinutes = lesson ? minutesOf(lesson) : picked > 30 ? picked : settings.defaultDuration;
  const firstStudent = students.find((student) => student.id === (lesson?.studentId ?? target.studentId)) ?? active[0];

  const [studentId, setStudentId] = useState(firstStudent?.id ?? "");
  const [day, setDay] = useState(dateKey(initialStart, local));
  const [time, setTime] = useState(timeKey(initialStart, local));
  const [minutes, setMinutes] = useState(initialMinutes);
  const [mode, setMode] = useState<Mode>(lesson?.mode ?? firstStudent?.mode ?? settings.defaultMode);
  const [location, setLocation] = useState(lesson?.location ?? firstStudent?.location ?? "");
  const [plan, setPlan] = useState<PlanItem[]>(lesson?.plan ?? []);
  const [status, setStatus] = useState<LessonStatus>(lesson?.status ?? "planned");
  const [covered, setCovered] = useState(lesson?.covered ?? "");
  const [homework, setHomework] = useState(lesson?.homework ?? "");
  const [privateNote, setPrivateNote] = useState(lesson?.privateNote ?? "");
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [endBy, setEndBy] = useState<"count" | "until">("count");
  const [count, setCount] = useState(10);
  const [until, setUntil] = useState(addDays(dateKey(initialStart, local), 7 * 12));
  const [saving, setSaving] = useState(false);

  const student = students.find((item) => item.id === studentId);
  const studentZone = zoneOf(student);
  const messages = useTranslator(student?.messageLang ?? i18n.lang);
  const valid = Boolean(student) && isDateKey(day) && isTimeKey(time) && minutes > 0;
  const start = valid ? combine(day, time, local) : NaN;
  const end = start + minutes * MINUTE;
  const started = lesson ? startMs(lesson) <= Date.now() : valid && start <= Date.now();

  const occurrences = useMemo(() => {
    if (!valid) return [];
    if (lesson || repeat === "none") return [{ start, end }];
    return weeklySeries(start, minutes, studentZone, { everyWeeks: repeat === "weekly" ? 1 : 2, ...(endBy === "count" ? { count } : { until }) });
  }, [valid, lesson, repeat, start, end, minutes, studentZone, endBy, count, until]);

  // Warnings: other lessons at the same time, and blackouts. Saving is still allowed.
  const warnings = useMemo(() => {
    const ignore = new Set(lesson ? [lesson.id] : []);
    const others = new Map(students.map((item) => [item.id, item.name]));
    return occurrences.flatMap((occurrence) => {
      const clashes = findClashes(lessons, occurrence.start, occurrence.end, ignore);
      const hits = blackoutHits(blackouts, occurrence.start, occurrence.end, local);
      if (!clashes.length && !hits.length) return [];
      const what = [...clashes.map((clash) => t("lesson.clashWith", { name: others.get(clash.studentId) ?? "?" })), ...hits.map((hit) => t("lesson.inBlackout", { title: hit.title }))];
      return [{ start: occurrence.start, what: i18n.list(what) }];
    });
  }, [occurrences, lessons, blackouts, students, lesson, local, t, i18n]);

  const changeStudent = (id: string) => {
    setStudentId(id);
    const next = students.find((item) => item.id === id);
    // A new lesson takes the student's usual way of meeting.
    if (!lesson && next) {
      setMode(next.mode);
      setLocation(next.location);
    }
  };

  const formLesson = (): Lesson => ({
    ...(lesson ?? { id: "", createdAt: "", updatedAt: "", status: "planned" as const }),
    studentId,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    mode,
    location,
    plan,
    status,
    covered,
    homework,
    privateNote,
  });

  const save = async () => {
    if (!valid || !student || saving) return;
    setSaving(true);
    try {
      if (!lesson) {
        const ids = await createLessons({
          studentId,
          start,
          minutes,
          mode,
          location: location.trim(),
          plan,
          zone: studentZone,
          repeat: repeat === "none" ? undefined : { everyWeeks: repeat === "weekly" ? 1 : 2, ...(endBy === "count" ? { count } : { until }) },
        });
        dialogs.toast(t("lesson.added", { count: ids.length }));
      } else {
        const timeChanged = start !== startMs(lesson) || end !== endMs(lesson);
        const placeChanged = mode !== lesson.mode || location.trim() !== lesson.location;
        if (timeChanged || placeChanged) {
          let scope: Scope = "one";
          if (lesson.seriesId) {
            const choice = await dialogs.ask<Scope>({
              title: t("series.applyTitle"),
              body: t("series.applyBody"),
              options: [
                { value: "one", label: t("series.onlyThis"), tone: "outline" },
                { value: "following", label: t("series.thisAndLater") },
              ],
            });
            if (!choice) return;
            scope = choice;
          }
          await moveLesson(lesson.id, start, end, scope, studentZone, { mode, location: location.trim() });
        }
        await updateLesson(lesson.id, { studentId, plan, status, covered, homework, privateNote });
        dialogs.toast(t("common.saved"));
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!lesson) return;
    let scope: Scope = "one";
    if (lesson.seriesId) {
      const choice = await dialogs.ask<Scope>({
        title: t("lesson.deleteTitle"),
        body: t("series.deleteBody"),
        options: [
          { value: "one", label: t("series.onlyThis"), tone: "danger" },
          { value: "following", label: t("series.thisAndLater"), tone: "danger" },
        ],
      });
      if (!choice) return;
      scope = choice;
    } else if (!(await dialogs.confirm({ title: t("lesson.deleteTitle"), body: t("lesson.deleteBody"), confirmLabel: t("common.delete"), danger: true }))) {
      return;
    }
    const removed = await deleteLessons(lesson.id, scope);
    dialogs.toast(t("lesson.deleted", { count: removed }));
    onClose();
  };

  const carryOver = async () => {
    if (!lesson) return;
    await updateLesson(lesson.id, { plan });
    const nextId = await carryOverTopics(lesson.id);
    if (!nextId) {
      dialogs.toast(t("lesson.noNextLesson", { name: student?.name ?? "" }));
      return;
    }
    const next = await db.lessons.get(nextId);
    setPlan((await db.lessons.get(lesson.id))?.plan ?? plan);
    dialogs.toast(t("lesson.carriedTo", { date: next ? i18n.date(startMs(next), "weekdayShort") : "" }));
  };

  const sendWhatsApp = () => {
    if (!student || !messages || !valid) return;
    const current = formLesson();
    const text = started ? summaryMessage(messages, student, current, nextLesson(lessons, student.id, end), settings.tutorName) : reminderMessage(messages, student, current, settings.tutorName);
    window.open(whatsappLink(student.phone, text), "_blank", "noopener");
  };

  // Only the plan: while the date or time is empty there's no valid start, and formLesson() would throw.
  const unfinished = unfinishedTopics({ plan });
  const zoneDiffers = student && studentZone !== local;

  if (!active.length && !lesson) {
    return (
      <Dialog title={t("lesson.newTitle")} onClose={onClose} size="narrow">
        <div className="empty">
          <strong>{t("lesson.noStudentsTitle")}</strong>
          {t("lesson.noStudentsBody")}
          <div>
            <button type="button" className="btn btn-primary" onClick={() => dialogs.openStudent({ onSaved: changeStudent })}>
              <UserPlus />
              {t("student.add")}
            </button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={lesson ? t("lesson.editTitle") : t("lesson.newTitle")}
      description={lesson?.seriesId ? t("lesson.inSeries") : undefined}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {lesson && (
            <button type="button" className="btn btn-danger spacer btn-collapse" onClick={remove} aria-label={t("common.delete")} title={t("common.delete")}>
              <Trash2 />
              <span>{t("common.delete")}</span>
            </button>
          )}
          {lesson && student && (
            <button type="button" className="btn btn-whatsapp" onClick={sendWhatsApp} disabled={!messages || !valid}>
              <MessageCircle />
              {started ? t("lesson.sendSummary") : t("lesson.sendReminder")}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid || saving}>
            {lesson ? t("common.save") : t("lesson.add", { count: occurrences.length || 1 })}
          </button>
        </>
      }
    >
      <div className="form">
        {!lesson && (
          <button
            type="button"
            className="link-button small"
            style={{ justifySelf: "start" }}
            onClick={() => {
              onClose();
              dialogs.openBlackout({ draft: { days: null, startDate: day, endDate: day, startTime: time, endTime: valid ? timeKey(end, local) : null } });
            }}
          >
            {t("lesson.blockInstead")}
          </button>
        )}
        <Field label={t("lesson.student")}>
          <select
            value={studentId}
            onChange={(event) => {
              if (event.target.value === "__new") dialogs.openStudent({ onSaved: changeStudent });
              else changeStudent(event.target.value);
            }}
            required
          >
            {active.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
            <option value="__new">{t("student.addOption")}</option>
          </select>
        </Field>
        <div className="field-row three">
          <Field label={t("lesson.date")}>
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} required />
          </Field>
          <Field label={t("lesson.start")}>
            <input type="time" value={time} step={300} onChange={(event) => setTime(event.target.value)} required />
          </Field>
          <Field label={t("lesson.length")}>
            <DurationSelect value={minutes} onChange={setMinutes} />
          </Field>
        </div>
        {valid && zoneDiffers && student && (
          <div className="notice notice-info">
            <Clock />
            <span>{t("lesson.theirTime", { name: student.name, time: i18n.time(start, studentZone), day: i18n.date(start, "weekdayShort", studentZone), place: zonePlace(studentZone, i18n.lang) })}</span>
          </div>
        )}
        {!lesson && (
          <Group label={t("lesson.repeat")}>
            <Segmented<Repeat>
              value={repeat}
              onChange={setRepeat}
              options={[
                { value: "none", label: t("lesson.repeatNone") },
                { value: "weekly", label: t("lesson.repeatWeekly") },
                { value: "fortnightly", label: t("lesson.repeatFortnightly") },
              ]}
            />
            {repeat !== "none" && (
              <div className="field-row" style={{ marginTop: 8 }}>
                <Field label={t("lesson.ends")}>
                  <select value={endBy} onChange={(event) => setEndBy(event.target.value as "count" | "until")}>
                    <option value="count">{t("lesson.endsAfter")}</option>
                    <option value="until">{t("lesson.endsOn")}</option>
                  </select>
                </Field>
                {endBy === "count" ? (
                  <Field label={t("lesson.howMany")}>
                    <input type="number" min={2} max={104} value={count} onChange={(event) => setCount(Math.max(1, Math.min(104, Number(event.target.value) || 1)))} />
                  </Field>
                ) : (
                  <Field label={t("lesson.lastDate")}>
                    <input type="date" value={until} min={day} onChange={(event) => setUntil(event.target.value)} />
                  </Field>
                )}
              </div>
            )}
            {repeat !== "none" && zoneDiffers && <small className="field-hint">{t("lesson.repeatZone", { place: zonePlace(studentZone, i18n.lang) })}</small>}
          </Group>
        )}
        {warnings.length > 0 && (
          <div className="notice notice-warn" role="alert">
            <AlertTriangle />
            <div>
              {occurrences.length > 1 ? t("lesson.warnSome", { count: warnings.length, total: occurrences.length }) : t("lesson.warnOne")}
              <ul>
                {warnings.slice(0, 4).map((warning) => (
                  <li key={warning.start}>
                    {occurrences.length > 1 && `${i18n.date(warning.start, "weekdayShort")}: `}
                    {warning.what}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <Group label={t("lesson.where")}>
          <Segmented<Mode>
            value={mode}
            onChange={setMode}
            options={[
              { value: "online", label: t("mode.online") },
              { value: "inPerson", label: t("mode.inPerson") },
            ]}
          />
        </Group>
        <Field label={mode === "online" ? t("lesson.link") : t("lesson.address")}>
          <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={mode === "online" ? "https://" : t("lesson.addressPlaceholder")} inputMode={mode === "online" ? "url" : "text"} />
        </Field>
        <Group label={t("lesson.plan")} hint={t("lesson.planHint")}>
          <PlanEditor items={plan} onChange={setPlan} />
        </Group>
        {lesson && started && unfinished.length > 0 && (
          <button type="button" className="btn btn-outline" style={{ justifySelf: "start" }} onClick={carryOver}>
            {t("lesson.carryOver", { count: unfinished.length })}
          </button>
        )}
        {lesson && (
          <>
            <hr className="divider" />
            <p className="section-label">{started ? t("lesson.after") : t("lesson.notes")}</p>
            {started && (
              <Group label={t("lesson.status")}>
                <Segmented<LessonStatus>
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "planned", label: t("status.taught") },
                    { value: "cancelledCharged", label: t("status.cancelledCharged") },
                    { value: "cancelledFree", label: t("status.cancelledFree") },
                  ]}
                />
              </Group>
            )}
            {!started && (
              <Group label={t("lesson.status")}>
                <Segmented<LessonStatus>
                  value={status}
                  onChange={setStatus}
                  options={[
                    { value: "planned", label: t("status.planned") },
                    { value: "cancelledCharged", label: t("status.cancelledCharged") },
                    { value: "cancelledFree", label: t("status.cancelledFree") },
                  ]}
                />
              </Group>
            )}
            {started && (
              <>
                <Field label={t("lesson.covered")} hint={t("lesson.sharedHint")}>
                  <textarea value={covered} onChange={(event) => setCovered(event.target.value)} rows={3} />
                </Field>
                <Field label={t("lesson.homework")} hint={t("lesson.sharedHint")}>
                  <textarea value={homework} onChange={(event) => setHomework(event.target.value)} rows={2} />
                </Field>
              </>
            )}
            <Field label={t("lesson.privateNote")} hint={t("lesson.privateHint")}>
              <textarea value={privateNote} onChange={(event) => setPrivateNote(event.target.value)} rows={2} />
            </Field>
            {lesson.invoiceId && (
              <div className="notice notice-info">
                <FileText />
                <span>
                  {t("lesson.onInvoice")}{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => {
                      onClose();
                      navigate({ name: "invoice", id: lesson.invoiceId! });
                    }}
                  >
                    {t("lesson.openInvoice")}
                  </button>
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
