import { Link } from "react-router-dom";
import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function Suppliers() {
  const columns = [
    { key: "id", header: "Supplier Code", render: (r) => <Link to={`/suppliers/${encodeURIComponent(r.id)}`} className="cell-link">{r.id}</Link> },
    { key: "name", header: "Supplier Name", render: (r) => <span className="cell-primary">{r.name}</span> },
    { key: "phone", header: "Phone" },
    { key: "email", header: "Email" },
    { key: "city", header: "Location" },
    { key: "itemsSupplied", header: "Items Supplied", render: (r) => r.itemsSupplied ?? 0 },
    { key: "outstanding", header: "Outstanding (₹)", render: (r) => inr(r.outstanding) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Both Add and Edit are standalone pages now (see addHref/editHref below),
  // so this only needs to exist to turn on the button label and the
  // Edit/Delete row actions.
  const addConfig = { buttonLabel: "+ Add Supplier" };

  return (
    <SimpleListPage
      title="Supplier List"
      crumbs={["Dashboard", "Suppliers", "Supplier List"]}
      endpoint="/api/suppliers"
      columns={columns}
      addConfig={addConfig}
      addHref="/suppliers/new"
      editHref={(row) => `/suppliers/${encodeURIComponent(row.id)}/edit`}
    />
  );
}
