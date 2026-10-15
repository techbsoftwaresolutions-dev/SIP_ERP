import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";

export default function ServiceHistory() {
  const columns = [
    { key: "id", header: "Task No", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "asset", header: "Asset", render: (r) => <span className="cell-primary">{r.asset}</span> },
    { key: "type", header: "Type" },
    { key: "scheduledDate", header: "Completed Date" },
    { key: "assignedTo", header: "Assigned To" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <SimpleListPage
      title="Service History"
      crumbs={["Dashboard", "Maintenance", "Service History"]}
      endpoint="/api/maintenance"
      params={{ view: "history" }}
      columns={columns}
    />
  );
}
