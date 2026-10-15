import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function SalesReturn() {
  const columns = [
    { key: "id", header: "Return No.", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "date", header: "Return Date" },
    { key: "invoiceNo", header: "Invoice No." },
    { key: "soNumber", header: "SO No." },
    { key: "dcNumber", header: "DC No." },
    { key: "customer", header: "Customer", render: (r) => <span className="cell-primary">{r.customer}</span> },
    { key: "product", header: "Product", render: (r) => r.product || "—" },
    { key: "qty", header: "Return Qty", render: (r) => `${(r.qty || 0).toLocaleString("en-IN")} ${r.unit || "Nos"}` },
    { key: "amount", header: "Return Value", render: (r) => inr(r.amount) },
    { key: "reason", header: "Return Reason" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Both Add and Edit are standalone pages now (see addHref/editHref below),
  // so this only needs to exist to turn on the button label and the
  // Edit/Delete row actions.
  const addConfig = { buttonLabel: "+ Add Sales Return" };

  return (
    <SimpleListPage
      title="Sales Return"
      crumbs={["Dashboard", "Sales", "Sales Return"]}
      endpoint="/api/sales/returns"
      columns={columns}
      addConfig={addConfig}
      addHref="/sales/returns/new"
      editHref={(row) => `/sales/returns/${encodeURIComponent(row.id)}/edit`}
    />
  );
}
