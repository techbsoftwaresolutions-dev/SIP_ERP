// Shared CSV export helpers — builds a CSV string from the same column
// definitions a DataTable already uses, then triggers a browser download.
// No backend involved; works on whatever rows are currently loaded.
// Resolves one cell the same way the other exporters do: an explicit
// `exportValue` wins, then a `render` that returns plain text (JSX renders
// like badges/links are skipped), then the raw field.
function csvCell(col, row) {
  if (typeof col.exportValue === "function") return col.exportValue(row);
  if (typeof col.render === "function") {
    const out = col.render(row);
    if (typeof out === "string" || typeof out === "number") return out;
  }
  return row[col.key];
}

export function toCSV(columns, rows) {
  const exportable = columns.filter(
    (c) => c.key !== "actions" && c.key !== "__actions" && c.key !== "__print" && c.key !== "__view"
  );
  const header = exportable.map((c) => c.header);
  const lines = [header.join(",")];
  rows.forEach((row) => {
    const line = exportable.map((c) => {
      const raw = csvCell(c, row);
      const value = raw === undefined || raw === null ? "" : String(raw).replace(/"/g, '""');
      return `"${value}"`;
    });
    lines.push(line.join(","));
  });
  return lines.join("\n");
}

export function downloadCSV(columns, rows, filename) {
  const csv = toCSV(columns, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
