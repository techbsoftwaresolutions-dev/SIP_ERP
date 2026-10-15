import { useState } from "react";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/ui/Icon";
import Toast from "../../components/ui/Toast";

const INCLUDED = [
  "Customers and suppliers, with their groups",
  "Categories, brands, warehouses and items",
  "Purchase orders, goods receipts, invoices and returns",
  "Sales orders, enquiries, quotations, delivery challans, invoices and returns",
  "Stock movements, ledger entries and maintenance tasks",
  "Manufacturing: BOMs, work centres, machines, work orders, job cards, material issues and production receipts",
  "Users (without passwords), roles and company settings",
];

export default function BackupRestore() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const handleExport = async () => {
    setBusy(true);
    setError("");
    try {
      const name = await api.download("/api/backup/export", "siperp-backup.json");
      setToast(`Backup downloaded: ${name}`);
      setTimeout(() => setToast(""), 4000);
    } catch (err) {
      setError(err.message || "Could not create the backup. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Backup & Restore" crumbs={["Dashboard", "Settings", "Backup & Restore"]} />

      <div className="list-card" style={{ marginBottom: "18px" }}>
        <div className="section-title">Export Data</div>
        <p style={{ color: "var(--text-muted)", fontSize: "13.5px", marginBottom: "12px" }}>
          Download a backup file (JSON) of your company's data. Keep it somewhere safe — it is a complete copy of your records.
        </p>
        {error && <div className="login-error">{error}</div>}
        <ul style={{ color: "var(--text-muted)", fontSize: "13px", margin: "0 0 16px", paddingLeft: "18px", lineHeight: 1.7 }}>
          {INCLUDED.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p style={{ color: "var(--text-light)", fontSize: "12.5px", margin: "0 0 16px" }}>
          For safety, passwords and the email-server password are never written to the file.
        </p>
        <button className="btn btn-primary" onClick={handleExport} disabled={busy}>
          <Icon name="download" size={15} /> {busy ? "Preparing backup…" : "Export Full Backup"}
        </button>
      </div>

      <div className="list-card">
        <div className="section-title">Restore Data</div>
        <p style={{ color: "var(--text-muted)", fontSize: "13.5px", marginBottom: "16px" }}>
          Restoring from a backup file isn't available yet in this build. If you need it, let your developer know — it can be added as a follow-up.
        </p>
        <input type="file" accept="application/json" disabled style={{ opacity: 0.6 }} />
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
