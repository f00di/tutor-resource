import { describe, expect, it } from "vitest";

import { CONTACT_EMAIL, CONTACT_WHATSAPP_DIGITS } from "@/config";
import { mailtoHref, plainText, signupMessage, whatsappHref } from "@/landing/signup";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
};

describe("sign-up message", () => {
  const data = form({
    fullName: "Sara Ahmed",
    email: "sara@example.com",
    phone: "+971 50 000 0000",
    applicantType: "Tutor",
    listed: "No, I'd like to be",
    country: "United Arab Emirates",
    city: "Dubai",
    years: "4",
    sessionMode: "Online",
    subjects: "IGCSE Maths, Physics",
    languages: "English, Arabic",
    bio: "Maths tutor for IGCSE and A-Level.",
    consent: "on",
    listingAgreement: "on",
  });
  const message = signupMessage(data, "English", new Date("2026-10-20T10:00:00Z"));

  it("has the same details as a Tutorcat listing application, plus whether they're listed", () => {
    expect(message.subject).toBe("Tutorcat Desk sign-up — Sara Ahmed");
    for (const line of [
      "Applicant wants to be listed as: Tutor",
      "Already listed on Tutorcat: No, I'd like to be",
      "Full name: Sara Ahmed",
      "Email: sara@example.com",
      "Phone or WhatsApp: +971 50 000 0000",
      "Country: United Arab Emirates",
      "City: Dubai",
      "Subjects I can teach: IGCSE Maths, Physics",
      "Countries I can advise on: Not provided",
      "Languages spoken: English, Arabic",
      "Years of experience: 4",
      "Session mode: Online",
      "Maths tutor for IGCSE and A-Level.",
      "Photo display consent: No",
      "By sending this, I agree to have these details shown on Tutorcat.",
      "Submitted date: 2026-10-20T10:00:00.000Z",
      "Site language: English",
    ]) {
      expect(message.body).toContain(line);
    }
  });

  it("only adds the location line when there is one", () => {
    expect(message.body).not.toContain("Location details");
    expect(signupMessage(form({ fullName: "A", place: "Karachi" }), "English").body).toContain("Location details: Karachi");
  });

  it("goes to the Tutorcat team's email and WhatsApp", () => {
    expect(mailtoHref(message).startsWith(`mailto:${CONTACT_EMAIL}?subject=Tutorcat%20Desk%20sign-up`)).toBe(true);
    expect(decodeURIComponent(mailtoHref(message).split("&body=")[1]!)).toBe(message.body);
    expect(whatsappHref(message).startsWith(`https://wa.me/${CONTACT_WHATSAPP_DIGITS}?text=`)).toBe(true);
    expect(decodeURIComponent(whatsappHref(message).split("?text=")[1]!)).toBe(`${message.subject}\n\n${message.body}`);
    expect(plainText(message).startsWith("Subject: Tutorcat Desk sign-up — Sara Ahmed\n\n")).toBe(true);
  });
});
