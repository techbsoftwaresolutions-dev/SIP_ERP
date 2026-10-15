// Official GST state codes, used to derive the "State Code" box on printed
// tax invoices from a customer's state name.
export const GST_STATE_CODES = {
  "Jammu and Kashmir": "01",
  "Himachal Pradesh": "02",
  "Punjab": "03",
  "Chandigarh": "04",
  "Uttarakhand": "05",
  "Haryana": "06",
  "Delhi": "07",
  "Rajasthan": "08",
  "Uttar Pradesh": "09",
  "Bihar": "10",
  "Sikkim": "11",
  "Arunachal Pradesh": "12",
  "Nagaland": "13",
  "Manipur": "14",
  "Mizoram": "15",
  "Tripura": "16",
  "Meghalaya": "17",
  "Assam": "18",
  "West Bengal": "19",
  "Jharkhand": "20",
  "Odisha": "21",
  "Chhattisgarh": "22",
  "Madhya Pradesh": "23",
  "Gujarat": "24",
  "Dadra and Nagar Haveli and Daman and Diu": "26",
  "Maharashtra": "27",
  "Karnataka": "29",
  "Goa": "30",
  "Lakshadweep": "31",
  "Kerala": "32",
  "Tamil Nadu": "33",
  "Puducherry": "34",
  "Andaman and Nicobar Islands": "35",
  "Telangana": "36",
  "Andhra Pradesh": "37",
  "Ladakh": "38",
};

export function getStateCode(stateName) {
  if (!stateName) return "";
  return GST_STATE_CODES[stateName.trim()] || "";
}

// The first two digits of any Indian GSTIN are its state code — this is how
// a printed tax invoice knows the seller's own state, to compare against
// the buyer's for CGST+SGST (same state) vs IGST (different state).
export function getStateCodeFromGstin(gstin) {
  if (!gstin) return "";
  const match = gstin.trim().match(/^\d{2}/);
  return match ? match[0] : "";
}

// true = same state as the buyer (CGST+SGST), false = different (IGST).
// Falls back to intrastate (the common default for a local business) when
// either state can't be determined from the data on hand.
export function isIntraState(companyGstin, customerState) {
  const companyCode = getStateCodeFromGstin(companyGstin);
  const customerCode = getStateCode(customerState);
  if (!companyCode || !customerCode) return true;
  return companyCode === customerCode;
}
