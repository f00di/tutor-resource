// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import ar from "../i18n/ar.json";
import { CONTACT_EMAIL, CONTACT_WHATSAPP } from "@/config";
import { Landing } from "@/landing/landing";
import { I18nProvider, loadCatalog } from "@/lib/i18n";

beforeAll(() => {
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, onchange: null, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
});
afterEach(cleanup);

const page = (lang: "en" | "ar" = "en") =>
  render(
    <I18nProvider initialLang={lang} hour12>
      <Landing />
    </I18nProvider>
  );

const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("information page", () => {
  it("describes the app and isn't the app", () => {
    page();
    expect(screen.getByRole("heading", { level: 1, name: "Your teaching week, sorted." })).toBeTruthy();
    for (const name of ["A schedule you can drag", "Blackout times", "Lesson plans and notes", "Invoices that build themselves", "Your data stays on your device"]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    // No link into the app: tutors get it from the Tutorcat team after signing up.
    expect(document.querySelector('a[href*="app/"]')).toBeNull();
  });

  it("shows the team's email address and WhatsApp number", () => {
    page();
    expect(screen.getAllByRole("link", { name: CONTACT_EMAIL }).every((link) => link.getAttribute("href") === `mailto:${CONTACT_EMAIL}`)).toBe(true);
    expect(screen.getAllByRole("link", { name: CONTACT_WHATSAPP }).every((link) => link.getAttribute("href") === "https://wa.me/971563784048")).toBe(true);
  });

  it("asks for the required details, then offers email and WhatsApp", async () => {
    page();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Prepare my sign-up/ })));
    expect(screen.getByRole("alert").textContent).toBe("Please complete the required fields.");

    type("Full name", "Sara Ahmed");
    type("Email address", "sara@example.com");
    fireEvent.change(screen.getByLabelText("I want to join as"), { target: { value: "Tutor" } });
    fireEvent.change(screen.getByLabelText("Country"), { target: { value: "Qatar" } });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "Doha" } });
    type("Subjects I can teach", "SAT Math");
    fireEvent.click(screen.getByLabelText(/I confirm that the information/));
    fireEvent.click(screen.getByLabelText(/does not guarantee/));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Prepare my sign-up/ })));

    expect(screen.getByRole("heading", { name: "Your sign-up is ready to send" })).toBeTruthy();
    const email = screen.getByRole("link", { name: /Send by email/ }).getAttribute("href") ?? "";
    const whatsapp = screen.getByRole("link", { name: /Send on WhatsApp/ }).getAttribute("href") ?? "";
    expect(email.startsWith(`mailto:${CONTACT_EMAIL}?`)).toBe(true);
    expect(decodeURIComponent(email)).toContain("City: Doha");
    expect(whatsapp.startsWith("https://wa.me/971563784048?text=")).toBe(true);
    expect(decodeURIComponent(whatsapp)).toContain("Subjects I can teach: SAT Math");

    // Editing goes back to the same, still-filled form.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Edit my details/ })));
    expect((screen.getByLabelText("Full name") as HTMLInputElement).value).toBe("Sara Ahmed");
  });

  it("works in Arabic, right to left", async () => {
    await loadCatalog("ar");
    page("ar");
    expect(screen.getByRole("heading", { level: 1, name: ar["site.hero.title"] })).toBeTruthy();
    expect(screen.getByLabelText("الاسم الكامل")).toBeTruthy();
    expect(document.documentElement.dir).toBe("rtl");
  });
});
