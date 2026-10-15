import { Link } from "react-router-dom";
import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import { num } from "./manufacturingLookups";

// Share of the planned quantity already booked in as good output.
function Progress({ row }) {
  const planned = Number(row.plannedQty) || 0;
  const produced = Number(row.producedQty) || 0;
  const pct = planned > 0 ? Math.min(100, Math.round((produced / planned) * 100)) : 0;
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        {num(produced)} / {num(planned)} {row.unit || ""} ({pct}%)
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--border, #e5e7eb)", overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: pct >= 100 ? "var(--green, #16a34a)" : "var(--primary, #2563eb)",
          }}
        />
      </div>
    </div>
  );
}

export default function WorkOrders() {
  const columns = [
    { key: "id", header: "WO No.", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "product", header: "Product", render: (r) => <span className="cell-primary">{r.product}</span> },
    { key: "bom", header: "BOM", render: (r) => r.bom || "—" },
    { key: "plannedQty", header: "Progress", render: (r) => <Progress row={r} /> },
    { key: "rejectedQty", header: "Rejected", render: (r) => num(r.rejectedQty) },
    { key: "workCenter", header: "Work Center", render: (r) => r.workCenter || "—" },
    { key: "dueDate", header: "Due", render: (r) => r.dueDate || "—" },
    { key: "priority", header: "Priority", render: (r) => <StatusBadge status={r.priority} /> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <SimpleListPage
      title="Work Orders"
      crumbs={["Dashboard", "Manufacturing", "Work Orders"]}
      endpoint="/api/manufacturing/work-orders"
      columns={columns}
      addConfig={{ buttonLabel: "+ New Work Order", fields: [] }}
      addHref="/manufacturing/work-orders/new"
      editHref={(row) => `/manufacturing/work-orders/${row.id}/edit`}
      detailHref={(row) => `/manufacturing/work-orders/${encodeURIComponent(row.id)}`}
      rowActions={(row) => (
        <Link to={`/manufacturing/work-orders/${row.id}`} className="icon-btn" title="View">
          <Icon name="eye" />
        </Link>
      )}
    />
  );
}
