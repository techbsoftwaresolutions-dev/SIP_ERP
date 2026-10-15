import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SimpleListPage from "../../components/data/SimpleListPage";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import AiReminderModal from "../../components/share/AiReminderModal";
import { useAuth } from "../../context/AuthContext";
import { useInvoiceLookups } from "./invoiceFields";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

export default function Invoices() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { customers } = useInvoiceLookups();
  const canUseAi = user?.role === "Administrator";
  const [reminderFor, setReminderFor] = useState(null); // invoice row or null

  // Opens the Add Delivery Challan screen pre-filled from this invoice
  // (customer, SO number, products, dispatched qty, transporter/vehicle).
  // Nothing is saved until the user reviews it and clicks "Add Delivery
  // Challan"; on save that screen links the challan back to this invoice.
  const convertToChallan = (r) => {
    if (r.dcNumber && r.dcNumber !== "—") {
      const again = window.confirm(
        `Invoice ${r.id} already has Delivery Challan ${r.dcNumber}. Create another?`
      );
      if (!again) return;
    }
    const items = Array.isArray(r.items) ? r.items : [];
    navigate("/sales/delivery-challan/new", {
      state: {
        fromInvoice: {
          fromInvoiceId: r.id,
          customer: r.customer || "",
          salesOrder: r.soNumber && r.soNumber !== "—" ? r.soNumber : "",
          product: r.product || items.map((i) => i.product).filter(Boolean).join(", "),
          dispatchedQty: items.reduce((s, i) => s + (Number(i.quantity) || 0), 0) || "",
          unit: (items.find((i) => i.unit) || {}).unit || "Nos",
          transporter: r.transportName || "",
          vehicleNo: r.vehicleNo || "",
          items: items.length || 1,
          status: "Pending",
        },
      },
    });
  };

  const columns = [
    { key: "id", header: "Invoice No.", render: (r) => <Link to={`/sales/invoices/${encodeURIComponent(r.id)}`} className="cell-link">{r.id}</Link> },
    { key: "date", header: "Invoice Date" },
    { key: "poNumber", header: "PO Number", render: (r) => r.poNumber || "—" },
    { key: "customer", header: "Customer", render: (r) => <span className="cell-primary">{r.customer}</span> },
    {
      key: "address",
      header: "Address",
      render: (r) => {
        const address = r.address || customers.find((c) => c.name === r.customer)?.address || "—";
        return <span className="cell-truncate" title={address}>{address}</span>;
      },
    },
    {
      key: "phone",
      header: "Mobile No.",
      render: (r) => r.phone || customers.find((c) => c.name === r.customer)?.phone || "—",
    },
    {
      key: "product",
      header: "Products",
      render: (r) => <span className="cell-truncate" title={r.product || ""}>{r.product || "—"}</span>,
    },
    { key: "amount", header: "Invoice Amount", render: (r) => inr(r.amount) },
    { key: "paidAmount", header: "Paid", render: (r) => inr(r.paidAmount) },
    { key: "balance", header: "Balance", render: (r) => inr(r.balance) },
    { key: "dueDate", header: "Due Date" },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "__print",
      header: "Invoice",
      render: (r) => (
        <button
          type="button"
          className="icon-btn"
          title="Print / View Invoice"
          onClick={() => navigate(`/sales/invoices/${encodeURIComponent(r.id)}/print`)}
        >
          <Icon name="printer" />
        </button>
      ),
    },
  ];

  // Both Add and Edit are standalone pages now (see addHref/editHref below),
  // so this only needs to exist to turn on the button label and the
  // Edit/Delete row actions — its fields/modalTitle are unused.
  const addConfig = { buttonLabel: "+ Add Invoice" };

  return (
    <>
      <SimpleListPage
        title="Invoices"
        crumbs={["Dashboard", "Sales", "Invoices"]}
        endpoint="/api/sales/invoices"
        columns={columns}
        addConfig={addConfig}
        addHref="/sales/invoices/new"
        editHref={(row) => `/sales/invoices/${encodeURIComponent(row.id)}/edit`}
        rowActions={(row) => (
          <>
            {canUseAi && (Number(row.balance) > 0 || (row.status && row.status !== "Paid")) && (
              <button
                type="button"
                className="icon-btn"
                title="Draft payment reminder with AI"
                onClick={() => setReminderFor(row)}
              >
                <Icon name="mail" />
              </button>
            )}
            <button
              type="button"
              className={`icon-btn${row.dcNumber && row.dcNumber !== "—" ? " converted" : ""}`}
              title={
                row.dcNumber && row.dcNumber !== "—"
                  ? `Delivery Challan ${row.dcNumber} created`
                  : "Convert to Delivery Challan"
              }
              onClick={() => convertToChallan(row)}
            >
              <Icon name="truck" />
            </button>
          </>
        )}
      />
      {reminderFor && (
        <AiReminderModal
          customer={reminderFor.customer}
          phone={reminderFor.phone || customers.find((c) => c.name === reminderFor.customer)?.phone || ""}
          email={customers.find((c) => c.name === reminderFor.customer)?.email || ""}
          onClose={() => setReminderFor(null)}
        />
      )}
    </>
  );
}
