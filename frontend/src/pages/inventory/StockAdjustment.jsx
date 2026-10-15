import SimpleListPage from "../../components/data/SimpleListPage";

export default function StockAdjustment() {
  const columns = [
    { key: "id", header: "Txn No", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "product", header: "Product", render: (r) => <span className="cell-primary">{r.product}</span> },
    { key: "quantity", header: "Quantity" },
    { key: "warehouse", header: "Warehouse" },
    { key: "reason", header: "Reason" },
    { key: "date", header: "Date" },
  ];

  const addConfig = {
    buttonLabel: "+ New Adjustment",
    modalTitle: "New Stock Adjustment",
    successMessage: "Stock adjustment recorded.",
    fields: [
      { key: "product", label: "Product", required: true, placeholder: "Enter your product" },
      { key: "quantity", label: "Quantity (+/-)", type: "number", placeholder: "Enter your quantity" },
      { key: "warehouse", label: "Warehouse", placeholder: "Enter your warehouse" },
      { key: "reason", label: "Reason", placeholder: "Enter your reason" },
    ],
  };

  return (
    <SimpleListPage
      title="Stock Adjustment"
      crumbs={["Dashboard", "Inventory", "Stock Adjustment"]}
      endpoint="/api/inventory/stock-adjustment"
      columns={columns}
      addConfig={addConfig}
    />
  );
}
