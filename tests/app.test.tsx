// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { App } from "@/App";
import { TUTORCAT_FOR_TUTORS, WELCOMED_STORAGE_KEY } from "@/components/first-run";
import { saveStudent } from "@/lib/actions";
import { exportBackup, readBackupFile } from "@/lib/backup";
import { DATA_TABLES, db } from "@/lib/db";
import { createTranslator, loadCatalog } from "@/lib/i18n";
import { loadSampleData } from "@/lib/sample";
import { LAST_BACKUP_KEY, saveSettings } from "@/lib/settings";
import { THEME_STORAGE_KEY } from "@/lib/theme";

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

const wipe = () => Promise.all([...DATA_TABLES.map((name) => db.table(name).clear()), db.meta.clear()]);

beforeEach(async () => {
  window.location.hash = "#/";
  window.localStorage.clear();
  await wipe();
});

afterEach(cleanup);

const welcomed = () => window.localStorage.setItem(WELCOMED_STORAGE_KEY, "1");

/** A backup file of the sample data, as a tutor would pick it; the database is empty again afterwards. */
async function sampleBackupFile(extra: object = {}) {
  await saveSettings({ tutorName: "Tutor T." });
  await loadSampleData(createTranslator("en"));
  const file = new File([JSON.stringify({ ...(await exportBackup()), ...extra })], "tutorcat-desk-backup-2026-10-01.json", { type: "application/json" });
  await wipe();
  return file;
}

const pickFile = async (container: HTMLElement, file: File) => {
  const input = await waitFor(() => {
    const found = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!found) throw new Error("no file input yet");
    return found;
  });
  await act(async () => void fireEvent.change(input, { target: { files: [file] } }));
};

/** jsdom can't download: collects what "Back up" saves instead. */
function catchDownloads() {
  const files: Blob[] = [];
  const names: string[] = [];
  URL.createObjectURL = (blob: Blob) => (files.push(blob), "blob:backup");
  URL.revokeObjectURL = () => {};
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    names.push(this.download);
  };
  return { files, names, restore: () => void (HTMLAnchorElement.prototype.click = click) };
}

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

  it("restores a backup from the welcome screen, then opens Today", async () => {
    const file = await sampleBackupFile({ prefs: { lang: null, theme: "dark" } });
    const { container } = render(<App initialLang="en" />);
    expect(await screen.findByText("Moving from another laptop or updating? Restore your backup and everything comes back.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Restore from a backup" })).toBeTruthy();

    await pickFile(container, file);
    // What's in the file, before anything is replaced.
    expect(await screen.findByText("Restore this backup?")).toBeTruthy();
    const summary = container.querySelector(".restore-summary")!;
    expect(summary.textContent).toContain("Tutor T.");
    expect(summary.textContent).toMatch(/Students2Lessons\d+Invoices\d+/);
    expect(summary.textContent).toContain("App versiontest");

    await act(async () => screen.getByRole("button", { name: "Restore" }).click());
    expect(await screen.findByText(/You're looking at sample data/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Welcome to Tutorcat Desk" })).toBeNull();
    expect(window.localStorage.getItem(WELCOMED_STORAGE_KEY)).toBe("1");
    expect(await db.students.count()).toBe(2);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    // No "you haven't backed up" reminder straight after restoring.
    expect((await db.meta.get(LAST_BACKUP_KEY))?.value).toBeTruthy();
    expect(screen.queryByText(/You haven't backed up yet/)).toBeNull();
  });

  it("offers to back up this device's own data before a restore replaces it", async () => {
    const file = await sampleBackupFile();
    await saveStudent({ name: "Own S.", parentName: "", phone: "", email: "", timeZone: "Asia/Dubai", messageLang: "en", curriculum: "", level: "", subjects: "", rate: 0, currency: "AED", mode: "online", location: "", tone: "sage", notes: "" });
    welcomed();
    window.location.hash = "#/settings";
    const downloads = catchDownloads();
    try {
      const { container } = render(<App initialLang="en" />);
      expect(await screen.findByRole("heading", { name: "Updating or moving to another laptop" })).toBeTruthy();
      await pickFile(container, file);
      expect(await screen.findByText("Replace everything with this backup?")).toBeTruthy();
      await act(async () => screen.getByRole("button", { name: "Back up first, then restore" }).click());

      await waitFor(() => expect(downloads.names).toEqual([expect.stringMatching(/^tutorcat-desk-backup-\d{4}-\d{2}-\d{2}\.json$/)]));
      // The file saved first holds what was here; then the backup replaced it.
      const saved = await readBackupFile(downloads.files[0]!);
      expect(saved.students.map((student) => (student as { name: string }).name)).toEqual(["Own S."]);
      await waitFor(async () => expect((await db.students.toArray()).some((student) => student.name === "Own S.")).toBe(false));
      expect(await db.students.count()).toBe(2);
    } finally {
      downloads.restore();
    }
  });

  it("replaces nothing if the tutor closes the Save window when backing up first", async () => {
    const file = await sampleBackupFile();
    await saveStudent({ name: "Own S.", parentName: "", phone: "", email: "", timeZone: "Asia/Dubai", messageLang: "en", curriculum: "", level: "", subjects: "", rate: 0, currency: "AED", mode: "online", location: "", tone: "sage", notes: "" });
    welcomed();
    window.location.hash = "#/settings";
    const picker = window as Window & { showSaveFilePicker?: () => Promise<never> };
    picker.showSaveFilePicker = () => Promise.reject(new DOMException("closed", "AbortError"));
    try {
      const { container } = render(<App initialLang="en" />);
      await pickFile(container, file);
      const backUpFirst = await screen.findByRole("button", { name: "Back up first, then restore" });
      await act(async () => backUpFirst.click());
      await waitFor(() => expect(screen.queryByText("Replace everything with this backup?")).toBeNull());
      expect((await db.students.toArray()).map((student) => student.name)).toEqual(["Own S."]);
    } finally {
      delete picker.showSaveFilePicker;
    }
  });
});
