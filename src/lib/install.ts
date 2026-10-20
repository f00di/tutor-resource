// "Install app": Chrome and Edge (Windows and macOS) offer a one-click install; Safari on macOS uses
// File → Add to Dock, and phones use Add to Home Screen. Once installed, the app opens in its own window.
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export const isInstalled = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export type InstallHint = "safari-mac" | "ios" | "other";
export function installHint(): InstallHint {
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(agent)) return "ios";
  if (/Macintosh/.test(agent) && /Safari/.test(agent) && !/Chrome|Chromium|Edg\//.test(agent)) return "safari-mac";
  return "other";
}

export function useInstall() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((tick) => tick + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return {
    installed: isInstalled(),
    canPrompt: deferred !== null,
    install: async () => {
      if (!deferred) return false;
      const prompt = deferred;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      deferred = null;
      notify();
      return outcome === "accepted";
    },
  };
}
