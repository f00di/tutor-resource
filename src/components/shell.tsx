import { CalendarDays, CalendarOff, FileText, HardDrive, LayoutDashboard, Moon, Settings as SettingsIcon, Sun, Users } from "lucide-react";
import type { ReactNode } from "react";

import { useI18n } from "@/lib/i18n";
import { hrefFor, type Route, type RouteName } from "@/lib/router";
import { useTheme } from "@/lib/theme";
import { Logo } from "./logo";
import { NavButtons, useNavShortcuts } from "./nav-buttons";

const NAV: Array<{ name: RouteName; key: string; short: string; icon: ReactNode; also?: RouteName[] }> = [
  { name: "today", key: "nav.today", short: "nav.todayShort", icon: <LayoutDashboard /> },
  { name: "schedule", key: "nav.schedule", short: "nav.scheduleShort", icon: <CalendarDays /> },
  { name: "blackouts", key: "nav.blackouts", short: "nav.blackoutsShort", icon: <CalendarOff /> },
  { name: "students", key: "nav.students", short: "nav.studentsShort", icon: <Users />, also: ["student"] },
  { name: "invoices", key: "nav.invoices", short: "nav.invoicesShort", icon: <FileText />, also: ["invoice"] },
];

const current = (route: Route, item: (typeof NAV)[number]) => (route.name === item.name || item.also?.includes(route.name) ? "page" : undefined);

/** Language and theme switches (also on the first-run screen). */
export function Tools() {
  const { t, lang, setLang } = useI18n();
  const { dark, toggle } = useTheme();
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")} lang={lang === "ar" ? "en" : "ar"}>
        {lang === "ar" ? "English" : "عربي"}
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={toggle} aria-label={dark ? t("theme.light") : t("theme.dark")} title={dark ? t("theme.light") : t("theme.dark")}>
        {dark ? <Sun /> : <Moon />}
      </button>
    </>
  );
}

/** Sidebar on laptops; a top bar and bottom tabs on phones and small tablets (styles.css). */
export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { t } = useI18n();
  useNavShortcuts();
  return (
    <div className="app">
      <a className="skip-link" href="#main" onClick={(event) => {
        event.preventDefault();
        document.getElementById("main")?.focus();
      }}>
        {t("nav.skip")}
      </a>
      <aside className="sidebar">
        <div className="brand-row">
          <a className="brand" href="#/" aria-label={t("app.home")}>
            <Logo className="logo" />
            <span className="brand-tag">Desk</span>
          </a>
          <NavButtons />
        </div>
        <nav className="nav" aria-label={t("nav.label")}>
          {NAV.map((item) => (
            <a key={item.name} className="nav-item" href={hrefFor({ name: item.name })} aria-current={current(route, item)}>
              {item.icon}
              {t(item.key)}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          <a className="nav-item" href={hrefFor({ name: "settings" })} aria-current={route.name === "settings" ? "page" : undefined}>
            <SettingsIcon />
            {t("nav.settings")}
          </a>
          <div className="sidebar-tools">
            <Tools />
          </div>
          <p className="device-note">
            <HardDrive />
            {t("app.onDevice")}
          </p>
        </div>
      </aside>
      <header className="topbar">
        <div className="topbar-start">
          <NavButtons />
          <a className="brand" href="#/" aria-label={t("app.home")}>
            <Logo className="logo" />
            <span className="brand-tag">Desk</span>
          </a>
        </div>
        <div className="topbar-tools">
          <Tools />
          <a className="btn btn-ghost btn-icon btn-sm" href={hrefFor({ name: "settings" })} aria-label={t("nav.settings")} aria-current={route.name === "settings" ? "page" : undefined}>
            <SettingsIcon />
          </a>
        </div>
      </header>
      <main id="main" className="main" tabIndex={-1}>
        {children}
      </main>
      <nav className="tabbar" aria-label={t("nav.label")}>
        {NAV.map((item) => (
          <a key={item.name} href={hrefFor({ name: item.name })} aria-current={current(route, item)}>
            {item.icon}
            {t(item.short)}
          </a>
        ))}
      </nav>
    </div>
  );
}
