import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";

const STATUS_META = {
  Normal: { icon: "checkCircle", label: "Normal" },
  "Low Stock": { icon: "alertCircle", label: "Low Stock" },
  "Out of Stock": { icon: "xCircle", label: "Out of Stock" },
};

const qtyFmt = (n) => (Number(n) || 0).toLocaleString("en-IN");

// The Stock Overview rows are computed/aggregated (no per-row GET on the
// backend), so the row is passed through router state on click. On a direct
// URL / refresh we fall back to fetching the full list and finding it by id.
export default function StockDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [row, setRow] = useState(location.state && location.state.row ? location.state.row : null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (row) return;
    api
      .get("/api/inventory?page=1&pageSize=5000")
      .then((r) => {
        const match = (r.data || []).find((x) => String(x.id) === decodeURIComponent(id));
        if (match) setRow(match);
        else setError("Could not find that stock item.");
      })
      .catch(() => setError("Could not load stock details."));
  }, [id, row]);

  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  useEffect(() => {
    if (!row?.productName) return;
    setLoadingMovements(true);
    api
      .get(`/api/inventory/movements?product=${encodeURIComponent(row.productName)}`)
      .then((data) => setMovements(Array.isArray(data) ? data : []))
      .catch(() => setMovements([]))
      .finally(() => setLoadingMovements(false));
  }, [row?.productName]);

  if (error) {
    return (
      <div>
        <PageHeader title="Stock Details" crumbs={["Dashboard", "Inventory", "Stock Overview", "Details"]} />
        <div className="loading-row">{error}</div>
      </div>
    );
  }

  if (!row) {
    return (
      <div>
        <PageHeader title="Stock Details" crumbs={["Dashboard", "Inventory", "Stock Overview", "Details"]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const meta = STATUS_META[row.stockStatus] || STATUS_META.Normal;
  const available = Number(row.available) || 0;
  const reserved = Number(row.reserved) || 0;
  const damaged = Number(row.damaged) || 0;
  const netAvailable = available - reserved;
  const totalOnHand = available + damaged;

  return (
    <div>
      <PageHeader
        title={`Stock — ${row.productName}`}
        crumbs={["Dashboard", "Inventory", "Stock Overview", row.productName]}
        actions={
          <>
            <button type="button" className="btn" onClick={() => navigate("/inventory")}>
              <Icon name="arrowLeft" size={15} /> Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate("/inventory/stock-in/new", { state: { product: row.productName, warehouse: row.warehouse, unit: row.unit } })}
            >
              <Icon name="download" size={15} /> Stock In
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => navigate("/inventory/stock-out/new", { state: { product: row.productName, warehouse: row.warehouse, unit: row.unit } })}
            >
              <Icon name="upload" size={15} /> Stock Out
            </button>
          </>
        }
      />

      <div className="list-card">
        <div className="section-title">Item Details</div>
        <div className="detail-grid">
          <div className="detail-field">
            <label>Product Code</label>
            <div className="detail-value">{row.productCode || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Product Name</label>
            <div className="detail-value">{row.productName || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Category</label>
            <div className="detail-value">{row.category || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Brand</label>
            <div className="detail-value">{row.brand || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Warehouse</label>
            <div className="detail-value">{row.warehouse || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Unit</label>
            <div className="detail-value">{row.unit || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Stock Status</label>
            <div className="detail-value">
              <span className="icon-text"><Icon name={meta.icon} size={15} /> {meta.label}</span>
            </div>
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Stock Position</div>
        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Available</th>
                <th>Reserved</th>
                <th>Damaged</th>
                <th>Net Available</th>
                <th>Total On Hand</th>
                <th>Unit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{qtyFmt(available)}</td>
                <td>{qtyFmt(reserved)}</td>
                <td>{qtyFmt(damaged)}</td>
                <td>{qtyFmt(netAvailable)}</td>
                <td>{qtyFmt(totalOnHand)}</td>
                <td>{row.unit || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 32, marginBottom: 14 }}>
          <div className="section-title" style={{ margin: 0 }}>Stock Movements & Particulars</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => navigate("/inventory/stock-in/new", { state: { product: row.productName, warehouse: row.warehouse, unit: row.unit } })}
            >
              <Icon name="download" size={14} /> Stock In
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => navigate("/inventory/stock-out/new", { state: { product: row.productName, warehouse: row.warehouse, unit: row.unit } })}
            >
              <Icon name="upload" size={14} /> Stock Out
            </button>
          </div>
        </div>

        <div className="items-table-wrap">
          <table className="items-table">
            <thead>
              <tr>
                <th>Txn No.</th>
                <th>Date</th>
                <th>Type</th>
                <th>Reference / Particulars</th>
                <th>Batch No.</th>
                <th>Warehouse</th>
                <th>Qty</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loadingMovements ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: 24 }}><Loader /></td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="items-empty" style={{ textAlign: "center", padding: 24 }}>
                    No stock movements recorded for this item yet.
                  </td>
                </tr>
              ) : (
                movements.map((m) => {
                  const isIn = m.type === "In";
                  const isOut = m.type === "Out";
                  const isTransfer = m.type === "Transfer";
                  const qty = Number(m.acceptedQty) > 0 ? Number(m.acceptedQty) : Number(m.quantity) || 0;
                  const qtyColor = isIn ? "var(--green)" : isOut ? "var(--red)" : "var(--blue)";
                  const sign = isIn ? "+" : isOut ? "−" : "";

                  return (
                    <tr key={m.id || m._id}>
                      <td><span className="cell-link">{m.id}</span></td>
                      <td>{m.date || "—"}</td>
                      <td>
                        <span className={`sb-pill ${isIn ? "full" : isOut ? "partial" : ""}`} style={{ fontSize: 11, padding: "2px 8px" }}>
                          {isIn ? "Stock In" : isOut ? "Stock Out" : m.type}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {isIn ? (m.supplier ? `Supplier: ${m.supplier}` : (m.poNumber || m.grnNumber || "Purchase Receipt")) :
                           isOut ? (m.departmentOrCustomer ? `Party: ${m.departmentOrCustomer}` : (m.issueType || m.referenceNo || "Dispatch")) :
                           isTransfer ? `To: ${m.toWarehouse || "—"}` : (m.reason || "Adjustment")}
                        </div>
                        {(m.poNumber || m.grnNumber || m.referenceNo) && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                            {[m.poNumber && `PO: ${m.poNumber}`, m.grnNumber && `GRN: ${m.grnNumber}`, m.referenceNo && `Ref: ${m.referenceNo}`].filter(Boolean).join(" | ")}
                          </div>
                        )}
                      </td>
                      <td>{m.batchNo || "—"}</td>
                      <td>{m.warehouse || "—"}</td>
                      <td>
                        <strong style={{ color: qtyColor }}>
                          {sign}{qty.toLocaleString("en-IN")} {m.unit || row.unit || "Nos"}
                        </strong>
                      </td>
                      <td>
                        <span className="cell-sub">{m.status || "Completed"}</span>
                      </td>
                      <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.reason || "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
