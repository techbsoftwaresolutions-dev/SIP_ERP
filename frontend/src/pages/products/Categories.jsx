import { Link } from "react-router-dom";
import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";

export default function Categories() {
  const columns = [
    { key: "id", header: "Code", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "name", header: "Category", render: (r) => <span className="cell-primary">{r.name}</span> },
    { key: "materialType", header: "Material Type", render: (r) => r.materialType || "—" },
    { key: "unit", header: "Default Unit", render: (r) => r.unit || "—" },
    { key: "taxRate", header: "Tax Rate", render: (r) => `${r.taxRate ?? 0}%` },
    {
      key: "itemCount",
      header: "Items",
      // Links straight to the catalog so a category with items is one click
      // from seeing them.
      render: (r) =>
        r.itemCount > 0 ? (
          <Link to="/products/items" className="cell-link">
            {r.itemCount}
          </Link>
        ) : (
          0
        ),
    },
    { key: "description", header: "Description", render: (r) => <span className="cell-truncate" title={r.description || ""}>{r.description || "—"}</span> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Add and Edit are standalone pages (see addHref/editHref) — this only
  // switches on the button label and the row Edit/Delete actions.
  const addConfig = { buttonLabel: "+ Add Category" };

  return (
    <SimpleListPage
      title="Categories"
      crumbs={["Dashboard", "Products", "Categories"]}
      endpoint="/api/categories"
      columns={columns}
      addConfig={addConfig}
      addHref="/products/categories/new"
      editHref={(row) => `/products/categories/${encodeURIComponent(row.id)}/edit`}
    />
  );
}
