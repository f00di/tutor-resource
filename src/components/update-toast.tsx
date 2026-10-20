import { useRegisterSW } from "virtual:pwa-register/react";

import { useI18n } from "@/lib/i18n";

/** A new version has downloaded: it waits until the tutor clicks Reload, so nothing reloads mid-typing. */
export default function UpdateToast() {
  const { t } = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version every hour while the app is open.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000);
    },
  });
  if (!needRefresh) return null;
  return (
    <div className="toast" role="status">
      <span>{t("update.ready")}</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => void updateServiceWorker(true)}>
        {t("update.reload")}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" style={{ color: "inherit" }} onClick={() => setNeedRefresh(false)}>
        {t("update.later")}
      </button>
    </div>
  );
}
