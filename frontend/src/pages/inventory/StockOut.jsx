import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";

export default function StockOut() {
  const columns = [
    { key: "id", header: "Stock Out No.", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "date", header: "Date" },
    { key: "issueType", header: "Issue Type", render: (r) => r.issueType || "—" },
    { key: "referenceNo", header: "Reference No.", render: (r) => r.referenceNo || "—" },
    { key: "departmentOrCustomer", header: "Department / Customer", render: (r) => r.departmentOrCustomer || "—" },
    { key: "product", header: "Product", render: (r) => <span className="cell-primary">{r.product}</span> },
    { key: "batchNo", header: "Batch No.", render: (r) => r.batchNo || "—" },
    { key: "quantity", header: "Qty Out", render: (r) => `${(r.quantity || 0).toLocaleString("en-IN")} ${r.unit || "Nos"}` },
    { key: "warehouse", header: "Warehouse" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status || "Pending"} /> },
  ];

  // Both Add and Edit are standalone pages now (see addHref/editHref below),
  // so this only needs to exist to turn on the button label and the
  // Edit/Delete row actions.
  const addConfig = { buttonLabel: "+ Add Stock Out" };

  return (
    <SimpleListPage
      title="Stock Out"
      crumbs={["Dashboard", "Inventory", "Stock Out"]}
      endpoint="/api/inventory/stock-out"
      columns={columns}
      addConfig={addConfig}
      addHref="/inventory/stock-out/new"
      editHref={(row) => `/inventory/stock-out/${encodeURIComponent(row.id)}/edit`}
    />
  );
}
