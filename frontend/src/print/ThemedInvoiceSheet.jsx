import { amountInWords } from "../utils/numberToWords";
import { formatPhone } from "../utils/formatPhone";
import { invoiceAccentVars } from "../utils/colorMix";
import { inr, num, taxSplit, groupByHsn, shippingLines } from "./invoiceCalc";

// One parametric A4/A5 invoice sheet that renders every theme except the two
// legacy layouts (see themeRegistry.jsx). A theme is a *descriptor*, not a
// component, so adding an eleventh theme is a row in the catalogue plus at
// most a few CSS rules — not another 250-line copy of the GST maths.
//
// The five families differ in how the page is framed:
//   plain  hairline rules, no fill                  (Simple)
//   band   solid accent header strip                (Modern, Festive, A5)
//   rail   vertical accent strip down the left edge (Stylish)
//   grid   fully boxed, Tally-style                 (Advanced GST, Tally)
//   plate  dark header plate with a gold hairline   (Luxury)
//
// Everything below the header — parties, items, HSN summary, totals, bank,
// signature — is shared, because that content is what makes the document a
// valid tax invoice and must not vary by theme.

function Party({ invoice, customer, shipping, compact }) {
  return (
    <div className={`ti-parties${compact ? " compact" : ""}`}>
      <div className="ti-party">
        <div className="ti-label">Billed to</div>
        <div className="ti-party-name">{invoice.customer}</div>
        {(invoice.address || customer?.address) && <div>{invoice.address || customer.address}</div>}
        {customer?.state && <div>{[customer.city, customer.state].filter(Boolean).join(", ")}</div>}
        {customer?.gstNo && <div className="ti-mono">GSTIN {customer.gstNo}</div>}
        {(invoice.phone || customer?.phone) && <div>Phone {formatPhone(invoice.phone || customer.phone)}</div>}
      </div>
      <div className="ti-party">
        <div className="ti-label">Shipped to</div>
        {shipping.freeform ? (
          <div>{shipping.freeform}</div>
        ) : (
          <>
            <div className="ti-party-name">{shipping.name}</div>
            {shipping.line1 && <div>{shipping.line1}</div>}
            {shipping.line2 && shipping.line2 !== ", " && <div>{shipping.line2}</div>}
          </>
        )}
      </div>
    </div>
  );
}

function ItemsTable({ items, showHsn, showUnit }) {
  return (
    <table className="ti-items">
      <thead>
        <tr>
          <th className="ti-w-no">#</th>
          <th>Description of Goods / Services</th>
          {showHsn && <th className="ti-w-hsn">HSN/SAC</th>}
          <th className="ti-w-qty ti-r">Qty</th>
          {showUnit && <th className="ti-w-unit">Unit</th>}
          <th className="ti-w-rate ti-r">Rate</th>
          <th className="ti-w-tax ti-r">Tax %</th>
          <th className="ti-w-amt ti-r">Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr>
            <td colSpan={showHsn && showUnit ? 8 : 7}>No items.</td>
          </tr>
        ) : (
          items.map((it, idx) => (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td>{it.product}</td>
              {showHsn && <td className="ti-mono">{it.hsnCode || "—"}</td>}
              <td className="ti-r ti-mono">{Number(it.quantity) || 0}</td>
              {showUnit && <td>{it.unit || "—"}</td>}
              <td className="ti-r ti-mono">{num(it.unitPrice)}</td>
              <td className="ti-r ti-mono">{it.taxPercent || 0}%</td>
              <td className="ti-r ti-mono">{num(it.amount)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function HsnTable({ rows, intraState }) {
  if (!rows.length) return null;
  return (
    <table className="ti-hsn">
      <thead>
        <tr>
          <th rowSpan={2}>HSN/SAC</th>
          <th rowSpan={2} className="ti-r">Taxable</th>
          {intraState ? (
            <>
              <th colSpan={2}>CGST</th>
              <th colSpan={2}>SGST</th>
            </>
          ) : (
            <th colSpan={2}>IGST</th>
          )}
          <th rowSpan={2} className="ti-r">Total tax</th>
        </tr>
        <tr>
          <th>Rate</th>
          <th className="ti-r">Amount</th>
          {intraState && (
            <>
              <th>Rate</th>
              <th className="ti-r">Amount</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.hsnCode}>
            <td className="ti-mono">{row.hsnCode}</td>
            <td className="ti-r ti-mono">{num(row.taxable)}</td>
            {intraState ? (
              <>
                <td>{(row.rate / 2).toFixed(1)}%</td>
                <td className="ti-r ti-mono">{num(row.tax / 2)}</td>
                <td>{(row.rate / 2).toFixed(1)}%</td>
                <td className="ti-r ti-mono">{num(row.tax / 2)}</td>
              </>
            ) : (
              <>
                <td>{row.rate.toFixed(1)}%</td>
                <td className="ti-r ti-mono">{num(row.tax)}</td>
              </>
            )}
            <td className="ti-r ti-mono">{num(row.tax)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Totals({ invoice, split, intraState }) {
  return (
    <table className="ti-totals">
      <tbody>
        <tr>
          <th>Sub Total</th>
          <td>{inr(split.taxableTotal)}</td>
        </tr>
        {intraState ? (
          <>
            <tr>
              <th>CGST ({split.cgstRate.toFixed(1)}%)</th>
              <td>{inr(split.cgstAmount)}</td>
            </tr>
            <tr>
              <th>SGST ({split.sgstRate.toFixed(1)}%)</th>
              <td>{inr(split.sgstAmount)}</td>
            </tr>
          </>
        ) : (
          <tr>
            <th>IGST ({split.igstRate.toFixed(1)}%)</th>
            <td>{inr(split.igstAmount)}</td>
          </tr>
        )}
        {invoice.freightCharges > 0 && (
          <tr>
            <th>Freight Charges</th>
            <td>{inr(invoice.freightCharges)}</td>
          </tr>
        )}
        <tr className="ti-grand">
          <th>Total Amount</th>
          <td>{inr(invoice.amount)}</td>
        </tr>
        <tr>
          <th>Paid</th>
          <td>{inr(invoice.paidAmount)}</td>
        </tr>
        <tr className="ti-due">
          <th>Balance Due</th>
          <td>{inr(invoice.balance)}</td>
        </tr>
      </tbody>
    </table>
  );
}

function Header({ settings, invoice, customer, copyLabel }) {
  const co = (settings.companyName || "Your Company").toUpperCase();
  // Same value the CGST+SGST vs IGST split (computed once in InvoicePrint.jsx
  // and handed down as the `intraState` prop each sheet already gets) is
  // based on — shown explicitly here too, not just implied by which tax
  // labels appear, since a GST invoice is expected to state it outright.
  const placeOfSupply = invoice.placeOfSupply || customer?.state || "";
  const contact = [
    settings.phone ? formatPhone(settings.phone) : "",
    settings.email || "",
    settings.website || "",
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div className="ti-head">
      <div className="ti-head-left">
        {settings.logo && <img className="ti-logo" src={settings.logo} alt="" />}
        <div>
          <div className="ti-co">{co}</div>
          {settings.legalName && <div className="ti-co-legal">{settings.legalName}</div>}
          {settings.address && <div className="ti-co-line">{settings.address}</div>}
          {contact && <div className="ti-co-line">{contact}</div>}
          {settings.gstin && <div className="ti-co-line ti-mono">GSTIN {settings.gstin}</div>}
        </div>
      </div>
      <div className="ti-head-right">
        <div className="ti-doc-title">TAX INVOICE</div>
        <div className="ti-copy">{copyLabel}</div>
        <div className="ti-ref">
          <div>
            <span className="ti-label">Invoice No</span>
            <span className="ti-mono ti-ref-val">{invoice.id}</span>
          </div>
          <div>
            <span className="ti-label">Date</span>
            <span className="ti-mono ti-ref-val">{invoice.date || "—"}</span>
          </div>
          {placeOfSupply && (
            <div>
              <span className="ti-label">Place of Supply</span>
              <span className="ti-ref-val">{placeOfSupply}</span>
            </div>
          )}
          {invoice.dueDate && (
            <div>
              <span className="ti-label">Due</span>
              <span className="ti-mono ti-ref-val">{invoice.dueDate}</span>
            </div>
          )}
          {invoice.eWayBillNo && (
            <div>
              <span className="ti-label">E-Way Bill</span>
              <span className="ti-mono ti-ref-val">{invoice.eWayBillNo}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ThemedInvoiceSheet({
  copyLabel,
  invoice,
  customer,
  settings,
  theme,
  accent,
  intraState,
  sheetRef,
}) {
  const items = invoice.items || [];
  const split = taxSplit(invoice, intraState);
  const hsnRows = groupByHsn(items);
  const shipping = shippingLines(invoice, customer);
  const hasBank = settings.bankName || settings.bankAccountNumber || settings.bankIfsc;
  // The grid family is the compliance-heavy one, so it carries the HSN-wise
  // summary; the others keep the sheet to a single page.
  const showHsnSummary = theme.family === "grid";
  const compact = theme.paper === "a5";

  const body = (
    <>
      <Header settings={settings} invoice={invoice} customer={customer} copyLabel={copyLabel} />
      <Party invoice={invoice} customer={customer} shipping={shipping} compact={compact} />
      <ItemsTable items={items} showHsn={!compact} showUnit={!compact} />
      {showHsnSummary && <HsnTable rows={hsnRows} intraState={intraState} />}

      <div className="ti-summary">
        <div className="ti-summary-left">
          <div className="ti-label">Amount in words</div>
          <div className="ti-words">{amountInWords(invoice.amount)}</div>
          {invoice.paymentMode && (
            <div className="ti-pay">
              <strong>Payment Mode:</strong> {invoice.paymentMode}
              {invoice.paymentReference ? ` (${invoice.paymentReference})` : ""}
            </div>
          )}
          {settings.invoiceTerms && (
            <div className="ti-terms">
              <div className="ti-label">Terms &amp; conditions</div>
              <ol>
                {String(settings.invoiceTerms)
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
              </ol>
            </div>
          )}
          {invoice.notes && (
            <div className="ti-terms">
              <div className="ti-label">Notes</div>
              <ol>
                {invoice.notes
                  .split("\n")
                  .filter(Boolean)
                  .map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
              </ol>
            </div>
          )}
        </div>
        <Totals invoice={invoice} split={split} intraState={intraState} />
      </div>

      <div className="ti-foot">
        {hasBank ? (
          <div className="ti-bank">
            <div className="ti-label">Bank details</div>
            {settings.bankName && <div>Bank : {settings.bankName}</div>}
            {settings.bankAccountNumber && <div className="ti-mono">A/c : {settings.bankAccountNumber}</div>}
            {settings.bankIfsc && <div className="ti-mono">IFSC : {settings.bankIfsc}</div>}
            {settings.bankAccountName && <div>Name : {settings.bankAccountName}</div>}
          </div>
        ) : (
          <div />
        )}
        <div className="ti-sign">
          <div>For {settings.companyName || "Your Company"}</div>
          <div className="ti-sign-marks">
            {settings.seal && <img className="ti-seal" src={settings.seal} alt="" />}
            {settings.signature && <img className="ti-signature" src={settings.signature} alt="" />}
          </div>
          <div className="ti-label">Authorised Signatory</div>
        </div>
      </div>
    </>
  );

  return (
    <div
      ref={sheetRef}
      className={`invoice-sheet ti-sheet ti-${theme.family} ti-paper-${theme.paper} ti-theme-${theme.key}`}
      style={invoiceAccentVars(accent)}
    >
      {theme.family === "rail" ? (
        <>
          <div className="ti-railstrip">
            <span>Tax Invoice</span>
          </div>
          <div className="ti-rail-body">{body}</div>
        </>
      ) : (
        body
      )}
    </div>
  );
}
