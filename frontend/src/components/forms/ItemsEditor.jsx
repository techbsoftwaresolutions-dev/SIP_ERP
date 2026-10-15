import SearchableSelect from "./SearchableSelect";
import DateInput from "./DateInput";
import TagsCell from "./TagsCell";

export default function ItemsEditor({ columns, rows, onChange, computeRow, addRowLabel = "+ Add Item", emptyDefaults }) {
  const makeEmptyRow = () => {
    const row = { ...(emptyDefaults || {}) };
    columns.forEach((c) => {
      if (row[c.key] === undefined) row[c.key] = c.type === "tags" ? [] : "";
    });
    return computeRow ? computeRow(row) : row;
  };

  const updateRow = (idx, key, value) => {
    const newRows = rows.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [key]: value };
      // A column can auto-fill other cells in the same row from the matched
      // lookup record (e.g. picking an Item fills in Unit/Tax/Price) — the
      // user can still freely edit any of those afterward.
      const col = columns.find((c) => c.key === key);
      if (col && col.deriveFrom) {
        const match = (col.deriveFrom.source || []).find((rec) => rec[col.deriveFrom.match] === value);
        if (match) {
          Object.entries(col.deriveFrom.fields).forEach(([targetKey, sourceKey]) => {
            updated[targetKey] = match[sourceKey] ?? updated[targetKey];
          });
        }
      }
      return updated;
    });
    const computed = computeRow ? newRows.map((r) => computeRow(r)) : newRows;
    onChange(computed);
  };

  const addRow = () => onChange([...rows, makeEmptyRow()]);
  const removeRow = (idx) => onChange(rows.filter((_, i) => i !== idx));

  return (
    <div className="items-editor">
      <div className="items-table-wrap">
        <table className="items-table">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="items-empty">No items added yet.</td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      {c.readOnly ? (
                        <span>{typeof row[c.key] === "number" ? row[c.key].toLocaleString("en-IN") : row[c.key]}</span>
                      ) : c.type === "tags" ? (
                        <TagsCell
                          values={Array.isArray(row[c.key]) ? row[c.key] : []}
                          onChange={(next) => updateRow(idx, c.key, next)}
                          scan={c.scan}
                        />
                      ) : c.type === "combo" ? (
                        <SearchableSelect
                          value={row[c.key] || ""}
                          onChange={(val) => updateRow(idx, c.key, val)}
                          options={c.options || []}
                          placeholder={c.placeholder || "Select..."}
                          onCreate={c.onCreate}
                          createLabel={c.createLabel}
                        />
                      ) : c.type === "select" ? (
                        <SearchableSelect
                          value={row[c.key] || ""}
                          onChange={(val) => updateRow(idx, c.key, val)}
                          options={c.options || []}
                          placeholder="Select..."
                        />
                      ) : c.type === "date" ? (
                        <DateInput
                          
                          value={row[c.key] || ""}
                          onChange={(e) => updateRow(idx, c.key, e.target.value)}
                        />
                      ) : (
                        <input
                          type={c.type === "number" ? "number" : "text"}
                          value={row[c.key] ?? ""}
                          onChange={(e) => updateRow(idx, c.key, e.target.value)}
                        />
                      )}
                    </td>
                  ))}
                  <td>
                    <button type="button" className="icon-btn" onClick={() => removeRow(idx)} title="Remove">×</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn" onClick={addRow} style={{ marginTop: "10px" }}>
        {addRowLabel}
      </button>
    </div>
  );
}
