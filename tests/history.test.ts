// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createHistoryTracker, goUnlessBrowserDid, HISTORY_STORAGE_KEY } from "@/lib/history";

// jsdom has no Navigation API, so these run the Safari path: numbered history entries.
const go = async (hash: string) => {
  window.location.hash = hash;
  await new Promise((resolve) => setTimeout(resolve, 0));
};
const traverse = async (step: () => void) => {
  const moved = new Promise((resolve) => window.addEventListener("popstate", resolve, { once: true }));
  step();
  await moved;
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("Back and Forward (numbered history entries)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState(null, "");
  });

  it("can't go either way on the first page", () => {
    const tracker = createHistoryTracker(window);
    expect(tracker.getSnapshot()).toEqual({ canGoBack: false, canGoForward: false });
    expect(window.history.state).toMatchObject({ idx: 0 });
  });

  it("goes back and forward through pages opened with links", async () => {
    const tracker = createHistoryTracker(window);
    const changes = vi.fn();
    tracker.subscribe(changes);
    await go("#/schedule");
    await go("#/students");
    expect(tracker.getSnapshot()).toEqual({ canGoBack: true, canGoForward: false });
    expect(changes).toHaveBeenCalled();

    await traverse(tracker.back);
    expect(window.location.hash).toBe("#/schedule");
    expect(tracker.getSnapshot()).toEqual({ canGoBack: true, canGoForward: true });

    await traverse(tracker.back);
    expect(tracker.getSnapshot()).toEqual({ canGoBack: false, canGoForward: true });

    await traverse(tracker.forward);
    await traverse(tracker.forward);
    expect(window.location.hash).toBe("#/students");
    expect(tracker.getSnapshot()).toEqual({ canGoBack: true, canGoForward: false });
  });

  it("drops the forward pages when a new page opens after going back", async () => {
    const tracker = createHistoryTracker(window);
    await go("#/a");
    await go("#/b");
    await traverse(tracker.back);
    await go("#/c");
    expect(tracker.getSnapshot()).toEqual({ canGoBack: true, canGoForward: false });
  });

  it("keeps its place after a reload", async () => {
    const first = createHistoryTracker(window);
    await go("#/one");
    await go("#/two");
    await traverse(first.back);
    expect(JSON.parse(window.sessionStorage.getItem(HISTORY_STORAGE_KEY)!)).toMatchObject({ max: expect.any(Number) });
    // A reload keeps history.state and sessionStorage; a new tracker reads them.
    const reloaded = createHistoryTracker(window);
    expect(reloaded.getSnapshot()).toEqual({ canGoBack: true, canGoForward: true });
  });

  it("works when sessionStorage is blocked", () => {
    const blocked = {
      history: window.history,
      addEventListener: window.addEventListener.bind(window),
      get sessionStorage(): Storage {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    expect(() => createHistoryTracker(blocked as unknown as Window)).not.toThrow();
  });
});

describe("Back and Forward (Navigation API)", () => {
  it("follows the browser's own canGoBack and canGoForward", () => {
    const navigation = Object.assign(new EventTarget(), { canGoBack: false, canGoForward: false });
    const history = { back: vi.fn(), forward: vi.fn() };
    const tracker = createHistoryTracker({ navigation, history, addEventListener: () => {} } as unknown as Window);
    expect(tracker.getSnapshot()).toEqual({ canGoBack: false, canGoForward: false });
    tracker.back();
    expect(history.back).not.toHaveBeenCalled();

    navigation.canGoBack = true;
    navigation.dispatchEvent(new Event("currententrychange"));
    expect(tracker.getSnapshot()).toEqual({ canGoBack: true, canGoForward: false });
    tracker.back();
    expect(history.back).toHaveBeenCalledTimes(1);
  });
});

describe("shortcuts", () => {
  afterEach(() => vi.useRealTimers());

  const fakeTracker = () => {
    const navigation = Object.assign(new EventTarget(), { canGoBack: true, canGoForward: true });
    const history = { back: vi.fn(), forward: vi.fn() };
    const tracker = createHistoryTracker({ navigation, history, addEventListener: () => {} } as unknown as Window);
    return { navigation, history, tracker };
  };

  it("goes back itself when the browser didn't", () => {
    vi.useFakeTimers();
    const { history, tracker } = fakeTracker();
    goUnlessBrowserDid("back", { store: tracker });
    vi.advanceTimersByTime(200);
    expect(history.back).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the browser already went, so one press never moves two pages", () => {
    vi.useFakeTimers();
    const { navigation, history, tracker } = fakeTracker();
    goUnlessBrowserDid("back", { store: tracker });
    navigation.dispatchEvent(new Event("currententrychange"));
    vi.advanceTimersByTime(200);
    expect(history.back).not.toHaveBeenCalled();
  });
});
