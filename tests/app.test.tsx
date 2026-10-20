// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { TUTORCAT_FOR_TUTORS, WELCOMED_STORAGE_KEY } from "@/components/first-run";
import { DATA_TABLES, db } from "@/lib/db";
import { loadCatalog } from "@/lib/i18n";

beforeAll(() => {
  // jsdom has no matchMedia, scrolling or <dialog>; the app only needs these to exist.
  window.scrollTo = () => {};
  window.matchMedia ??= ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, onchange: null, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

beforeEach(async () => {
  window.location.hash = "#/";
  window.localStorage.clear();
  await Promise.all([...DATA_TABLES.map((name) => db.table(name).clear()), db.meta.clear()]);
});

afterEach(cleanup);

const welcomed = () => window.localStorage.setItem(WELCOMED_STORAGE_KEY, "1");

describe("app", () => {
  it("shows the welcome screen once, then the app", async () => {
    const { unmount } = render(<App initialLang="en" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Welcome to Tutorcat Desk" })).toBeTruthy();
    expect(screen.getByText(/free for tutors listed on Tutorcat/)).toBeTruthy();
    const apply = screen.getByRole("link", { name: /Apply on Tutorcat/ });
    expect(apply.getAttribute("href")).toBe(TUTORCAT_FOR_TUTORS);
    expect(apply.getAttribute("target")).toBe("_blank");
    expect(screen.getByRole("heading", { name: "Your data stays on this device" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try it with sample data" })).toBeTruthy();

    await act(async () => screen.getByRole("button", { name: "Get started" }).click());
    expect(await screen.findByRole("heading", { name: "Getting started" })).toBeTruthy();
    expect(window.localStorage.getItem(WELCOMED_STORAGE_KEY)).toBe("1");

    unmount();
    render(<App initialLang="en" />);
    expect(await screen.findByRole("heading", { name: "Getting started" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Welcome to Tutorcat Desk" })).toBeNull();
  });

  it("starts the sample data from the welcome screen", async () => {
    render(<App initialLang="en" />);
    const button = await screen.findByRole("button", { name: "Try it with sample data" });
    await act(async () => button.click());
    expect(await screen.findByText(/You're looking at sample data/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Welcome to Tutorcat Desk" })).toBeNull();
    expect(window.localStorage.getItem(WELCOMED_STORAGE_KEY)).toBe("1");
  });

  it("guides a new tutor on the Today page", async () => {
    welcomed();
    render(<App initialLang="en" />);
    expect(await screen.findByRole("heading", { name: "Getting started" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Schedule/ }).length).toBeGreaterThan(0);
  });

  it("shows sample students after loading sample data", async () => {
    welcomed();
    render(<App initialLang="en" />);
    const button = await screen.findByRole("button", { name: "Try it with sample data" });
    await act(async () => button.click());
    expect(await screen.findByText(/You're looking at sample data/)).toBeTruthy();
    await act(async () => {
      window.location.hash = "#/students";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(await screen.findByText("Omar K.")).toBeTruthy();
  });

  it("runs right-to-left in Arabic", async () => {
    await loadCatalog("ar");
    render(<App initialLang="ar" />);
    expect(await screen.findByRole("heading", { level: 1, name: "مرحبًا بك في Tutorcat Desk" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ابدأ" })).toBeTruthy();
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });
});
