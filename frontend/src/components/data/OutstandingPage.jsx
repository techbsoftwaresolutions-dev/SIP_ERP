import { useEffect, useState } from "react";
import api from "../../api/client";
import PageHeader from "../layout/PageHeader";
import DataTable from "./DataTable";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function OutstandingPage({ title, crumbs, endpoint, partyKey, partyLabel }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(endpoint)
      .then(setRows)
      .finally(() => setLoading(false));
  }, [endpoint]);

  const total = rows.reduce((a, r) => a + r.totalOutstanding, 0);

  const columns = [
    { key: partyKey, header: partyLabel, render: (r) => <span className="cell-primary">{r[partyKey]}</span> },
    { key: "invoiceCount", header: "Open Invoices" },
    { key: "totalOutstanding", header: "Outstanding (₹)", render: (r) => inr(r.totalOutstanding) },
  ];

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />

      <div className="summary-tiles" style={{ gridTemplateColumns: "repeat(2, 1fr)", maxWidth: "500px" }}>
        <div className="summary-tile">
          <div className="label">Total Outstanding</div>
          <div className="value">{inr(total)}</div>
        </div>
        <div className="summary-tile">
          <div className="label">{partyLabel}s With Balance</div>
          <div className="value">{rows.length}</div>
        </div>
      </div>

      <div className="card">
        <DataTable columns={columns} rows={rows} loading={loading} emptyText="No outstanding balances." />
      </div>
    </div>
  );
}
