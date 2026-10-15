import { useEffect, useState } from "react";
import api, { clearSwrCache } from "../api/client";

// Keys a custom field's AddRecordForm entry under, so it can never collide
// with a built-in field of the same name (e.g. a client adding their own
// "Address" custom field next to the built-in `address`).
const PREFIX = "cf_";

// A Dropdown custom field maps to "combo" (searchable, with an inline
// "+ Add new option" via onCreate below) rather than a plain "select" —
// every other dropdown in this app (Category, Brand, Payment Terms, ...) is
// searchable and can grow its own option list the same way.
const TYPE_MAP = { text: undefined, textarea: "textarea", number: "number", date: "date" };

// Loads the client's own field definitions for one entity (Customer /
// Supplier / Item / ... — see Settings → Custom Fields) and shapes them as
// extra AddRecordForm field entries, ready to append to that form's static
// field list. Returns [] until they arrive, so callers can just spread the
// result in — an empty array changes nothing.
export function useCustomFields(entity) {
  const [defs, setDefs] = useState([]);

  useEffect(() => {
    api.swr(`/api/custom-fields?entity=${entity}`, (r) => setDefs(r.fields || []));
  }, [entity]);

  // Typing a new value into a Dropdown field's search box and choosing
  // "+ Add ..." grows that field's own option list for next time, the same
  // way creating a new Category/Brand works — persisted via the definition's
  // own PUT route, then reflected locally so it's selectable again without a
  // reload.
  const addOption = async (def, newOption) => {
    const next = [...new Set([...(def.options || []), newOption])];
    const updated = await api.put(`/api/custom-fields/${encodeURIComponent(def.id)}`, { options: next });
    clearSwrCache();
    setDefs((prev) => prev.map((d) => (d.id === def.id ? updated : d)));
    return newOption;
  };

  const fields = defs.map((d) => ({
    key: PREFIX + d.key,
    label: d.label,
    required: d.required,
    type: d.type === "select" ? "combo" : TYPE_MAP[d.type],
    options: d.options || [],
    placeholder: d.type === "select" ? "Select or type to add new..." : `Enter ${d.label.toLowerCase()}`,
    ...(d.type === "select"
      ? {
          onCreate: (text) => addOption(d, text),
          createLabel: (text) => `+ Add "${text}" as a new option`,
        }
      : {}),
  }));

  return { defs, fields, addOption };
}

// Call right before POST/PUT: pulls every `cf_*` key back out of the form's
// flat `values` object into a nested `customFields` map, matching what the
// API stores on the record. Use as a form's `transform` (RecordFormPage) or
// inline in a hand-rolled `handleSubmit`.
export function packCustomFields(values) {
  const rest = {};
  const customFields = {};
  Object.entries(values || {}).forEach(([k, v]) => {
    if (k.startsWith(PREFIX)) customFields[k.slice(PREFIX.length)] = v;
    else rest[k] = v;
  });
  return { ...rest, customFields };
}

// The reverse, for edit mode: flattens a loaded record's `customFields` map
// back into `cf_*` keys so AddRecordForm's `initialValues` lookup finds them.
export function unpackCustomFields(record) {
  if (!record) return record;
  const { customFields, ...rest } = record;
  Object.entries(customFields || {}).forEach(([k, v]) => {
    rest[PREFIX + k] = v;
  });
  return rest;
}
