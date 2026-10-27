import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

import { saveBackupFile } from "@/lib/backup";
import { useI18n } from "@/lib/i18n";
import { TopLayer } from "./top-layer";

/** A moment for a downloaded backup file to finish saving before the page reloads. */
export const RELOAD_AFTER_BACKUP_MS = 500;

/**
 * A new version has downloaded: it waits until the tutor clicks Reload, so nothing reloads mid-typing.
 * Updating keeps everything (the data is in this browser, not in the app's files); "Back up first"
 * saves the backup file before reloading, just in case.
 */
export default function UpdateToast() {
  const { t } = useI18n();
  const timer = useRef<number | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every hour while the app is open.
      window.clearInterval(timer.current);
      if (registration) timer.current = window.setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });
  useEffect(() => () => window.clearInterval(timer.current), []);

  const backupFirst = async () => {
    setSaving(true);
    try {
      // Closing the Save window keeps the prompt, so the tutor can choose again.
      if (!(await saveBackupFile())) return;
      await new Promise((resolve) => window.setTimeout(resolve, RELOAD_AFTER_BACKUP_MS));
      await updateServiceWorker(true);
    } finally {
      setSaving(false);
    }
  };

  if (!needRefresh) return null;
  // In the top layer, so it shows above an open dialog too.
  return (
    <TopLayer className="toast toast-update">
      <div className="toast-text">
        <strong>{t("update.ready")}</strong>
        <span>{t("update.dataStays")}</span>
      </div>
      <div className="toast-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={() => void backupFirst()} disabled={saving} aria-busy={saving}>
          {saving ? t("update.backingUp") : t("update.backupFirst")}
        </button>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void updateServiceWorker(true)} disabled={saving}>
          {t("update.reload")}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" style={{ color: "inherit" }} onClick={() => setNeedRefresh(false)} disabled={saving}>
          {t("update.later")}
        </button>
      </div>
    </TopLayer>
  );
}
