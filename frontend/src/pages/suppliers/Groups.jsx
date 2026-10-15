import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";

export default function SupplierGroups() {
  const columns = [
    { key: "id", header: "Group Code", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "name", header: "Group Name", render: (r) => <span className="cell-primary">{r.name}</span> },
    { key: "description", header: "Description" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const addConfig = {
    buttonLabel: "+ Add Group",
    modalTitle: "Add Supplier Group",
    successMessage: "Supplier group added.",
    fields: [
      { key: "name", label: "Group Name", required: true, placeholder: "Enter your group name" },
      { key: "description", label: "Description", placeholder: "Enter your description" },
    ],
  };

  return (
    <SimpleListPage
      title="Supplier Groups"
      crumbs={["Dashboard", "Suppliers", "Supplier Groups"]}
      endpoint="/api/supplier-groups"
      columns={columns}
      addConfig={addConfig}
    />
  );
}
