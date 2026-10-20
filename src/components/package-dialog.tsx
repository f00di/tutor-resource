import { useLiveQuery } from "dexie-react-hooks";
import { Trash2 } from "lucide-react";
import { useState } from "react";

import { deletePackage, savePackage } from "@/lib/actions";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { isDateKey, todayKey } from "@/lib/time";
import type { CurrencyCode, LessonPackage, Student } from "@/lib/types";
import { useDialogs, type PackageTarget } from "./dialog-host";
import { Dialog } from "./dialog";
import { CurrencySelect, Field, MoneyInput } from "./fields";

type Props = PackageTarget & { onClose: () => void };

export function PackageDialog(props: Props) {
  const pack = useLiveQuery(async () => (props.id ? ((await db.packages.get(props.id)) ?? null) : null), [props.id]);
  const student = useLiveQuery(async () => (await db.students.get(props.studentId)) ?? null, [props.studentId]);
  if (pack === undefined || student === undefined || !student || (props.id && !pack)) return null;
  return <PackageForm {...props} pack={pack} student={student} />;
}

/** A prepaid bundle: "10 lessons for AED 1,800". Taught lessons use it up, oldest first. */
function PackageForm({ onClose, pack, student }: Props & { pack: LessonPackage | null; student: Student }) {
  const { t } = useI18n();
  const dialogs = useDialogs();
  const [size, setSize] = useState(pack?.size ?? 10);
  const [currency, setCurrency] = useState<CurrencyCode>(pack?.currency ?? student.currency);
  const [price, setPrice] = useState(pack?.price ?? student.rate * 10);
  const [startDate, setStartDate] = useState(pack?.startDate ?? todayKey());
  const valid = size >= 1 && isDateKey(startDate);

  const save = async () => {
    if (!valid) return;
    await savePackage({ ...(pack ? { id: pack.id } : {}), studentId: student.id, size, price, currency, startDate, ...(pack?.invoiceId ? { invoiceId: pack.invoiceId } : {}), ...(pack?.sample ? { sample: true } : {}) });
    dialogs.toast(t("common.saved"));
    onClose();
  };

  const remove = async () => {
    if (!pack) return;
    if (!(await dialogs.confirm({ title: t("package.deleteTitle"), body: t("package.deleteBody"), confirmLabel: t("common.delete"), danger: true }))) return;
    await deletePackage(pack.id);
    onClose();
  };

  return (
    <Dialog
      size="narrow"
      title={pack ? t("package.editTitle") : t("package.newTitle")}
      description={t("package.intro", { name: student.name })}
      onClose={onClose}
      onSubmit={save}
      footer={
        <>
          {pack && (
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
        <div className="field-row">
          <Field label={t("package.size")}>
            <input type="number" min={1} max={200} value={size} onChange={(event) => setSize(Math.max(1, Math.min(200, Number(event.target.value) || 1)))} />
          </Field>
          <Field label={t("package.start")} hint={t("package.startHint")}>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
        </div>
        <div className="field-row">
          <Field label={t("package.price")}>
            <MoneyInput value={price} currency={currency} onChange={setPrice} />
          </Field>
          <Field label={t("student.currency")}>
            <CurrencySelect value={currency} onChange={setCurrency} />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}
