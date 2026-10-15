import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import { MACHINE_STATUSES, UNITS, num, useManufacturingLookups } from "./manufacturingLookups";

export default function Machines() {
  const { workCenters } = useManufacturingLookups({ workCenters: true });

  const columns = [
    { key: "id", header: "Code", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "name", header: "Machine", render: (r) => <span className="cell-primary">{r.name}</span> },
    { key: "workCenter", header: "Work Center", render: (r) => r.workCenter || "—" },
    { key: "machineType", header: "Type", render: (r) => r.machineType || "—" },
    { key: "capacityPerHour", header: "Capacity / Hour", render: (r) => `${num(r.capacityPerHour)} ${r.unit || ""}`.trim() },
    { key: "nextServiceDate", header: "Next Service", render: (r) => r.nextServiceDate || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Add and Edit are standalone pages now (addHref / editHref below); this
  // only switches on the button label and the row Edit/Delete actions.
  const addConfig = { buttonLabel: "+ Add Machine" };

  return (
    <SimpleListPage
      title="Machines"
      crumbs={["Dashboard", "Manufacturing", "Machines"]}
      endpoint="/api/manufacturing/machines"
      columns={columns}
      addConfig={addConfig}
      addHref="/manufacturing/machines/new"
      editHref={(row) => `/manufacturing/machines/${encodeURIComponent(row.id)}/edit`}
    />
  );
}
