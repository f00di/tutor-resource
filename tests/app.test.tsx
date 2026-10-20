// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { act, render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
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
  await Promise.all([...DATA_TABLES.map((name) => db.table(name).clear()), db.meta.clear()]);
});

describe("app", () => {
  it("welcomes a new tutor on the Today page", async () => {
    render(<App initialLang="en" />);
    expect(await screen.findByRole("heading", { name: "Welcome to Tutorcat Desk" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Schedule/ }).length).toBeGreaterThan(0);
  });

  it("shows sample students after loading sample data", async () => {
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
    expect(await screen.findByRole("heading", { name: "مرحبًا بك في Tutorcat Desk" })).toBeTruthy();
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("ar");
  });
});
