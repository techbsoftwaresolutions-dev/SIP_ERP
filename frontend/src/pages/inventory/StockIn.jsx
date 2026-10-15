import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";

export default function StockIn() {
  const columns = [
    { key: "id", header: "Stock In No.", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "date", header: "Date" },
    { key: "grnNumber", header: "GRN No.", render: (r) => r.grnNumber || "—" },
    { key: "poNumber", header: "Purchase Order No", render: (r) => r.poNumber || "—" },
    { key: "supplier", header: "Supplier", render: (r) => r.supplier || "—" },
    { key: "product", header: "Product", render: (r) => <span className="cell-primary">{r.product}</span> },
    { key: "batchNo", header: "Batch No.", render: (r) => r.batchNo || "—" },
    { key: "quantity", header: "Received Qty", render: (r) => (r.quantity || 0).toLocaleString("en-IN") },
    { key: "acceptedQty", header: "Accepted Qty", render: (r) => (r.acceptedQty || 0).toLocaleString("en-IN") },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status || "Pending QC"} /> },
  ];

  // Both Add and Edit are standalone pages now (see addHref/editHref below),
  // so this only needs to exist to turn on the button label and the
  // Edit/Delete row actions.
  const addConfig = { buttonLabel: "+ Add Stock In" };

  return (
    <SimpleListPage
      title="Stock In"
      crumbs={["Dashboard", "Inventory", "Stock In"]}
      endpoint="/api/inventory/stock-in"
      columns={columns}
      addConfig={addConfig}
      addHref="/inventory/stock-in/new"
      editHref={(row) => `/inventory/stock-in/${encodeURIComponent(row.id)}/edit`}
    />
  );
}
