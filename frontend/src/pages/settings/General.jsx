import SettingsSectionPage from "../../components/forms/SettingsSectionPage";
import { TABLE_STYLE_OPTIONS } from "../../hooks/useTableStyle";

// Passing an array in the `type` slot renders a dropdown of those options.
const CURRENCIES = ["INR (₹)", "USD ($)", "EUR (€)", "GBP (£)", "AED (د.إ)", "SGD (S$)"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TIMEZONES = [
  "Asia/Kolkata (IST)",
  "Asia/Dubai (GST)",
  "Asia/Singapore (SGT)",
  "Europe/London (GMT)",
  "America/New_York (EST)",
  "UTC",
];

// Sample: 09 Sep 2026 (a Wednesday), so every token is unambiguous.
const DATE_FORMATS = [
  "DD MMM YYYY",   // 09 Sep 2026
  "DD-MM-YYYY",    // 09-09-2026
  "DD/MM/YYYY",    // 09/09/2026
  "DD.MM.YYYY",    // 09.09.2026
  "DD.MM.YY",      // 09.09.26
  "DD-MMM-YYYY",   // 09-Sep-2026
  "MM/DD/YYYY",    // 09/09/2026 (US)
  "MMM DD, YYYY",  // Sep 09, 2026
  "YYYY-MM-DD",    // 2026-09-09
];

// Default credit period used when a customer/supplier has no payment terms
// of their own. Drives the due date on new invoices and bills.
const PAYMENT_TERMS = ["Immediate", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"];

const COPIES = ["1", "2", "3"];

export default function GeneralSettings() {
  const fields = [
    ["currency", "Currency", CURRENCIES],
    ["fiscalYearStart", "Fiscal Year Start", MONTHS],
    ["timezone", "Timezone", TIMEZONES],
    ["dateFormat", "Date Format", DATE_FORMATS],
    ["salesPaymentTerms", "Default Sales Payment Terms", PAYMENT_TERMS],
    ["purchasePaymentTerms", "Default Purchase Payment Terms", PAYMENT_TERMS],
    ["reminderDueSoonDays", "Remind Me This Many Days Ahead", "number"],
    // How list tables look: the standard table, or each row as a soft card.
    ["tableStyle", "Table Style", TABLE_STYLE_OPTIONS],
    // Copies a document prints and downloads with by default (Original,
    // Duplicate, Office). Each preview page can still change it per print.
    ["invoiceCopies", "Invoice - Copies to Print / Download", COPIES],
    ["challanCopies", "Delivery Challan - Copies to Print / Download", COPIES],
    ["purchaseOrderCopies", "Purchase Order - Copies to Print / Download", COPIES],
    ["quotationCopies", "Quotation - Copies to Print / Download", COPIES],
    ["enquiryCopies", "Enquiry - Copies to Print / Download", COPIES],
    // What each copy is called on the printout. Blank keeps the default.
    ["copyLabel1", "Copy 1 Label (default: Original Copy)"],
    ["copyLabel2", "Copy 2 Label (default: Duplicate Copy)"],
    ["copyLabel3", "Copy 3 Label (default: Office Copy)"],
  ];

  return (
    <SettingsSectionPage
      title="General Settings"
      crumbs={["Dashboard", "Settings", "General Settings"]}
      sectionTitle="General Preferences"
      fields={fields}
    />
  );
}
