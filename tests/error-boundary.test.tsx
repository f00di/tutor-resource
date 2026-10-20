// @vitest-environment jsdom
import "fake-indexeddb/auto";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/App";
import { ErrorBoundary, ErrorNotice } from "@/components/error-boundary";
import { DATA_TABLES, db } from "@/lib/db";
import { dismissReportedError, isChunkError, listenForErrors, reportError } from "@/lib/errors";
import { I18nProvider } from "@/lib/i18n";

function Broken({ error }: { error: Error }): never {
  throw error;
}

beforeAll(() => {
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
  document.documentElement.lang = "en";
  document.documentElement.dir = "ltr";
  dismissReportedError();
  // React logs caught errors; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
  await Promise.all([...DATA_TABLES.map((name) => db.table(name).clear()), db.meta.clear()]);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("error boundary", () => {
  it("shows what happened instead of a blank window", () => {
    render(
      <ErrorBoundary scope="app">
        <Broken error={new RangeError("Invalid time value")} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("heading", { name: "Tutorcat Desk hit a problem" })).toBeTruthy();
    expect(screen.getByText("Invalid time value")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go to Today" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy error details" })).toBeTruthy();
  });

  it("copies the details to the clipboard only", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    render(
      <ErrorBoundary scope="page">
        <Broken error={new Error("Boom")} />
      </ErrorBoundary>
    );
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy error details" })));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Error: Boom"));
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
  });

  it("offers to reload when a file of a newer version failed to load", () => {
    render(
      <ErrorBoundary scope="page">
        <Broken error={new TypeError("Failed to fetch dynamically imported module: /tutor-resource/assets/schedule-abc.js")} />
      </ErrorBoundary>
    );
    expect(screen.getByRole("heading", { name: "A new version of Tutorcat Desk is ready." })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload" })).toBeTruthy();
  });

  it("speaks Arabic when the app does", async () => {
    const { loadCatalog } = await import("@/lib/i18n");
    await loadCatalog("ar");
    render(
      <I18nProvider initialLang="ar" hour12>
        <ErrorBoundary scope="page">
          <Broken error={new Error("Boom")} />
        </ErrorBoundary>
      </I18nProvider>
    );
    expect(screen.getByRole("heading", { name: "حدثت مشكلة في هذه الصفحة" })).toBeTruthy();
  });

  it("keeps the rest of the app when a page fails, and starts fresh on another page", () => {
    const { rerender } = render(
      <>
        <nav>Menu</nav>
        <ErrorBoundary key="#/schedule" scope="page">
          <Broken error={new Error("Boom")} />
        </ErrorBoundary>
      </>
    );
    expect(screen.getByText("Menu")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "This page hit a problem" })).toBeTruthy();
    rerender(
      <>
        <nav>Menu</nav>
        <ErrorBoundary key="#/students" scope="page">
          <p>Students</p>
        </ErrorBoundary>
      </>
    );
    expect(screen.getByText("Students")).toBeTruthy();
  });

  it("Go to Today opens Today and tries again", async () => {
    window.location.hash = "#/schedule";
    let fail = true;
    function Flaky() {
      if (fail) throw new Error("Once");
      return <p>Working again</p>;
    }
    render(
      <ErrorBoundary scope="page">
        <Flaky />
      </ErrorBoundary>
    );
    fail = false;
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Go to Today" })));
    expect(window.location.hash).toBe("#/");
    expect(screen.getByText("Working again")).toBeTruthy();
  });
});

describe("the lesson dialog with no students", () => {
  it("asks for a student first instead of crashing (the blank-window bug)", async () => {
    render(<App initialLang="en" />);
    const add = await screen.findAllByRole("button", { name: "Add lesson" });
    await act(async () => fireEvent.click(add[0]!));
    expect(await screen.findByText("Add a student first")).toBeTruthy();
    expect(screen.queryByText("Tutorcat Desk hit a problem")).toBeNull();
  });
});

describe("errors outside drawing", () => {
  it("are recognised as a new version when a file failed to load", () => {
    expect(isChunkError(new TypeError("Failed to fetch dynamically imported module: x.js"))).toBe(true);
    expect(isChunkError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkError(new RangeError("Invalid time value"))).toBe(false);
  });

  it("show a notice for a failed promise, and none for a cancelled one", async () => {
    const stop = listenForErrors(window);
    render(
      <I18nProvider initialLang="en" hour12>
        <ErrorNotice />
      </I18nProvider>
    );
    await act(async () => {
      const cancelled = new Event("unhandledrejection") as PromiseRejectionEvent;
      Object.assign(cancelled, { reason: new DOMException("cancelled", "AbortError") });
      window.dispatchEvent(cancelled);
    });
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => reportError(new Error("QuotaExceededError")));
    expect(screen.getByRole("alert").textContent).toContain("Something went wrong");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Close" })));
    expect(screen.queryByRole("alert")).toBeNull();
    stop();
  });
});
