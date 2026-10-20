import type { Translator } from "@/lib/i18n";
import { invoiceTotals, itemAmount } from "@/lib/invoices";
import type { Invoice, Settings } from "@/lib/types";

/**
 * The invoice as it prints (and as the PDF looks), in the invoice's own language. Layout follows
 * Tutorcat's example invoice: tutor block and "INVOICE" on top, a solid header bar, light row
 * dividers and a big total box. Always on white, whatever the app's theme.
 */
export function InvoicePaper({ invoice, settings, tr }: { invoice: Invoice; settings: Settings; tr: Translator }) {
  const { t } = tr;
  const totals = invoiceTotals(invoice);
  const money = (minor: number) => tr.money(minor, invoice.currency);
  const fromName = settings.businessName.trim() || settings.tutorName.trim();
  const contact = [settings.businessName.trim() && settings.tutorName.trim(), settings.email.trim(), settings.phone.trim(), settings.address.trim()].filter(Boolean).join("\n");
  const footer = settings.invoiceFooter.trim() || (settings.tutorName.trim() || settings.email.trim() ? t("paper.questions", { name: settings.tutorName.trim() || settings.email.trim() }) : "");

  return (
    <article className="invoice-paper" lang={tr.lang} dir={tr.dir} aria-label={t("paper.label", { number: invoice.number })}>
      {invoice.sample && <span className="inv-sample">{t("common.sample")}</span>}
      <header className="inv-top">
        <div className="inv-from">
          <strong><bdi>{fromName || t("paper.yourName")}</bdi></strong>
          {contact && <span>{contact}</span>}
          {settings.taxNumber.trim() && <span>{t("paper.taxNumber", { number: settings.taxNumber.trim() })}</span>}
        </div>
        <div className="inv-title">
          <h1>{t("paper.title")}</h1>
          <span dir="ltr">{invoice.number}</span>
          {invoice.status === "paid" && <span className="inv-status">{t("paper.paid")}</span>}
        </div>
      </header>

      <dl className="inv-details">
        <div>
          <dt>{t("paper.billTo")}</dt>
          <dd>
            <bdi>{invoice.billTo || invoice.studentName}</bdi>
            {invoice.billTo && invoice.studentName && invoice.billTo !== invoice.studentName && <div style={{ fontWeight: 400 }}>{t("paper.forStudent", { name: invoice.studentName })}</div>}
          </dd>
        </div>
        <div>
          <dt>{t("paper.issued")}</dt>
          <dd>{tr.day(invoice.issueDate, "medium")}</dd>
        </div>
        <div>
          <dt>{invoice.status === "paid" ? t("paper.paidOn") : t("paper.due")}</dt>
          <dd>{tr.day(invoice.status === "paid" && invoice.paidOn ? invoice.paidOn : invoice.dueDate, "medium")}</dd>
        </div>
        {invoice.periodStart && invoice.periodEnd && (
          <div>
            <dt>{t("paper.period")}</dt>
            <dd>{t("paper.periodValue", { from: tr.day(invoice.periodStart, "short"), to: tr.day(invoice.periodEnd, "medium") })}</dd>
          </div>
        )}
      </dl>

      <table className="inv-table">
        <thead>
          <tr>
            <th scope="col">{t("paper.date")}</th>
            <th scope="col">{t("paper.description")}</th>
            <th scope="col" className="num">{t("paper.qty")}</th>
            <th scope="col" className="num">{t("paper.rate")}</th>
            <th scope="col" className="num">{t("paper.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id}>
              <td className="nowrap">{item.date ? tr.day(item.date, "medium") : ""}</td>
              <td>
                {item.kind === "package" ? (
                  <>
                    {t("paper.package", { count: item.size ?? 0 })}
                    {item.description && (
                      <>
                        {" · "}
                        <bdi>{item.description}</bdi>
                      </>
                    )}
                  </>
                ) : item.description ? (
                  <bdi>{item.description}</bdi>
                ) : item.kind === "lesson" ? (
                  t("paper.lesson")
                ) : (
                  ""
                )}
              </td>
              <td className="num">{item.kind === "lesson" ? t("paper.hours", { count: item.quantity }) : tr.number(item.quantity)}</td>
              <td className="num">{money(item.unitPrice)}</td>
              <td className="num">{money(itemAmount(item))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-sums">
        <span className="inv-hours">{totals.hours > 0 ? t("paper.totalHours", { count: totals.hours }) : ""}</span>
        <dl>
          {(totals.discount > 0 || totals.tax > 0) && (
            <div>
              <dt>{t("paper.subtotal")}</dt>
              <dd>{money(totals.subtotal)}</dd>
            </div>
          )}
          {totals.discount > 0 && (
            <div>
              <dt>{t("paper.discount")}</dt>
              <dd>−{money(totals.discount)}</dd>
            </div>
          )}
          {invoice.taxRate > 0 && (
            <div>
              <dt>{t("paper.tax", { label: invoice.taxLabel || t("paper.taxDefault"), rate: invoice.taxRate })}</dt>
              <dd>{money(totals.tax)}</dd>
            </div>
          )}
          <div className="inv-total">
            <dt>{t("paper.total")}</dt>
            <dd>{money(totals.total)}</dd>
          </div>
        </dl>
      </div>

      {invoice.notes.trim() && (
        <section className="inv-notes">
          <div>
            <h2>{t("paper.payment")}</h2>
            <p>{invoice.notes.trim()}</p>
          </div>
        </section>
      )}
      {footer && <footer className="inv-footer">{footer}</footer>}
    </article>
  );
}
