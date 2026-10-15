import { INDIAN_STATES } from "../../utils/indianStates";
import { gstAutofill } from "../../utils/gstAutofill";

export const PAYMENT_TERMS = ["Immediate", "15 Days", "30 Days", "45 Days", "60 Days"];
export const CUSTOMER_TYPES = ["Industrial", "OEM", "Manufacturer", "Retailer", "Distributor"];

// Shared field definitions for the Customer form — used by both the
// Customer List page (edit modal) and the standalone Add Customer page,
// so the two never drift apart.
export const CUSTOMER_FIELDS = [
  { key: "name", label: "Customer Name", required: true, placeholder: "Enter your customer name" },
  { key: "contactPerson", label: "Contact Person", placeholder: "Enter your contact person" },
  { key: "phone", label: "Phone", type: "phone", placeholder: "Enter your mobile number (optional)" },
  { key: "email", label: "Email", placeholder: "Enter your email" },
  { key: "customerType", label: "Customer Type", type: "select", options: CUSTOMER_TYPES },
  {
    key: "gstNo",
    label: "GST No.",
    placeholder: "Enter the 15-character GST no to fill the address",
    uppercase: true,
    maxLength: 15,
    onValueChange: gstAutofill("customers"),
  },
  { key: "address", label: "Address", placeholder: "Enter your address" },
  { key: "city", label: "City", placeholder: "Enter your city" },
  { key: "state", label: "State", type: "combo", options: INDIAN_STATES },
  { key: "pincode", label: "Pincode", type: "pincode", placeholder: "Enter your pincode" },
  { key: "paymentTerms", label: "Payment Terms", type: "select", options: PAYMENT_TERMS },
];
