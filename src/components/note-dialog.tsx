import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { deleteNote, saveNote } from "@/lib/actions";
import { db } from "@/lib/db";
import { useStudents } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { isDateKey, todayKey } from "@/lib/time";
import type { DayNote } from "@/lib/types";
import { useDialogs, type NoteTarget } from "./dialog-host";
import { Dialog } from "./dialog";
import { Field } from "./fields";

type Props = NoteTarget & { onClose: () => void };

export function NoteDialog(props: Props) {
  const note = useLiveQuery(async () => (props.id ? ((await db.notes.get(props.id)) ?? null) : null), [props.id]);
  if (note === undefined || (props.id && !note)) return null;
  return <NoteForm {...props} note={note} />;
}

/** A note for a day: "Print the past paper", "Teach vectors to Omar on Thursday". */
function NoteForm({ onClose, note, date, studentId }: Props & { note: DayNote | null }) {
  const { t } = useI18n();
  const dialogs = useDialogs();
  const students = useStudents() ?? [];
  const [day, setDay] = useState(note?.date ?? date ?? todayKey());
  const [text, setText] = useState(note?.text ?? "");
  const [who, setWho] = useState(note?.studentId ?? studentId ?? "");
  const [done, setDone] = useState(note?.done ?? false);
  const valid = isDateKey(day) && text.trim().length > 0;

  const save = async () => {
    if (!valid) return;
    await saveNote({ ...(note ? { id: note.id } : {}), date: day, text: text.trim(), ...(who ? { studentId: who } : {}), done, ...(note?.sample ? { sample: true } : {}) });
    dialogs.toast(t("common.saved"));
    onClose();
  };

  const remove = async () => {
    if (!note) return;
    await deleteNote(note.id);
    onClose();
  };

  return (
    <Dialog
      size="narrow"
      title={note ? t("note.editTitle") : t("note.newTitle")}
      description={t("note.intro")}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {note && (
            <button type="button" className="btn btn-danger spacer" onClick={remove}>
              <Trash2 />
              {t("common.delete")}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="form">
        <Field label={t("note.text")}>
          <textarea value={text} onChange={(event) => setText(event.target.value)} rows={3} placeholder={t("note.placeholder")} autoFocus required />
        </Field>
        <div className="field-row">
          <Field label={t("note.date")}>
            <input type="date" value={day} onChange={(event) => setDay(event.target.value)} required />
          </Field>
          <Field label={t("note.student")}>
            <select value={who} onChange={(event) => setWho(event.target.value)}>
              <option value="">{t("note.anyStudent")}</option>
              {students
                .filter((student) => !student.archived || student.id === who)
                .map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
        {note && (
          <label className="check">
            <input type="checkbox" checked={done} onChange={(event) => setDone(event.target.checked)} />
            {t("note.done")}
          </label>
        )}
      </div>
    </Dialog>
  );
}
