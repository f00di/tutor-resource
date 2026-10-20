// The week view: drag a lesson to move it, drag its edge to change its length, click an empty slot to
// add one. Blackouts are shaded; day notes sit in the all-day row and can be dragged to another day.
// FullCalendar (MIT plugins only) is loaded with this page, so the rest of the app opens faster.
import type { DateSelectArg, DatesSetArg, EventClickArg, EventContentArg, EventDropArg, EventInput, LocaleInput } from "@fullcalendar/core";
import arLocale from "@fullcalendar/core/locales/ar";
import enGbLocale from "@fullcalendar/core/locales/en-gb";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin, { type EventResizeDoneArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import { CalendarOff, CalendarPlus, StickyNote } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useDialogs } from "@/components/dialog-host";
import { moveLesson, saveNote, type Scope } from "@/lib/actions";
import { blackoutHits, blackoutIntervals } from "@/lib/blackouts";
import { useBlackouts, useLessons, useNarrow, useNotes, useStudentMap, useStudents } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { findClashes, isCancelled, minutesOf, startMs } from "@/lib/lessons";
import { hrefFor } from "@/lib/router";
import { useSettings } from "@/lib/settings";
import { combine, dateKey, deviceZone, HOUR, isValidZone, MINUTE, timeKey, zonePlace } from "@/lib/time";
import type { Student } from "@/lib/types";
import { usePageTitle } from "./page-title";

const VIEW_KEY = "tutorcat-desk.calendarView";
const WIDE_VIEWS = ["timeGridDay", "timeGridWeek", "dayGridMonth", "listWeek"];
const NARROW_VIEWS = ["timeGridDay", "timeGridThreeDay", "listWeek"];

const savedView = (narrow: boolean) => {
  try {
    const view = window.localStorage.getItem(VIEW_KEY) ?? "";
    if ((narrow ? NARROW_VIEWS : WIDE_VIEWS).includes(view)) return view;
  } catch {
    // Storage blocked: use the default view.
  }
  return narrow ? "timeGridDay" : "timeGridWeek";
};

const zoneOf = (student: Student | undefined) => (student && isValidZone(student.timeZone) ? student.timeZone : deviceZone());
// Arabic calendar text with Western digits, as in the rest of the app.
const AR_LOCALE: LocaleInput = { ...arLocale, code: "ar-AE-u-nu-latn" };

export default function SchedulePage() {
  const i18n = useI18n();
  const { t } = i18n;
  usePageTitle(t("nav.schedule"));
  const dialogs = useDialogs();
  const settings = useSettings();
  const students = useStudents();
  const studentMap = useStudentMap(students);
  const lessons = useLessons();
  const notes = useNotes();
  const blackouts = useBlackouts();
  const narrow = useNarrow(640);
  const calendar = useRef<FullCalendar>(null);
  const [range, setRange] = useState<{ start: number; end: number; view: string } | null>(null);
  const local = deviceZone();
  const lessonsById = useMemo(() => new Map(lessons.map((lesson) => [lesson.id, lesson])), [lessons]);

  const events = useMemo<EventInput[]>(() => {
    if (!range) return [];
    const lessonEvents: EventInput[] = lessons
      .filter((lesson) => Date.parse(lesson.end) > range.start && startMs(lesson) < range.end)
      .map((lesson) => {
        const student = studentMap.get(lesson.studentId);
        const zone = zoneOf(student);
        const parts = [];
        if (zone !== local) parts.push(`${zonePlace(zone, i18n.lang)} ${i18n.time(startMs(lesson), zone)}`);
        const open = lesson.plan.filter((item) => !item.done && !item.movedOn).length;
        if (open) parts.push(t("schedule.topics", { count: open }));
        return {
          id: lesson.id,
          title: student?.name ?? t("student.unknown"),
          start: lesson.start,
          end: lesson.end,
          classNames: ["lesson-event", `tone-${student?.tone ?? "sage"}`, ...(isCancelled(lesson) ? ["is-cancelled"] : [])],
          extendedProps: { kind: "lesson", sub: parts.join(" · ") },
        };
      });
    const noteEvents: EventInput[] = notes.map((note) => ({
      id: `note:${note.id}`,
      title: note.text,
      start: note.date,
      allDay: true,
      durationEditable: false,
      classNames: ["note-event", ...(note.done ? ["is-done"] : [])],
      extendedProps: { kind: "note", noteId: note.id },
    }));
    // In the month view only whole-day blackouts are shaded (a two-hour block would shade the whole day).
    const month = range.view === "dayGridMonth";
    const blackoutEvents: EventInput[] = blackouts
      .filter((blackout) => !month || !blackout.startTime || !blackout.endTime)
      .flatMap((blackout) =>
        blackoutIntervals(blackout, range.start, range.end, local).map(([start, end], index) => ({
          id: `blackout:${blackout.id}:${index}`,
          title: blackout.title,
          start,
          end,
          display: "background",
          classNames: ["blackout-bg"],
          ...(month ? { allDay: true, start: dateKey(start, local), end: dateKey(end - 1, local) + "T23:59:59" } : {}),
        }))
      );
    return [...blackoutEvents, ...lessonEvents, ...noteEvents];
  }, [range, lessons, notes, blackouts, studentMap, local, i18n, t]);

  // Widen the visible hours if a lesson in view starts before or ends after them, and note the
  // earliest lesson so the view opens on it (tutors abroad often teach Gulf families early in the day).
  const hours = useMemo(() => {
    let min = settings.dayStart;
    let max = settings.dayEnd;
    let first: string | null = null;
    if (range) {
      for (const lesson of lessons) {
        const start = startMs(lesson);
        if (start >= range.end || Date.parse(lesson.end) <= range.start) continue;
        const from = timeKey(start, local).slice(0, 2) + ":00";
        const endKey = timeKey(Date.parse(lesson.end) - MINUTE, local);
        const to = `${String(Math.min(24, Number(endKey.slice(0, 2)) + 1)).padStart(2, "0")}:00`;
        if (from < min) min = from;
        if (to > max) max = to;
        if (!first || from < first) first = from;
      }
    }
    return { min: `${min}:00`, max: `${max}:00`, first };
  }, [settings.dayStart, settings.dayEnd, range, lessons, local]);

  const warningsFor = useCallback(
    (lessonId: string, start: number, end: number) => {
      const clashes = findClashes(lessons, start, end, new Set([lessonId])).map((clash) => t("lesson.clashWith", { name: studentMap.get(clash.studentId)?.name ?? "?" }));
      const hits = blackoutHits(blackouts, start, end, local).map((hit) => t("lesson.inBlackout", { title: hit.title }));
      return [...clashes, ...hits];
    },
    [lessons, blackouts, studentMap, local, t]
  );

  const moveFromCalendar = async (eventId: string, start: Date | null, end: Date | null, revert: () => void) => {
    const lesson = lessonsById.get(eventId);
    if (!lesson || !start) return revert();
    const newStart = start.getTime();
    const newEnd = end ? end.getTime() : newStart + minutesOf(lesson) * MINUTE;
    const warnings = warningsFor(lesson.id, newStart, newEnd);
    const warningText = warnings.length ? t("schedule.warnBody", { what: i18n.list(warnings) }) : undefined;
    let scope: Scope = "one";
    if (lesson.seriesId) {
      const choice = await dialogs.ask<Scope>({
        title: t("schedule.moveSeriesTitle"),
        body: warningText ?? t("series.applyBody"),
        options: [
          { value: "one", label: t("series.onlyThis"), tone: "outline" },
          { value: "following", label: t("series.thisAndLater") },
        ],
      });
      if (!choice) return revert();
      scope = choice;
    } else if (warningText) {
      if (!(await dialogs.confirm({ title: t("schedule.moveWarnTitle"), body: warningText, confirmLabel: t("schedule.moveAnyway") }))) return revert();
    }
    await moveLesson(lesson.id, newStart, newEnd, scope, zoneOf(studentMap.get(lesson.studentId)));
    dialogs.toast(t("schedule.moved", { day: i18n.date(newStart, "weekdayShort"), time: i18n.time(newStart) }));
  };

  const onDrop = (info: EventDropArg) => {
    if (info.event.extendedProps["kind"] === "note") {
      const noteId = String(info.event.extendedProps["noteId"]);
      const note = notes.find((item) => item.id === noteId);
      if (note && info.event.start) void saveNote({ ...note, date: dateKey(info.event.start.getTime(), local) });
      return;
    }
    void moveFromCalendar(info.event.id, info.event.start, info.event.end, info.revert);
  };

  const onResize = (info: EventResizeDoneArg) => void moveFromCalendar(info.event.id, info.event.start, info.event.end, info.revert);

  const onSelect = (info: DateSelectArg) => {
    calendar.current?.getApi().unselect();
    if (info.view.type === "dayGridMonth") {
      // A day in the month view: a lesson that day at the tutor's usual afternoon time.
      const day = dateKey(info.start.getTime(), local);
      return dialogs.openLesson({ start: combine(day, "16:00", local) });
    }
    if (info.allDay) return dialogs.openNote({ date: dateKey(info.start.getTime(), local) });
    dialogs.openLesson({ start: info.start.getTime(), end: info.end.getTime() });
  };

  const onClick = (info: EventClickArg) => {
    info.jsEvent.preventDefault();
    if (info.event.extendedProps["kind"] === "note") return dialogs.openNote({ id: String(info.event.extendedProps["noteId"]) });
    if (info.event.extendedProps["kind"] === "lesson") dialogs.openLesson({ id: info.event.id });
  };

  const onDates = (info: DatesSetArg) => {
    setRange((current) => (current && current.start === info.start.getTime() && current.end === info.end.getTime() && current.view === info.view.type ? current : { start: info.start.getTime(), end: info.end.getTime(), view: info.view.type }));
    try {
      window.localStorage.setItem(VIEW_KEY, info.view.type);
    } catch {
      // Storage blocked: the view isn't remembered.
    }
  };

  const content = (arg: EventContentArg) => {
    const kind = arg.event.extendedProps["kind"];
    // Blackouts (background events) show their name in the shaded area.
    if (arg.event.display === "background") return <div className="fc-event-title">{arg.event.title}</div>;
    if (kind === "note") {
      return (
        <div className="ev">
          <span className="ev-title" style={{ fontWeight: 600 }}>
            {arg.event.title}
          </span>
        </div>
      );
    }
    const sub = String(arg.event.extendedProps["sub"] ?? "");
    const { start, end } = arg.event;
    // The app's own time format, so the calendar matches every other page.
    const time = start ? (end ? t("range.times", { from: i18n.time(start.getTime()), to: i18n.time(end.getTime()) }) : i18n.time(start.getTime())) : "";
    return (
      <div className="ev">
        {time && arg.view.type !== "listWeek" && <span className="ev-time">{time}</span>}
        <bdi className="ev-title">{arg.event.title}</bdi>
        {sub && <span className="ev-sub">{sub}</span>}
      </div>
    );
  };

  const timeFormat = { hour: "numeric", minute: "2-digit", hour12: settings.hour12, meridiem: settings.hour12 ? "short" : false } as const;
  const nowish = timeKey(Math.max(Date.now() - HOUR, combine(dateKey(Date.now(), local), settings.dayStart, local)), local);
  const scrollTo = hours.first && hours.first < nowish ? hours.first : nowish;
  // On each new week or view, open on the earliest lesson (or about now).
  const scrolledFor = useRef("");
  useEffect(() => {
    // Wait for the lessons to load (the first render has none yet).
    if (!range || !lessons.length) return;
    const key = `${range.start}-${range.view}`;
    if (scrolledFor.current === key) return;
    scrolledFor.current = key;
    calendar.current?.getApi().scrollToTime(`${scrollTo}:00`);
  }, [range, scrollTo, lessons.length]);

  return (
    <div className="calendar-page">
      <div className="calendar-head">
        <h1>{t("nav.schedule")}</h1>
        <div className="calendar-legend" aria-hidden="true">
          <span>
            <span className="legend-swatch" />
            {t("schedule.legendBlackout")}
          </span>
          <span>
            <span className="legend-note" />
            {t("schedule.legendNote")}
          </span>
          <span>{t("schedule.dragHint")}</span>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => dialogs.openLesson()}>
            <CalendarPlus />
            {t("today.addLesson")}
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => dialogs.openNote()}>
            <StickyNote />
            {t("today.addNote")}
          </button>
          <a className="btn btn-outline btn-sm" href={hrefFor({ name: "blackouts" })}>
            <CalendarOff />
            {t("nav.blackouts")}
          </a>
        </div>
      </div>
      <div className="calendar-wrap">
        <FullCalendar
          key={`${narrow}-${i18n.lang}`}
          ref={calendar}
          plugins={[timeGridPlugin, dayGridPlugin, listPlugin, interactionPlugin]}
          initialView={savedView(narrow)}
          views={{ timeGridThreeDay: { type: "timeGrid", duration: { days: 3 }, buttonText: t("schedule.threeDays") } }}
          headerToolbar={narrow ? { start: "prev,next", center: "title", end: "today timeGridDay,timeGridThreeDay,listWeek" } : { start: "prev,next today", center: "title", end: WIDE_VIEWS.join(",") }}
          locale={i18n.lang === "ar" ? AR_LOCALE : enGbLocale}
          direction={i18n.dir}
          firstDay={settings.weekStart}
          height="100%"
          slotMinTime={hours.min}
          slotMaxTime={hours.max}
          scrollTime={`${scrollTo}:00`}
          slotDuration="00:30:00"
          snapDuration="00:15:00"
          slotLabelFormat={timeFormat}
          eventTimeFormat={timeFormat}
          allDayText={t("schedule.notesRow")}
          noEventsText={t("schedule.noEvents")}
          nowIndicator
          editable
          eventInteractive
          selectable
          selectMirror
          dayMaxEvents
          longPressDelay={350}
          eventDurationEditable
          events={events}
          eventAllow={(drop, dragged) => (dragged?.extendedProps["kind"] === "note" ? drop.allDay : !drop.allDay)}
          eventContent={content}
          eventDrop={onDrop}
          eventResize={onResize}
          select={onSelect}
          eventClick={onClick}
          datesSet={onDates}
        />
      </div>
    </div>
  );
}
