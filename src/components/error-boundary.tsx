// The safety net. If a page or dialog throws while drawing, only that part is replaced by a short
// explanation with Reload, Go to Today and Copy error details; the rest of the app keeps working.
// Before this, one error unmounted everything and left the window blank (dark in the dark theme).
// Error details only go to the clipboard: nothing is ever sent anywhere.
import { AlertTriangle, Check, ClipboardCopy, Home, RefreshCw } from "lucide-react";
import { Component, useState, type ErrorInfo, type ReactNode } from "react";

import { copyText, dismissReportedError, errorDetails, isChunkError, reloadApp, useReportedError } from "@/lib/errors";
import { useAnyTranslator } from "@/lib/i18n";
import { navigate } from "@/lib/router";
import { Dialog } from "./dialog";
import { TopLayer } from "./top-layer";

/** app: the whole window. page: inside the shell, so the menu still works. dialog: in place of the dialog. silent: draws nothing. */
type Scope = "app" | "page" | "dialog" | "silent";

interface Props {
  scope: Scope;
  /** For a dialog: closes it. */
  onClose?: () => void;
  children: ReactNode;
}
interface State {
  failed: boolean;
  error: unknown;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false, error: null, componentStack: null };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { failed: true, error };
  }

  override componentDidCatch(_error: unknown, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
  }

  reset = () => this.setState({ failed: false, error: null, componentStack: null });

  override render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.scope === "silent") return null;
    return <ErrorFallback scope={this.props.scope} error={this.state.error} componentStack={this.state.componentStack} onReset={this.reset} onClose={this.props.onClose} />;
  }
}

function CopyButton({ error, componentStack }: { error: unknown; componentStack?: string | null }) {
  const { t } = useAnyTranslator();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => void copyText(errorDetails(error, componentStack)).then(setCopied)}
      title={t("error.copyHint")}
    >
      {copied ? <Check /> : <ClipboardCopy />}
      {copied ? t("error.copied") : t("error.copy")}
    </button>
  );
}

function ErrorFallback({ scope, error, componentStack, onReset, onClose }: { scope: Exclude<Scope, "silent">; error: unknown; componentStack: string | null; onReset: () => void; onClose?: (() => void) | undefined }) {
  const { t } = useAnyTranslator();
  // A file that didn't load usually means a new version replaced it while the app was open.
  const update = isChunkError(error);
  const title = update ? t("update.ready") : t(`error.${scope}Title`);
  const body = update ? t("error.updateBody") : scope === "dialog" ? t("error.dialogBody") : t("error.body");

  if (scope === "dialog") {
    return (
      <Dialog
        size="narrow"
        title={title}
        onClose={() => onClose?.()}
        footer={
          <>
            <CopyButton error={error} componentStack={componentStack} />
            <button type="button" className="btn btn-outline" onClick={() => void reloadApp()}>
              <RefreshCw />
              {t("update.reload")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onClose?.()}>
              {t("common.close")}
            </button>
          </>
        }
      >
        <p className="card-note">{body}</p>
      </Dialog>
    );
  }

  return (
    <div className={scope === "app" ? "error-screen" : "page"}>
      <div className="error-card" role="alert">
        <AlertTriangle className="error-icon" />
        <h1>{title}</h1>
        <p>{body}</p>
        {!update && (
          <p className="error-message">
            <code dir="ltr">{String(error instanceof Error ? error.message : error)}</code>
          </p>
        )}
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => void reloadApp()}>
            <RefreshCw />
            {t("update.reload")}
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              navigate({ name: "today" });
              onReset();
            }}
          >
            <Home />
            {t("error.goToday")}
          </button>
          {!update && <CopyButton error={error} componentStack={componentStack} />}
        </div>
      </div>
    </div>
  );
}

/** Problems outside drawing (a save that failed, a file that didn't load), shown above everything. */
export function ErrorNotice() {
  const { t } = useAnyTranslator();
  const reported = useReportedError();
  if (!reported) return null;
  const update = isChunkError(reported.error);
  return (
    <TopLayer className="toast toast-error" role="alert">
      <span>{update ? t("update.ready") : t("error.notice")}</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => void reloadApp()}>
        {t("update.reload")}
      </button>
      {!update && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ color: "inherit" }} onClick={() => void copyText(errorDetails(reported.error)).then((copied) => copied && dismissReportedError())} title={t("error.copyHint")}>
          {t("error.copy")}
        </button>
      )}
      <button type="button" className="btn btn-ghost btn-sm" style={{ color: "inherit" }} onClick={dismissReportedError}>
        {update ? t("update.later") : t("common.close")}
      </button>
    </TopLayer>
  );
}
