// Light/dark: follows the system until the tutor picks one. The boot script in index.html applies it
// before the first paint; this keeps every toggle on the page in step.
import { useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "light" | "dark";
export const THEME_STORAGE_KEY = "tutorcat-desk.theme";

const listeners = new Set<() => void>();
const isDark = () => document.documentElement.classList.contains("dark");

const storedChoice = (): ThemeChoice => {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
};

const apply = (dark: boolean) => {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  listeners.forEach((listener) => listener());
};

if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
    if (storedChoice() === "system") apply(event.matches);
  });
}

export function setThemeChoice(next: ThemeChoice) {
  try {
    if (next === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Storage blocked: the choice lasts for this visit only.
  }
  apply(next === "dark" || (next === "system" && (window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false)));
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useTheme() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  return { dark, choice: storedChoice(), setChoice: setThemeChoice, toggle: () => setThemeChoice(dark ? "light" : "dark") };
}
