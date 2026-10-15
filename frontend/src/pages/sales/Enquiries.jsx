import { useNavigate } from "react-router-dom";
import SimpleListPage from "../../components/data/SimpleListPage";
import Icon from "../../components/ui/Icon";
import StatusBadge from "../../components/ui/StatusBadge";

export default function Enquiries() {
  const navigate = useNavigate();
  const columns = [
    { key: "id", header: "Enquiry No.", render: (r) => <span className="cell-link">{r.id}</span> },
    { key: "date", header: "Enquiry Date" },
    { key: "customer", header: "Customer", render: (r) => <span className="cell-primary">{r.customer}</span> },
    { key: "contactPerson", header: "Contact Person", render: (r) => r.contactPerson || "—" },
    {
      key: "product",
      header: "Products",
      // Several products: show the first and how many more, with the full
      // list on hover — keeps the table row one line tall.
      render: (r) => {
        const items = Array.isArray(r.items) ? r.items : [];
        if (items.length <= 1) return r.product || "—";
        return (
          <span title={items.map((i) => i.product).join(", ")}>
            {items[0].product} <span className="cell-sub-inline">+{items.length - 1} more</span>
          </span>
        );
      },
    },
    {
      key: "qty",
      header: "Qty",
      render: (r) => {
        const items = Array.isArray(r.items) ? r.items : [];
        if (items.length > 1) return `${items.length} items`;
        return `${(r.qty || 0).toLocaleString("en-IN")} ${r.unit || "Nos"}`;
      },
    },
    { key: "requiredDate", header: "Required Date", render: (r) => r.requiredDate || "—" },
    { key: "source", header: "Source", render: (r) => r.source || "—" },
    { key: "priority", header: "Priority", render: (r) => r.priority || "—" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Both Add and Edit are standalone pages now (see addHref/editHref below),
  // so this only needs to exist to turn on the button label and the
  // Edit/Delete row actions.
  const addConfig = { buttonLabel: "+ Add Enquiry" };

  return (
    <SimpleListPage
      title="Enquiries"
      crumbs={["Dashboard", "Sales", "Enquiries"]}
      endpoint="/api/sales/enquiries"
      columns={columns}
      addConfig={addConfig}
      addHref="/sales/enquiries/new"
      editHref={(row) => `/sales/enquiries/${encodeURIComponent(row.id)}/edit`}
      detailHref={(row) => `/sales/enquiries/${encodeURIComponent(row.id)}`}
      rowActions={(r) => (
        <button
          type="button"
          className="icon-btn"
          title="Preview / Print / Download"
          onClick={() => navigate(`/sales/enquiries/${encodeURIComponent(r.id)}/print`)}
        >
          <Icon name="download" />
        </button>
      )}
    />
  );
}
