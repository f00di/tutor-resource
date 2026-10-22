import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, CheckCircle2, MessageCircle, Plus, Printer, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useDialogs } from "@/components/dialog-host";
import { Field, MoneyInput } from "@/components/fields";
import { InvoicePaper } from "@/components/invoice-paper";
import { deleteInvoice, updateInvoice } from "@/lib/actions";
import { db, newId } from "@/lib/db";
import { useStudents } from "@/lib/hooks";
import { useI18n, useTranslator } from "@/lib/i18n";
import { chargePerHour, invoiceTotals, itemAmount, isOverdue } from "@/lib/invoices";
import { invoiceMessage, whatsappLink } from "@/lib/messages";
import { hrefFor, navigate } from "@/lib/router";
import { useSettings } from "@/lib/settings";
import { todayKey } from "@/lib/time";
import type { Invoice, InvoiceItem, Lang } from "@/lib/types";
import { usePageTitle } from "./page-title";

export function InvoicePage({ id }: { id: string }) {
  const { t } = useI18n();
  const invoice = useLiveQuery(async () => (await db.invoices.get(id)) ?? null, [id]);
  usePageTitle(invoice?.number ?? t("nav.invoices"));
  if (invoice === undefined) return null;
  if (!invoice) {
    return (
      <div className="page">
        <a className="back-link" href={hrefFor({ name: "invoices" })}>
          <ArrowLeft className="dir-icon" />
          {t("nav.invoices")}
        </a>
        <div className="empty">{t("invoice.notFound")}</div>
      </div>
    );
  }
  return <InvoiceEditor key={invoice.id} initial={invoice} />;
}

/** Edits save by themselves (a moment after typing stops); the preview is exactly what prints. */
function InvoiceEditor({ initial }: { initial: Invoice }) {
  const i18n = useI18n();
  const { t } = i18n;
  const dialogs = useDialogs();
  const settings = useSettings();
  const students = useStudents();
  const [draft, setDraft] = useState(initial);
  const paper = useTranslator(draft.language);
  const pending = useRef<Partial<Invoice>>({});
  const timer = useRef<number | undefined>(undefined);
  const student = students?.find((item) => item.id === draft.studentId);
  const totals = invoiceTotals(draft);
  const today = todayKey();

  const flush = () => {
    window.clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length) void updateInvoice(initial.id, patch);
  };
  useEffect(() => flush, []); // Save anything left when leaving the page.

  const change = (patch: Partial<Invoice>) => {
    setDraft((current) => ({ ...current, ...patch }));
    pending.current = { ...pending.current, ...patch };
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 400);
  };
  const changeItem = (itemId: string, patch: Partial<InvoiceItem>) => change({ items: draft.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) });

  const print = () => {
    flush();
    const title = document.title;
    // The PDF's suggested file name comes from the page title.
    document.title = [draft.number, draft.studentName].filter(Boolean).join(" ");
    window.addEventListener("afterprint", () => (document.title = title), { once: true });
    window.print();
  };

  const markPaid = (paid: boolean) => change(paid ? { status: "paid", paidOn: today } : { status: "unpaid" });

  const remove = async () => {
    const ok = await dialogs.confirm({ title: t("invoice.deleteTitle", { number: draft.number }), body: t("invoice.deleteBody"), confirmLabel: t("common.delete"), danger: true });
    if (!ok) return;
    window.clearTimeout(timer.current);
    pending.current = {};
    await deleteInvoice(initial.id);
    dialogs.toast(t("invoice.deleted"));
    navigate({ name: "invoices" });
  };

  const whatsapp = () => {
    if (!paper) return;
    flush();
    window.open(whatsappLink(student?.phone ?? "", invoiceMessage(paper, student, draft, settings.tutorName)), "_blank", "noopener");
  };

  const overdue = isOverdue(draft, today);

  return (
    <div className="page wide">
      <a className="back-link" href={hrefFor({ name: "invoices" })}>
        <ArrowLeft className="dir-icon" />
        {t("nav.invoices")}
      </a>
      <div className="page-head">
        <div>
          <h1 dir="auto">
            {draft.number}{" "}
            <span className={`badge ${draft.status === "paid" ? "badge-green" : overdue ? "badge-red" : ""}`} style={{ verticalAlign: "middle" }}>
              {draft.status === "paid" ? t("invoice.paid") : overdue ? t("invoice.overdue") : t("invoice.unpaid")}
            </span>
          </h1>
          <p className="page-sub">
            {draft.studentName} · {i18n.money(totals.total, draft.currency)}
            {draft.span && ` · ${t(`invoice.span.${draft.span}`)}`}
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={print}>
            <Printer />
            {t("invoice.print")}
          </button>
          <button type="button" className="btn btn-whatsapp" onClick={whatsapp} disabled={!paper}>
            <MessageCircle />
            {t("invoice.whatsapp")}
          </button>
          {draft.status === "paid" ? (
            <button type="button" className="btn btn-outline" onClick={() => markPaid(false)}>
              <RotateCcw />
              {t("invoice.markUnpaid")}
            </button>
          ) : (
            <button type="button" className="btn btn-outline" onClick={() => markPaid(true)}>
              <CheckCircle2 />
              {t("invoice.markPaid")}
            </button>
          )}
        </div>
      </div>
      <p className="field-hint" style={{ marginTop: -10, marginBottom: 16 }}>
        {t("invoice.printHint")}
      </p>

      <div className="editor-layout">
        <div>
          <section className="card">
            <div className="form">
              <div className="field-row three">
                <Field label={t("invoices.number")}>
                  <input value={draft.number} onChange={(event) => change({ number: event.target.value })} dir="ltr" />
                </Field>
                <Field label={t("paper.issued")}>
                  <input type="date" value={draft.issueDate} onChange={(event) => change({ issueDate: event.target.value })} />
                </Field>
                <Field label={t("paper.due")}>
                  <input type="date" value={draft.dueDate} onChange={(event) => change({ dueDate: event.target.value })} />
                </Field>
              </div>
              <div className="field-row">
                <Field label={t("lesson.student")}>
                  <input value={draft.studentName} onChange={(event) => change({ studentName: event.target.value })} />
                </Field>
                <Field label={t("invoice.language")} hint={t("invoice.languageHint")}>
                  <select value={draft.language} onChange={(event) => change({ language: event.target.value as Lang })}>
                    <option value="en">English</option>
                    <option value="ar">العربية</option>
                  </select>
                </Field>
              </div>
              <div className="field-row three">
                <Field label={t("invoice.level")} hint={t("invoice.levelHint")}>
                  <input value={draft.level ?? ""} onChange={(event) => change({ level: event.target.value })} />
                </Field>
                <Field label={t("invoice.subject")} hint={t("invoice.subjectHint")}>
                  <input value={draft.subject ?? ""} onChange={(event) => change({ subject: event.target.value })} />
                </Field>
                <Field label={t("paper.chargePerHour")} hint={t("invoice.rateHint")}>
                  <MoneyInput
                    value={chargePerHour(draft) ?? 0}
                    currency={draft.currency}
                    onChange={(minor) => change({ rate: minor, items: draft.items.map((item) => (item.kind === "lesson" ? { ...item, unitPrice: minor } : item)) })}
                  />
                </Field>
              </div>
            </div>
          </section>
          <section className="card">
            <div className="card-head">
              <h2>{t("invoice.lines")}</h2>
              <span className="muted small">{draft.currency}</span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t("paper.date")}</th>
                    <th scope="col">{t("paper.description")}</th>
                    <th scope="col">{t("paper.qty")}</th>
                    <th scope="col">{t("paper.rate")}</th>
                    <th scope="col" className="num">{t("paper.amount")}</th>
                    <th scope="col">
                      <span className="sr-only">{t("invoice.removeLine")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((item) => (
                    <tr key={item.id}>
                      <td style={{ minWidth: 130 }}>
                        <input className="input" type="date" value={item.date ?? ""} onChange={(event) => changeItem(item.id, { date: event.target.value })} aria-label={t("paper.date")} />
                      </td>
                      <td style={{ minWidth: 120 }}>
                        {item.kind === "lesson" ? (
                          <span className="muted small">{t("paper.lesson")}</span>
                        ) : (
                          <input
                            className="input"
                            value={item.description}
                            placeholder={item.kind === "package" ? t("paper.package", { count: item.size ?? 0 }) : ""}
                            onChange={(event) => changeItem(item.id, { description: event.target.value })}
                            aria-label={t("paper.description")}
                          />
                        )}
                      </td>
                      <td style={{ minWidth: 76 }}>
                        <input
                          className="input"
                          type="number"
                          min={0}
                          step={item.kind === "lesson" ? 0.25 : 1}
                          value={item.quantity}
                          onChange={(event) => changeItem(item.id, { quantity: Math.max(0, Number(event.target.value) || 0) })}
                          aria-label={item.kind === "lesson" ? t("invoice.hours") : t("paper.qty")}
                        />
                      </td>
                      <td style={{ minWidth: 100 }}>
                        <MoneyInput className="input" value={item.unitPrice} currency={draft.currency} onChange={(minor) => changeItem(item.id, { unitPrice: minor })} aria-label={t("paper.rate")} />
                      </td>
                      <td className="num">{i18n.money(itemAmount(item), draft.currency)}</td>
                      <td>
                        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => change({ items: draft.items.filter((other) => other.id !== item.id) })} aria-label={t("invoice.removeLine")}>
                          <X />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ marginTop: 10 }}
              onClick={() => change({ items: [...draft.items, { id: newId(), kind: "custom", description: "", quantity: 1, unitPrice: 0, date: today }] })}
            >
              <Plus />
              {t("invoice.addLine")}
            </button>
            <div className="field-row three" style={{ marginTop: 16 }}>
              <Field label={t("paper.discount")}>
                <MoneyInput value={draft.discount} currency={draft.currency} onChange={(minor) => change({ discount: minor })} />
              </Field>
              <Field label={t("invoice.taxLabel")}>
                <input value={draft.taxLabel} onChange={(event) => change({ taxLabel: event.target.value })} />
              </Field>
              <Field label={t("invoice.taxRate")} hint={t("invoice.taxHint")}>
                <input type="number" min={0} max={100} step={0.5} value={draft.taxRate} onChange={(event) => change({ taxRate: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} />
              </Field>
            </div>
            <div className="totals" style={{ marginTop: 12 }}>
              <div>
                <span>{t("paper.subtotal")}</span>
                <span>{i18n.money(totals.subtotal, draft.currency)}</span>
              </div>
              {totals.discount > 0 && (
                <div>
                  <span>{t("paper.discount")}</span>
                  <span>−{i18n.money(totals.discount, draft.currency)}</span>
                </div>
              )}
              {totals.tax > 0 && (
                <div>
                  <span>{draft.taxLabel || t("paper.taxDefault")}</span>
                  <span>{i18n.money(totals.tax, draft.currency)}</span>
                </div>
              )}
              <div className="grand">
                <span>{t("paper.total")}</span>
                <span>{i18n.money(totals.total, draft.currency)}</span>
              </div>
            </div>
          </section>
          <section className="card">
            <div className="form">
              <Field label={t("settings.otherPayment")} hint={t("invoice.paymentHint")}>
                <textarea value={draft.notes} onChange={(event) => change({ notes: event.target.value })} rows={3} />
              </Field>
              {draft.status === "paid" && (
                <div className="field-row">
                  <Field label={t("paper.paidOn")}>
                    <input type="date" value={draft.paidOn ?? today} onChange={(event) => change({ paidOn: event.target.value })} />
                  </Field>
                  <Field label={t("invoice.method")}>
                    <input value={draft.paymentMethod ?? ""} onChange={(event) => change({ paymentMethod: event.target.value })} placeholder={t("invoice.methodPlaceholder")} />
                  </Field>
                </div>
              )}
            </div>
          </section>
          <button type="button" className="btn btn-danger btn-sm" style={{ marginTop: 16 }} onClick={remove}>
            <Trash2 />
            {t("invoice.delete")}
          </button>
        </div>
        <div className="preview-pane">
          <p className="section-label" style={{ marginBottom: 8 }}>
            {t("invoice.preview")}
          </p>
          <div className="preview-scale">
            <FitWidth width={794}>{paper && <InvoicePaper invoice={draft} settings={settings} tr={paper} preview />}</FitWidth>
          </div>
        </div>
      </div>
      {paper && createPortal(<div className="print-root">{<InvoicePaper invoice={draft} settings={settings} tr={paper} />}</div>, document.body)}
    </div>
  );
}

/** Shows a fixed-width page (an A4 invoice) zoomed down to the space there is, so the preview matches the print. */
function FitWidth({ width, children }: { width: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const fit = () => setZoom(Math.min(1, element.clientWidth / width));
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div ref={box} className="preview-fit">
      <div style={{ width, zoom }}>{children}</div>
    </div>
  );
}
