import { Link } from "react-router-dom";
import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function Customers() {
  const columns = [
    { key: "id", header: "Customer Code", render: (r) => <Link to={`/customers/${encodeURIComponent(r.id)}`} className="cell-link">{r.id}</Link> },
    { key: "name", header: "Customer Name", render: (r) => <span className="cell-primary">{r.name}</span> },
    { key: "phone", header: "Mobile No.", render: (r) => r.phone || "—" },
    { key: "address", header: "Address", render: (r) => <span className="cell-truncate" title={r.address || ""}>{r.address || "—"}</span> },
    { key: "email", header: "Email" },
    { key: "city", header: "Location" },
    { key: "totalOrders", header: "Total Orders", render: (r) => r.totalOrders ?? 0 },
    { key: "totalInvoices", header: "Total Invoices", render: (r) => r.totalInvoices ?? 0 },
    { key: "invoicedAmount", header: "Invoice Amount", render: (r) => inr(r.invoicedAmount) },
    { key: "outstanding", header: "Outstanding (₹)", render: (r) => inr(r.outstanding) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Both Add and Edit are standalone pages now (see addHref/editHref below),
  // so this only needs to exist to turn on the button label and the
  // Edit/Delete row actions.
  const addConfig = { buttonLabel: "+ Add Customer" };

  return (
    <SimpleListPage
      title="Customer List"
      crumbs={["Dashboard", "Customers", "Customer List"]}
      endpoint="/api/customers"
      columns={columns}
      addConfig={addConfig}
      addHref="/customers/new"
      editHref={(row) => `/customers/${encodeURIComponent(row.id)}/edit`}
      pageSize={100}
      mobileSearchPlaceholder="Search customers..."
      mobileTabs={{
        field: "status",
        options: [
          { label: "All Customers", value: undefined },
          { label: "Active Customers", value: "Active" },
        ],
      }}
      mobileSummary={(rows, total) => ({
        icon: "users",
        title: `${total} Total Customer${total === 1 ? "" : "s"}`,
        sub: "Manage your customer relationships and track orders",
      })}
      mobileCard={(row, { onEdit, onDelete }) => (
        <div className="m-card" onClick={onEdit} role="button" tabIndex={0}>
          <div className="m-card-top">
            <div className="m-avatar">{(row.name || "?").charAt(0).toUpperCase()}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="m-card-title-row">
                <div className="m-card-name">{row.name}</div>
                <StatusBadge status={row.status} />
              </div>
              <div className="m-card-sub">{row.city || "—"}</div>
            </div>
            {onDelete && (
              <button
                type="button"
                className="m-card-menu"
                aria-label="More options"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                ⋮
              </button>
            )}
          </div>
          <div className="m-card-meta">
            {row.phone && <div className="m-card-meta-row"><Icon name="phone" size={14} /> {row.phone}</div>}
            {row.email && <div className="m-card-meta-row"><Icon name="mail" size={14} /> {row.email}</div>}
          </div>
          <div className="m-card-footer">
            <div className="m-card-orders">
              <span className="n">{row.totalOrders ?? 0}</span> Orders
            </div>
          </div>
        </div>
      )}
    />
  );
}
