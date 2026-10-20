import { X } from "lucide-react";
import { useEffect, useId, useRef, type FormEvent, type ReactNode } from "react";

import { useI18n } from "@/lib/i18n";
import { DIALOG_OPENED } from "./top-layer";

type Props = {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  /** With onSubmit the body and footer are a <form>; Enter in a field submits it. */
  onSubmit?: () => void;
  footer?: ReactNode;
  size?: "narrow" | "wide";
  children: ReactNode;
};

/**
 * A modal on the native <dialog>: focus stays inside, Esc closes, and it sits above everything.
 * Mount it to open, unmount to close (DialogHost does this), so every opening starts fresh.
 */
export function Dialog({ title, description, onClose, onSubmit, footer, size, children }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closing = useRef(onClose);
  closing.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) {
      // A question over another dialog keeps that dialog's dimming instead of adding a second layer
      // (two dark backdrops made the screen go almost black).
      if (document.querySelector("dialog[open]")) dialog.dataset["stacked"] = "";
      dialog.showModal();
      window.dispatchEvent(new Event(DIALOG_OPENED));
    }
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit?.();
  };

  const body = (
    <>
      <div className="dialog-body">{children}</div>
      {footer && <div className="dialog-foot">{footer}</div>}
    </>
  );

  return (
    <dialog
      ref={ref}
      className={`dialog ${size ?? ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        closing.current();
      }}
    >
      <div className="dialog-head">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => closing.current()} aria-label={t("common.close")}>
          <X />
        </button>
      </div>
      {onSubmit ? (
        <form onSubmit={submit} style={{ display: "contents" }}>
          {body}
        </form>
      ) : (
        body
      )}
    </dialog>
  );
}
