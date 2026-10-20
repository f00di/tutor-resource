import { CalendarDays, CalendarOff, Check, FileText, Globe, HardDrive, Languages, Mail, MessageCircle, Moon, NotebookPen, Smartphone, Sun, WifiOff } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Logo } from "@/components/logo";
import { CONTACT_EMAIL, CONTACT_WHATSAPP, CONTACT_WHATSAPP_DIGITS, TUTORCAT_PRIVACY_URL, TUTORCAT_URL } from "@/config";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { SignupForm } from "./signup-form";

// A fixed Monday (5 Jan 2026) so the previews show the same week in every language.
const at = (day: number, hour: number, minute = 0) => Date.UTC(2026, 0, 5 + day, hour, minute);
const DUBAI = "Asia/Dubai";

function Header() {
  const { t, lang, setLang } = useI18n();
  const { dark, toggle } = useTheme();
  return (
    <header className="site-header">
      <div className="site-shell site-header-inner">
        <a className="brand" href="#top" aria-label={t("site.home")}>
          <Logo className="logo" />
          <span className="brand-tag">Desk</span>
        </a>
        <nav className="site-nav" aria-label={t("site.navLabel")}>
          <a href="#features">{t("site.nav.features")}</a>
          <a href="#how">{t("site.nav.how")}</a>
          <a href="#faq">{t("site.nav.faq")}</a>
        </nav>
        <div className="site-header-tools">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLang(lang === "ar" ? "en" : "ar")} lang={lang === "ar" ? "en" : "ar"}>
            {lang === "ar" ? "English" : "عربي"}
          </button>
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={toggle} aria-label={dark ? t("theme.light") : t("theme.dark")} title={dark ? t("theme.light") : t("theme.dark")}>
            {dark ? <Sun /> : <Moon />}
          </button>
          <a className="btn btn-primary btn-sm site-header-cta" href="#signup">
            {t("site.signUp")}
          </a>
        </div>
      </div>
    </header>
  );
}

/** A small, non-interactive picture of the week view. */
function WeekPreview() {
  const { t, time, weekday } = useI18n();
  const days = [1, 2, 3, 4, 5];
  const lessons: Record<number, Array<{ name: string; subject: string; tone: string; start: number }>> = {
    1: [{ name: "Sara A.", subject: "IGCSE Maths", tone: "sage", start: at(0, 13) }],
    2: [{ name: "Omar K.", subject: "SAT Math", tone: "peach", start: at(1, 15) }],
    3: [
      { name: "Sara A.", subject: "IGCSE Maths", tone: "sage", start: at(2, 13, 30) },
      { name: "Lina H.", subject: "IB Chemistry", tone: "lavender", start: at(2, 15, 30) },
    ],
    4: [{ name: "Omar K.", subject: "SAT Math", tone: "peach", start: at(3, 15) }],
    5: [],
  };
  return (
    <figure className="site-week" role="img" aria-label={t("site.preview.weekLabel")}>
      <div className="site-week-head">
        <strong>{t("site.preview.week")}</strong>
        <span className="badge badge-green">{t("site.preview.thisWeek", { count: 5 })}</span>
      </div>
      <div className="site-week-grid">
        {days.map((day) => (
          <div key={day} className="site-week-day">
            <span className="site-week-label">{weekday(day, "short")}</span>
            {day === 5 && (
              <span className="site-week-block">
                <CalendarOff />
                {t("site.preview.fridayPrayer")}
              </span>
            )}
            {lessons[day]!.map((lesson) => (
              <span key={lesson.start} className={`site-week-lesson tone-${lesson.tone}`}>
                <b>{time(lesson.start, DUBAI)}</b>
                <bdi>{lesson.name}</bdi>
                <small>{lesson.subject}</small>
              </span>
            ))}
          </div>
        ))}
      </div>
      <figcaption className="site-week-invoice">
        <FileText />
        <span>
          <b dir="ltr">INV-2026-007</b> · {t("site.preview.invoice")}
        </span>
        <span className="badge badge-green">{t("site.preview.paid")}</span>
      </figcaption>
    </figure>
  );
}

function Feature({ id, icon, title, body, points, visual, flip = false }: { id: string; icon: ReactNode; title: string; body: string; points: string[]; visual: ReactNode; flip?: boolean }) {
  return (
    <article className={`site-feature${flip ? " is-flipped" : ""}`} aria-labelledby={id}>
      <div className="site-feature-text">
        <span className="site-feature-icon" aria-hidden="true">
          {icon}
        </span>
        <h3 id={id}>{title}</h3>
        <p>{body}</p>
        <ul className="site-points">
          {points.map((point) => (
            <li key={point}>
              <Check aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className="site-feature-visual" aria-hidden="true">
        {visual}
      </div>
    </article>
  );
}

function ScheduleVisual() {
  const { t, time } = useI18n();
  return (
    <div className="site-mini">
      <div className="site-mini-lesson tone-sage">
        <b>Sara A.</b>
        <small>IGCSE Maths · {t("site.visual.weekly")}</small>
      </div>
      <div className="site-mini-row">
        <span className="site-clock">
          <Globe />
          {t("site.visual.theirTime", { time: time(at(0, 13), DUBAI) })}
        </span>
        <span className="site-clock is-you">{t("site.visual.yourTime", { time: time(at(0, 13), "America/Los_Angeles") })}</span>
      </div>
      <p className="site-mini-note">{t("site.visual.dragNote")}</p>
    </div>
  );
}

function BlackoutVisual() {
  const { t, time } = useI18n();
  return (
    <div className="site-mini">
      <div className="site-mini-blocked">
        <CalendarOff />
        <span>
          <b>{t("site.preview.fridayPrayer")}</b>
          <small>{t("site.visual.everyFriday", { from: time(at(4, 12), "UTC"), to: time(at(4, 14), "UTC") })}</small>
        </span>
      </div>
      <div className="site-mini-blocked is-dates">
        <CalendarOff />
        <span>
          <b>{t("site.visual.eid")}</b>
          <small>{t("site.visual.estimated")}</small>
        </span>
      </div>
      <p className="site-mini-warn">{t("site.visual.warn")}</p>
    </div>
  );
}

function NotesVisual() {
  const { t } = useI18n();
  return (
    <div className="site-mini">
      <ul className="site-mini-plan">
        <li className="is-done">
          <Check />
          {t("site.visual.topic1")}
        </li>
        <li>
          <span className="site-box" />
          {t("site.visual.topic2")}
          <span className="badge">{t("site.visual.movedOn")}</span>
        </li>
      </ul>
      <div className="site-mini-message">
        <MessageCircle />
        <span>{t("site.visual.summary")}</span>
      </div>
    </div>
  );
}

function InvoiceVisual() {
  const { t, money, day } = useI18n();
  const rows: Array<[string, number]> = [
    ["2026-01-05", 20000],
    ["2026-01-07", 30000],
    ["2026-01-12", 20000],
  ];
  return (
    <div className="site-mini site-mini-invoice">
      <div className="site-mini-invoice-top">
        <b>{t("paper.title")}</b>
        <span dir="ltr">INV-2026-007</span>
      </div>
      {rows.map(([date, amount]) => (
        <div key={date} className="site-mini-invoice-row">
          <span>{day(date, "short")}</span>
          <span>{money(amount, "AED")}</span>
        </div>
      ))}
      <div className="site-mini-invoice-total">
        <span>{t("paper.total")}</span>
        <b>{money(70000, "AED")}</b>
      </div>
      <p className="site-mini-note">{t("site.visual.currencies")}</p>
    </div>
  );
}

export function Landing() {
  const { t, lang } = useI18n();

  useEffect(() => {
    document.title = t("site.title");
  }, [t, lang]);

  const faq: Array<[string, string]> = [
    ["site.faq.free.q", "site.faq.free.a"],
    ["site.faq.listed.q", "site.faq.listed.a"],
    ["site.faq.devices.q", "site.faq.devices.a"],
    ["site.faq.data.q", "site.faq.data.a"],
    ["site.faq.parents.q", "site.faq.parents.a"],
    ["site.faq.arabic.q", "site.faq.arabic.a"],
  ];

  return (
    <div className="site" id="top">
      <a className="skip-link" href="#main">
        {t("nav.skip")}
      </a>
      <Header />
      <main id="main">
        <section className="site-hero">
          <div className="site-shell site-hero-inner">
            <div className="site-hero-copy">
              <p className="site-eyebrow">{t("site.hero.eyebrow")}</p>
              <h1>{t("site.hero.title")}</h1>
              <p className="site-lead">{t("site.hero.lead")}</p>
              <div className="site-actions">
                <a className="btn btn-primary site-btn-lg" href="#signup">
                  {t("site.hero.primary")}
                </a>
                <a className="btn btn-outline site-btn-lg" href="#features">
                  {t("site.hero.secondary")}
                </a>
              </div>
              <ul className="site-proof">
                <li>
                  <Languages />
                  {t("site.proof.languages")}
                </li>
                <li>
                  <WifiOff />
                  {t("site.proof.offline")}
                </li>
                <li>
                  <HardDrive />
                  {t("site.proof.device")}
                </li>
              </ul>
            </div>
            <WeekPreview />
          </div>
        </section>

        <section className="site-section" id="features" aria-labelledby="features-title">
          <div className="site-shell">
            <div className="site-section-head">
              <p className="site-eyebrow">{t("site.features.eyebrow")}</p>
              <h2 id="features-title">{t("site.features.title")}</h2>
              <p>{t("site.features.intro")}</p>
            </div>
            <div className="site-features">
              <Feature
                id="f-schedule"
                icon={<CalendarDays />}
                title={t("site.f.schedule.title")}
                body={t("site.f.schedule.body")}
                points={[t("site.f.schedule.p1"), t("site.f.schedule.p2"), t("site.f.schedule.p3")]}
                visual={<ScheduleVisual />}
              />
              <Feature
                id="f-blackouts"
                icon={<CalendarOff />}
                title={t("site.f.blackouts.title")}
                body={t("site.f.blackouts.body")}
                points={[t("site.f.blackouts.p1"), t("site.f.blackouts.p2"), t("site.f.blackouts.p3")]}
                visual={<BlackoutVisual />}
                flip
              />
              <Feature
                id="f-notes"
                icon={<NotebookPen />}
                title={t("site.f.notes.title")}
                body={t("site.f.notes.body")}
                points={[t("site.f.notes.p1"), t("site.f.notes.p2"), t("site.f.notes.p3")]}
                visual={<NotesVisual />}
              />
              <Feature
                id="f-invoices"
                icon={<FileText />}
                title={t("site.f.invoices.title")}
                body={t("site.f.invoices.body")}
                points={[t("site.f.invoices.p1"), t("site.f.invoices.p2"), t("site.f.invoices.p3")]}
                visual={<InvoiceVisual />}
                flip
              />
            </div>
            <ul className="site-extras">
              <li>
                <CalendarDays />
                <span>
                  <b>{t("site.extra.today.title")}</b>
                  {t("site.extra.today.body")}
                </span>
              </li>
              <li>
                <Smartphone />
                <span>
                  <b>{t("site.extra.devices.title")}</b>
                  {t("site.extra.devices.body")}
                </span>
              </li>
              <li>
                <HardDrive />
                <span>
                  <b>{t("site.extra.backup.title")}</b>
                  {t("site.extra.backup.body")}
                </span>
              </li>
            </ul>
          </div>
        </section>

        <section className="site-privacy" aria-labelledby="privacy-title">
          <div className="site-shell site-privacy-inner">
            <HardDrive aria-hidden="true" />
            <div>
              <h2 id="privacy-title">{t("site.privacy.title")}</h2>
              <p>{t("site.privacy.body")}</p>
            </div>
          </div>
        </section>

        <section className="site-section" id="how" aria-labelledby="how-title">
          <div className="site-shell">
            <div className="site-section-head">
              <p className="site-eyebrow">{t("site.how.eyebrow")}</p>
              <h2 id="how-title">{t("site.how.title")}</h2>
            </div>
            <ol className="site-steps">
              {[1, 2, 3].map((step) => (
                <li key={step}>
                  <span className="site-step-number">{step}</span>
                  <h3>{t(`site.how.s${step}.title`)}</h3>
                  <p>{t(`site.how.s${step}.body`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="site-section site-signup" id="signup" aria-labelledby="signup-title">
          <div className="site-shell site-signup-inner">
            <div className="site-signup-copy">
              <p className="site-eyebrow">{t("site.signup.eyebrow")}</p>
              <h2 id="signup-title">{t("site.signup.title")}</h2>
              <p>{t("site.signup.body")}</p>
              <div className="site-contact">
                <p className="site-contact-title">{t("site.contact.title")}</p>
                <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr">
                  <Mail />
                  {CONTACT_EMAIL}
                </a>
                <a href={`https://wa.me/${CONTACT_WHATSAPP_DIGITS}`} target="_blank" rel="noopener noreferrer" dir="ltr">
                  <MessageCircle />
                  {CONTACT_WHATSAPP}
                </a>
              </div>
            </div>
            <SignupForm />
          </div>
        </section>

        <section className="site-section" id="faq" aria-labelledby="faq-title">
          <div className="site-shell site-faq">
            <h2 id="faq-title">{t("site.faq.title")}</h2>
            <div>
              {faq.map(([q, a]) => (
                <details key={q}>
                  <summary>{t(q)}</summary>
                  <p>{t(a)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="site-shell site-footer-inner">
          <div>
            <Logo className="logo site-footer-logo" />
            <p>{t("site.footer.about")}</p>
          </div>
          <ul>
            <li>
              <a href={TUTORCAT_URL} target="_blank" rel="noopener noreferrer">
                {t("site.footer.tutorcat")}
              </a>
            </li>
            <li>
              <a href={TUTORCAT_PRIVACY_URL} target="_blank" rel="noopener noreferrer">
                {t("site.footer.privacy")}
              </a>
            </li>
            <li>
              <a href={`mailto:${CONTACT_EMAIL}`} dir="ltr">
                {CONTACT_EMAIL}
              </a>
            </li>
            <li>
              <a href={`https://wa.me/${CONTACT_WHATSAPP_DIGITS}`} target="_blank" rel="noopener noreferrer" dir="ltr">
                {CONTACT_WHATSAPP}
              </a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
