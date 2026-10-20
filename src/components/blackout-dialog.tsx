import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, Moon, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { deleteBlackout, saveBlackout, type BlackoutDraft } from "@/lib/actions";
import { blackoutIntervals } from "@/lib/blackouts";
import { db } from "@/lib/db";
import { useLessons } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { endMs, isCancelled, overlaps, startMs } from "@/lib/lessons";
import { useSettings } from "@/lib/settings";
import { addDays, DAY, isDateKey, isTimeKey, todayKey } from "@/lib/time";
import type { Blackout } from "@/lib/types";
import { useDialogs, type BlackoutTarget } from "./dialog-host";
import { Dialog } from "./dialog";
import { DayChips, Field, Group, Segmented } from "./fields";

type Props = BlackoutTarget & { onClose: () => void };

export function BlackoutDialog(props: Props) {
  const blackout = useLiveQuery(async () => (props.id ? ((await db.blackouts.get(props.id)) ?? null) : null), [props.id]);
  if (blackout === undefined || (props.id && !blackout)) return null;
  return <BlackoutForm {...props} blackout={blackout} />;
}

type Kind = "weekly" | "dates";

function BlackoutForm({ onClose, blackout, draft: preset }: Props & { blackout: Blackout | null }) {
  const i18n = useI18n();
  const { t } = i18n;
  const dialogs = useDialogs();
  const settings = useSettings();
  const lessons = useLessons();
  const today = todayKey();
  const base: BlackoutDraft = blackout ?? {
    title: "",
    days: null,
    startTime: null,
    endTime: null,
    startDate: today,
    endDate: today,
    ...preset,
  };
  const [title, setTitle] = useState(base.title);
  const [kind, setKind] = useState<Kind>(base.days ? "weekly" : "dates");
  const [days, setDays] = useState<number[]>(base.days ?? [5]);
  const [allDay, setAllDay] = useState(!base.startTime || !base.endTime);
  const [startTime, setStartTime] = useState(base.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(base.endTime ?? "17:00");
  const [startDate, setStartDate] = useState(base.startDate ?? today);
  const [endDate, setEndDate] = useState(base.endDate ?? base.startDate ?? today);
  // A weekly blackout can be limited to a stretch of dates (e.g. exam season evenings).
  const [limited, setLimited] = useState(Boolean(base.days && (base.startDate || base.endDate)));

  const result: BlackoutDraft = {
    ...(blackout ? { id: blackout.id } : {}),
    title: title.trim() || t("blackout.defaultTitle"),
    days: kind === "weekly" ? days : null,
    startTime: allDay ? null : startTime,
    endTime: allDay ? null : endTime,
    startDate: kind === "dates" || limited ? startDate : null,
    endDate: kind === "dates" || limited ? endDate : null,
    ...(base.estimated ? { estimated: true } : {}),
    ...(base.sample ? { sample: true } : {}),
  };

  const problem = (() => {
    if (kind === "weekly" && !days.length) return t("blackout.pickDay");
    if (!allDay && (!isTimeKey(startTime) || !isTimeKey(endTime) || endTime <= startTime)) return t("blackout.timeOrder");
    if ((kind === "dates" || limited) && (!isDateKey(startDate) || !isDateKey(endDate) || endDate < startDate)) return t("blackout.dateOrder");
    return null;
  })();

  // Booked lessons in the next six months that this blackout would cover.
  const affected = useMemo(() => {
    if (problem) return 0;
    const from = Date.now();
    const to = from + 183 * DAY;
    const candidate = { ...result, id: "preview", createdAt: "" } as Blackout;
    const intervals = blackoutIntervals(candidate, from, to);
    return lessons.filter((lesson) => !isCancelled(lesson) && startMs(lesson) > from && intervals.some(([start, end]) => overlaps(startMs(lesson), endMs(lesson), start, end))).length;
  }, [problem, kind, days, allDay, startTime, endTime, startDate, endDate, limited, lessons]);

  const save = async () => {
    if (problem) return;
    await saveBlackout(result);
    dialogs.toast(t("common.saved"));
    onClose();
  };

  const remove = async () => {
    if (!blackout) return;
    if (!(await dialogs.confirm({ title: t("blackout.deleteTitle"), body: blackout.title, confirmLabel: t("common.delete"), danger: true }))) return;
    await deleteBlackout(blackout.id);
    onClose();
  };

  return (
    <Dialog
      size="narrow"
      title={blackout ? t("blackout.editTitle") : t("blackout.newTitle")}
      description={t("blackout.intro")}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {blackout && (
            <button type="button" className="btn btn-danger spacer" onClick={remove}>
              <Trash2 />
              {t("common.delete")}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={Boolean(problem)}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        {base.estimated && (
          <div className="notice notice-warn">
            <Moon />
            <span>{t("blackout.estimatedNote")}</span>
          </div>
        )}
        <Field label={t("blackout.title")}>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("blackout.titlePlaceholder")} />
        </Field>
        <Group label={t("blackout.kind")}>
          <Segmented<Kind>
            value={kind}
            onChange={setKind}
            options={[
              { value: "weekly", label: t("blackout.weekly") },
              { value: "dates", label: t("blackout.dates") },
            ]}
          />
        </Group>
        {kind === "weekly" && (
          <Group label={t("blackout.days")}>
            <DayChips value={days} onChange={setDays} weekStart={settings.weekStart} />
          </Group>
        )}
        {(kind === "dates" || limited) && (
          <div className="field-row">
            <Field label={t("blackout.from")}>
              <input
                type="date"
                value={startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  if (endDate < event.target.value) setEndDate(event.target.value);
                }}
              />
            </Field>
            <Field label={t("blackout.to")}>
              <input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
            </Field>
          </div>
        )}
        {kind === "weekly" && (
          <label className="check">
            <input
              type="checkbox"
              checked={limited}
              onChange={(event) => {
                setLimited(event.target.checked);
                if (event.target.checked && endDate <= startDate) setEndDate(addDays(startDate, 28));
              }}
            />
            {t("blackout.limited")}
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} />
          {t("blackout.allDay")}
        </label>
        {!allDay && (
          <div className="field-row">
            <Field label={t("blackout.startTime")}>
              <input type="time" value={startTime} step={300} onChange={(event) => setStartTime(event.target.value)} />
            </Field>
            <Field label={t("blackout.endTime")}>
              <input type="time" value={endTime} step={300} onChange={(event) => setEndTime(event.target.value)} />
            </Field>
          </div>
        )}
        {problem && <p className="field-hint" style={{ color: "var(--destructive)" }}>{problem}</p>}
        {affected > 0 && (
          <div className="notice notice-warn">
            <AlertTriangle />
            <span>{t("blackout.affected", { count: affected })}</span>
          </div>
        )}
      </div>
    </Dialog>
  );
}
