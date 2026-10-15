import { useCustomFields } from "../../hooks/useCustomFields";
import DateInput from "./DateInput";
import SearchableSelect from "./SearchableSelect";

// Drops a client's custom fields into a hand-rolled, multi-section document
// form (Purchase Invoice, Purchase Order, Goods Receipt, Purchase Return,
// Sales Invoice) that keeps its own `useState` per field rather than one
// flat values object — so this is controlled directly via `values`/`onChange`
// instead of the pack/unpack helpers the simpler field-list forms use.
// Renders nothing (not even a heading) when the client has no custom fields
// defined for this entity, so an empty section never clutters the form.
export default function CustomFieldsSection({ entity, values, onChange }) {
  const { defs, addOption } = useCustomFields(entity);
  if (defs.length === 0) return null;

  const setField = (key, v) => onChange({ ...values, [key]: v });

  return (
    <div className="txn-header-fields" style={{ marginTop: 18 }}>
      {defs.map((d) => (
        <div className="field" key={d.id} style={d.type === "textarea" ? { gridColumn: "1 / -1" } : undefined}>
          <label>
            {d.label}
            {d.required && <span className="req"> *</span>}
          </label>
          {d.type === "select" ? (
            <SearchableSelect
              value={values[d.key] || ""}
              onChange={(v) => setField(d.key, v)}
              options={d.options || []}
              placeholder="Select or type to add new..."
              onCreate={(text) => addOption(d, text)}
              createLabel={(text) => `+ Add "${text}" as a new option`}
            />
          ) : d.type === "textarea" ? (
            <textarea rows={3} value={values[d.key] || ""} onChange={(e) => setField(d.key, e.target.value)} />
          ) : d.type === "date" ? (
            <DateInput value={values[d.key] || ""} onChange={(e) => setField(d.key, e.target.value)} />
          ) : (
            <input
              type={d.type === "number" ? "number" : "text"}
              value={values[d.key] || ""}
              onChange={(e) => setField(d.key, e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}
