import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect } from "react";

import { goUnlessBrowserDid, historyTracker, useHistoryNav } from "@/lib/history";
import { useI18n } from "@/lib/i18n";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const KEYS = isMac ? { back: "⌘[", forward: "⌘]" } : { back: "Alt+←", forward: "Alt+→" };

/** Browser-style Back and Forward: the installed app's window has no buttons of its own. Arrows mirror in Arabic. */
export function NavButtons() {
  const { t } = useI18n();
  const { canGoBack, canGoForward, back, forward } = useHistoryNav();
  return (
    <div className="nav-buttons">
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={back} disabled={!canGoBack} aria-label={t("nav.back")} title={t("nav.backHint", { keys: KEYS.back })}>
        <ArrowLeft className="dir-icon" />
      </button>
      <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={forward} disabled={!canGoForward} aria-label={t("nav.forward")} title={t("nav.forwardHint", { keys: KEYS.forward })}>
        <ArrowRight className="dir-icon" />
      </button>
    </div>
  );
}

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select, [contenteditable]"));

/**
 * The browser's own shortcuts (⌘[ ⌘] and ⌘← ⌘→ on a Mac, Alt+← Alt+→ elsewhere) and mouse side buttons,
 * also in an installed window. Never while typing (they move the cursor there) or while a dialog is open.
 * If the browser handles a press itself, the page has changed by the time we'd act, so nothing happens twice.
 */
export function useNavShortcuts() {
  useEffect(() => {
    const busy = (target: EventTarget | null) => typing(target) || document.querySelector("dialog[open]") !== null;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.shiftKey || event.ctrlKey || busy(event.target)) return;
      let direction: "back" | "forward" | null = null;
      if (isMac && event.metaKey && !event.altKey) {
        if (event.key === "[" || event.code === "BracketLeft" || event.key === "ArrowLeft") direction = "back";
        else if (event.key === "]" || event.code === "BracketRight" || event.key === "ArrowRight") direction = "forward";
      } else if (!isMac && event.altKey && !event.metaKey) {
        if (event.key === "ArrowLeft") direction = "back";
        else if (event.key === "ArrowRight") direction = "forward";
      }
      if (!direction) return;
      // Stops the browser doing it too where it can; goUnlessBrowserDid covers the browsers that can't be stopped.
      event.preventDefault();
      goUnlessBrowserDid(direction);
    };
    // Mouse buttons 4 and 5 (side buttons). Chrome and Edge usually go back themselves (on press or on
    // release); Safari doesn't. Counting from the press catches a browser that already went on press.
    let pressedAt: number | null = null;
    const onPress = (event: MouseEvent) => {
      if (event.button === 3 || event.button === 4) pressedAt = historyTracker().moves();
    };
    const onRelease = (event: MouseEvent) => {
      if ((event.button !== 3 && event.button !== 4) || pressedAt === null) return;
      const since = pressedAt;
      pressedAt = null;
      if (!busy(event.target)) goUnlessBrowserDid(event.button === 3 ? "back" : "forward", { since });
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPress);
    window.addEventListener("mouseup", onRelease);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPress);
      window.removeEventListener("mouseup", onRelease);
    };
  }, []);
}
