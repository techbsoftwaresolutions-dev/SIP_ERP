import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";

export default function CustomerGroups() {
  const columns = [
    { key: "id", header: "Group Code", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "name", header: "Group Name", render: (r) => <span className="cell-primary">{r.name}</span> },
    { key: "description", header: "Description" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  const addConfig = {
    buttonLabel: "+ Add Group",
    modalTitle: "Add Customer Group",
    successMessage: "Customer group added.",
    fields: [
      { key: "name", label: "Group Name", required: true, placeholder: "Enter your group name" },
      { key: "description", label: "Description", placeholder: "Enter your description" },
    ],
  };

  return (
    <SimpleListPage
      title="Customer Groups"
      crumbs={["Dashboard", "Customers", "Customer Groups"]}
      endpoint="/api/customer-groups"
      columns={columns}
      addConfig={addConfig}
    />
  );
}
