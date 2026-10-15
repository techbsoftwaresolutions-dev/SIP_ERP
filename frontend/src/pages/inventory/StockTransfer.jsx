import SimpleListPage from "../../components/data/SimpleListPage";

export default function StockTransfer() {
  const columns = [
    { key: "id", header: "Txn No", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "product", header: "Product", render: (r) => <span className="cell-primary">{r.product}</span> },
    { key: "quantity", header: "Quantity" },
    { key: "warehouse", header: "From Warehouse" },
    { key: "toWarehouse", header: "To Warehouse" },
    { key: "date", header: "Date" },
  ];

  const addConfig = {
    buttonLabel: "+ New Transfer",
    modalTitle: "New Stock Transfer",
    successMessage: "Stock transfer recorded.",
    fields: [
      { key: "product", label: "Product", required: true, placeholder: "Enter your product" },
      { key: "quantity", label: "Quantity", type: "number", placeholder: "Enter your quantity" },
      { key: "warehouse", label: "From Warehouse", placeholder: "Enter your from warehouse" },
      { key: "toWarehouse", label: "To Warehouse", placeholder: "Enter your to warehouse" },
    ],
  };

  return (
    <SimpleListPage
      title="Stock Transfer"
      crumbs={["Dashboard", "Inventory", "Stock Transfer"]}
      endpoint="/api/inventory/stock-transfer"
      columns={columns}
      addConfig={addConfig}
    />
  );
}
