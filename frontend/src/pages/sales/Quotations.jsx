import SimpleListPage from "../../components/data/SimpleListPage";
import { Link, useNavigate } from "react-router-dom";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";

import { buildSalesOrderFromQuotation } from "./quotationConvert";

export default function Quotations() {
  const navigate = useNavigate();
  const columns = [
    { key: "id", header: "Quotation No", render: (r) => <Link to={`/sales/quotations/${encodeURIComponent(r.id)}`} className="cell-link">{r.id}</Link> },
    { key: "customer", header: "Customer", render: (r) => <span className="cell-primary">{r.customer}</span> },
    { key: "date", header: "Date" },
    { key: "validTill", header: "Valid Till" },
    { key: "amount", header: "Amount (₹)", render: (r) => (r.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  // Add and Edit are standalone pages (addHref/editHref); addConfig only
  // turns on the button label and the Edit/Delete row actions.
  const addConfig = { buttonLabel: "+ New Quotation" };

  return (
    <SimpleListPage
      title="Quotations"
      crumbs={["Dashboard", "Sales", "Quotations"]}
      endpoint="/api/sales/quotations"
      columns={columns}
      addConfig={addConfig}
      addHref="/sales/quotations/new"
      editHref={(row) => `/sales/quotations/${encodeURIComponent(row.id)}/edit`}
      rowActions={(r) => (
        <>
          <button
            type="button"
            className={`icon-btn${r.salesOrderId ? " converted" : ""}`}
            title={r.salesOrderId ? `Converted — view Sales Order ${r.salesOrderId}` : "Convert to Sales Order"}
            onClick={() =>
              r.salesOrderId
                ? navigate(`/sales/orders/${encodeURIComponent(r.salesOrderId)}`)
                : navigate("/sales/orders/new", { state: { fromQuotation: buildSalesOrderFromQuotation(r) } })
            }
          >
            <Icon name="cart" />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="View / Print / Share"
            onClick={() => navigate(`/sales/quotations/${encodeURIComponent(r.id)}/print`)}
          >
            <Icon name="download" />
          </button>
        </>
      )}
    />
  );
}
