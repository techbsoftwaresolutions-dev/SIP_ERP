import { INDIAN_STATES } from "../../utils/indianStates";
import { gstAutofill } from "../../utils/gstAutofill";

export const PAYMENT_TERMS = ["Immediate", "15 Days", "30 Days", "45 Days", "60 Days"];
export const SUPPLIER_TYPES = ["Manufacturer", "Distributor", "Wholesaler", "Trader", "Importer", "Service Provider"];

// Shared field definitions for the Supplier form — used by both the
// Supplier List page (edit modal) and the standalone Add Supplier page,
// so the two never drift apart.
export const SUPPLIER_FIELDS = [
  { key: "name", label: "Supplier Name", required: true, placeholder: "Enter your supplier name" },
  { key: "contactPerson", label: "Contact Person", placeholder: "Enter your contact person" },
  { key: "phone", label: "Phone", type: "phone", placeholder: "Enter your mobile number (optional)" },
  { key: "email", label: "Email", placeholder: "Enter your email" },
  { key: "supplierType", label: "Supplier Type", type: "select", options: SUPPLIER_TYPES },
  {
    key: "gstNo",
    label: "GST No.",
    placeholder: "Enter the 15-character GST no to fill the address",
    uppercase: true,
    maxLength: 15,
    onValueChange: gstAutofill("suppliers"),
  },
  { key: "address", label: "Address", placeholder: "Enter your address" },
  { key: "city", label: "City", placeholder: "Enter your city" },
  { key: "state", label: "State", type: "combo", options: INDIAN_STATES },
  { key: "pincode", label: "Pincode", type: "pincode", placeholder: "Enter your pincode" },
  { key: "paymentTerms", label: "Payment Terms", type: "select", options: PAYMENT_TERMS },
];
