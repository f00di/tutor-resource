import { Globe, MapPin, MessageCircle, Pencil, Video } from "lucide-react";

import { updateLesson } from "@/lib/actions";
import { useI18n, useTranslator } from "@/lib/i18n";
import { endMs, isCancelled, isTaught, startMs } from "@/lib/lessons";
import { reminderMessage, whatsappLink } from "@/lib/messages";
import { deviceZone, isValidZone, zonePlace } from "@/lib/time";
import type { Lesson, Student } from "@/lib/types";

const isLink = (value: string) => /^https?:\/\//i.test(value.trim());

/** One lesson in a list: time (and the family's time if it differs), who, where, the plan to tick off. */
export function LessonRow({ lesson, student, tutorName, onOpen, showDate = false, now = Date.now() }: { lesson: Lesson; student: Student | undefined; tutorName: string; onOpen: () => void; showDate?: boolean; now?: number }) {
  const i18n = useI18n();
  const { t } = i18n;
  const messages = useTranslator(student?.messageLang ?? i18n.lang);
  const start = startMs(lesson);
  const local = deviceZone();
  const theirZone = student && isValidZone(student.timeZone) ? student.timeZone : local;
  const cancelled = isCancelled(lesson);
  const live = !cancelled && start <= now && endMs(lesson) > now;

  return (
    <div className={`lesson-row tone-${student?.tone ?? "sage"}`} style={cancelled ? { opacity: 0.6 } : undefined}>
      <div className="lesson-time">
        {showDate && <small>{i18n.date(start, "weekdayShort")}</small>}
        {i18n.time(start)}
        <small>{t("duration.minutes", { count: Math.round((endMs(lesson) - start) / 60000) })}</small>
      </div>
      <div className="lesson-main">
        <div className="lesson-title">
          <span className="dot" aria-hidden="true" />
          <button type="button" className="link-button" style={{ color: "var(--foreground)" }} onClick={onOpen}>
            <bdi>{student?.name ?? t("student.unknown")}</bdi>
          </button>
          {student?.subjects && <span className="muted small">{student.subjects}</span>}
          {live && <span className="badge badge-green">{t("lesson.now")}</span>}
          {cancelled && <span className="badge">{lesson.status === "cancelledCharged" ? t("status.cancelledCharged") : t("status.cancelledFree")}</span>}
          {isTaught(lesson, now) && !live && <span className="badge">{t("status.taught")}</span>}
        </div>
        <div className="lesson-meta">
          {theirZone !== local && (
            <span>
              <Globe />
              {t("lesson.theirTimeShort", { time: i18n.time(start, theirZone), place: zonePlace(theirZone, i18n.lang) })}
            </span>
          )}
          {lesson.location.trim() && (
            <span>
              {lesson.mode === "online" ? <Video /> : <MapPin />}
              {lesson.mode === "online" && isLink(lesson.location) ? (
                <a href={lesson.location.trim()} target="_blank" rel="noopener noreferrer">
                  {t("lesson.joinLink")}
                </a>
              ) : (
                lesson.location.trim()
              )}
            </span>
          )}
          {!lesson.location.trim() && <span>{lesson.mode === "online" ? t("mode.online") : t("mode.inPerson")}</span>}
        </div>
        {lesson.plan.length > 0 && (
          <ul className="checklist">
            {lesson.plan.map((item) => (
              <li key={item.id} className={item.done ? "is-done" : undefined}>
                <input
                  type="checkbox"
                  checked={item.done}
                  aria-label={item.text}
                  onChange={(event) => void updateLesson(lesson.id, { plan: lesson.plan.map((other) => (other.id === item.id ? { ...other, done: event.target.checked } : other)) })}
                />
                <span>
                  {item.text}
                  {item.carriedFrom && <span className="carried"> · {t("plan.from", { date: i18n.date(Date.parse(item.carriedFrom), "short") })}</span>}
                  {item.movedOn && <span className="carried"> · {t("plan.movedOn")}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="lesson-actions">
        {student && !cancelled && start > now && messages && (
          <a className="btn btn-outline btn-icon btn-sm" href={whatsappLink(student.phone, reminderMessage(messages, student, lesson, tutorName))} target="_blank" rel="noopener noreferrer" aria-label={t("lesson.sendReminder")} title={t("lesson.sendReminder")}>
            <MessageCircle />
          </a>
        )}
        <button type="button" className="btn btn-outline btn-icon btn-sm" onClick={onOpen} aria-label={t("lesson.open")} title={t("lesson.open")}>
          <Pencil />
        </button>
      </div>
    </div>
  );
}
