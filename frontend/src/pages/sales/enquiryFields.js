export const SOURCE_OPTIONS = ["Website", "Phone", "Email", "Sales Team", "Referral", "Other"];
export const PRIORITY_OPTIONS = ["High", "Medium", "Low"];
export const STATUS_OPTIONS = ["New", "Under Review", "Quotation Sent", "Won", "Lost"];
export const UNIT_OPTIONS = ["Nos", "Pcs", "Box", "Kg", "Litre", "Set", "Roll", "Sheet"];

// Shared field definitions for the Enquiry form — used by both the
// standalone Add and Edit pages, so the two never drift apart.
//
// An enquiry can ask about several products, so they are rows in a table. A
// product can be picked from the Items catalogue (which fills in its unit) or
// simply typed, since customers often ask about things that aren't catalogued yet.
export function buildEnquiryFields(catalogItems = []) {
  return [
    { key: "customer", label: "Customer", required: true, placeholder: "Enter your customer" },
    { key: "contactPerson", label: "Contact Person", placeholder: "Enter your contact person" },
    { key: "requiredDate", label: "Required Date", type: "date" },
    {
      key: "items",
      label: "Products",
      type: "items",
      full: true,
      addRowLabel: "+ Add Product",
      columns: [
        {
          key: "product",
          label: "Product",
          type: "combo",
          options: catalogItems.map((p) => p.name),
          placeholder: "Select or type a product",
          onCreate: async (text) => text,
          createLabel: (text) => `+ Use "${text}"`,
          deriveFrom: { source: catalogItems, match: "name", fields: { unit: "unit" } },
        },
        { key: "qty", label: "Qty", type: "number" },
        { key: "unit", label: "Unit", type: "combo", options: UNIT_OPTIONS },
        { key: "remarks", label: "Remarks" },
      ],
    },
    { key: "source", label: "Source", type: "select", options: SOURCE_OPTIONS },
    { key: "priority", label: "Priority", type: "select", options: PRIORITY_OPTIONS },
    { key: "estValue", label: "Est. Value (₹)", type: "number", placeholder: "Enter your estimated value" },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
  ];
}

// Enquiries saved before products became a table have a single flat
// product / qty / unit — show those as the first row when one is opened.
export function enquiryItemsFor(enquiry) {
  if (Array.isArray(enquiry.items) && enquiry.items.length) return enquiry.items;
  if (enquiry.product && enquiry.product !== "General Enquiry") {
    return [{ product: enquiry.product, qty: enquiry.qty || "", unit: enquiry.unit || "Nos", remarks: "" }];
  }
  return [];
}
