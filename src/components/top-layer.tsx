import { useLayoutEffect, useRef, type ReactNode } from "react";

/** Sent by <Dialog> when it opens, so toasts move back above it. */
export const DIALOG_OPENED = "tutorcat-desk:dialog-opened";

type PopoverElement = HTMLDivElement & { showPopover?: () => void; hidePopover?: () => void };

/**
 * A message in the browser's top layer (a popover), so it stays visible above an open dialog. Where
 * popovers aren't supported it's a normal fixed element. Used by toasts, the update prompt and error notices.
 */
export function TopLayer({ className, role = "status", children }: { className: string; role?: "status" | "alert"; children: ReactNode }) {
  const ref = useRef<PopoverElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element?.showPopover) return;
    // The top layer stacks in opening order: showing it again puts it above a dialog opened since.
    const raise = () => {
      try {
        if (element.matches(":popover-open")) element.hidePopover?.();
        element.showPopover?.();
      } catch {
        // Not connected any more, or no popover support.
      }
    };
    raise();
    window.addEventListener(DIALOG_OPENED, raise);
    return () => window.removeEventListener(DIALOG_OPENED, raise);
  }, []);
  return (
    <div ref={ref} className={className} role={role} {...({ popover: "manual" } as object)}>
      {children}
    </div>
  );
}
