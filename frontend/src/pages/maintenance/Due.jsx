import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

export default function ServiceDue() {
  const { fields: customFields } = useCustomFields("maintenance-task");

  const columns = [
    { key: "id", header: "Task No", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "asset", header: "Asset", render: (r) => <span className="cell-primary">{r.asset}</span> },
    { key: "type", header: "Type" },
    { key: "scheduledDate", header: "Scheduled Date" },
    { key: "assignedTo", header: "Assigned To" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const addConfig = {
    buttonLabel: "+ New Task",
    modalTitle: "New Maintenance Task",
    successMessage: "Maintenance task scheduled.",
    fields: [
      { key: "asset", label: "Asset", required: true, placeholder: "Enter your asset" },
      { key: "type", label: "Type", type: "select", options: ["Preventive", "Corrective", "Inspection"] },
      { key: "assignedTo", label: "Assigned To", placeholder: "Enter your assigned to" },
      ...customFields,
    ],
    transform: packCustomFields,
    loadTransform: unpackCustomFields,
  };

  return (
    <SimpleListPage
      title="Service Due"
      crumbs={["Dashboard", "Maintenance", "Service Due"]}
      endpoint="/api/maintenance"
      params={{ view: "due" }}
      columns={columns}
      addConfig={addConfig}
    />
  );
}
