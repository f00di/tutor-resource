// The first screen on a new device, shown once: who Tutorcat Desk is for, that the data stays on this
// device, restoring a backup (a new laptop, another address, a reinstall), and the sample data. Remembered in localStorage["tutorcat-desk.welcomed"] (like the theme and
// language), so "Delete everything" in Settings doesn't bring it back.
import { ArrowRight, BadgeCheck, ExternalLink, HardDrive, Sparkles } from "lucide-react";
import { useState } from "react";

import { useI18n } from "@/lib/i18n";
import { navigate } from "@/lib/router";
import { loadSampleData } from "@/lib/sample";
import { usePageTitle } from "@/pages/page-title";
import { useDialogs } from "./dialog-host";
import { Logo } from "./logo";
import { RestoreButton } from "./restore-button";
import { Tools } from "./shell";

/** Where tutors apply to be listed. A link the tutor clicks; the app never contacts Tutorcat. */
export const TUTORCAT_FOR_TUTORS = "https://f00di.github.io/tutorcat/for-tutors/";
export const WELCOMED_STORAGE_KEY = "tutorcat-desk.welcomed";

export function hasBeenWelcomed(): boolean {
  try {
    return window.localStorage.getItem(WELCOMED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberWelcomed() {
  try {
    window.localStorage.setItem(WELCOMED_STORAGE_KEY, "1");
  } catch {
    // Storage blocked: the welcome shows again on the next visit.
  }
}

export function FirstRun({ onDone }: { onDone: () => void }) {
  const i18n = useI18n();
  const { t } = i18n;
  usePageTitle("");
  const dialogs = useDialogs();
  const [loadingSample, setLoadingSample] = useState(false);

  const finish = () => {
    rememberWelcomed();
    onDone();
  };

  const trySample = async () => {
    setLoadingSample(true);
    try {
      await loadSampleData(i18n);
      dialogs.toast(t("sample.loaded"));
      finish();
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <div className="first-run">
      <header className="first-run-bar">
        <span className="brand">
          <Logo className="logo" />
          <span className="brand-tag">Desk</span>
        </span>
        <div className="first-run-tools">
          <Tools />
        </div>
      </header>
      <main id="main" className="first-run-main" tabIndex={-1}>
        <div className="first-run-card">
          <h1>{t("firstRun.title")}</h1>
          <p className="first-run-lead">{t("firstRun.lead")}</p>
          <ul className="first-run-points">
            <li>
              <span className="first-run-icon">
                <BadgeCheck />
              </span>
              <div>
                <h2>{t("firstRun.freeTitle")}</h2>
                <p>
                  {t("firstRun.free")} {t("firstRun.notListed")}{" "}
                  <a href={TUTORCAT_FOR_TUTORS} target="_blank" rel="noopener noreferrer">
                    {t("firstRun.apply")}
                    <ExternalLink className="dir-icon" aria-hidden />
                    <span className="sr-only"> {t("common.newTab")}</span>
                  </a>
                </p>
              </div>
            </li>
            <li>
              <span className="first-run-icon">
                <HardDrive />
              </span>
              <div>
                <h2>{t("firstRun.dataTitle")}</h2>
                <p>{t("firstRun.data")}</p>
              </div>
            </li>
          </ul>
          <div className="first-run-actions">
            <button type="button" className="btn btn-primary" onClick={finish}>
              {t("firstRun.start")}
              <ArrowRight className="dir-icon" />
            </button>
            <RestoreButton
              onRestored={() => {
                navigate({ name: "today" });
                finish();
              }}
            />
            <button type="button" className="btn btn-outline" onClick={trySample} disabled={loadingSample} aria-busy={loadingSample}>
              <Sparkles />
              {loadingSample ? t("sample.loading") : t("sample.load")}
            </button>
          </div>
          <p className="first-run-restore">{t("firstRun.restoreHint")}</p>
        </div>
      </main>
    </div>
  );
}
