import { Link } from "react-router-dom";
import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";

export default function Brands() {
  const columns = [
    { key: "id", header: "Code", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "name", header: "Brand", render: (r) => <span className="cell-primary">{r.name}</span> },
    { key: "manufacturer", header: "Manufacturer", render: (r) => r.manufacturer || "—" },
    { key: "material", header: "Material", render: (r) => r.material || "—" },
    {
      key: "itemCount",
      header: "Items",
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

  const addConfig = { buttonLabel: "+ Add Brand" };

  return (
    <SimpleListPage
      title="Brands"
      crumbs={["Dashboard", "Products", "Brands"]}
      endpoint="/api/brands"
      columns={columns}
      addConfig={addConfig}
      addHref="/products/brands/new"
      editHref={(row) => `/products/brands/${encodeURIComponent(row.id)}/edit`}
    />
  );
}
