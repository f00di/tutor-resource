import { ArrowRight, Check, Copy, Download, Mail, MessageCircle, Pencil } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { CONTACT_EMAIL, CONTACT_WHATSAPP, TUTORCAT_PRIVACY_URL } from "@/config";
import { useI18n } from "@/lib/i18n";
import { installHint } from "@/lib/install";
import { COUNTRIES, placeLabel } from "./places";
import { mailtoHref, plainText, signupMessage, whatsappHref, type Signup } from "./signup";

/** The app, next to this page (app/index.html). It installs from there; this page offers no install itself. */
const APP_URL = `${import.meta.env.BASE_URL}app/`;

const Field = ({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) => (
  <label className={`field${wide ? " site-wide" : ""}`}>
    <span>{label}</span>
    {children}
  </label>
);

/**
 * The same questions as Tutorcat's tutor application. Pressing the button builds the message; the
 * tutor then sends it by email or WhatsApp themselves (or copies it). Nothing is sent from the page.
 * Once they've opened it in WhatsApp, the download button appears, with a reminder that sending it
 * means agreeing to have their details shown on Tutorcat.
 */
export function SignupForm() {
  const { t, lang } = useI18n();
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState<Signup | null>(null);
  const [copied, setCopied] = useState(false);
  // The page can't see whether they pressed send in WhatsApp, only that they opened it. Kept for this
  // visit only (the page stores nothing), and kept through "Edit my details".
  const [openedWhatsApp, setOpenedWhatsApp] = useState(false);
  const region = COUNTRIES.find((item) => item.name === country);
  const showPlace = country === "Other" || city === "Other";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    // At least one subject or study destination, as on Tutorcat.
    const subjects = form.elements.namedItem("subjects") as HTMLInputElement;
    const countries = form.elements.namedItem("countries") as HTMLInputElement;
    subjects.setCustomValidity(subjects.value.trim() || countries.value.trim() ? "" : t("site.form.needSubject"));
    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus(t("site.form.invalid"));
      return;
    }
    setStatus("");
    setCopied(false);
    setReady(signupMessage(new FormData(form), lang === "ar" ? "Arabic" : "English"));
    window.requestAnimationFrame(() => document.getElementById("signup-ready")?.focus());
  };

  const copy = async () => {
    if (!ready) return;
    try {
      await navigator.clipboard.writeText(plainText(ready));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="site-form-card">
      <form className="site-form" noValidate onSubmit={submit} hidden={Boolean(ready)} aria-labelledby="signup-title">
        <div className="site-form-grid">
          <Field label={t("site.form.fullName")}>
            <input required name="fullName" autoComplete="name" />
          </Field>
          <Field label={t("site.form.email")}>
            <input required type="email" dir="ltr" name="email" autoComplete="email" />
          </Field>
          <Field label={t("site.form.phone")}>
            <input type="tel" dir="ltr" name="phone" autoComplete="tel" placeholder="+971 50 123 4567" />
          </Field>
          <Field label={t("site.form.joinAs")}>
            <select required name="applicantType" defaultValue="">
              <option value="">{t("site.form.chooseOne")}</option>
              <option value="Tutor">{t("site.form.tutor")}</option>
              <option value="Counselor">{t("site.form.counselor")}</option>
              <option value="Tutor + Counselor">{t("site.form.tutorCounselor")}</option>
            </select>
          </Field>
          <Field label={t("site.form.listed")}>
            <select name="listed" defaultValue="">
              <option value="">{t("site.form.chooseOne")}</option>
              <option value="Yes">{t("site.form.listedYes")}</option>
              <option value="No, I'd like to be">{t("site.form.listedNo")}</option>
              <option value="Not sure">{t("site.form.listedUnsure")}</option>
            </select>
          </Field>
          <Field label={t("site.form.country")}>
            <select
              name="country"
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setCity("");
              }}
            >
              <option value="">{t("site.form.chooseOne")}</option>
              {COUNTRIES.map((item) => (
                <option key={item.name} value={item.name}>
                  {placeLabel(item, lang)}
                </option>
              ))}
              <option value="Other">{t("site.form.other")}</option>
            </select>
          </Field>
          {region && (
            <Field label={t("site.form.city")}>
              <select name="city" value={city} onChange={(event) => setCity(event.target.value)}>
                <option value="">{t("site.form.chooseOne")}</option>
                {region.cities.map((item) => (
                  <option key={item.name} value={item.name}>
                    {placeLabel(item, lang)}
                  </option>
                ))}
                <option value="Other">{t("site.form.otherNotListed")}</option>
              </select>
            </Field>
          )}
          {showPlace && (
            <Field label={t("site.form.place")}>
              <input name="place" autoComplete="address-level2" />
            </Field>
          )}
          <Field label={t("site.form.years")}>
            <input name="years" type="number" min={0} max={60} inputMode="numeric" dir="ltr" />
          </Field>
          <Field label={t("site.form.sessionMode")}>
            <select name="sessionMode" defaultValue="">
              <option value="">{t("site.form.chooseOne")}</option>
              <option value="Online">{t("site.form.online")}</option>
              <option value="In-person">{t("site.form.inPerson")}</option>
              <option value="Hybrid">{t("site.form.hybrid")}</option>
            </select>
          </Field>
          <Field label={t("site.form.subjects")} wide>
            <input name="subjects" placeholder={t("site.form.subjectsPlaceholder")} />
          </Field>
          <Field label={t("site.form.countries")} wide>
            <input name="countries" placeholder={t("site.form.countriesPlaceholder")} />
          </Field>
          <Field label={t("site.form.languages")}>
            <input name="languages" placeholder={t("site.form.languagesPlaceholder")} />
          </Field>
          <Field label={t("site.form.availability")}>
            <input name="availability" placeholder={t("site.form.availabilityPlaceholder")} />
          </Field>
          <Field label={t("site.form.photoUrl")}>
            <input name="photoUrl" type="url" dir="ltr" placeholder="https://" />
          </Field>
          <Field label={t("site.form.profileLink")}>
            <input name="profileLink" type="url" dir="ltr" placeholder="https://" />
          </Field>
          <Field label={t("site.form.experience")} wide>
            <textarea name="experience" rows={3} placeholder={t("site.form.experiencePlaceholder")} />
          </Field>
          <Field label={t("site.form.bio")} wide>
            <textarea name="bio" rows={3} placeholder={t("site.form.bioPlaceholder")} />
          </Field>
        </div>
        <div className="site-consents">
          <label className="check">
            <input required name="consent" type="checkbox" />
            <span>{t("site.form.consent")}</span>
          </label>
          <label className="check">
            <input name="photoConsent" type="checkbox" />
            <span>{t("site.form.photoConsent")}</span>
          </label>
          <label className="check">
            <input required name="listingAgreement" type="checkbox" />
            <span>{t("site.form.listingAgreement")}</span>
          </label>
        </div>
        {status && (
          <p className="site-form-error" role="alert">
            {status}
          </p>
        )}
        <button type="submit" className="btn btn-primary site-btn-lg">
          {t("site.form.submit")}
          <ArrowRight className="dir-icon" />
        </button>
        <p className="site-form-note">
          {t("site.form.note")}{" "}
          <a href={TUTORCAT_PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            {t("site.form.privacy")}
          </a>
        </p>
      </form>

      {ready && (
        <div className="site-ready" id="signup-ready" tabIndex={-1} aria-live="polite">
          <span className="site-ready-icon" aria-hidden="true">
            <Check />
          </span>
          <h3>{t("site.ready.title")}</h3>
          <p>{t("site.ready.body")}</p>
          <div className="site-ready-actions">
            <a className="btn btn-primary site-btn-lg" href={mailtoHref(ready)}>
              <Mail />
              {t("site.ready.email")}
            </a>
            <a className="btn btn-whatsapp site-btn-lg" href={whatsappHref(ready)} target="_blank" rel="noopener noreferrer" onClick={() => setOpenedWhatsApp(true)}>
              <MessageCircle />
              {t("site.ready.whatsapp")}
            </a>
          </div>
          <p className="site-ready-to">
            {/* The number is forced left-to-right, or Arabic text shows its digit groups in reverse. */}
            {t("site.ready.to", { email: CONTACT_EMAIL, whatsapp: `⁦${CONTACT_WHATSAPP}⁩` })}
          </p>
          {openedWhatsApp && (
            <div className="site-download">
              <h4>{t("site.download.title")}</h4>
              <p>{t("site.download.agree")}</p>
              <a className="btn btn-primary site-btn-lg" href={APP_URL}>
                <Download />
                {t("site.download.button")}
              </a>
              <p className="site-download-hint">
                {t("site.download.opens")} {t(`install.${installHint()}`)}
              </p>
            </div>
          )}
          <details className="site-ready-text">
            <summary>{t("site.ready.preview")}</summary>
            <pre dir="ltr">{plainText(ready)}</pre>
          </details>
          <div className="site-ready-more">
            <button type="button" className="btn btn-outline" onClick={() => void copy()}>
              {copied ? <Check /> : <Copy />}
              {copied ? t("site.ready.copied") : t("site.ready.copy")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setReady(null)}>
              <Pencil />
              {t("site.ready.edit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
