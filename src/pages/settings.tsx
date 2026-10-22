import { useLiveQuery } from "dexie-react-hooks";
import { CheckCircle2, Download, HardDrive, MonitorDown, ShieldCheck, Sparkles, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import { BankFields } from "@/components/bank-fields";
import { useDialogs } from "@/components/dialog-host";
import { CurrencySelect, DurationSelect, Field, Group, MoneyInput, Segmented } from "@/components/fields";
import { BackupError, backupCounts, deleteAllData, parseBackup, restoreBackup, saveBackupFile } from "@/lib/backup";
import { db } from "@/lib/db";
import { useI18n } from "@/lib/i18n";
import { installHint, useInstall } from "@/lib/install";
import { navigate } from "@/lib/router";
import { loadSampleData, removeSampleData } from "@/lib/sample";
import { saveSettings, useLastBackup, useLoadedSettings } from "@/lib/settings";
import { isTimeKey } from "@/lib/time";
import { setThemeChoice, useTheme, type ThemeChoice } from "@/lib/theme";
import type { Mode, Settings } from "@/lib/types";
import { usePageTitle } from "./page-title";

export function SettingsPage() {
  const { t } = useI18n();
  usePageTitle(t("nav.settings"));
  const settings = useLoadedSettings();
  if (settings === undefined) return null;
  return <SettingsForm initial={settings} />;
}

function SettingsForm({ initial }: { initial: Settings }) {
  const i18n = useI18n();
  const { t } = i18n;
  const dialogs = useDialogs();
  const install = useInstall();
  const theme = useTheme();
  const lastBackup = useLastBackup();
  const hasSample = useLiveQuery(async () => (await db.students.filter((student) => student.sample === true).count()) > 0, [], false);
  const [draft, setDraft] = useState(initial);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const pending = useRef<Partial<Settings>>({});
  const timer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  const flush = () => {
    window.clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length) void saveSettings(patch);
  };
  useEffect(() => flush, []);

  const change = (patch: Partial<Settings>) => {
    setDraft((current) => ({ ...current, ...patch }));
    pending.current = { ...pending.current, ...patch };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 400);
  };
  const text = (key: keyof Settings) => ({ value: String(draft[key] ?? ""), onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change({ [key]: event.target.value } as Partial<Settings>) });

  const backup = async () => {
    flush();
    if (await saveBackupFile()) dialogs.toast(t("backup.saved"));
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text());
      const counts = backupCounts(parsed);
      const ok = await dialogs.confirm({
        title: t("backup.restoreTitle"),
        body: t("backup.restoreBody", { date: i18n.date(Date.parse(parsed.exportedAt), "medium"), students: counts.students, lessons: counts.lessons, invoices: counts.invoices }),
        confirmLabel: t("backup.restore"),
        danger: true,
      });
      if (!ok) return;
      await restoreBackup(parsed);
      dialogs.toast(t("backup.restored"));
      navigate({ name: "today" });
    } catch (error) {
      dialogs.toast(error instanceof BackupError ? t(`backup.error.${error.reason}`) : t("backup.error.damaged"));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const loadSample = async () => {
    setSampleBusy(true);
    try {
      await loadSampleData(i18n);
      dialogs.toast(t("sample.loaded"));
    } finally {
      setSampleBusy(false);
    }
  };
  // Asks first, as on the Today page: it deletes anything made for the sample students too.
  const removeSample = async () => {
    if (!(await dialogs.confirm({ title: t("sample.removeTitle"), body: t("sample.removeBody"), confirmLabel: t("sample.remove"), danger: true }))) return;
    setSampleBusy(true);
    try {
      await removeSampleData();
      dialogs.toast(t("sample.removed"));
    } finally {
      setSampleBusy(false);
    }
  };

  const wipe = async () => {
    const first = await dialogs.confirm({ title: t("data.deleteTitle"), body: t("data.deleteBody"), confirmLabel: t("data.deleteConfirm"), danger: true });
    if (!first) return;
    await deleteAllData();
    dialogs.toast(t("data.deleted"));
    navigate({ name: "today" });
  };

  const hint = installHint();

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t("nav.settings")}</h1>
          <p className="page-sub">{t("settings.intro")}</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="card">
          <div className="card-head">
            <h2>{t("settings.you")}</h2>
          </div>
          <p className="card-note" style={{ marginBottom: 14 }}>
            {t("settings.youIntro")}
          </p>
          <div className="form">
            <div className="field-row">
              <Field label={t("settings.name")}>
                <input {...text("tutorName")} autoComplete="name" />
              </Field>
              <Field label={t("settings.business")} hint={t("settings.businessHint")}>
                <input {...text("businessName")} />
              </Field>
            </div>
            <div className="field-row">
              <Field label={t("student.email")}>
                <input type="email" {...text("email")} autoComplete="email" dir="ltr" />
              </Field>
              <Field label={t("settings.phone")}>
                <input type="tel" {...text("phone")} autoComplete="tel" dir="ltr" />
              </Field>
            </div>
            <Field label={t("settings.address")}>
              <textarea {...text("address")} rows={2} />
            </Field>
            <Field label={t("settings.taxNumber")} hint={t("settings.taxNumberHint")}>
              <input {...text("taxNumber")} dir="ltr" />
            </Field>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t("bank.title")}</h2>
          </div>
          <p className="card-note" style={{ marginBottom: 14 }}>
            {t("bank.intro")}
          </p>
          <BankFields value={draft} onChange={change} />
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t("settings.invoices")}</h2>
          </div>
          <div className="form">
            <div className="field-row three">
              <Field label={t("settings.prefix")} hint={t("settings.prefixHint", { example: `${draft.invoicePrefix}${draft.nextInvoiceNumber}` })}>
                <input {...text("invoicePrefix")} dir="ltr" />
              </Field>
              <Field label={t("settings.nextNumber")}>
                <input type="number" min={1} value={draft.nextInvoiceNumber} onChange={(event) => change({ nextInvoiceNumber: Math.max(1, Math.floor(Number(event.target.value) || 1)) })} />
              </Field>
              <Field label={t("settings.dueDays")}>
                <input type="number" min={0} max={120} value={draft.dueDays} onChange={(event) => change({ dueDays: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} />
              </Field>
            </div>
            <div className="field-row">
              <Field label={t("invoice.taxLabel")}>
                <input {...text("taxLabel")} />
              </Field>
              <Field label={t("settings.taxRate")} hint={t("invoice.taxHint")}>
                <input type="number" min={0} max={100} step={0.5} value={draft.taxRate} onChange={(event) => change({ taxRate: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} />
              </Field>
            </div>
            <Field label={t("settings.otherPayment")} hint={t("settings.paymentHint")}>
              <textarea {...text("paymentDetails")} rows={3} />
            </Field>
            <Field label={t("settings.footer")} hint={t("settings.footerHint")}>
              <textarea {...text("invoiceFooter")} rows={2} />
            </Field>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t("settings.lessons")}</h2>
          </div>
          <div className="form">
            <div className="field-row three">
              <Field label={t("settings.defaultLength")}>
                <DurationSelect value={draft.defaultDuration} onChange={(minutes) => change({ defaultDuration: minutes })} />
              </Field>
              <Field label={t("settings.defaultRate")}>
                <MoneyInput value={draft.defaultRate} currency={draft.defaultCurrency} onChange={(minor) => change({ defaultRate: minor })} />
              </Field>
              <Field label={t("student.currency")}>
                <CurrencySelect value={draft.defaultCurrency} onChange={(currency) => change({ defaultCurrency: currency })} />
              </Field>
            </div>
            <Group label={t("settings.defaultMode")}>
              <Segmented<Mode>
                value={draft.defaultMode}
                onChange={(mode) => change({ defaultMode: mode })}
                options={[
                  { value: "online", label: t("mode.online") },
                  { value: "inPerson", label: t("mode.inPerson") },
                ]}
              />
            </Group>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t("settings.calendar")}</h2>
          </div>
          <div className="form">
            <Group label={t("settings.weekStart")} hint={t("settings.weekStartHint")}>
              <Segmented<"0" | "1" | "6">
                value={String(draft.weekStart) as "0" | "1" | "6"}
                onChange={(value) => change({ weekStart: Number(value) as 0 | 1 | 6 })}
                options={[
                  { value: "6", label: i18n.weekday(6, "long") },
                  { value: "0", label: i18n.weekday(0, "long") },
                  { value: "1", label: i18n.weekday(1, "long") },
                ]}
              />
            </Group>
            <Group label={t("settings.timeFormat")}>
              <Segmented<"12" | "24">
                value={draft.hour12 ? "12" : "24"}
                onChange={(value) => change({ hour12: value === "12" })}
                options={[
                  { value: "12", label: t("settings.hour12") },
                  { value: "24", label: t("settings.hour24") },
                ]}
              />
            </Group>
            <div className="field-row">
              <Field label={t("settings.dayStart")}>
                <input type="time" step={1800} value={draft.dayStart} onChange={(event) => isTimeKey(event.target.value) && event.target.value < draft.dayEnd && change({ dayStart: event.target.value })} />
              </Field>
              <Field label={t("settings.dayEnd")} hint={t("settings.dayHoursHint")}>
                <input type="time" step={1800} value={draft.dayEnd} onChange={(event) => isTimeKey(event.target.value) && event.target.value > draft.dayStart && change({ dayEnd: event.target.value })} />
              </Field>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t("settings.look")}</h2>
          </div>
          <div className="form">
            <Group label={t("settings.language")}>
              <Segmented
                value={i18n.lang}
                onChange={i18n.setLang}
                options={[
                  { value: "en", label: "English" },
                  { value: "ar", label: "العربية" },
                ]}
              />
            </Group>
            <Group label={t("settings.theme")}>
              <Segmented<ThemeChoice>
                value={theme.choice}
                onChange={setThemeChoice}
                options={[
                  { value: "system", label: t("theme.system") },
                  { value: "light", label: t("theme.lightShort") },
                  { value: "dark", label: t("theme.darkShort") },
                ]}
              />
            </Group>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t("install.title")}</h2>
          </div>
          {install.installed ? (
            <p className="card-note">
              <CheckCircle2 width={15} height={15} style={{ verticalAlign: "-3px", color: "var(--primary)", marginInlineEnd: 6 }} />
              {t("install.done")}
            </p>
          ) : (
            <>
              <p className="card-note" style={{ marginBottom: 12 }}>
                {t("install.intro")}
              </p>
              {install.canPrompt ? (
                <button type="button" className="btn btn-primary" onClick={() => void install.install()}>
                  <MonitorDown />
                  {t("install.button")}
                </button>
              ) : (
                <p className="card-note" style={{ color: "var(--foreground)" }}>
                  {t(hint === "safari-mac" ? "install.safari" : hint === "ios" ? "install.ios" : "install.other")}
                </p>
              )}
            </>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>{t("data.title")}</h2>
          </div>
          <div className="notice notice-info" style={{ marginBottom: 14 }}>
            <ShieldCheck />
            <span>{t("data.private")}</span>
          </div>
          <dl className="details" style={{ marginBottom: 14 }}>
            <dt>{t("data.stored")}</dt>
            <dd>
              <HardDrive width={13} height={13} style={{ verticalAlign: "-2px", marginInlineEnd: 4 }} />
              {t("data.thisDevice")}
              {persisted === true && ` · ${t("data.persisted")}`}
              {persisted === false && ` · ${t("data.notPersisted")}`}
            </dd>
            <dt>{t("data.lastBackup")}</dt>
            <dd>{lastBackup ? i18n.date(Date.parse(lastBackup), "medium") : t("data.neverBackedUp")}</dd>
          </dl>
          <p className="card-note" style={{ marginBottom: 12 }}>
            {t("data.backupIntro")}
          </p>
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={backup}>
              <Download />
              {t("backup.now")}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => fileInput.current?.click()}>
              <Upload />
              {t("backup.restoreButton")}
            </button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => void restore(event.target.files?.[0])} />
          </div>
          <hr className="divider" style={{ margin: "18px 0" }} />
          <div className="page-actions">
            {hasSample ? (
              <button type="button" className="btn btn-outline" onClick={removeSample} disabled={sampleBusy}>
                <Sparkles />
                {t("sample.remove")}
              </button>
            ) : (
              <button type="button" className="btn btn-outline" onClick={loadSample} disabled={sampleBusy} aria-busy={sampleBusy}>
                <Sparkles />
                {sampleBusy ? t("sample.loading") : t("sample.load")}
              </button>
            )}
            <button type="button" className="btn btn-danger" onClick={wipe}>
              <Trash2 />
              {t("data.delete")}
            </button>
          </div>
        </section>

        <p className="field-hint">{t("settings.about", { version: __APP_VERSION__ })}</p>
      </div>
    </div>
  );
}
