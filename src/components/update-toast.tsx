import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

import { useI18n } from "@/lib/i18n";
import { TopLayer } from "./top-layer";

/** A new version has downloaded: it waits until the tutor clicks Reload, so nothing reloads mid-typing. */
export default function UpdateToast() {
  const { t } = useI18n();
  const timer = useRef<number | undefined>(undefined);
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
  if (!needRefresh) return null;
  // In the top layer, so it shows above an open dialog too.
  return (
    <TopLayer className="toast">
      <span>{t("update.ready")}</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => void updateServiceWorker(true)}>
        {t("update.reload")}
      </button>
      <button type="button" className="btn btn-ghost btn-sm" style={{ color: "inherit" }} onClick={() => setNeedRefresh(false)}>
        {t("update.later")}
      </button>
    </TopLayer>
  );
}
