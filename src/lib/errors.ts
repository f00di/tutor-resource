// What happens when something goes wrong: error boundaries (components/error-boundary.tsx) catch
// drawing errors, and this file keeps the latest problem from outside drawing (a failed save, a file
// that didn't load after an update) so the app can say so instead of silently doing nothing.
// Error details only ever go to the tutor's clipboard: nothing is sent anywhere.
import { useSyncExternalStore } from "react";

export const messageOf = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
};

/** A lazy-loaded file (the calendar, the Arabic text) couldn't load: usually a new version replaced it. */
export const isChunkError = (error: unknown): boolean =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk .* failed|ChunkLoadError/i.test(messageOf(error));

/** Plain text for "Copy error details": what failed and where, never the tutor's data. */
export function errorDetails(error: unknown, componentStack?: string | null): string {
  const lines = [
    `Tutorcat Desk ${__APP_VERSION__}`,
    `Time: ${new Date().toISOString()}`,
    `Page: ${window.location.hash || "#/"}`,
    `Browser: ${navigator.userAgent}`,
    "",
    messageOf(error),
  ];
  if (error instanceof Error && error.stack) lines.push("", error.stack);
  if (componentStack) lines.push("", `Components:${componentStack}`);
  return lines.join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No clipboard access (older browser or not allowed): the old way.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch {
      copied = false;
    }
    area.remove();
    return copied;
  }
}

/** Reload, first switching to a new version if one is waiting, so the reload doesn't bring the old files back. */
export async function reloadApp(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.waiting) {
      navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => window.location.reload(), 3000);
      return;
    }
  } catch {
    // No service worker (development, or blocked): a plain reload.
  }
  window.location.reload();
}

/* The latest problem from outside drawing, shown by <ErrorNotice>. */

let reported: { error: unknown } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export function reportError(error: unknown) {
  reported = { error };
  emit();
}

export function dismissReportedError() {
  reported = null;
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useReportedError = () => useSyncExternalStore(subscribe, () => reported, () => null);

// Not problems: a cancelled share or file picker, and the browser's harmless ResizeObserver note.
const ignored = (error: unknown) => (error instanceof DOMException && error.name === "AbortError") || /ResizeObserver loop/.test(messageOf(error));

/** Reports errors nothing else caught: failed promises, errors in click handlers, files that didn't load. */
export function listenForErrors(target: Window = window): () => void {
  const onRejection = (event: PromiseRejectionEvent) => {
    if (!ignored(event.reason)) reportError(event.reason);
  };
  const onError = (event: ErrorEvent) => {
    if (event.error instanceof Error && !ignored(event.error)) reportError(event.error);
  };
  target.addEventListener("unhandledrejection", onRejection);
  target.addEventListener("error", onError);
  return () => {
    target.removeEventListener("unhandledrejection", onRejection);
    target.removeEventListener("error", onError);
  };
}
