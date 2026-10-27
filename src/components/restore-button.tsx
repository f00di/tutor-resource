// "Restore from a backup", on the welcome screen and in Settings: shows what's in the file, offers to
// back up this device's own data first when there is some, then replaces everything with the file.
import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { BackupError, backupCounts, hasOwnData, readBackupFile, restoreBackup, saveBackupFile, type Backup } from "@/lib/backup";
import { useI18n } from "@/lib/i18n";
import { normaliseSettings } from "@/lib/settings";
import { setThemeChoice } from "@/lib/theme";
import { useDialogs } from "./dialog-host";

export function RestoreButton({ className = "btn btn-outline", onRestored }: { className?: string; onRestored: () => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  const dialogs = useDialogs();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const confirmRestore = async (backup: Backup): Promise<boolean> => {
    const summary = <BackupSummary backup={backup} />;
    // Nothing of the tutor's own here (a new install, or only the sample data): nothing to lose.
    if (!(await hasOwnData())) {
      return dialogs.confirm({
        title: t("restore.title"),
        body: (
          <>
            {summary}
            <p className="restore-note">{t("restore.freshBody")}</p>
          </>
        ),
        confirmLabel: t("restore.confirm"),
      });
    }
    const choice = await dialogs.ask({
      title: t("backup.restoreTitle"),
      body: (
        <>
          {summary}
          <p className="restore-note">{t("restore.replaceBody")}</p>
        </>
      ),
      options: [
        { value: "replace", label: t("backup.restore"), tone: "danger" },
        { value: "backupFirst", label: t("restore.backupFirst"), tone: "primary" },
      ],
    });
    if (choice === "backupFirst") {
      // Closing the Save window means no backup, so nothing is replaced.
      if (!(await saveBackupFile())) return false;
      dialogs.toast(t("backup.saved"));
    }
    return choice !== null;
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const backup = await readBackupFile(file);
      if (!(await confirmRestore(backup))) return;
      await restoreBackup(backup);
      // Version 2 files also bring back the theme and language chosen on the old device.
      if (backup.prefs) {
        setThemeChoice(backup.prefs.theme ?? "system");
        if (backup.prefs.lang && backup.prefs.lang !== i18n.lang) i18n.setLang(backup.prefs.lang);
      }
      dialogs.toast(t("backup.restored"));
      onRestored();
    } catch (error) {
      dialogs.toast(error instanceof BackupError ? t(`backup.error.${error.reason}`) : t("backup.error.damaged"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={() => input.current?.click()} disabled={busy} aria-busy={busy}>
        <Upload />
        {t("backup.restoreButton")}
      </button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(event) => void restore(event.target.files?.[0])} />
    </>
  );
}

/** What the file holds, before anything is replaced. */
function BackupSummary({ backup }: { backup: Backup }) {
  const i18n = useI18n();
  const { t } = i18n;
  const counts = backupCounts(backup);
  const savedAt = Date.parse(backup.exportedAt);
  const tutor = normaliseSettings(backup.settings).tutorName.trim();
  return (
    <dl className="details restore-summary">
      <dt>{t("restore.savedOn")}</dt>
      <dd>{t("restore.savedAt", { date: i18n.date(savedAt, "medium"), time: i18n.time(savedAt) })}</dd>
      {backup.appVersion && (
        <>
          <dt>{t("restore.appVersion")}</dt>
          <dd>
            <bdi>{backup.appVersion}</bdi>
          </dd>
        </>
      )}
      {tutor && (
        <>
          <dt>{t("restore.tutor")}</dt>
          <dd>
            <bdi>{tutor}</bdi>
          </dd>
        </>
      )}
      <dt>{t("restore.students")}</dt>
      <dd>{i18n.number(counts.students)}</dd>
      <dt>{t("restore.lessons")}</dt>
      <dd>{i18n.number(counts.lessons)}</dd>
      <dt>{t("restore.invoices")}</dt>
      <dd>{i18n.number(counts.invoices)}</dd>
    </dl>
  );
}
