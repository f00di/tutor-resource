import { AlertTriangle, CalendarOff, Check, Pencil, Plus, Repeat } from "lucide-react";

import { useDialogs } from "@/components/dialog-host";
import { currentPresets, isPastBlackout } from "@/lib/blackouts";
import { describeBlackout } from "@/lib/describe";
import { useBlackouts } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { todayKey } from "@/lib/time";
import type { Blackout } from "@/lib/types";
import { usePageTitle } from "./page-title";

const sameShape = (a: Pick<Blackout, "days" | "startTime" | "endTime" | "startDate" | "endDate">, b: Blackout) =>
  JSON.stringify(a.days) === JSON.stringify(b.days) && a.startTime === b.startTime && a.endTime === b.endTime && a.startDate === b.startDate && a.endDate === b.endDate;

export function BlackoutsPage() {
  const i18n = useI18n();
  const { t } = i18n;
  usePageTitle(t("nav.blackouts"));
  const dialogs = useDialogs();
  const settings = useSettings();
  const blackouts = useBlackouts();
  const today = todayKey();

  const weekly = blackouts.filter((blackout) => blackout.days && !isPastBlackout(blackout, today));
  const dated = blackouts.filter((blackout) => !blackout.days && !isPastBlackout(blackout, today)).sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  const past = blackouts.filter((blackout) => isPastBlackout(blackout, today));
  const presets = currentPresets(today);

  const row = (blackout: Blackout) => (
    <li key={blackout.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0" }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontWeight: 600 }}>
          <bdi>{blackout.title}</bdi>
          {blackout.estimated && (
            <span className="badge badge-amber">
              <AlertTriangle />
              {t("blackout.estimated")}
            </span>
          )}
          {blackout.sample && <span className="badge">{t("common.sample")}</span>}
        </div>
        <div className="small muted">{describeBlackout(i18n, blackout, settings.weekStart)}</div>
      </div>
      <button type="button" className="btn btn-outline btn-sm" onClick={() => dialogs.openBlackout({ id: blackout.id })}>
        <Pencil />
        {t("common.edit")}
      </button>
    </li>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t("nav.blackouts")}</h1>
          <p className="page-sub">{t("blackout.pageIntro")}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => dialogs.openBlackout()}>
            <Plus />
            {t("blackout.add")}
          </button>
        </div>
      </div>
      <div className="grid-2">
        <div>
          <section className="card">
            <div className="card-head">
              <h2>
                <Repeat width={16} height={16} style={{ verticalAlign: "-3px", marginInlineEnd: 6, color: "var(--primary)" }} />
                {t("blackout.weeklyTitle")}
              </h2>
              <button type="button" className="link-button" onClick={() => dialogs.openBlackout({ draft: { days: [5], startDate: null, endDate: null, startTime: "12:00", endTime: "14:00" } })}>
                {t("blackout.addWeekly")}
              </button>
            </div>
            {weekly.length ? <ul className="list">{weekly.map(row)}</ul> : <p className="card-note">{t("blackout.noWeekly")}</p>}
          </section>
          <section className="card">
            <div className="card-head">
              <h2>
                <CalendarOff width={16} height={16} style={{ verticalAlign: "-3px", marginInlineEnd: 6, color: "var(--primary)" }} />
                {t("blackout.datesTitle")}
              </h2>
              <button type="button" className="link-button" onClick={() => dialogs.openBlackout()}>
                {t("blackout.addDates")}
              </button>
            </div>
            {dated.length ? <ul className="list">{dated.map(row)}</ul> : <p className="card-note">{t("blackout.noDates")}</p>}
          </section>
          {past.length > 0 && (
            <details className="card">
              <summary className="card-head" style={{ marginBottom: 0 }}>
                <h2>{t("blackout.pastTitle", { count: past.length })}</h2>
              </summary>
              <ul className="list" style={{ marginTop: 10 }}>
                {past.map(row)}
              </ul>
            </details>
          )}
        </div>
        <div>
          <section className="card">
            <div className="card-head">
              <h2>{t("blackout.quickAdd")}</h2>
            </div>
            <p className="card-note" style={{ marginBottom: 12 }}>
              {t("blackout.quickIntro")}
            </p>
            <ul className="list">
              {presets.map((preset) => {
                const added = blackouts.some((blackout) => sameShape(preset.blackout, blackout));
                const sample = { ...preset.blackout, id: "", title: t(preset.titleKey), createdAt: "" } as Blackout;
                return (
                  <li key={preset.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>
                        {t(preset.titleKey)}
                        {preset.blackout.estimated && (
                          <span className="badge badge-amber" style={{ marginInlineStart: 6 }}>
                            {t("blackout.estimated")}
                          </span>
                        )}
                      </div>
                      <div className="small muted">{describeBlackout(i18n, sample, settings.weekStart)}</div>
                    </div>
                    {added ? (
                      <span className="badge badge-green">
                        <Check />
                        {t("blackout.added")}
                      </span>
                    ) : (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => dialogs.openBlackout({ draft: { ...preset.blackout, title: t(preset.titleKey) } })}>
                        <Plus />
                        {t("blackout.addShort")}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="field-hint" style={{ marginTop: 10 }}>
              {t("blackout.estimatedNote")}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
