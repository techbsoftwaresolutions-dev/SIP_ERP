import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import UserCell from "../../components/ui/UserCell";
import { inr, num } from "./manufacturingLookups";

export default function WorkCenters() {
  const columns = [
    { key: "id", header: "Code", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "name", header: "Work Center", render: (r) => <span className="cell-primary">{r.name}</span> },
    { key: "location", header: "Location", render: (r) => r.location || "—" },
    { key: "supervisor", header: "Supervisor", render: (r) => <UserCell name={r.supervisor} /> },
    { key: "capacityPerDay", header: "Capacity / Day", render: (r) => `${num(r.capacityPerDay)} ${r.unit || ""}`.trim() },
    { key: "workingHoursPerDay", header: "Hours / Day", render: (r) => num(r.workingHoursPerDay) },
    { key: "costPerHour", header: "Cost / Hour", render: (r) => inr(r.costPerHour) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Add and Edit are standalone pages now (addHref / editHref below); this
  // only switches on the button label and the row Edit/Delete actions.
  const addConfig = { buttonLabel: "+ Add Work Center" };

  return (
    <SimpleListPage
      title="Work Centers"
      crumbs={["Dashboard", "Manufacturing", "Work Centers"]}
      endpoint="/api/manufacturing/work-centers"
      columns={columns}
      addConfig={addConfig}
      addHref="/manufacturing/work-centers/new"
      editHref={(row) => `/manufacturing/work-centers/${encodeURIComponent(row.id)}/edit`}
    />
  );
}
