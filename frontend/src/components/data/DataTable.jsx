import { useMemo, useState } from "react";
import Icon from "../ui/Icon";
import useTableStyle from "../../hooks/useTableStyle";

// Recognizes "10 Aug 2026" and "2026-09-30" specifically — not just "any
// string containing digits" — so things like "30 Days" or a PO number don't
// get misread as dates.
const DATE_PATTERN = /^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$|^\d{4}-\d{2}-\d{2}$/;

function toComparable(value) {
  if (value === null || value === undefined || value === "") return { type: "empty", val: "" };
  if (typeof value === "number") return { type: "number", val: value };
  if (typeof value === "boolean") return { type: "number", val: value ? 1 : 0 };
  const str = String(value);
  if (DATE_PATTERN.test(str)) {
    const parsed = Date.parse(str);
    if (!Number.isNaN(parsed)) return { type: "date", val: parsed };
  }
  return { type: "string", val: str.toLowerCase() };
}

function compareValues(a, b) {
  const ca = toComparable(a);
  const cb = toComparable(b);
  if (ca.type === "empty" && cb.type === "empty") return 0;
  if (ca.type === "empty") return -1;
  if (cb.type === "empty") return 1;
  if (ca.type === cb.type && (ca.type === "number" || ca.type === "date")) return ca.val - cb.val;
  return String(ca.val).localeCompare(String(cb.val), undefined, { numeric: true, sensitivity: "base" });
}

// A column is sortable when its underlying value (row[col.key]) is a plain
// string/number/boolean on at least one row — this automatically excludes
// Actions columns and any column whose `key` is just a display label with no
// matching field (e.g. a computed "packingItems" summary joined from
// `row.items`), without every page needing to opt in or out by hand.
function isSortable(col, rows) {
  if (col.sortable === false) return false;
  if (col.sortable === true) return true;
  return rows.some((r) => {
    const v = r[col.key];
    return typeof v === "string" || typeof v === "number" || typeof v === "boolean";
  });
}

export default function DataTable({
  columns,
  rows,
  loading,
  emptyText = "No records found.",
  // Row selection is opt-in: pass `selectedIds` (a Set of row ids) and
  // `onSelectionChange` to get the leading checkbox column. Pages that
  // don't pass them render exactly as before.
  selectedIds,
  onSelectionChange,
  // "cards" draws every row as its own soft card (the redesigned list pages).
  variant,
}) {
  const globalStyle = useTableStyle();
  const effectiveVariant = variant !== undefined ? variant : (globalStyle === "cards" ? "cards" : undefined);
  const [sort, setSort] = useState(null); // { key, dir: "asc" | "desc" }
  const selectable = Boolean(selectedIds && onSelectionChange);

  const sortableFlags = useMemo(
    () => Object.fromEntries(columns.map((col) => [col.key, isSortable(col, rows)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, rows.length]
  );

  const sortedRows = useMemo(() => {
    if (!sort || !sortableFlags[sort.key]) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => factor * compareValues(a[sort.key], b[sort.key]));
  }, [rows, sort, sortableFlags]);

  const toggleSort = (col) => {
    if (!sortableFlags[col.key]) return;
    setSort((prev) => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: "asc" };
      return { key: col.key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  // "Select all" covers the rows currently on screen — which is the page the
  // user is looking at, not the whole result set across every page.
  // Guarded on `selectable`: most tables pass no selection props at all.
  const pageIds = selectable ? sortedRows.map((r) => r.id).filter(Boolean) : [];
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someOnPageSelected = pageIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectionChange(next);
  };

  const toggleRow = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const colSpan = columns.length + (selectable ? 1 : 0);

  return (
    <div className={`data-table-wrap${effectiveVariant === "cards" ? " data-table-cards-wrap" : ""}`}>
      <table className={`data-table${effectiveVariant === "cards" ? " data-table-cards" : ""}`}>
        <thead>
          <tr>
            {selectable && (
              <th className="table-check-col">
                <input
                  type="checkbox"
                  className="table-check"
                  checked={allOnPageSelected}
                  // Partial page selection shows the dash state rather than
                  // an empty box, so it's clear something is already ticked.
                  ref={(el) => {
                    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all rows on this page"
                />
              </th>
            )}
            {columns.map((col) => {
              const sortable = sortableFlags[col.key];
              const active = sort && sort.key === col.key;
              return (
                <th
                  key={col.key}
                  className={sortable ? "sortable-th" : undefined}
                  onClick={sortable ? () => toggleSort(col) : undefined}
                >
                  <span className="th-label">
                    {col.header}
                    {sortable && (
                      <Icon
                        name={active && sort.dir === "desc" ? "chevronDown" : "chevronUp"}
                        size={12}
                        className={`th-sort-icon${active ? " active" : ""}`}
                      />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            // Grey placeholder rows in the shape of the table, so the page
            // looks laid out immediately instead of showing a lone spinner.
            Array.from({ length: 6 }, (_, r) => (
              <tr key={`sk-${r}`} className="skeleton-row" aria-hidden="true">
                {Array.from({ length: colSpan }, (_c, c) => (
                  <td key={c}><span className="skeleton-bar" style={{ width: `${55 + ((r * 7 + c * 13) % 35)}%` }} /></td>
                ))}
              </tr>
            ))
          ) : sortedRows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="loading-row">{emptyText}</td>
            </tr>
          ) : (
            sortedRows.map((row, idx) => {
              const checked = selectable && row.id ? selectedIds.has(row.id) : false;
              return (
                <tr key={row.id || idx} className={checked ? "row-selected" : undefined}>
                  {selectable && (
                    <td className="table-check-col">
                      {row.id && (
                        <input
                          type="checkbox"
                          className="table-check"
                          checked={checked}
                          onChange={() => toggleRow(row.id)}
                          aria-label={`Select ${row.id}`}
                        />
                      )}
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
