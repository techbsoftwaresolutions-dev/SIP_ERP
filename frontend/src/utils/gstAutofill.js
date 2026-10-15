import api from "../api/client";
import { INDIAN_STATES } from "./indianStates";
import { GST_STATE_CODES } from "./gstStateCodes";

const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

// "33" -> "Tamil Nadu", from the first two digits of any GSTIN.
const STATE_BY_CODE = Object.fromEntries(Object.entries(GST_STATE_CODES).map(([name, code]) => [code, name]));

const matchState = (name) => {
  const wanted = String(name || "").trim().toLowerCase();
  return INDIAN_STATES.find((s) => s.toLowerCase() === wanted) || "";
};

// Field `onValueChange` handler for the "GST No." box on the Customer and
// Supplier forms. `kind` is the API collection ("customers" | "suppliers").
//
// Typing 15 characters fills the State straight away (it is in the number
// itself). If the server has an address lookup configured, it also fills the
// registered address, city, pincode and — only when still empty — the name.
// Nothing here ever blocks saving: a failed lookup just leaves the form as is.
export function gstAutofill(kind) {
  return async (value, { values, fill, hint }) => {
    const gstin = String(value || "").trim().toUpperCase();
    if (!gstin) return hint("");
    if (gstin.length < 15) return hint("");
    if (!GSTIN_SHAPE.test(gstin)) return hint("That does not look like a valid 15-character GST number.", "warn");

    const stateFromCode = STATE_BY_CODE[gstin.slice(0, 2)] || "";
    if (stateFromCode) fill({ state: stateFromCode });
    hint("Looking up the registered address…");

    let res;
    try {
      res = await api.get(`/api/${kind}/gst-lookup?gstin=${encodeURIComponent(gstin)}`);
    } catch {
      return hint(stateFromCode ? `State filled from the GST number. Enter the address manually.` : "", "ok");
    }
    // The user kept typing while we waited — this answer is for an old value.
    if (String(values().gstNo || "").trim().toUpperCase() !== gstin) return;

    if (!res.valid) return hint(res.message || "This GST number could not be verified.", "warn");
    if (!res.found) {
      const note = res.configured ? res.message || "No registered details were found." : "";
      return hint(
        stateFromCode
          ? `State filled from the GST number.${res.configured ? ` ${note}` : " Enter the address manually."}`
          : note,
        res.configured && note ? "warn" : "ok"
      );
    }

    const patch = {};
    if (res.address) patch.address = res.address;
    if (res.city) patch.city = res.city;
    if (res.pincode) patch.pincode = res.pincode;
    const state = matchState(res.state) || stateFromCode;
    if (state) patch.state = state;
    if (!String(values().name || "").trim()) patch.name = res.tradeName || res.name || "";
    fill(patch);
    hint(`Details filled from the GST record${res.status ? ` (${res.status})` : ""}. Please check them.`, "ok");
  };
}
