import { useI18n } from "@/lib/i18n";
import type { BankField } from "@/lib/invoices";
import type { Settings } from "@/lib/types";
import { Field } from "./fields";

export type BankDetails = Pick<Settings, BankField>;

/** The bank lines printed on invoices, used in Settings and in the New invoice dialog. Only filled-in lines print. */
export function BankFields({ value, onChange }: { value: BankDetails; onChange: (patch: Partial<BankDetails>) => void }) {
  const { t } = useI18n();
  const input = (field: BankField) => (
    <Field label={t(`bank.${field}`)}>
      <input value={value[field]} onChange={(event) => onChange({ [field]: event.target.value })} dir={field === "beneficiaryName" ? "auto" : "ltr"} autoComplete="off" spellCheck={false} />
    </Field>
  );
  return (
    <div className="form">
      {input("beneficiaryName")}
      {input("iban")}
      <div className="field-row">
        {input("accountNumber")}
        {input("swiftCode")}
      </div>
      {input("routingNumber")}
    </div>
  );
}
