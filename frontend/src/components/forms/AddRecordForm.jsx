import { lazy, Suspense, useRef, useState } from "react";
import SearchableSelect from "./SearchableSelect";
import ItemsEditor from "./ItemsEditor";
import DateInput from "./DateInput";
import Icon from "../ui/Icon";
import PasswordInput from "./PasswordInput";

// Lazy: this component is used by dozens of unrelated forms, and the
// scanning library is sizable — only pay for it on the rare form that
// actually has a "barcode" field, and only once the scan button is clicked.
const BarcodeScanner = lazy(() => import("./BarcodeScanner"));

// Toggle-mode fields: a small pill switcher next to the label lets the user
// pick between two ways of filling that one field in.
const TOGGLE_PRESETS = {
  "select-or-text": [
    { mode: "select", label: "Dropdown" },
    { mode: "text", label: "Type New" },
  ],
  "auto-or-manual": [
    { mode: "auto", label: "Auto Generate" },
    { mode: "manual", label: "Manual" },
  ],
};

export default function AddRecordForm({ fields, onSubmit, onCancel, submitLabel = "Add", initialValues }) {
  const [values, setValues] = useState(() => {
    const initial = {};
    fields.forEach((f) => {
      let existing = initialValues ? initialValues[f.key] : undefined;
      // Line-items editor fields keep their value as an array of row objects,
      // never a joined string.
      if (f.type === "items") {
        const rows = Array.isArray(existing) ? existing : [];
        initial[f.key] = f.computeRow ? rows.map((r) => f.computeRow(r)) : rows;
        return;
      }
      if (Array.isArray(existing)) existing = existing.join(", ");
      if (existing === undefined && f.type === "auto-or-manual" && f.generate) {
        initial[f.key] = f.generate();
      } else {
        initial[f.key] = existing ?? (f.defaultValue ?? "");
      }
    });
    return initial;
  });
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const [fieldHints, setFieldHints] = useState({});
  const [error, setError] = useState("");
  // Per-field validation messages, keyed by field key — shown in red under the
  // field itself and cleared as soon as that field is edited.
  const [fieldErrors, setFieldErrors] = useState({});
  const clearFieldError = (key) =>
    setFieldErrors((fe) => {
      if (!fe[key]) return fe;
      const { [key]: _drop, ...rest } = fe;
      return rest;
    });
  const [submitting, setSubmitting] = useState(false);
  // Which "barcode" field currently has its scan-camera modal open, by key —
  // a plain string rather than a set, since a form only ever has one such
  // field in practice.
  const [scanningField, setScanningField] = useState("");
  // For toggle-mode fields: which of the two modes is currently active.
  // "select-or-text" defaults to dropdown, unless editing an existing record
  // whose value isn't in the option list (then start on text). "auto-or-manual"
  // defaults to auto (a value is already generated above), unless editing an
  // existing record that already has a value (then start on manual, showing it).
  const [fieldModes, setFieldModes] = useState(() => {
    const modes = {};
    fields.forEach((f) => {
      if (f.type === "select-or-text") {
        const existing = initialValues ? initialValues[f.key] : undefined;
        modes[f.key] = existing && !(f.options || []).includes(existing) ? "text" : "select";
      } else if (f.type === "auto-or-manual") {
        const existing = initialValues ? initialValues[f.key] : undefined;
        modes[f.key] = existing ? "manual" : "auto";
      }
    });
    return modes;
  });

  const setFieldMode = (field, mode) => {
    setFieldModes((m) => {
      if (m[field.key] === mode) return m; // already in this mode — no-op, don't clear anything
      return { ...m, [field.key]: mode };
    });
    setValues((v) => {
      if (fieldModes[field.key] === mode) return v;
      if (field.type === "auto-or-manual") {
        return { ...v, [field.key]: mode === "auto" && field.generate ? field.generate() : "" };
      }
      const next = { ...v, [field.key]: "" };
      fields.forEach((f) => {
        const rules = Array.isArray(f.deriveFrom) ? f.deriveFrom : f.deriveFrom ? [f.deriveFrom] : [];
        if (rules.some((rule) => rule.field === field.key)) next[f.key] = "";
      });
      return next;
    });
  };

  // Auto-fills any fields that derive from `field` (e.g. Address / Mobile No.
  // populated from the selected Customer, or a PO's date from its number) —
  // but only when the new value matches a record in the lookup source. If it
  // doesn't match (e.g. still mid-typing a new name), leaves whatever the
  // user already typed in the derived field alone instead of wiping it out.
  const applyDerived = (field, val, next) => {
    fields.forEach((f) => {
      // `deriveFrom` is usually one rule (a single trigger field), but a
      // target can list several — e.g. Sales Return's "Customer" fills in
      // from whichever of "SO No." or "Invoice No." the user actually picks.
      // Wrapping the single-object case keeps every existing caller working
      // unchanged.
      const rules = Array.isArray(f.deriveFrom) ? f.deriveFrom : f.deriveFrom ? [f.deriveFrom] : [];
      for (const rule of rules) {
        if (rule.field !== field.key) continue;
        const match = (rule.source || []).find((item) => item[rule.match] === val);
        if (match) next[f.key] = match[rule.pick] || "";
      }
    });
  };

  const handleChange = (field) => (e) => {
    let val = e.target.value;
    if (field.type === "phone") {
      val = val.replace(/\D/g, "").slice(0, 10);
    } else if (field.type === "pincode") {
      val = val.replace(/\D/g, "").slice(0, 6);
    } else if (field.uppercase) {
      val = val.toUpperCase().replace(/\s/g, "");
    }
    if (field.maxLength) val = val.slice(0, field.maxLength);
    clearFieldError(field.key);
    setValues((v) => {
      const next = { ...v, [field.key]: val };
      applyDerived(field, val, next);
      return next;
    });
    runValueChange(field, val);
  };

  const setFieldValue = (field, val) => {
    clearFieldError(field.key);
    setValues((v) => {
      const next = { ...v, [field.key]: val };
      applyDerived(field, val, next);
      return next;
    });
    runValueChange(field, val);
  };

  // A field can carry an `onValueChange(value, { values, fill, hint })` handler
  // — e.g. the GST No. box fills the address. `values()` reads the latest form
  // values (so a slow lookup can tell the user has moved on), `fill(patch)`
  // sets other fields, and `hint(text, tone)` shows a note under this field.
  const runValueChange = (field, val) => {
    if (!field.onValueChange) return;
    field.onValueChange(val, {
      values: () => valuesRef.current,
      fill: (patch) => setValues((v) => ({ ...v, ...patch })),
      hint: (text, tone = "") =>
        setFieldHints((h) => ({ ...h, [field.key]: text ? { text, tone } : undefined })),
    });
  };

  // For an "auto-or-manual" field, `required` only actually applies while
  // "Manual" is the active mode — in "Auto" mode a value is always generated
  // for you, so there's nothing for the user to be blocked on.
  const isFieldRequired = (f) =>
    f.type === "auto-or-manual" ? f.required && fieldModes[f.key] === "manual" : f.required;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const errors = {};
    fields.forEach((f) => {
      if (f.type === "items") {
        if (f.required && (!Array.isArray(values[f.key]) || values[f.key].length === 0)) {
          errors[f.key] = "Add at least one row.";
        }
        return;
      }
      const filled = String(values[f.key] ?? "").trim();
      if (isFieldRequired(f) && !filled) errors[f.key] = `${f.label} is required.`;
      else if (f.type === "number" && f.min != null && filled && Number(values[f.key]) < f.min) {
        errors[f.key] = `${f.label} must be at least ${f.min}.`;
      } else if (f.type === "phone" && values[f.key] && String(values[f.key]).length !== 10) {
        errors[f.key] = `${f.label} must be a 10-digit mobile number.`;
      }
    });
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError(Object.keys(errors).length === 1 ? Object.values(errors)[0] : "Please fix the highlighted fields.");
      requestAnimationFrame(() => {
        document.querySelector(".add-form .field.has-error")?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="add-form" onSubmit={handleSubmit}>
      {error && <div className="login-error">{error}</div>}
      {fields.map((f) => (
        <div className={`field ${f.full ? "field-full" : ""}${fieldErrors[f.key] ? " has-error" : ""}`} key={f.key}>
          <label className={TOGGLE_PRESETS[f.type] ? "field-label-row" : undefined}>
            <span>
              {f.label}
              {isFieldRequired(f) && <span className="req"> *</span>}
            </span>
            {TOGGLE_PRESETS[f.type] && (
              <span className="field-mode-toggle">
                {TOGGLE_PRESETS[f.type].map((opt) => (
                  <button
                    key={opt.mode}
                    type="button"
                    className={fieldModes[f.key] === opt.mode ? "active" : ""}
                    onClick={() => setFieldMode(f, opt.mode)}
                  >
                    {opt.label}
                  </button>
                ))}
              </span>
            )}
          </label>
          {f.type === "items" ? (
            <ItemsEditor
              columns={f.columns || []}
              rows={values[f.key] || []}
              onChange={(rows) => {
                clearFieldError(f.key);
                setValues((v) => ({ ...v, [f.key]: rows }));
              }}
              computeRow={f.computeRow}
              emptyDefaults={f.emptyDefaults}
              addRowLabel={f.addRowLabel}
            />
          ) : f.type === "combo" ? (
            <SearchableSelect
              value={values[f.key]}
              onChange={(val) => setFieldValue(f, val)}
              options={f.options || []}
              placeholder={f.placeholder || `Select ${f.label.toLowerCase()}`}
              onCreate={f.onCreate}
              createLabel={f.createLabel || ((text) => `+ Add "${text}" as new ${f.label.toLowerCase()}`)}
            />
          ) : f.type === "select" || (f.type === "select-or-text" && fieldModes[f.key] === "select") ? (
            <SearchableSelect
              value={values[f.key]}
              onChange={(val) => setFieldValue(f, val)}
              options={f.options || []}
              placeholder={f.placeholder || `Select your ${f.label.toLowerCase()}`}
            />
          ) : f.type === "select-or-text" && fieldModes[f.key] === "text" ? (
            <input
              type="text"
              placeholder={`Enter new ${f.label.toLowerCase()}`}
              value={values[f.key]}
              onChange={handleChange(f)}
              autoComplete="off"
            />
          ) : f.type === "auto-or-manual" ? (
            <input
              type="text"
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={handleChange(f)}
              readOnly={fieldModes[f.key] === "auto"}
              className={fieldModes[f.key] === "auto" ? "field-readonly" : undefined}
              autoComplete="off"
            />
          ) : f.type === "phone" || f.type === "pincode" ? (
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={f.type === "phone" ? 10 : 6}
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={handleChange(f)}
              autoComplete="off"
              onKeyDown={(e) => {
                const allowedKeys = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
                if (!allowedKeys.includes(e.key) && !/^[0-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                }
              }}
            />
          ) : f.type === "date" ? (
            <DateInput value={values[f.key]} onChange={handleChange(f)} autoComplete="off" />
          ) : f.type === "barcode" ? (
            <>
              <div className="field-scan-row">
                <input
                  type="text"
                  placeholder={f.placeholder}
                  value={values[f.key]}
                  onChange={handleChange(f)}
                  autoComplete="off"
                />
                <button type="button" className="btn field-scan-btn" onClick={() => setScanningField(f.key)}>
                  <Icon name="scan" size={15} /> Scan
                </button>
              </div>
              {scanningField === f.key && (
                <Suspense fallback={null}>
                  <BarcodeScanner
                    onDetect={(code) => {
                      setScanningField("");
                      setFieldValue(f, code);
                    }}
                    onClose={() => setScanningField("")}
                  />
                </Suspense>
              )}
            </>
          ) : f.type === "textarea" ? (
            <textarea
              rows={3}
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={handleChange(f)}
              autoComplete="off"
            />
          ) : f.type === "password" ? (
            <PasswordInput
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={handleChange(f)}
              autoComplete="new-password"
            />
          ) : (
            <input
              type={f.type === "number" ? "number" : "text"}
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={handleChange(f)}
              autoComplete="off"
              readOnly={f.readOnly}
              className={f.readOnly ? "field-readonly" : undefined}
            />
          )}
          {fieldHints[f.key] && !fieldErrors[f.key] && (
            <span className={`field-hint${fieldHints[f.key].tone === "ok" ? " field-hint-ok" : fieldHints[f.key].tone === "warn" ? " field-hint-warn" : ""}`}>
              {fieldHints[f.key].text}
            </span>
          )}
          {fieldErrors[f.key] && <span className="field-error">{fieldErrors[f.key]}</span>}
        </div>
      ))}
      <div className="add-form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={submitting}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
