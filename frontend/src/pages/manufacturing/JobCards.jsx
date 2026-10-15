import { Link } from "react-router-dom";
import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import UserCell from "../../components/ui/UserCell";
import { num } from "./manufacturingLookups";

export default function JobCards() {
  const columns = [
    { key: "id", header: "Job Card", render: (r) => <span className="cell-link">{r.id}</span> },
    {
      key: "workOrder",
      header: "Work Order",
      render: (r) => <Link to={`/manufacturing/work-orders/${r.workOrder}`}>{r.workOrder}</Link>,
    },
    { key: "operation", header: "Operation", render: (r) => <span className="cell-primary">{r.operation}</span> },
    { key: "workCenter", header: "Work Center", render: (r) => r.workCenter || "—" },
    { key: "machine", header: "Machine", render: (r) => r.machine || "—" },
    { key: "operator", header: "Operator", render: (r) => <UserCell name={r.operator} /> },
    { key: "plannedQty", header: "Planned", render: (r) => num(r.plannedQty) },
    { key: "completedQty", header: "Completed", render: (r) => num(r.completedQty) },
    { key: "rejectedQty", header: "Rejected", render: (r) => num(r.rejectedQty) },
    { key: "hours", header: "Hours", render: (r) => num(r.hours) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Add and Edit are standalone pages now (addHref / editHref below); this
  // only switches on the button label and the row Edit/Delete actions.
  const addConfig = { buttonLabel: "+ Add Job Card" };

  return (
    <SimpleListPage
      title="Job Cards"
      crumbs={["Dashboard", "Manufacturing", "Job Cards"]}
      endpoint="/api/manufacturing/job-cards"
      columns={columns}
      addConfig={addConfig}
      addHref="/manufacturing/job-cards/new"
      editHref={(row) => `/manufacturing/job-cards/${encodeURIComponent(row.id)}/edit`}
    />
  );
}
