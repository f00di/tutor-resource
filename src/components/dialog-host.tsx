// One place that opens the app's dialogs (lesson, student, note, blackout, package, new invoice),
// plus "ask" (a question with buttons), "confirm" and short toasts. Any page can open any dialog,
// and a dialog can open another on top (e.g. "New student" from inside a lesson).
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { useI18n } from "@/lib/i18n";
import type { BlackoutDraft } from "@/lib/actions";
import { BlackoutDialog } from "./blackout-dialog";
import { Dialog } from "./dialog";
import { LessonDialog } from "./lesson-dialog";
import { NewInvoiceDialog } from "./new-invoice-dialog";
import { NoteDialog } from "./note-dialog";
import { PackageDialog } from "./package-dialog";
import { StudentDialog } from "./student-dialog";

export interface AskOption<T extends string> {
  value: T;
  label: string;
  tone?: "primary" | "danger" | "outline";
}
interface AskRequest<T extends string> {
  title: string;
  body?: ReactNode;
  options: Array<AskOption<T>>;
  cancelLabel?: string;
}

export interface LessonTarget {
  id?: string;
  start?: number;
  end?: number;
  studentId?: string;
}
export interface StudentTarget {
  id?: string;
  onSaved?: (id: string) => void;
}
export interface NoteTarget {
  id?: string;
  date?: string;
  studentId?: string;
}
export interface BlackoutTarget {
  id?: string;
  draft?: Partial<BlackoutDraft>;
}
export interface InvoiceTarget {
  studentId?: string;
  packageId?: string;
}
export interface PackageTarget {
  studentId: string;
  id?: string;
}

interface DialogApi {
  openLesson: (target?: LessonTarget) => void;
  openStudent: (target?: StudentTarget) => void;
  openNote: (target?: NoteTarget) => void;
  openBlackout: (target?: BlackoutTarget) => void;
  openNewInvoice: (target?: InvoiceTarget) => void;
  openPackage: (target: PackageTarget) => void;
  ask: <T extends string>(request: AskRequest<T>) => Promise<T | null>;
  confirm: (request: { title: string; body?: ReactNode; confirmLabel: string; danger?: boolean }) => Promise<boolean>;
  toast: (message: string) => void;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialogs(): DialogApi {
  const value = useContext(DialogContext);
  if (!value) throw new Error("useDialogs must be used inside <DialogHost>");
  return value;
}

type Asking = { request: AskRequest<string>; resolve: (value: string | null) => void };

export function DialogHost({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [lesson, setLesson] = useState<LessonTarget | null>(null);
  const [student, setStudent] = useState<StudentTarget | null>(null);
  const [note, setNote] = useState<NoteTarget | null>(null);
  const [blackout, setBlackout] = useState<BlackoutTarget | null>(null);
  const [invoice, setInvoice] = useState<InvoiceTarget | null>(null);
  const [pack, setPack] = useState<PackageTarget | null>(null);
  const [asking, setAsking] = useState<Asking | null>(null);
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  // Each opening gets a new key, so a dialog always starts from fresh state.
  const [keys, setKeys] = useState(0);
  const bump = () => setKeys((key) => key + 1);

  const ask = useCallback(<T extends string>(request: AskRequest<T>) => new Promise<T | null>((resolve) => setAsking({ request, resolve: resolve as (value: string | null) => void })), []);

  const toast = useCallback((message: string) => {
    window.clearTimeout(toastTimer.current);
    setToastText(message);
    toastTimer.current = window.setTimeout(() => setToastText(null), 4000);
  }, []);

  const api = useMemo<DialogApi>(
    () => ({
      openLesson: (target = {}) => {
        bump();
        setLesson(target);
      },
      openStudent: (target = {}) => {
        bump();
        setStudent(target);
      },
      openNote: (target = {}) => {
        bump();
        setNote(target);
      },
      openBlackout: (target = {}) => {
        bump();
        setBlackout(target);
      },
      openNewInvoice: (target = {}) => {
        bump();
        setInvoice(target);
      },
      openPackage: (target) => {
        bump();
        setPack(target);
      },
      ask,
      confirm: async ({ title, body, confirmLabel, danger }) => (await ask({ title, body, options: [{ value: "yes", label: confirmLabel, tone: danger ? "danger" : "primary" }] })) === "yes",
      toast,
    }),
    [ask, toast]
  );

  const answer = (value: string | null) => {
    asking?.resolve(value);
    setAsking(null);
  };

  return (
    <DialogContext.Provider value={api}>
      {children}
      {lesson && <LessonDialog key={`lesson-${keys}`} {...lesson} onClose={() => setLesson(null)} />}
      {note && <NoteDialog key={`note-${keys}`} {...note} onClose={() => setNote(null)} />}
      {blackout && <BlackoutDialog key={`blackout-${keys}`} {...blackout} onClose={() => setBlackout(null)} />}
      {invoice && <NewInvoiceDialog key={`invoice-${keys}`} {...invoice} onClose={() => setInvoice(null)} />}
      {pack && <PackageDialog key={`package-${keys}`} {...pack} onClose={() => setPack(null)} />}
      {/* After the others, so "New student" opens on top of a lesson. */}
      {student && <StudentDialog key={`student-${keys}`} {...student} onClose={() => setStudent(null)} />}
      {asking && (
        <Dialog
          size="narrow"
          title={asking.request.title}
          onClose={() => answer(null)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => answer(null)}>
                {asking.request.cancelLabel ?? t("common.cancel")}
              </button>
              {asking.request.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`btn ${option.tone === "danger" ? "btn-danger" : option.tone === "outline" ? "btn-outline" : "btn-primary"}`}
                  onClick={() => answer(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </>
          }
        >
          {asking.request.body && <div className="card-note">{asking.request.body}</div>}
        </Dialog>
      )}
      {toastText && <Toast text={toastText} />}
    </DialogContext.Provider>
  );
}

/** Shown in the top layer (a popover) where the browser supports it, so it's visible above an open dialog. */
function Toast({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current as (HTMLDivElement & { showPopover?: () => void }) | null;
    try {
      element?.showPopover?.();
    } catch {
      // Already showing, or no popover support: it's a normal fixed element then.
    }
  });
  return (
    <div ref={ref} className="toast" role="status" {...({ popover: "manual" } as object)}>
      {text}
    </div>
  );
}
