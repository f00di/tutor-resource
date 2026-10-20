// Back and Forward for the installed app, whose window has no browser buttons. Chrome and Edge have
// the Navigation API, which says whether each way is possible. Elsewhere (Safari) every history entry
// gets a number in history.state, so the app knows how far back and forward the tutor can go; the
// numbers are kept in sessionStorage too, so they survive a reload.
import { useSyncExternalStore } from "react";

export interface HistorySnapshot {
  canGoBack: boolean;
  canGoForward: boolean;
}

interface NavigationLike extends EventTarget {
  canGoBack: boolean;
  canGoForward: boolean;
}

type HistoryWindow = Pick<Window, "history" | "addEventListener"> & {
  navigation?: NavigationLike;
  sessionStorage?: Storage;
};

export const HISTORY_STORAGE_KEY = "tutorcat-desk.history";
const isIndex = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;

export function createHistoryTracker(win: HistoryWindow = window) {
  const listeners = new Set<() => void>();
  let snapshot: HistorySnapshot = { canGoBack: false, canGoForward: false };
  // Counts page changes, so a shortcut can tell whether the browser already went back by itself.
  let moves = 0;

  const publish = (next: HistorySnapshot) => {
    if (next.canGoBack === snapshot.canGoBack && next.canGoForward === snapshot.canGoForward) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  const navigation = win.navigation;
  if (navigation && typeof navigation.canGoBack === "boolean") {
    const read = () => {
      moves += 1;
      publish({ canGoBack: navigation.canGoBack, canGoForward: navigation.canGoForward });
    };
    read();
    navigation.addEventListener("currententrychange", read);
  } else {
    let index = 0;
    let max = 0;
    const stateIndex = (): number | null => {
      const state: unknown = win.history.state;
      const value = state && typeof state === "object" ? (state as { idx?: unknown }).idx : undefined;
      return isIndex(value) ? value : null;
    };
    const tag = (value: number) => {
      const state: unknown = win.history.state;
      win.history.replaceState({ ...(state && typeof state === "object" ? state : {}), idx: value }, "");
    };
    const save = () => {
      try {
        win.sessionStorage?.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ idx: index, max }));
      } catch {
        // Storage blocked: the buttons still work until the next reload.
      }
    };
    const saved = (): { idx: number; max: number } | null => {
      try {
        const value: unknown = JSON.parse(win.sessionStorage?.getItem(HISTORY_STORAGE_KEY) ?? "null");
        const { idx, max: savedMax } = (value ?? {}) as { idx?: unknown; max?: unknown };
        return isIndex(idx) && isIndex(savedMax) ? { idx, max: savedMax } : null;
      } catch {
        return null;
      }
    };
    const update = () => {
      save();
      publish({ canGoBack: index > 0, canGoForward: index < max });
    };

    // Opening the app: a reload keeps its number; a fresh entry comes after the last one we knew.
    const known = saved();
    const tagged = stateIndex();
    if (tagged !== null) {
      index = tagged;
      max = Math.max(tagged, known?.max ?? tagged);
    } else {
      index = known ? known.idx + 1 : 0;
      max = index;
      tag(index);
    }
    update();

    const sync = () => {
      moves += 1;
      const current = stateIndex();
      if (current === null) {
        // A new page (a link or navigate()): it's one further on, and nothing is ahead of it any more.
        index += 1;
        max = index;
        tag(index);
      } else {
        // Back or Forward.
        index = current;
        max = Math.max(max, current);
      }
      update();
    };
    win.addEventListener("hashchange", sync);
    win.addEventListener("popstate", sync);
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    back: () => {
      if (snapshot.canGoBack) win.history.back();
    },
    forward: () => {
      if (snapshot.canGoForward) win.history.forward();
    },
    /** How many page changes so far. */
    moves: () => moves,
  };
}

export type HistoryTracker = ReturnType<typeof createHistoryTracker>;

let tracker: HistoryTracker | null = null;
export const historyTracker = (): HistoryTracker => (tracker ??= createHistoryTracker());

const SERVER_SNAPSHOT: HistorySnapshot = { canGoBack: false, canGoForward: false };

export function useHistoryNav() {
  const store = historyTracker();
  const { canGoBack, canGoForward } = useSyncExternalStore(store.subscribe, store.getSnapshot, () => SERVER_SNAPSHOT);
  return { canGoBack, canGoForward, back: store.back, forward: store.forward };
}

/**
 * For keyboard shortcuts and mouse side buttons: the browser may already handle them (Chrome and Edge do
 * in a tab, and often in an installed window). Wait a moment, and only go if the page hasn't changed by
 * then, so one press never moves two pages.
 */
export function goUnlessBrowserDid(direction: "back" | "forward", { store = historyTracker(), since = store.moves(), delay = 150 }: { store?: HistoryTracker; since?: number; delay?: number } = {}) {
  window.setTimeout(() => {
    if (store.moves() !== since) return;
    if (direction === "back") store.back();
    else store.forward();
  }, delay);
}
