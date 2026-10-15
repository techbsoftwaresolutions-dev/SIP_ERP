import { STATUS_OPTIONS } from "./itemFields";

export const CATALOG_UNITS = ["Nos", "Pcs", "Kg", "Litre", "Metre", "Box", "Set", "Roll", "Sheet"];

// Field definitions for the Category and Brand forms. Exported so the list
// page and the standalone Add/Edit page share one definition and can't drift.
export const CATEGORY_FIELDS = [
  { key: "name", label: "Category Name", required: true, placeholder: "e.g. Sheet Metal" },
  { key: "materialType", label: "Material Type", placeholder: "e.g. Steel, Aluminium, Plastic" },
  { key: "unit", label: "Default Unit", type: "select", options: CATALOG_UNITS, defaultValue: "Nos" },
  {
    key: "taxRate",
    label: "Tax Rate (%)",
    type: "number",
    defaultValue: 18,
    placeholder: "GST rate applied to items in this category",
  },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS, defaultValue: "Active" },
  { key: "description", label: "Description", type: "textarea", full: true },
];

export const BRAND_FIELDS = [
  { key: "name", label: "Brand Name", required: true, placeholder: "e.g. Tata Steel" },
  { key: "manufacturer", label: "Manufacturer", placeholder: "Who makes it" },
  { key: "material", label: "Material", placeholder: "e.g. Mild Steel, SS304" },
  { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS, defaultValue: "Active" },
  { key: "description", label: "Description", type: "textarea", full: true },
];
