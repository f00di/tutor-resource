import { FileText, Plus } from "lucide-react";
import { useState } from "react";

import { useDialogs } from "@/components/dialog-host";
import { Segmented } from "@/components/fields";
import { useInvoices } from "@/lib/hooks";
import { useI18n } from "@/lib/i18n";
import { invoiceTotals, isOverdue } from "@/lib/invoices";
import { sumByCurrency } from "@/lib/money";
import { hrefFor } from "@/lib/router";
import { todayKey } from "@/lib/time";
import { usePageTitle } from "./page-title";

type Filter = "all" | "unpaid" | "paid";

export function InvoicesPage() {
  const i18n = useI18n();
  const { t } = i18n;
  usePageTitle(t("nav.invoices"));
  const dialogs = useDialogs();
  const invoices = useInvoices();
  const [filter, setFilter] = useState<Filter>("all");
  const today = todayKey();
  const shown = invoices.filter((invoice) => filter === "all" || invoice.status === filter);
  const unpaid = sumByCurrency(invoices.filter((invoice) => invoice.status === "unpaid").map((invoice) => ({ currency: invoice.currency, amount: invoiceTotals(invoice).total })));
  const thisYear = sumByCurrency(invoices.filter((invoice) => invoice.status === "paid" && (invoice.paidOn ?? invoice.issueDate).startsWith(today.slice(0, 4))).map((invoice) => ({ currency: invoice.currency, amount: invoiceTotals(invoice).total })));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{t("nav.invoices")}</h1>
          <p className="page-sub">{t("invoices.intro")}</p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={() => dialogs.openNewInvoice()}>
            <Plus />
            {t("today.newInvoice")}
          </button>
        </div>
      </div>
      {invoices.length > 0 && (
        <div className="stat-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div className="stat">
            <div className="stat-label">{t("today.unpaid")}</div>
            <div className="stat-value">{unpaid.length ? unpaid.map((entry) => i18n.money(entry.amount, entry.currency)).join(" · ") : "—"}</div>
          </div>
          <div className="stat">
            <div className="stat-label">{t("invoices.paidThisYear", { year: today.slice(0, 4) })}</div>
            <div className="stat-value">{thisYear.length ? thisYear.map((entry) => i18n.money(entry.amount, entry.currency)).join(" · ") : "—"}</div>
          </div>
        </div>
      )}
      <section className="card">
        {invoices.length > 0 && (
          <div className="filter-row">
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: "all", label: t("invoices.all") },
                { value: "unpaid", label: t("invoice.unpaid") },
                { value: "paid", label: t("invoice.paid") },
              ]}
            />
          </div>
        )}
        {shown.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t("invoices.number")}</th>
                  <th scope="col">{t("invoices.family")}</th>
                  <th scope="col">{t("paper.issued")}</th>
                  <th scope="col">{t("paper.due")}</th>
                  <th scope="col" className="num">{t("paper.total")}</th>
                  <th scope="col">{t("invoices.status")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((invoice) => {
                  const overdue = isOverdue(invoice, today);
                  return (
                    <tr key={invoice.id}>
                      <td>
                        <a href={hrefFor({ name: "invoice", id: invoice.id })} dir="ltr">
                          {invoice.number}
                        </a>
                      </td>
                      <td>
                        <bdi>{invoice.studentName}</bdi>
                        {invoice.billTo && invoice.billTo !== invoice.studentName && <div className="small muted">{invoice.billTo}</div>}
                      </td>
                      <td className="nowrap">{i18n.day(invoice.issueDate, "medium")}</td>
                      <td className="nowrap">{i18n.day(invoice.dueDate, "medium")}</td>
                      <td className="num">{i18n.money(invoiceTotals(invoice).total, invoice.currency)}</td>
                      <td>
                        <span className={`badge ${invoice.status === "paid" ? "badge-green" : overdue ? "badge-red" : ""}`}>
                          {invoice.status === "paid" ? t("invoice.paid") : overdue ? t("invoice.overdue") : t("invoice.unpaid")}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <FileText width={22} height={22} style={{ color: "var(--primary)" }} />
            <strong>{invoices.length ? t("invoices.noneHere") : t("invoices.emptyTitle")}</strong>
            {!invoices.length && t("invoices.emptyBody")}
          </div>
        )}
      </section>
    </div>
  );
}
