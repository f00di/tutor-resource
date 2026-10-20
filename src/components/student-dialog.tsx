import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";

import { saveStudent, type StudentDraft } from "@/lib/actions";
import { CURRICULA } from "@/lib/curricula";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { deviceZone, GULF_ZONES } from "@/lib/time";
import type { Lang, Mode, Student, Tone } from "@/lib/types";
import { useDialogs, type StudentTarget } from "./dialog-host";
import { Dialog } from "./dialog";
import { CurrencySelect, Field, Group, MoneyInput, Segmented, TONES, TonePicker, ZoneSelect } from "./fields";

type Props = StudentTarget & { onClose: () => void };

export function StudentDialog(props: Props) {
  const student = useLiveQuery(async () => (props.id ? ((await db.students.get(props.id)) ?? null) : null), [props.id]);
  const count = useLiveQuery(() => db.students.count(), []);
  if (student === undefined || count === undefined) return null;
  return <StudentForm {...props} student={student} count={count} />;
}

function StudentForm({ onClose, onSaved, student, count }: Props & { student: Student | null; count: number }) {
  const { t, lang } = useI18n();
  const dialogs = useDialogs();
  const settings = useSettings();
  const local = deviceZone();
  const [draft, setDraft] = useState<StudentDraft>(() =>
    student
      ? { ...student }
      : {
          name: "",
          parentName: "",
          phone: "",
          email: "",
          // A tutor in the Gulf usually teaches families nearby; abroad, they pick the family's zone.
          timeZone: GULF_ZONES.includes(local) ? local : "Asia/Dubai",
          messageLang: lang,
          curriculum: "",
          level: "",
          subjects: "",
          rate: settings.defaultRate,
          currency: settings.defaultCurrency,
          mode: settings.defaultMode,
          location: "",
          tone: TONES[count % TONES.length] ?? "sage",
          notes: "",
        }
  );
  const set = <K extends keyof StudentDraft>(key: K, value: StudentDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  // "Other": the tutor types the curriculum's name.
  const [other, setOther] = useState(() => Boolean(student?.curriculum) && !CURRICULA.some((item) => item.value === student?.curriculum));

  const save = async () => {
    if (!draft.name.trim()) return;
    const id = await saveStudent({
      ...draft,
      name: draft.name.trim(),
      parentName: draft.parentName.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      location: draft.location.trim(),
      curriculum: draft.curriculum.trim(),
    });
    dialogs.toast(t("common.saved"));
    onSaved?.(id);
    onClose();
  };

  return (
    <Dialog
      title={student ? t("student.editTitle") : t("student.newTitle")}
      description={t("student.privacy")}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!draft.name.trim()}>
            {student ? t("common.save") : t("student.add")}
          </button>
        </>
      }
    >
      <div className="form">
        <div className="field-row">
          <Field label={t("student.name")}>
            <input value={draft.name} onChange={(event) => set("name", event.target.value)} required autoFocus />
          </Field>
          <Field label={t("student.parent")}>
            <input value={draft.parentName} onChange={(event) => set("parentName", event.target.value)} />
          </Field>
        </div>
        <div className="field-row">
          <Field label={t("student.phone")} hint={t("student.phoneHint")}>
            <input type="tel" value={draft.phone} onChange={(event) => set("phone", event.target.value)} placeholder="+971 50 123 4567" dir="ltr" />
          </Field>
          <Field label={t("student.email")}>
            <input type="email" value={draft.email} onChange={(event) => set("email", event.target.value)} dir="ltr" />
          </Field>
        </div>
        <div className="field-row">
          <Field label={t("student.zone")} hint={t("student.zoneHint")}>
            <ZoneSelect value={draft.timeZone} onChange={(zone) => set("timeZone", zone)} />
          </Field>
          <Field label={t("student.messageLang")}>
            <select value={draft.messageLang} onChange={(event) => set("messageLang", event.target.value as Lang)}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </Field>
        </div>
        <div className="field-row three">
          <Field label={t("student.curriculum")}>
            <select
              value={other ? "__other" : draft.curriculum}
              onChange={(event) => {
                const value = event.target.value;
                setOther(value === "__other");
                set("curriculum", value === "__other" ? "" : value);
              }}
            >
              <option value="">{t("student.curriculumNone")}</option>
              {CURRICULA.map((item) => (
                <option key={item.value} value={item.value}>
                  {t(item.key)}
                </option>
              ))}
              <option value="__other">{t("curriculum.other")}</option>
            </select>
          </Field>
          <Field label={t("student.level")}>
            <input value={draft.level} onChange={(event) => set("level", event.target.value)} placeholder={t("student.levelPlaceholder")} />
          </Field>
          <Field label={t("student.subjects")}>
            <input value={draft.subjects} onChange={(event) => set("subjects", event.target.value)} placeholder={t("student.subjectsPlaceholder")} />
          </Field>
        </div>
        {other && (
          <Field label={t("student.curriculumOther")}>
            <input value={draft.curriculum} onChange={(event) => set("curriculum", event.target.value)} />
          </Field>
        )}
        <div className="field-row">
          <Field label={t("student.rate")} hint={t("student.rateHint")}>
            <MoneyInput value={draft.rate} currency={draft.currency} onChange={(minor) => set("rate", minor)} />
          </Field>
          <Field label={t("student.currency")}>
            <CurrencySelect value={draft.currency} onChange={(currency) => set("currency", currency)} />
          </Field>
        </div>
        <Group label={t("student.usualMode")}>
          <Segmented<Mode>
            value={draft.mode}
            onChange={(mode) => set("mode", mode)}
            options={[
              { value: "online", label: t("mode.online") },
              { value: "inPerson", label: t("mode.inPerson") },
            ]}
          />
        </Group>
        <Field label={draft.mode === "online" ? t("student.usualLink") : t("student.usualAddress")}>
          <input value={draft.location} onChange={(event) => set("location", event.target.value)} placeholder={draft.mode === "online" ? "https://" : ""} />
        </Field>
        <Group label={t("student.colour")}>
          <TonePicker value={draft.tone} onChange={(tone: Tone) => set("tone", tone)} />
        </Group>
        <Field label={t("student.notes")} hint={t("student.notesHint")}>
          <textarea value={draft.notes} onChange={(event) => set("notes", event.target.value)} rows={3} />
        </Field>
      </div>
    </Dialog>
  );
}
