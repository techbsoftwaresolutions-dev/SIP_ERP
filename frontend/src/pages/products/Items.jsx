import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";

export default function Items() {
  const columns = [
    { key: "id", header: "Item ID", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "itemCode", header: "Item Code", render: (r) => r.itemCode || "—" },
    { key: "hsnCode", header: "HSN Code", render: (r) => r.hsnCode || "—" },
    { key: "taxPercent", header: "Tax (%)", render: (r) => `${r.taxPercent || 0}%` },
    { key: "name", header: "Product Name", render: (r) => <span className="cell-primary">{r.name}</span> },
    { key: "itemType", header: "Item Type", render: (r) => r.itemType || "—" },
    { key: "category", header: "Category", render: (r) => r.category || "—" },
    { key: "brand", header: "Brand", render: (r) => r.brand || "—" },
    { key: "size", header: "Size / Specification", render: (r) => r.size || "—" },
    { key: "unit", header: "Unit" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Add and Edit are standalone pages (addHref / editHref below); this only
  // switches on the button label and the row Edit/Delete actions.
  const addConfig = { buttonLabel: "+ Add Item" };

  return (
    <SimpleListPage
      title="Items"
      crumbs={["Dashboard", "Products", "Items"]}
      endpoint="/api/items"
      columns={columns}
      addConfig={addConfig}
      addHref="/products/items/new"
      editHref={(row) => `/products/items/${encodeURIComponent(row.id)}/edit`}
    />
  );
}
