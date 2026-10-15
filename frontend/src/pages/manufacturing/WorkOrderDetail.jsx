import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Modal from "../../components/ui/Modal";
import AddRecordForm from "../../components/forms/AddRecordForm";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Loader from "../../components/ui/Loader";
import Icon from "../../components/ui/Icon";
import { usePermissions } from "../../context/PermissionsContext";
import UserCell from "../../components/ui/UserCell";
import { UNITS, inr, num } from "./manufacturingLookups";
import Toast from "../../components/ui/Toast";

// The one screen that ties the cycle together: what this order needs, what has
// been issued to it, what has come off the line, and the actions that move
// each of those forward.
export default function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermissions();
  const canEdit = can("manufacturing", "edit");
  const canCreate = can("manufacturing", "create");

  const [order, setOrder] = useState(null);
  const [jobCards, setJobCards] = useState([]);
  const [issues, setIssues] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(location.state?.toast || "");
  const [busy, setBusy] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const load = useCallback(async () => {
    const q = `?workOrder=${encodeURIComponent(id)}&page=1&pageSize=100`;
    const [o, jc, mi, pr] = await Promise.all([
      api.get(`/api/manufacturing/work-orders/${encodeURIComponent(id)}`),
      api.get(`/api/manufacturing/job-cards${q}`).catch(() => ({ data: [] })),
      api.get(`/api/manufacturing/material-issues${q}`).catch(() => ({ data: [] })),
      api.get(`/api/manufacturing/production-receipts${q}`).catch(() => ({ data: [] })),
    ]);
    setOrder(o);
    setJobCards(jc.data || []);
    setIssues(mi.data || []);
    setReceipts(pr.data || []);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => setError(err.message || "Could not load this work order."))
      .finally(() => setLoading(false));
  }, [load]);

  // Clear the one-shot toast passed in router state so a refresh doesn't repeat it.
  useEffect(() => {
    if (location.state?.toast) navigate(location.pathname, { replace: true, state: {} });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (key, fn, successMsg) => {
    setBusy(key);
    try {
      await fn();
      await load();
      if (successMsg) flash(successMsg);
    } catch (err) {
      flash(err.message || "Something went wrong.");
    } finally {
      setBusy("");
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Work Order" crumbs={["Dashboard", "Manufacturing", "Work Orders"]} />
        <div className="loading-row" style={{ padding: 48, textAlign: "center" }}>
          <Loader />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div>
        <PageHeader title="Work Order" crumbs={["Dashboard", "Manufacturing", "Work Orders"]} />
        <div className="list-card">
          <div className="login-error">{error || "Work order not found."}</div>
        </div>
      </div>
    );
  }

  const isDraft = order.status === "Draft";
  const isClosed = order.status === "Cancelled";
  const planned = Number(order.plannedQty) || 0;
  const produced = Number(order.producedQty) || 0;
  const pct = planned > 0 ? Math.min(100, Math.round((produced / planned) * 100)) : 0;
  const remaining = Math.max(0, planned - produced);

  // Short pick list for the issue form: every requirement still short, with the
  // outstanding quantity pre-filled so the common case is one click.
  const shortfall = (order.requirements || [])
    .map((r) => ({ ...r, pending: Math.max(0, (Number(r.requiredQty) || 0) - (Number(r.issuedQty) || 0)) }))
    .filter((r) => r.pending > 0);

  const requirementColumns = [
    { key: "item", header: "Item", render: (r) => <span className="cell-primary">{r.item}</span> },
    { key: "requiredQty", header: "Required", render: (r) => `${num(r.requiredQty)} ${r.unit || ""}`.trim() },
    { key: "issuedQty", header: "Issued", render: (r) => num(r.issuedQty) },
    {
      key: "pending",
      header: "Pending",
      render: (r) => {
        const pending = (Number(r.requiredQty) || 0) - (Number(r.issuedQty) || 0);
        return (
          <span style={{ color: pending > 0 ? "var(--red, #dc2626)" : "var(--green, #16a34a)" }}>{num(pending)}</span>
        );
      },
    },
    { key: "rate", header: "Rate", render: (r) => inr(r.rate) },
    { key: "amount", header: "Amount", render: (r) => inr(r.amount) },
  ];

  const jobCardColumns = [
    { key: "id", header: "Job Card" },
    { key: "sequence", header: "Seq" },
    { key: "operation", header: "Operation", render: (r) => <span className="cell-primary">{r.operation}</span> },
    { key: "workCenter", header: "Work Center", render: (r) => r.workCenter || "—" },
    { key: "machine", header: "Machine", render: (r) => r.machine || "—" },
    { key: "operator", header: "Operator", render: (r) => <UserCell name={r.operator} /> },
    { key: "completedQty", header: "Completed", render: (r) => num(r.completedQty) },
    { key: "rejectedQty", header: "Rejected", render: (r) => num(r.rejectedQty) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const issueColumns = [
    { key: "id", header: "Issue No.", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "issueDate", header: "Date", render: (r) => r.issueDate || "—" },
    { key: "items", header: "Lines", render: (r) => (r.items || []).length },
    { key: "totalQty", header: "Total Qty", render: (r) => num(r.totalQty) },
    { key: "totalValue", header: "Value", render: (r) => inr(r.totalValue) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "__cancel",
      header: "",
      render: (r) =>
        canEdit && r.status === "Issued" ? (
          <button
            type="button"
            className="icon-btn danger"
            title="Cancel this issue and return its material to stock"
            onClick={() => setCancelTarget({ kind: "material-issues", row: r })}
          >
            <Icon name="arrowLeft" />
          </button>
        ) : null,
    },
  ];

  const receiptColumns = [
    { key: "id", header: "Receipt No.", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "receiptDate", header: "Date", render: (r) => r.receiptDate || "—" },
    { key: "acceptedQty", header: "Accepted", render: (r) => num(r.acceptedQty) },
    { key: "rejectedQty", header: "Rejected", render: (r) => num(r.rejectedQty) },
    { key: "batchNo", header: "Batch", render: (r) => r.batchNo || "—" },
    { key: "warehouse", header: "Warehouse", render: (r) => r.warehouse || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "__cancel",
      header: "",
      render: (r) =>
        canEdit && r.status === "Accepted" ? (
          <button
            type="button"
            className="icon-btn danger"
            title="Cancel this receipt and reverse its stock"
            onClick={() => setCancelTarget({ kind: "production-receipts", row: r })}
          >
            <Icon name="arrowLeft" />
          </button>
        ) : null,
    },
  ];

  const issueFields = [
    {
      key: "items",
      label: "Material to Issue",
      type: "items",
      required: true,
      full: true,
      addRowLabel: "+ Add Line",
      computeRow: (row) => ({
        ...row,
        amount: Math.round((Number(row.qty) || 0) * (Number(row.rate) || 0) * 100) / 100,
      }),
      emptyDefaults: { unit: order.unit || "Nos", qty: 0, rate: 0 },
      columns: [
        {
          key: "item",
          label: "Item",
          type: "combo",
          options: (order.requirements || []).map((r) => r.item),
          deriveFrom: {
            source: order.requirements || [],
            match: "item",
            fields: { unit: "unit", rate: "rate" },
          },
        },
        { key: "qty", label: "Qty", type: "number" },
        { key: "unit", label: "Unit", type: "select", options: UNITS },
        { key: "rate", label: "Rate (₹)", type: "number" },
        { key: "amount", label: "Amount (₹)", readOnly: true },
        { key: "batchNo", label: "Batch" },
      ],
    },
    { key: "issueDate", label: "Issue Date", type: "date" },
    { key: "issuedBy", label: "Issued By" },
    { key: "receivedBy", label: "Received By" },
    { key: "notes", label: "Notes", type: "textarea", full: true },
  ];

  const receiptFields = [
    {
      key: "acceptedQty",
      label: "Accepted Quantity",
      type: "number",
      defaultValue: remaining || "",
      placeholder: `${num(remaining)} still to produce`,
    },
    { key: "rejectedQty", label: "Rejected Quantity", type: "number" },
    { key: "unit", label: "Unit", type: "select", options: UNITS, defaultValue: order.unit || "Nos" },
    { key: "batchNo", label: "Batch No." },
    { key: "receiptDate", label: "Receipt Date", type: "date" },
    { key: "receivedBy", label: "Received By" },
    { key: "inspectedBy", label: "Inspected By" },
    { key: "rejectionReason", label: "Rejection Reason", full: true },
    { key: "notes", label: "Notes", type: "textarea", full: true },
  ];

  return (
    <div>
      <PageHeader
        title={`Work Order ${order.id}`}
        crumbs={["Dashboard", "Manufacturing", "Work Orders", order.id]}
        actions={
          <>
            {canEdit && isDraft && (
              <button
                className="btn btn-primary"
                disabled={busy === "release"}
                onClick={() =>
                  act(
                    "release",
                    () => api.put(`/api/manufacturing/work-orders/${encodeURIComponent(order.id)}`, { status: "Released" }),
                    "Work order released — material can now be issued."
                  )
                }
              >
                {busy === "release" ? "Releasing..." : "Release Order"}
              </button>
            )}
            {canCreate && !isDraft && !isClosed && (
              <>
                <button className="btn" onClick={() => setIssueOpen(true)}>
                  Issue Material
                </button>
                <button className="btn btn-primary" onClick={() => setReceiptOpen(true)}>
                  Book Production
                </button>
              </>
            )}
            {canCreate && jobCards.length === 0 && order.bom && (
              <button
                className="btn"
                disabled={busy === "jc"}
                onClick={() =>
                  act(
                    "jc",
                    () => api.post(`/api/manufacturing/work-orders/${encodeURIComponent(order.id)}/job-cards`),
                    "Job cards generated from the BOM routing."
                  )
                }
              >
                {busy === "jc" ? "Generating..." : "Generate Job Cards"}
              </button>
            )}
            {canEdit && (
              <Link to={`/manufacturing/work-orders/${order.id}/edit`} className="btn">
                Edit
              </Link>
            )}
          </>
        }
      />

      <div className="list-card">
        <div className="section-title">Order Summary</div>
        <div className="detail-grid">
          <div className="detail-field">
            <label>Product</label>
            <div>{order.product}</div>
          </div>
          <div className="detail-field">
            <label>BOM</label>
            <div>{order.bom || "— (no BOM; requirements entered manually)"}</div>
          </div>
          <div className="detail-field">
            <label>Planned</label>
            <div>
              {num(order.plannedQty)} {order.unit}
            </div>
          </div>
          <div className="detail-field">
            <label>Produced</label>
            <div>
              {num(order.producedQty)} {order.unit} ({pct}%)
            </div>
          </div>
          <div className="detail-field">
            <label>Rejected</label>
            <div>{num(order.rejectedQty)}</div>
          </div>
          <div className="detail-field">
            <label>Status</label>
            <div>
              <StatusBadge status={order.status} />
            </div>
          </div>
          <div className="detail-field">
            <label>Priority</label>
            <div>
              <StatusBadge status={order.priority} />
            </div>
          </div>
          <div className="detail-field">
            <label>Work Center</label>
            <div>{order.workCenter || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Machine</label>
            <div>{order.machine || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Warehouse</label>
            <div>{order.warehouse || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Sales Order</label>
            <div>{order.salesOrder || "— (to stock)"}</div>
          </div>
          <div className="detail-field">
            <label>Customer</label>
            <div>{order.customer || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Start / Due</label>
            <div>
              {order.startDate || "—"} → {order.dueDate || "—"}
            </div>
          </div>
          <div className="detail-field">
            <label>Completed</label>
            <div>{order.completedDate || "—"}</div>
          </div>
          <div className="detail-field">
            <label>Material Cost</label>
            <div>{inr(order.materialCost)}</div>
          </div>
          <div className="detail-field">
            <label>Total Cost</label>
            <div>{inr(order.totalCost)}</div>
          </div>
        </div>
        {order.notes && (
          <p className="muted" style={{ marginBottom: 0 }}>
            {order.notes}
          </p>
        )}
      </div>

      <div className="list-card">
        <div className="section-title">Material Requirements</div>
        <DataTable columns={requirementColumns} rows={order.requirements || []} />
      </div>

      <div className="list-card">
        <div className="section-title">Job Cards ({jobCards.length})</div>
        <DataTable columns={jobCardColumns} rows={jobCards} />
      </div>

      <div className="list-card">
        <div className="section-title">Material Issues ({issues.length})</div>
        <DataTable columns={issueColumns} rows={issues} />
      </div>

      <div className="list-card">
        <div className="section-title">Production Receipts ({receipts.length})</div>
        <DataTable columns={receiptColumns} rows={receipts} />
      </div>

      {issueOpen && (
        <Modal title={`Issue Material to ${order.id}`} onClose={() => setIssueOpen(false)}>
          <AddRecordForm
            fields={issueFields}
            initialValues={{
              // Pre-load every outstanding line so the usual "issue what's
              // short" case needs no typing.
              items: shortfall.map((r) => ({
                item: r.item,
                qty: r.pending,
                unit: r.unit,
                rate: r.rate,
                batchNo: "",
              })),
            }}
            submitLabel="Post Issue"
            onCancel={() => setIssueOpen(false)}
            onSubmit={async (values) => {
              await api.post("/api/manufacturing/material-issues", { ...values, workOrder: order.id });
              setIssueOpen(false);
              await load();
              flash("Material issued — raw material stock reduced.");
            }}
          />
        </Modal>
      )}

      {receiptOpen && (
        <Modal title={`Book Production from ${order.id}`} onClose={() => setReceiptOpen(false)}>
          <AddRecordForm
            fields={receiptFields}
            submitLabel="Post Receipt"
            onCancel={() => setReceiptOpen(false)}
            onSubmit={async (values) => {
              await api.post("/api/manufacturing/production-receipts", { ...values, workOrder: order.id });
              setReceiptOpen(false);
              await load();
              flash("Production booked — finished goods added to stock.");
            }}
          />
        </Modal>
      )}

      {cancelTarget && (
        <ConfirmDialog
          title={cancelTarget.kind === "material-issues" ? "Cancel material issue" : "Cancel production receipt"}
          message={
            cancelTarget.kind === "material-issues"
              ? `Cancel ${cancelTarget.row.id}? Its material goes back into stock and the issued quantities on this order are rewound.`
              : `Cancel ${cancelTarget.row.id}? Its finished goods are removed from stock and this order's produced quantity is rewound.`
          }
          confirming={busy === "cancel"}
          onCancel={() => setCancelTarget(null)}
          onConfirm={async () => {
            const { kind, row } = cancelTarget;
            setCancelTarget(null);
            await act(
              "cancel",
              () => api.post(`/api/manufacturing/${kind}/${encodeURIComponent(row.id)}/cancel`),
              `${row.id} cancelled and its stock movement reversed.`
            );
          }}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
