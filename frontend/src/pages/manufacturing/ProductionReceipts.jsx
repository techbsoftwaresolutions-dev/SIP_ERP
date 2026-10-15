import { Link } from "react-router-dom";
import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import { num } from "./manufacturingLookups";

// Yield = accepted / (accepted + rejected) for the run this receipt covers.
function yieldPct(row) {
  const accepted = Number(row.acceptedQty) || 0;
  const rejected = Number(row.rejectedQty) || 0;
  const total = accepted + rejected;
  if (total === 0) return "—";
  return `${Math.round((accepted / total) * 100)}%`;
}

// Read-only register, for the same reason as the material issue list: receipts
// are posted against a work order and corrected by cancelling.
export default function ProductionReceipts() {
  const columns = [
    { key: "id", header: "Receipt No.", render: (r) => <span className="cell-link">{r.id}</span> },
    {
      key: "workOrder",
      header: "Work Order",
      render: (r) => <Link to={`/manufacturing/work-orders/${r.workOrder}`}>{r.workOrder}</Link>,
    },
    { key: "product", header: "Product", render: (r) => <span className="cell-primary">{r.product}</span> },
    { key: "receiptDate", header: "Date", render: (r) => r.receiptDate || "—" },
    { key: "acceptedQty", header: "Accepted", render: (r) => `${num(r.acceptedQty)} ${r.unit || ""}`.trim() },
    { key: "rejectedQty", header: "Rejected", render: (r) => num(r.rejectedQty) },
    { key: "__yield", header: "Yield", render: yieldPct },
    { key: "batchNo", header: "Batch", render: (r) => r.batchNo || "—" },
    { key: "warehouse", header: "Warehouse", render: (r) => r.warehouse || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "__open",
      header: "",
      render: (r) => (
        <Link to={`/manufacturing/work-orders/${r.workOrder}`} className="icon-btn" title="Open work order">
          <Icon name="eye" />
        </Link>
      ),
    },
  ];

  return (
    <SimpleListPage
      title="Production Receipt"
      crumbs={["Dashboard", "Manufacturing", "Production Receipt"]}
      endpoint="/api/manufacturing/production-receipts"
      columns={columns}
      note={
        <>
          Finished goods are booked in from a work order — open one and use <strong>Book Production</strong>. Only the
          accepted quantity is added to stock; rejects are recorded for yield reporting.
        </>
      }
    />
  );
}
