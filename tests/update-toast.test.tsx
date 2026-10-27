// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UpdateToast from "@/components/update-toast";
import { DATA_TABLES, db } from "@/lib/db";
import { I18nProvider } from "@/lib/i18n";
import { LAST_BACKUP_KEY } from "@/lib/settings";

// The service worker only exists in the built app, so its hook is replaced: a new version is waiting.
const sw = vi.hoisted(() => ({ updateServiceWorker: vi.fn(async (_reload?: boolean) => {}), setNeedRefresh: vi.fn() }));
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({ needRefresh: [true, sw.setNeedRefresh], offlineReady: [false, () => {}], updateServiceWorker: sw.updateServiceWorker }),
}));

const events: string[] = [];
const picker = window as Window & { showSaveFilePicker?: () => Promise<never> };

beforeEach(async () => {
  events.length = 0;
  sw.updateServiceWorker.mockReset().mockImplementation(async () => void events.push("reload"));
  sw.setNeedRefresh.mockReset();
  await Promise.all([...DATA_TABLES.map((name) => db.table(name).clear()), db.meta.clear()]);
  // jsdom can't download: the backup's download link is recorded instead.
  URL.createObjectURL = () => "blob:backup";
  URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    events.push(`download ${this.download}`);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete picker.showSaveFilePicker;
});

const renderToast = () =>
  render(
    <I18nProvider initialLang="en" hour12>
      <UpdateToast />
    </I18nProvider>
  );

describe("update prompt", () => {
  it("says the data stays, and offers a backup before reloading", () => {
    renderToast();
    expect(screen.getByText("A new version of Tutorcat Desk is ready.")).toBeTruthy();
    expect(screen.getByText("Your data stays; a backup is just in case.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back up first" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Later" })).toBeTruthy();
  });

  it("Back up first saves the backup file, then reloads into the new version", async () => {
    renderToast();
    await act(async () => screen.getByRole("button", { name: "Back up first" }).click());
    await waitFor(() => expect(sw.updateServiceWorker).toHaveBeenCalledWith(true));
    expect(events).toEqual([expect.stringMatching(/^download tutorcat-desk-backup-\d{4}-\d{2}-\d{2}\.json$/), "reload"]);
    expect((await db.meta.get(LAST_BACKUP_KEY))?.value).toBeTruthy();
  });

  it("doesn't reload if the tutor closes the Save window", async () => {
    picker.showSaveFilePicker = () => Promise.reject(new DOMException("closed", "AbortError"));
    renderToast();
    await act(async () => screen.getByRole("button", { name: "Back up first" }).click());
    await waitFor(() => expect((screen.getByRole("button", { name: "Back up first" }) as HTMLButtonElement).disabled).toBe(false));
    expect(sw.updateServiceWorker).not.toHaveBeenCalled();
    expect(screen.getByText("A new version of Tutorcat Desk is ready.")).toBeTruthy();
  });

  it("Reload updates straight away and Later hides the prompt", async () => {
    renderToast();
    await act(async () => screen.getByRole("button", { name: "Reload" }).click());
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true);
    expect(events).toEqual(["reload"]);
    await act(async () => screen.getByRole("button", { name: "Later" }).click());
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
