import { BookOpen, CalendarClock, Package, Plus, Search, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { useDialogs } from "@/components/dialog-host";
import { Segmented } from "@/components/fields";
import { curriculumKey } from "@/lib/curricula";
import { useLessons, useNow, usePackages, useStudents } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { nextLesson, packageUsage, startMs } from "@/lib/lessons";
import { hrefFor } from "@/lib/router";
import type { Student } from "@/lib/types";
import { usePageTitle } from "./page-title";

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();

export function useStudentLine() {
  const { t } = useI18n();
  return (student: Student) => {
    const key = curriculumKey(student.curriculum);
    return [key ? t(key) : student.curriculum, student.level].filter((part) => part && part.trim()).join(" · ");
  };
}

export function StudentsPage() {
  const i18n = useI18n();
  const { t } = i18n;
  usePageTitle(t("nav.students"));
  const dialogs = useDialogs();
  const students = useStudents();
  const lessons = useLessons();
  const packages = usePackages();
  const now = useNow();
  const line = useStudentLine();
  const [show, setShow] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");
  const usage = useMemo(() => packageUsage(packages, lessons, now).byPackage, [packages, lessons, now]);

  if (students === undefined) return null;
  const needle = query.trim().toLowerCase();
  const shown = students.filter(
    (student) => (show === "archived" ? student.archived : !student.archived) && (!needle || [student.name, student.parentName, student.subjects].some((value) => value.toLowerCase().includes(needle)))
  );
  const archivedCount = students.filter((student) => student.archived).length;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t("nav.students")}</h1>
          <p className="page-sub">{t("students.intro")}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => dialogs.openStudent()}>
            <Plus />
            {t("student.add")}
          </button>
        </div>
      </div>
      {students.length > 0 && (
        <div className="filter-row">
          <label className="field" style={{ flex: "1 1 240px", maxWidth: 360 }}>
            <span className="sr-only">{t("students.search")}</span>
            <div style={{ position: "relative" }}>
              <Search width={15} height={15} style={{ position: "absolute", insetInlineStart: 11, top: 12, color: "var(--muted-foreground)" }} />
              <input className="input" style={{ paddingInlineStart: 33 }} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("students.search")} type="search" />
            </div>
          </label>
          {archivedCount > 0 && (
            <Segmented
              value={show}
              onChange={setShow}
              options={[
                { value: "active", label: t("students.active") },
                { value: "archived", label: t("students.archived", { count: archivedCount }) },
              ]}
            />
          )}
        </div>
      )}
      {shown.length ? (
        <div className="student-grid">
          {shown.map((student) => {
            const next = nextLesson(lessons, student.id, now);
            const open = packages.filter((pack) => pack.studentId === student.id).map((pack) => usage.get(pack.id)).find((use) => use && use.remaining > 0);
            return (
              <a key={student.id} className={`student-card tone-${student.tone}`} href={hrefFor({ name: "student", id: student.id })}>
                <div className="student-top">
                  <span className="avatar" aria-hidden="true">
                    {initials(student.name)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="student-name">
                      <bdi>{student.name}</bdi> {student.sample && <span className="badge">{t("common.sample")}</span>}
                    </div>
                    <div className="student-sub">{line(student) || t("students.noDetails")}</div>
                  </div>
                </div>
                <div className="student-facts">
                  {student.subjects && (
                    <span>
                      <BookOpen />
                      {student.subjects}
                    </span>
                  )}
                  <span>
                    <CalendarClock />
                    {next ? t("students.next", { when: `${i18n.date(startMs(next), "weekdayShort")} · ${i18n.time(startMs(next))}` }) : t("students.noNext")}
                  </span>
                  <span>
                    <Wallet />
                    {t("students.rate", { rate: i18n.money(student.rate, student.currency) })}
                  </span>
                  {open && (
                    <span>
                      <Package />
                      {t("package.left", { count: open.remaining })}
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <strong>{students.length ? t("students.noMatch") : t("students.emptyTitle")}</strong>
          {!students.length && t("students.emptyBody")}
          {!students.length && (
            <div>
              <button type="button" className="btn btn-primary" onClick={() => dialogs.openStudent()}>
                <Plus />
                {t("student.add")}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
