import type { CSSProperties, ReactNode } from "react";

import type { Translator } from "@/lib/i18n";
import { bankLines, chargePerHour, groupByMonth, invoiceTotals, itemAmount, monthsBetween, paddingRows, PAPER_ROWS, type InvoiceTotals, type MonthGroup } from "@/lib/invoices";
import { formatAmount } from "@/lib/money";
import { hrefFor } from "@/lib/router";
import { isDateKey } from "@/lib/time";
import type { Invoice, InvoiceItem, Settings } from "@/lib/types";

const formatters = new Map<string, Intl.DateTimeFormat>();
function dayFormat(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) formatters.set(key, (formatter = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" })));
  return formatter;
}
const utcDay = (key: string) => {
  const [year = 1970, month = 1, day = 1] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day, 12);
};
/** "07-03-26", as the spreadsheet writes dates. */
const shortDate = (key: string) => `${key.slice(8, 10)}-${key.slice(5, 7)}-${key.slice(2, 4)}`;

/**
 * The invoice as it prints (and as the PDF looks), in the invoice's own language. The layout is a
 * tutor's own spreadsheet invoice: a monthly invoice is one page; a 3- or 6-month invoice is a cover
 * with each month's total and the final total, a "Monthly break down" page, then a page for each
 * month with lessons, newest first. Every page is A4 and white, whatever the app's theme.
 * `preview` adds on-screen hints (missing name or bank details) that the printed copy leaves out.
 */
export function InvoicePaper({ invoice, settings, tr, preview = false }: { invoice: Invoice; settings: Settings; tr: Translator; preview?: boolean }) {
  const { t } = tr;
  const span = invoice.span ?? 1;
  const totals = invoiceTotals(invoice);
  const currency = invoice.currency;
  const amount = (minor: number) => formatAmount(minor, currency, tr.locale);
  const rate = chargePerHour(invoice);
  // English dates as on the spreadsheet ("Saturday, March 7, 2026"); Arabic in its own order.
  const longDate = (key: string) => dayFormat(tr.lang === "en" ? "en-US" : tr.locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(utcDay(key));
  const monthName = (month: string) => dayFormat(tr.locale, { month: "long" }).format(utcDay(`${month}-15`));
  const monthYear = (month: string) => dayFormat(tr.locale, { month: "long", year: "numeric" }).format(utcDay(`${month}-15`));

  const name = settings.tutorName.trim() || settings.businessName.trim();
  const business = settings.tutorName.trim() && settings.businessName.trim();
  const email = settings.email.trim();
  const phone = settings.phone.trim();
  const bank = bankLines(settings);
  const contact = name
    ? phone && email
      ? t("paper.contactBoth", { name, phone, email })
      : phone || email
        ? t("paper.contactOne", { name, contact: phone || email })
        : name
    : [phone, email].filter(Boolean).join(" · ");

  const amountCell = (minor: number | null) => (
    <td>
      <div className="inv-split">
        <span>{currency}</span>
        <span>{minor === null ? "-" : amount(minor)}</span>
      </div>
    </td>
  );

  const head = (when: ReactNode) => (
    <header className="inv-head">
      {invoice.sample && <span className="inv-sample">{t("common.sample")}</span>}
      <h1>{t("paper.title")}</h1>
      <div className="inv-from">
        <strong>
          <bdi>{name || (preview ? t("paper.yourName") : "")}</bdi>
        </strong>
        {business && <bdi>{business}</bdi>}
        {email && (
          <a href={`mailto:${email}`} dir="ltr">
            {email}
          </a>
        )}
        {phone && <strong>{t("paper.phone", { phone })}</strong>}
        {settings.address.trim() && <span className="inv-pre">{settings.address.trim()}</span>}
        {settings.taxNumber.trim() && <span>{t("paper.taxNumber", { number: settings.taxNumber.trim() })}</span>}
      </div>
      <div className="inv-when">
        {when}
        <span className="inv-kind">{t("paper.tutoring")}</span>
        {invoice.status === "paid" && <span className="inv-status">{invoice.paidOn ? t("paper.paidOnDate", { date: shortDate(invoice.paidOn) }) : t("paper.paid")}</span>}
      </div>
    </header>
  );

  /** Year and month in bold, as on a month's page; a range of months when the period spans more than one. */
  const monthHeading = (months: string[]) => {
    const first = months[0]!;
    const last = months.at(-1)!;
    const years = first.slice(0, 4) === last.slice(0, 4) ? first.slice(0, 4) : `${first.slice(0, 4)} - ${last.slice(0, 4)}`;
    return (
      <div className="inv-month">
        <span>{years}</span>
        <strong>{first === last ? monthName(first) : t("paper.range", { from: monthName(first), to: monthName(last) })}</strong>
      </div>
    );
  };

  const bars = (details: string[]) => (
    <div className="inv-bars">
      <div className="inv-bar">
        <span>{t("paper.student")}</span>
        <span>{t("paper.invoiceNo")}</span>
        <span>{t("paper.dateHead")}</span>
      </div>
      <div className="inv-row">
        <span>
          <bdi>{invoice.studentName}</bdi>
        </span>
        <strong>
          <span dir="ltr">{invoice.number}</span>
        </strong>
        <strong>
          <span dir="ltr">{shortDate(invoice.issueDate)}</span>
        </strong>
      </div>
      <div className="inv-bar">
        <span>{t("paper.details")}</span>
      </div>
      {(details.length ? details : [""]).map((line, index) => (
        <div className="inv-row" key={index}>
          <span>
            <bdi>{line}</bdi>
          </span>
          {index === 0 && rate !== undefined && (
            <>
              <strong>{t("paper.chargePerHour")}</strong>
              <strong className="inv-split">
                <span>{currency}</span>
                <span>{amount(rate)}</span>
              </strong>
            </>
          )}
        </div>
      ))}
    </div>
  );

  /** Subtotal, discount and tax: only when there's a discount or tax. */
  const adjustments = (sums: InvoiceTotals) =>
    (sums.discount > 0 || sums.tax > 0) && (
      <table className="inv-adjust">
        <tbody>
          <tr>
            <th scope="row">{t("paper.subtotal")}</th>
            {amountCell(sums.subtotal)}
          </tr>
          {sums.discount > 0 && (
            <tr>
              <th scope="row">{t("paper.discount")}</th>
              {amountCell(-sums.discount)}
            </tr>
          )}
          {sums.tax > 0 && (
            <tr>
              <th scope="row">{t("paper.tax", { label: invoice.taxLabel || t("paper.taxDefault"), rate: invoice.taxRate })}</th>
              {amountCell(sums.tax)}
            </tr>
          )}
        </tbody>
      </table>
    );

  const totalBox = (minor: number) => (
    <div className="inv-total">
      <span>{currency}</span>
      <span>{amount(minor)}</span>
    </div>
  );

  const foot = (
    <>
      {bank.length ? (
        <div className="inv-bank">
          {bank.map((line) => (
            <div key={line.field}>{t(`paper.bank.${line.field}`, { value: line.value })}</div>
          ))}
        </div>
      ) : (
        preview && (
          <a className="inv-bank inv-bank-empty" href={hrefFor({ name: "settings" })}>
            {t("paper.addBank")}
          </a>
        )
      )}
      {invoice.notes.trim() && <p className="inv-notes inv-pre">{invoice.notes.trim()}</p>}
      <footer className="inv-footer">
        {settings.invoiceFooter.trim() && <p className="inv-pre">{settings.invoiceFooter.trim()}</p>}
        {contact && (
          <>
            <p>{t("paper.questions")}</p>
            <p>
              <strong>{contact}</strong>
            </p>
          </>
        )}
      </footer>
    </>
  );

  const lineLabel = (item: InvoiceItem): ReactNode => {
    if (item.kind === "lesson") return item.date && isDateKey(item.date) ? longDate(item.date) : item.description ? <bdi>{item.description}</bdi> : t("paper.lesson");
    const label = item.kind === "package" ? [t("paper.package", { count: item.size ?? 0 }), item.description.trim()].filter(Boolean).join(" · ") : item.description.trim();
    return (
      <>
        <bdi>{label}</bdi>
        {item.quantity !== 1 && ` × ${tr.number(item.quantity)}`}
      </>
    );
  };

  /** A month's page (or a monthly invoice): every session, padded to 15 rows, the hours and the total. */
  const monthPage = (key: string, months: string[], items: InvoiceItem[], hours: number, total: number, sums?: InvoiceTotals) => (
    <section className="inv-page" key={key} style={{ "--inv-rows": Math.max(PAPER_ROWS, items.length) } as CSSProperties}>
      {head(monthHeading(months))}
      {bars([invoice.level?.trim() || invoice.subject?.trim() || ""].filter(Boolean))}
      <table className="inv-table inv-lines">
        <colgroup>
          <col className="inv-col-date" />
          <col className="inv-col-short" />
          <col className="inv-col-hours" />
          <col className="inv-col-amount" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{t("paper.sessionDate")}</th>
            <th scope="col">{t("paper.shortDate")}</th>
            <th scope="col" className="inv-c">{t("paper.hoursHead")}</th>
            <th scope="col" className="inv-c">{t("paper.amountHead")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="inv-filled">
              <td className="inv-end">{lineLabel(item)}</td>
              <td className="inv-end">{item.date && isDateKey(item.date) && <span dir="ltr">{shortDate(item.date)}</span>}</td>
              <td className="inv-end">{item.kind === "lesson" ? tr.number(item.quantity) : ""}</td>
              {amountCell(itemAmount(item))}
            </tr>
          ))}
          {Array.from({ length: paddingRows(items.length) }, (_, index) => (
            <tr key={`pad${index}`}>
              <td />
              <td />
              <td />
              {amountCell(null)}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td />
            <td className="inv-c">{hours > 0 ? tr.number(hours) : ""}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <div className="inv-sum">
        {sums && adjustments(sums)}
        {totalBox(total)}
      </div>
      {foot}
    </section>
  );

  const label = t("paper.label", { number: invoice.number });

  if (span === 1) {
    const dates = invoice.items
      .map((item) => item.date)
      .filter(isDateKey)
      .sort();
    const from = invoice.periodStart ?? dates[0] ?? invoice.issueDate;
    const to = invoice.periodEnd ?? dates.at(-1) ?? from;
    return (
      <article className="invoice-paper" lang={tr.lang} dir={tr.dir} aria-label={label}>
        {monthPage("month", monthsBetween(from, to), invoice.items, totals.hours, totals.total, totals)}
      </article>
    );
  }

  const groups = groupByMonth(invoice);
  const filled = groups.filter((group) => group.items.length > 0);
  const first = groups[0]!.month;
  const last = groups.at(-1)!.month;
  const cover = (
    <section className="inv-page inv-cover" key="cover">
      {head(
        <div className="inv-month">
          <strong>{t("paper.range", { from: monthYear(first), to: monthYear(last) })}</strong>
        </div>
      )}
      {bars([invoice.level?.trim() ?? "", invoice.subject?.trim() ?? ""].filter(Boolean))}
      <table className="inv-table inv-months">
        <colgroup>
          <col className="inv-col-month" />
          <col className="inv-col-year" />
          <col className="inv-col-amount" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{t("paper.month")}</th>
            <th scope="col">{t("paper.year")}</th>
            <th scope="col" className="inv-c">{t("paper.amountHead")}</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group: MonthGroup) => (
            <tr key={group.month} className="inv-filled">
              <td>{monthName(group.month)}</td>
              <td className="inv-year">{group.month.slice(0, 4)}</td>
              {amountCell(group.items.length ? group.amount : null)}
            </tr>
          ))}
          {Array.from({ length: paddingRows(groups.length) }, (_, index) => (
            <tr key={`pad${index}`}>
              <td />
              <td className="inv-year" />
              {amountCell(null)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="inv-sum inv-final">
        {adjustments(totals)}
        <div className="inv-final-row">
          <strong className="inv-final-label">{t("paper.finalTotal")}</strong>
          {totalBox(totals.total)}
        </div>
      </div>
      {foot}
    </section>
  );

  return (
    <article className="invoice-paper" lang={tr.lang} dir={tr.dir} aria-label={label}>
      {cover}
      <section className="inv-page inv-break" key="break">
        <h2>{t("paper.breakdown")}</h2>
      </section>
      {[...filled].reverse().map((group) => monthPage(group.month, [group.month], group.items, group.hours, group.amount))}
    </article>
  );
}
