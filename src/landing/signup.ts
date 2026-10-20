// The sign-up message for the Tutorcat team: the same details as Tutorcat's tutor application
// (tutorcat/src/lib/drafts.ts applicationDraft), plus whether the tutor is already listed. It's English
// for the team whatever the page language (select values are English on purpose), and it's only ever
// put into an email or WhatsApp message the tutor sends themselves.
import { CONTACT_EMAIL, CONTACT_WHATSAPP_DIGITS } from "@/config";

export interface Signup {
  subject: string;
  body: string;
}

const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const or = (value: string) => value || "Not provided";

export function signupMessage(data: FormData, siteLanguage: string, now = new Date()): Signup {
  const name = field(data, "fullName");
  const place = field(data, "place");
  return {
    subject: `Tutorcat Desk sign-up — ${name}`,
    body: [
      "Tutorcat Desk sign-up (same details as a Tutorcat listing application)",
      "",
      `Applicant wants to be listed as: ${field(data, "applicantType")}`,
      `Already listed on Tutorcat: ${or(field(data, "listed"))}`,
      "",
      `Full name: ${name}`,
      `Email: ${field(data, "email")}`,
      `Phone or WhatsApp: ${or(field(data, "phone"))}`,
      `Country: ${or(field(data, "country"))}`,
      `City: ${or(field(data, "city"))}`,
      ...(place ? [`Location details: ${place}`] : []),
      `Subjects I can teach: ${or(field(data, "subjects"))}`,
      `Countries I can advise on: ${or(field(data, "countries"))}`,
      `Languages spoken: ${or(field(data, "languages"))}`,
      `Education/experience: ${or(field(data, "experience"))}`,
      `Years of experience: ${or(field(data, "years"))}`,
      `Session mode: ${or(field(data, "sessionMode"))}`,
      `Availability: ${or(field(data, "availability"))}`,
      "",
      "Short bio:",
      or(field(data, "bio")),
      "",
      `Profile picture URL: ${or(field(data, "photoUrl"))}`,
      `LinkedIn/portfolio/profile link: ${or(field(data, "profileLink"))}`,
      `Photo display consent: ${data.get("photoConsent") ? "Yes" : "No"}`,
      `Submitted date: ${now.toISOString()}`,
      `Site language: ${siteLanguage}`,
      "",
      "Note: Tutorcat should review this sign-up before sending the Tutorcat Desk link or adding any public profile.",
    ].join("\n"),
  };
}

export const mailtoHref = ({ subject, body }: Signup) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

export const whatsappHref = ({ subject, body }: Signup) => `https://wa.me/${CONTACT_WHATSAPP_DIGITS}?text=${encodeURIComponent(`${subject}\n\n${body}`)}`;

export const plainText = ({ subject, body }: Signup) => `Subject: ${subject}\n\n${body}`;
