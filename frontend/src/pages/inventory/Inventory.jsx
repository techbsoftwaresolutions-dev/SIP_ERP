import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import Pagination from "../../components/data/Pagination";
import usePaginatedData from "../../hooks/usePaginatedData";
import Icon from "../../components/ui/Icon";
import ExportButtons from "../../components/data/ExportButtons";
import useTableStyle from "../../hooks/useTableStyle";

const STATUS_META = {
  Normal: { icon: "checkCircle", label: "Normal" },
  "Low Stock": { icon: "alertCircle", label: "Low Stock" },
  "Out of Stock": { icon: "xCircle", label: "Out of Stock" },
};

export default function Inventory() {
  const { data, page, setPage, total, totalPages, loading } = usePaginatedData("/api/inventory", { pageSize: 8 });
  const navigate = useNavigate();
  const tableStyle = useTableStyle();

  const detailHref = (r) => `/inventory/item/${encodeURIComponent(r.id)}`;

  const columns = [
    {
      key: "productCode",
      header: "Product Code",
      render: (r) => <Link to={detailHref(r)} state={{ row: r }} className="cell-link">{r.productCode}</Link>,
    },
    { key: "productName", header: "Product Name", render: (r) => <span className="cell-primary">{r.productName}</span> },
    { key: "category", header: "Category" },
    { key: "brand", header: "Brand" },
    { key: "available", header: "Available", render: (r) => (r.available || 0).toLocaleString("en-IN") },
    { key: "reserved", header: "Reserved", render: (r) => (r.reserved || 0).toLocaleString("en-IN") },
    { key: "damaged", header: "Damaged", render: (r) => (r.damaged || 0).toLocaleString("en-IN") },
    { key: "unit", header: "Unit" },
    {
      key: "stockStatus",
      header: "Stock Status",
      render: (r) => {
        const meta = STATUS_META[r.stockStatus] || STATUS_META.Normal;
        return <span className="icon-text"><Icon name={meta.icon} size={15} /> {meta.label}</span>;
      },
    },
    {
      key: "__actions",
      header: "Actions",
      render: (r) => (
        <div className="row-actions">
          <Link to={detailHref(r)} state={{ row: r }} className="icon-btn" title="View Details">
            <Icon name="eye" />
          </Link>
          <button
            type="button"
            className="icon-btn"
            title="Stock In"
            onClick={() => navigate("/inventory/stock-in")}
          >
            <Icon name="download" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Stock Overview"
        crumbs={["Dashboard", "Inventory", "Stock Overview"]}
        actions={
          <ExportButtons
            endpoint="/api/inventory"
            columns={columns}
            title="Stock Overview"
            filenameBase="stock-overview"
          />
        }
      />

      <div className={`card${tableStyle === "cards" ? " table-cards-mode" : ""}`}>
        <DataTable
          variant={tableStyle === "cards" ? "cards" : "classic"}
          columns={columns}
          rows={data}
          loading={loading}
          emptyText="No stock records found."
        />
        <Pagination page={page} pageSize={8} total={total} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
