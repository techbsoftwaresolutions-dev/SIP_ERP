import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";

export default function StockOut() {
  const columns = [
    { key: "id", header: "Stock Out No.", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "date", header: "Date" },
    { key: "grnNumber", header: "GRN No.", render: (r) => r.grnNumber || r.referenceNo || "—" },
    { key: "poNumber", header: "Purchase Order No", render: (r) => r.poNumber || "—" },
    { key: "supplier", header: "Customer / Supplier", render: (r) => r.supplier || r.departmentOrCustomer || "—" },
    { key: "product", header: "Product", render: (r) => <span className="cell-primary">{r.product}</span> },
    { key: "batchNo", header: "Batch No.", render: (r) => r.batchNo || "—" },
    { key: "quantity", header: "Qty Out", render: (r) => `${(r.quantity || 0).toLocaleString("en-IN")} ${r.unit || "Nos"}` },
    { key: "acceptedQty", header: "Accepted Qty", render: (r) => `${(r.acceptedQty || 0).toLocaleString("en-IN")} ${r.unit || "Nos"}` },
    { key: "warehouse", header: "Warehouse" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status || "Completed"} /> },
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
