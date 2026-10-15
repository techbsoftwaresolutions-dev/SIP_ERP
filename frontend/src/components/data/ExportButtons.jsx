import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import api from "../../api/client";
import { downloadPDFTable, downloadWordTable, downloadExcelTable } from "../../utils/exportDoc";
import { downloadCSV } from "../../utils/exportCsv";

// Single "Download" button with a dropdown offering PDF / Word / Excel for
// any list page. Fetches the full (unpaginated) dataset for `endpoint` — or
// uses `rows` if the caller already has the complete set loaded — and
// builds each document from the same `columns` the on-screen table uses.
export default function ExportButtons({ endpoint, columns, title, filenameBase, rows: providedRows, params, empty }) {
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState(false);
  const [nothing, setNothing] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const fetchAllRows = async () => {
    if (providedRows) return providedRows;
    const query = new URLSearchParams({ page: "1", pageSize: "5000", ...(params || {}) });
    const result = await api.get(`${endpoint}?${query.toString()}`);
    return result.data || result || [];
  };

  const run = async (kind, fn, ext) => {
    if (busy) return;
    setBusy(kind);
    try {
      const rows = await fetchAllRows();
      if (!rows.length) {
        setNothing(true);
        setTimeout(() => setNothing(false), 2500);
        return;
      }
      const filename = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      fn(columns, rows, title, filename);
    } finally {
      setBusy("");
      setOpen(false);
    }
  };

  const nothingToDownload = empty || (Array.isArray(providedRows) && providedRows.length === 0);

  return (
    <div className="export-btn-group" ref={wrapRef}>
      <button type="button" className="btn" onClick={() => setOpen((o) => !o)} disabled={!!busy || nothingToDownload} title={nothingToDownload ? "No records to download" : "Download"}>
        <Icon name="download" size={15} /> <Icon name="chevronDown" size={14} />
      </button>
      {nothing && (
        <div className="topbar-dropdown export-dropdown" onMouseLeave={() => setNothing(false)}>
          <div className="topbar-dropdown-item">No records to download.</div>
        </div>
      )}
      {open && (
        <div className="topbar-dropdown export-dropdown">
          <button type="button" className="topbar-dropdown-item" onClick={() => run("pdf", downloadPDFTable, "pdf")}>
            <Icon name="download" size={15} /> PDF
          </button>
          <button type="button" className="topbar-dropdown-item" onClick={() => run("word", downloadWordTable, "doc")}>
            <Icon name="download" size={15} /> Word
          </button>
          <button type="button" className="topbar-dropdown-item" onClick={() => run("excel", downloadExcelTable, "xls")}>
            <Icon name="download" size={15} /> Excel
          </button>
          <button
            type="button"
            className="topbar-dropdown-item"
            onClick={() => run("csv", (cols, rws, _title, fname) => downloadCSV(cols, rws, fname), "csv")}
          >
            <Icon name="download" size={15} /> CSV
          </button>
        </div>
      )}
    </div>
  );
}
