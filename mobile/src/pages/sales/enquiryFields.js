export const SOURCE_OPTIONS = ["Website", "Phone", "Email", "Sales Team", "Referral", "Other"];
export const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
export const STATUS_OPTIONS = ["New", "Under Review", "Quotation Sent", "Won", "Lost"];

// Shared field definitions for the Enquiry form — used by both the
// standalone Add and Edit pages, so the two never drift apart.
export const ENQUIRY_FIELDS = [
  { key: "customer", label: "Customer", required: true, placeholder: "Enter your customer" },
  { key: "contactPerson", label: "Contact Person", placeholder: "Enter your contact person" },
  { key: "product", label: "Products", placeholder: "Enter your products" },
  { key: "qty", label: "Qty", type: "number", placeholder: "Enter your quantity" },
  { key: "unit", label: "Unit", type: "select", options: ["Nos", "Pcs", "Box", "Kg", "Litre", "Set", "Roll", "Sheet"] },
  { key: "requiredDate", label: "Required Date", type: "date" },
  { key: "source", label: "Source", type: "select", options: SOURCE_OPTIONS },
  { key: "priority", label: "Priority", type: "select", options: PRIORITY_OPTIONS },
  { key: "estValue", label: "Est. Value (₹)", type: "number", placeholder: "Enter your estimated value" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
];
