import { Link, useNavigate } from "react-router-dom";
import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";

export default function DeliveryChallan() {
  const navigate = useNavigate();

  const columns = [
    { key: "id", header: "DC Number", render: (r) => <Link to={`/sales/delivery-challan/${encodeURIComponent(r.id)}`} className="cell-link">{r.id}</Link> },
    { key: "date", header: "DC Date" },
    { key: "salesOrder", header: "Sales Order No" },
    { key: "customer", header: "Customer", render: (r) => <span className="cell-primary">{r.customer}</span> },
    { key: "product", header: "Products", render: (r) => r.product || "—" },
    { key: "dispatchedQty", header: "Dispatched Qty", render: (r) => `${(r.dispatchedQty || 0).toLocaleString("en-IN")} ${r.unit || "Nos"}` },
    { key: "transporter", header: "Transporter", render: (r) => r.transporter || "—" },
    { key: "vehicleNo", header: "Vehicle No." },
    { key: "status", header: "Delivery Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Both Add and Edit are standalone pages now (see addHref/editHref below),
  // so this only needs to exist to turn on the button label and the
  // Edit/Delete row actions.
  const addConfig = { buttonLabel: "+ Add Delivery Challan" };

  return (
    <SimpleListPage
      title="Delivery Challan"
      crumbs={["Dashboard", "Sales", "Delivery Challan"]}
      endpoint="/api/sales/delivery-challans"
      columns={columns}
      addConfig={addConfig}
      addHref="/sales/delivery-challan/new"
      editHref={(row) => `/sales/delivery-challan/${encodeURIComponent(row.id)}/edit`}
      rowActions={(r) => (
        <button
          type="button"
          className="icon-btn"
          title="Download / Print"
          onClick={() => navigate(`/sales/delivery-challans/${encodeURIComponent(r.id)}/print`)}
        >
          <Icon name="download" />
        </button>
      )}
    />
  );
}
