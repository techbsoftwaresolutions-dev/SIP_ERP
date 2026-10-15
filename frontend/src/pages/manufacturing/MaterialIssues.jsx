import { Link } from "react-router-dom";
import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import UserCell from "../../components/ui/UserCell";
import { inr, num } from "./manufacturingLookups";

// Read-only register. Issues are posted from the work order screen (where the
// outstanding quantities are known) and corrected by cancelling, never by
// editing — a posted stock movement must not be rewritten in place.
export default function MaterialIssues() {
  const columns = [
    { key: "id", header: "Issue No.", render: (r) => <span className="cell-link">{r.id}</span> },
    {
      key: "workOrder",
      header: "Work Order",
      render: (r) => <Link to={`/manufacturing/work-orders/${r.workOrder}`}>{r.workOrder}</Link>,
    },
    { key: "product", header: "For Product", render: (r) => <span className="cell-primary">{r.product || "—"}</span> },
    { key: "issueDate", header: "Date", render: (r) => r.issueDate || "—" },
    { key: "warehouse", header: "Warehouse", render: (r) => r.warehouse || "—" },
    { key: "items", header: "Lines", render: (r) => (r.items || []).length },
    { key: "totalQty", header: "Total Qty", render: (r) => num(r.totalQty) },
    { key: "totalValue", header: "Value", render: (r) => inr(r.totalValue) },
    { key: "issuedBy", header: "Issued By", render: (r) => <UserCell name={r.issuedBy} /> },
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
      title="Material Issue"
      crumbs={["Dashboard", "Manufacturing", "Material Issue"]}
      endpoint="/api/manufacturing/material-issues"
      columns={columns}
      note={
        <>
          Material is issued from a work order, which knows what is still outstanding — open one and use{" "}
          <strong>Issue Material</strong>. To correct a posted issue, cancel it there; that returns the stock.
        </>
      }
    />
  );
}
