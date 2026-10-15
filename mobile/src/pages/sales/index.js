import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import api from "../../api/client";
import ListScreen, { inr } from "../../components/data/ListScreen";
import RecordFormScreen from "../../components/forms/RecordFormScreen";
import DocumentActions from "../../components/data/DocumentActions";
import Screen from "../../components/layout/Screen";
import { Button, Card, ErrorBox, KeyValueGrid, Loader, MiniTable, SectionTitle, StatCard, StatGrid, StatusBadge, TotalsBox, useFeedback } from "../../components/ui";
import { usePermissions } from "../../context/SessionContext";
import { useAuth } from "../../context/AuthContext";
import { useGoBack, useLocation, useNavigate, useParams } from "../../navigation/router";
import useRecord, { useList } from "../../hooks/useRecord";
import { ENQUIRY_FIELDS } from "./enquiryFields";
import { buildSalesOrderFields, useSalesOrderLookups, STATUS_OPTIONS as SO_STATUSES } from "./salesOrderFields";
import { buildDeliveryChallanFields, useDeliveryChallanLookups } from "./deliveryChallanFields";
import { buildSalesReturnFields, useSalesReturnLookups } from "./salesReturnFields";
import { STATUS_OPTIONS as INVOICE_STATUSES } from "./invoiceFields";
import { challanHtml, invoiceHtml, loadDocContext } from "../../print/documents";
import { copyLabelsFor } from "../../print/copies";
import { formatPhone } from "../../utils/formatPhone";
import { colors } from "../../theme";

export { default as InvoiceForm } from "./InvoiceForm";

const qtyUnit = (q, u) => `${(Number(q) || 0).toLocaleString("en-IN")} ${u || "Nos"}`;

// ---------------------------------------------------------------- Enquiries
export function Enquiries() {
  return (
    <ListScreen
      title="Enquiries"
      endpoint="/api/sales/enquiries"
      addPath="/sales/enquiries/new"
      editPath={(r) => `/sales/enquiries/${encodeURIComponent(r.id)}/edit`}
      tabs={{ field: "status", options: [{ label: "All", value: undefined }, ...["New", "Under Review", "Quotation Sent", "Won", "Lost"].map((s) => ({ label: s, value: s }))] }}
      card={(r) => ({
        title: r.customer,
        subtitle: [r.id, r.date].filter(Boolean).join(" · "),
        amount: r.estValue ? inr(r.estValue) : undefined,
        meta: [
          { icon: "package", text: r.product },
          { text: r.qty ? qtyUnit(r.qty, r.unit) : "" },
          { icon: "calendar", text: r.requiredDate },
          { label: "Priority", text: r.priority },
          { label: "Source", text: r.source },
        ],
        status: r.status,
      })}
    />
  );
}

export function EnquiryForm() {
  return <RecordFormScreen entity="Enquiry" endpoint="/api/sales/enquiries" fields={ENQUIRY_FIELDS} />;
}

// ---------------------------------------------------------------- Quotations
export function Quotations() {
  return (
    <ListScreen
      title="Quotations"
      endpoint="/api/sales/quotations"
      card={(r) => ({
        title: r.customer,
        subtitle: [r.id, r.date].filter(Boolean).join(" · "),
        amount: inr(r.amount),
        meta: [{ icon: "calendar", label: "Valid till", text: r.validTill }],
        status: r.status,
      })}
      addConfig={{
        buttonLabel: "+ New Quotation",
        modalTitle: "New Quotation",
        successMessage: "Quotation created.",
        fields: [
          { key: "customer", label: "Customer", required: true, placeholder: "Enter your customer" },
          { key: "amount", label: "Amount (₹)", type: "number", placeholder: "Enter your amount" },
        ],
      }}
    />
  );
}

// ---------------------------------------------------------------- Sales orders

// Builds the "Convert to Invoice" hand-off exactly like the web SalesOrders page.
function invoiceSeedFromOrder(row, customers, catalogItems) {
  const matched = customers.find((c) => c.name === row.customer);
  const fromCatalog = (p) => catalogItems.find((c) => c.name === p) || {};
  const lines = Array.isArray(row.lineItems) ? row.lineItems : [];
  const items = lines.length
    ? lines.map((li) => {
        const cat = fromCatalog(li.product);
        return {
          product: li.product || "",
          hsnCode: cat.hsnCode || "",
          quantity: Number(li.orderQty) || 0,
          unit: li.unit || cat.unit || "Nos",
          unitPrice: Number(li.unitPrice) || Number(cat.sellingPrice) || 0,
          taxPercent: Number(cat.taxPercent) || 0,
        };
      })
    : [
        (() => {
          const cat = fromCatalog(row.product);
          return {
            product: row.product || "",
            hsnCode: cat.hsnCode || "",
            quantity: Number(row.qty) || 0,
            unit: row.unit || cat.unit || "Nos",
            unitPrice: Number(row.qty) ? (Number(row.amount) || 0) / Number(row.qty) : Number(cat.sellingPrice) || 0,
            taxPercent: Number(cat.taxPercent) || 0,
          };
        })(),
      ];
  return {
    id: row.id,
    orderNo: row.orderNo,
    customer: row.customer,
    address: matched?.address || "",
    phone: matched?.phone || "",
    poNumber: row.poNumber || "",
    poDate: row.poDate || "",
    items,
  };
}

function useConvertToInvoice() {
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const customers = useList("/api/customers?page=1&pageSize=200");
  const catalogItems = useList("/api/items?page=1&pageSize=500");
  return (row) => {
    if (row.invoiceId) return toast(`Already converted — Invoice ${row.invoiceId} already exists.`);
    navigate("/sales/invoices/new", { state: { fromSalesOrder: invoiceSeedFromOrder(row, customers, catalogItems) } });
  };
}

function SalesOrderStats({ reloadKey }) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get("/api/sales/orders/stats").then(setStats).catch(() => {});
  }, [reloadKey]);
  return (
    <StatGrid>
      <StatCard label="Open Sales Orders" value={stats ? stats.openSalesOrders : "—"} icon="cart" />
      <StatCard label="Total Value (Open)" value={stats ? inr(stats.totalOpenValue) : "—"} color="green" icon="banknote" />
      <StatCard label="Delivered This Month" value={stats ? stats.deliveredThisMonth : "—"} color="teal" icon="truck" />
      <StatCard label="Pending Approval" value={stats ? stats.pendingApproval : "—"} color="amber" icon="clock" />
    </StatGrid>
  );
}

export function SalesOrders() {
  const convert = useConvertToInvoice();
  const customers = useList("/api/customers?page=1&pageSize=200");
  return (
    <ListScreen
      title="Sales Orders"
      endpoint="/api/sales/orders"
      addPath="/sales/orders/new"
      editPath={(r) => `/sales/orders/${encodeURIComponent(r.id)}/edit`}
      detailPath={(r) => `/sales/orders/${encodeURIComponent(r.id)}`}
      deleteLabel={(r) => r.orderNo || r.id}
      header={<SalesOrderStats />}
      filters={[
        { key: "customer", label: "Customer", options: customers.map((c) => c.name) },
        { key: "status", label: "Status", options: SO_STATUSES },
        { key: "dateFrom", label: "From date", type: "date" },
        { key: "dateTo", label: "To date", type: "date" },
      ]}
      card={(r) => ({
        title: r.customer,
        subtitle: [r.orderNo, r.orderDate].filter(Boolean).join(" · "),
        amount: inr(r.amount),
        meta: [
          { icon: "package", text: r.product },
          { text: r.qty ? qtyUnit(r.qty, r.unit) : "" },
          { icon: "calendar", label: "Req", text: r.requiredDate },
          r.invoiceId ? { icon: "file", text: r.invoiceId } : null,
        ],
        badges: [r.deliveryStatus || "Not Dispatched", r.paymentStatus || "Pending"],
        status: r.status,
      })}
      rowActions={(r) => [
        { label: r.invoiceId ? `Converted — ${r.invoiceId}` : "Convert to Invoice", icon: "file", onPress: () => convert(r) },
      ]}
    />
  );
}

export function SalesOrderForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const lookups = useSalesOrderLookups();
  const fields = buildSalesOrderFields({ ...lookups, isEdit });
  return (
    <RecordFormScreen
      entity="Sales Order"
      endpoint="/api/sales/orders"
      fields={fields}
      transform={(values) => {
        const matched = lookups.customers.find((c) => c.name === values.customer);
        const payload = {
          customer: values.customer,
          city: matched?.city || "Chennai",
          poNumber: values.poNumber,
          poDate: values.poDate,
          lineItems: values.lineItems || [],
          deliveryStatus: values.deliveryStatus,
          paymentStatus: values.paymentStatus,
        };
        if (isEdit) payload.status = values.status;
        return payload;
      }}
      successMessage={isEdit ? "Sales order updated." : "Sales order created."}
    />
  );
}

function DeleteButton({ endpoint, id, label, backTo }) {
  const { confirm, toast } = useFeedback();
  const goBack = useGoBack();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      small
      variant="secondary"
      icon="trash"
      title="Delete"
      loading={busy}
      onPress={async () => {
        if (!(await confirm({ title: "Delete", message: `Delete ${label}? This cannot be undone.`, confirmLabel: "Delete", danger: true }))) return;
        setBusy(true);
        try {
          await api.delete(`${endpoint}/${encodeURIComponent(id)}`);
          toast(`${label} deleted.`);
          goBack(backTo);
        } catch (err) {
          toast(err.message || "Failed to delete.");
          setBusy(false);
        }
      }}
    />
  );
}

export function SalesOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const convert = useConvertToInvoice();
  const { data: o, error, refreshing, reload } = useRecord(`/api/sales/orders/${encodeURIComponent(id)}`);
  if (error) return <Screen title="Sales Order"><ErrorBox message={error} /></Screen>;
  if (!o) return <Screen title="Sales Order"><Loader /></Screen>;
  const lines = Array.isArray(o.lineItems) ? o.lineItems : [];
  const lineTotal = lines.reduce((a, i) => a + (Number(i.orderQty) || 0) * (Number(i.unitPrice) || 0), 0);
  return (
    <Screen
      title={o.orderNo || o.id}
      refreshing={refreshing}
      onRefresh={reload}
      headerRight={can("sales", "edit") ? [{ icon: "edit", onPress: () => navigate(`/sales/orders/${encodeURIComponent(o.id)}/edit`) }] : undefined}
    >
      <Card>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Button small icon="file" title={o.invoiceId ? `Invoice ${o.invoiceId}` : "Convert to Invoice"} onPress={() => (o.invoiceId ? navigate(`/sales/invoices/${encodeURIComponent(o.invoiceId)}`) : convert(o))} />
          {can("sales", "delete") ? <DeleteButton endpoint="/api/sales/orders" id={o.id} label={o.orderNo || o.id} /> : null}
        </View>
        <KeyValueGrid
          rows={[
            ["Customer", o.customer],
            ["City", o.city],
            ["Order Date", o.orderDate],
            ["Required Date", o.requiredDate],
            ["Purchase Order No", o.poNumber],
            ["Purchase Order Date", o.poDate],
            ["Order Value", inr(o.amount)],
            ["Invoice", o.invoiceId || "Not converted"],
            ["Delivery Status", <StatusBadge status={o.deliveryStatus || "Not Dispatched"} />],
            ["Payment Status", <StatusBadge status={o.paymentStatus || "Pending"} />],
            ["SO Status", <StatusBadge status={o.status} />],
          ]}
        />
      </Card>
      <Card>
        <SectionTitle>Items</SectionTitle>
        <MiniTable
          rows={lines}
          columns={[
            { key: "product", label: "Item" },
            { key: "orderQty", label: "Order Qty", render: (r) => qtyUnit(r.orderQty, r.unit) },
            { key: "dispatchQty", label: "Dispatched", render: (r) => Number(r.dispatchQty) || 0 },
            { key: "pendingQty", label: "Pending", render: (r) => Number(r.pendingQty) || 0 },
            { key: "unitPrice", label: "Unit Price", render: (r) => inr(r.unitPrice) },
            { key: "requiredDate", label: "Required", render: (r) => r.requiredDate || "—" },
          ]}
        />
        {lines.length ? <TotalsBox rows={[["Line Items Total", inr(lineTotal), true]]} /> : null}
      </Card>
    </Screen>
  );
}

// ---------------------------------------------------------------- Delivery challans
export function DeliveryChallans() {
  return (
    <ListScreen
      title="Delivery Challan"
      endpoint="/api/sales/delivery-challans"
      addPath="/sales/delivery-challan/new"
      editPath={(r) => `/sales/delivery-challan/${encodeURIComponent(r.id)}/edit`}
      detailPath={(r) => `/sales/delivery-challan/${encodeURIComponent(r.id)}`}
      tabs={{ field: "status", options: [{ label: "All", value: undefined }, ...["Pending", "Dispatched", "In Transit", "Delivered"].map((s) => ({ label: s, value: s }))] }}
      card={(r) => ({
        title: r.customer,
        subtitle: [r.id, r.date, r.salesOrder && r.salesOrder !== "—" ? r.salesOrder : ""].filter(Boolean).join(" · "),
        meta: [
          { icon: "package", text: r.product },
          { text: qtyUnit(r.dispatchedQty, r.unit) },
          { icon: "truck", text: [r.transporter, r.vehicleNo].filter(Boolean).join(" · ") },
        ],
        status: r.status,
        icon: "truck",
      })}
    />
  );
}

export function DeliveryChallanForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { state } = useLocation();
  const fromInvoice = !isEdit && state && state.fromInvoice;
  const lookups = useDeliveryChallanLookups();
  return (
    <RecordFormScreen
      entity="Delivery Challan"
      endpoint="/api/sales/delivery-challans"
      fields={buildDeliveryChallanFields(lookups)}
      initialValues={fromInvoice || undefined}
      note={fromInvoice ? `Pre-filled from invoice ${fromInvoice.fromInvoiceId}. Nothing is saved until you tap Add.` : undefined}
      onSubmit={async (values, { isEdit: editing }) => {
        if (editing) {
          await api.put(`/api/sales/delivery-challans/${encodeURIComponent(id)}`, values);
          return;
        }
        const created = await api.post("/api/sales/delivery-challans", values);
        if (fromInvoice && fromInvoice.fromInvoiceId && created && created.id) {
          await api.put(`/api/sales/invoices/${encodeURIComponent(fromInvoice.fromInvoiceId)}/dc-number`, { dcNumber: created.id }).catch(() => {});
        }
      }}
      successMessage={isEdit ? "Delivery challan updated." : fromInvoice ? `Delivery challan created from ${fromInvoice.fromInvoiceId}.` : "Delivery challan created."}
    />
  );
}

export function DeliveryChallanDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { data: dc, error, refreshing, reload } = useRecord(`/api/sales/delivery-challans/${encodeURIComponent(id)}`);
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    api.get("/api/settings").then(setSettings).catch(() => {});
  }, []);
  if (error) return <Screen title="Delivery Challan"><ErrorBox message={error} /></Screen>;
  if (!dc) return <Screen title="Delivery Challan"><Loader /></Screen>;
  const build = async () => {
    const { settings: s, party } = await loadDocContext("/api/customers", dc.customer);
    return challanHtml({ dc, customer: party, settings: s });
  };
  return (
    <Screen
      title={dc.id}
      refreshing={refreshing}
      onRefresh={reload}
      headerRight={can("sales", "edit") ? [{ icon: "edit", onPress: () => navigate(`/sales/delivery-challan/${encodeURIComponent(dc.id)}/edit`) }] : undefined}
    >
      <Card>
        <View style={{ gap: 8, marginBottom: 12 }}>
          <DocumentActions
            build={build}
            filename={`delivery-challan-${dc.id}.pdf`}
            settings={settings}
            whatsapp={{ documentType: "delivery-challan", documentId: dc.id, partyName: dc.customer }}
          />
          {can("sales", "delete") ? <DeleteButton endpoint="/api/sales/delivery-challans" id={dc.id} label={dc.id} /> : null}
        </View>
        <KeyValueGrid
          rows={[
            ["DC Number", dc.id],
            ["DC Date", dc.date],
            ["Sales Order No", dc.salesOrder],
            ["Customer", dc.customer],
            ["Products", dc.product, { full: true }],
            ["Dispatched Qty", qtyUnit(dc.dispatchedQty, dc.unit)],
            ["Items", dc.items],
            ["Warehouse", dc.warehouse],
            ["Transporter", dc.transporter],
            ["Vehicle No.", dc.vehicleNo],
            ["Delivery Status", <StatusBadge status={dc.status} />],
          ]}
        />
      </Card>
    </Screen>
  );
}

// ---------------------------------------------------------------- Invoices

function invoiceToChallanSeed(r) {
  const items = Array.isArray(r.items) ? r.items : [];
  return {
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
  };
}

function useConvertToChallan() {
  const navigate = useNavigate();
  const { confirm } = useFeedback();
  return async (r) => {
    if (r.dcNumber && r.dcNumber !== "—") {
      const again = await confirm({ title: "Already has a challan", message: `Invoice ${r.id} already has Delivery Challan ${r.dcNumber}. Create another?`, confirmLabel: "Create another" });
      if (!again) return;
    }
    navigate("/sales/delivery-challan/new", { state: { fromInvoice: invoiceToChallanSeed(r) } });
  };
}

export function Invoices() {
  const convert = useConvertToChallan();
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <ListScreen
      title="Invoices"
      endpoint="/api/sales/invoices"
      addPath="/sales/invoices/new"
      editPath={(r) => `/sales/invoices/${encodeURIComponent(r.id)}/edit`}
      detailPath={(r) => `/sales/invoices/${encodeURIComponent(r.id)}`}
      tabs={{ field: "status", options: [{ label: "All", value: undefined }, ...INVOICE_STATUSES.map((s) => ({ label: s, value: s }))] }}
      card={(r) => ({
        title: r.customer,
        subtitle: [r.id, r.date].filter(Boolean).join(" · "),
        amount: inr(r.amount),
        meta: [
          { label: "Paid", text: inr(r.paidAmount) },
          { label: "Balance", text: inr(r.balance) },
          { icon: "calendar", label: "Due", text: r.dueDate },
          { icon: "package", text: r.product },
        ],
        status: r.status,
        icon: "file",
      })}
      rowActions={(r) => [
        { label: r.dcNumber && r.dcNumber !== "—" ? `Challan ${r.dcNumber} — create another` : "Convert to Delivery Challan", icon: "truck", onPress: () => convert(r) },
        user?.role === "Administrator" && (Number(r.balance) > 0 || (r.status && r.status !== "Paid"))
          ? { label: "Draft payment reminder with AI", icon: "sparkles", onPress: () => navigate("/ai/reminder", { state: { customer: r.customer, phone: r.phone } }) }
          : null,
      ]}
    />
  );
}

export function InvoiceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { toast } = useFeedback();
  const convert = useConvertToChallan();
  const { data: inv, error, refreshing, reload, setData } = useRecord(`/api/sales/invoices/${encodeURIComponent(id)}`);
  const [settings, setSettings] = useState(null);
  const [deciding, setDeciding] = useState(false);
  useEffect(() => {
    api.get("/api/settings").then(setSettings).catch(() => {});
  }, []);

  if (error) return <Screen title="Invoice"><ErrorBox message={error} /></Screen>;
  if (!inv) return <Screen title="Invoice"><Loader /></Screen>;

  const items = inv.items || [];
  const subTotal = items.reduce((a, i) => a + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
  const grandTotal = items.reduce((a, i) => a + (i.amount || 0), 0) || inv.amount || 0;

  const decide = async (action) => {
    setDeciding(true);
    try {
      setData(await api.post(`/api/sales/invoices/${encodeURIComponent(id)}/${action}`, {}));
      toast(action === "approve" ? "Invoice approved." : "Invoice rejected.");
    } catch (err) {
      toast(err.message || "Could not record that decision.");
    } finally {
      setDeciding(false);
    }
  };

  const build = async () => {
    const { settings: s, party } = await loadDocContext("/api/customers", inv.customer);
    return invoiceHtml({ invoice: inv, customer: party, settings: s, copies: copyLabelsFor(s, "invoiceCopies", 3) });
  };

  const approval = inv.approvalStatus && inv.approvalStatus !== "not_required" ? inv.approvalStatus : null;

  return (
    <Screen
      title={inv.id}
      refreshing={refreshing}
      onRefresh={reload}
      headerRight={can("sales", "edit") ? [{ icon: "edit", onPress: () => navigate(`/sales/invoices/${encodeURIComponent(inv.id)}/edit`) }] : undefined}
    >
      {approval ? (
        <Card style={{ backgroundColor: approval === "approved" ? colors.greenBg : approval === "rejected" ? colors.redBg : colors.amberBg, borderColor: "transparent" }}>
          <Text style={{ fontWeight: "800", color: colors.text }}>
            {approval === "pending" ? "Waiting for approval" : approval === "approved" ? "Approved" : "Rejected"}
          </Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>
            {approval === "pending" ? inv.approvalReason || "This invoice needs signing off." : `${inv.approvedBy || "Someone"}${inv.approvalNote ? ` — ${inv.approvalNote}` : ""}`}
          </Text>
          {approval === "pending" ? (
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Button title="Reject" variant="secondary" style={{ flex: 1 }} disabled={deciding} onPress={() => decide("reject")} />
              <Button title="Approve" style={{ flex: 1 }} loading={deciding} onPress={() => decide("approve")} />
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>{inr(inv.amount)}</Text>
            <Text style={{ color: colors.textMuted }}>Balance {inr(inv.balance)}</Text>
          </View>
          <StatusBadge status={inv.status} />
        </View>
        <View style={{ gap: 8, marginBottom: 14 }}>
          <DocumentActions
            build={build}
            filename={`invoice-${inv.id}.pdf`}
            settings={settings}
            whatsapp={{ documentType: "invoice", documentId: inv.id, partyName: inv.customer, amount: inv.amount, defaultPhone: inv.phone }}
          />
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button small variant="secondary" icon="truck" title={inv.dcNumber && inv.dcNumber !== "—" ? `DC ${inv.dcNumber}` : "Make Challan"} onPress={() => convert(inv)} />
            {can("sales", "delete") ? <DeleteButton endpoint="/api/sales/invoices" id={inv.id} label={`Invoice ${inv.id}`} /> : null}
          </View>
        </View>
        <KeyValueGrid
          rows={[
            ["Customer", inv.customer],
            ["Mobile No.", formatPhone(inv.phone)],
            ["Billing Address", inv.address, { full: true }],
            ["Shipping Address", inv.shippingSameAsBilling === false && inv.shippingAddress ? inv.shippingAddress : `${inv.address || "—"} (same as billing)`, { full: true }],
            ["Place of Supply", inv.placeOfSupply],
            ["Invoice Date", inv.date],
            ["Due Date", inv.dueDate],
            ["PO Number", inv.poNumber],
            ["PO Date", inv.poDate],
            ["SO Number", inv.soNumber],
            ["Payment Mode", [inv.paymentMode, inv.paymentReference].filter(Boolean).join(" · ")],
            ["Transport Name", inv.transportName],
            ["Vehicle Number", inv.vehicleNo],
            ["Delivery Date", inv.deliveryDate],
            ["Delivery Location", inv.deliveryLocation],
            ["E-Way Bill No.", inv.eWayBillNo],
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>Items</SectionTitle>
        <MiniTable
          rows={items}
          columns={[
            { key: "product", label: "Item" },
            { key: "hsnCode", label: "HSN/SAC", render: (r) => r.hsnCode || "—" },
            { key: "quantity", label: "Qty", render: (r) => qtyUnit(r.quantity, r.unit) },
            { key: "unitPrice", label: "Unit Price", render: (r) => inr(r.unitPrice) },
            { key: "taxPercent", label: "Tax", render: (r) => `${r.taxPercent || 0}%` },
            { key: "amount", label: "Amount", render: (r) => inr(r.amount) },
          ]}
        />
        <TotalsBox
          rows={[
            ["Sub Total", inr(subTotal)],
            ["Tax", inr(grandTotal - subTotal)],
            ["Total Amount", inr(inv.amount), true],
            ["Paid Amount", inr(inv.paidAmount)],
            ["Balance Due", inr(inv.balance), true],
          ]}
        />
        {inv.notes ? <Text style={{ color: colors.textMuted, marginTop: 12 }}>{inv.notes}</Text> : null}
      </Card>
    </Screen>
  );
}

// ---------------------------------------------------------------- Sales returns
export function SalesReturns() {
  return (
    <ListScreen
      title="Sales Return"
      endpoint="/api/sales/returns"
      addPath="/sales/returns/new"
      editPath={(r) => `/sales/returns/${encodeURIComponent(r.id)}/edit`}
      card={(r) => ({
        title: r.customer,
        subtitle: [r.id, r.date].filter(Boolean).join(" · "),
        amount: inr(r.amount),
        meta: [
          { icon: "package", text: r.product },
          { text: qtyUnit(r.qty, r.unit) },
          { label: "Reason", text: r.reason },
          { label: "Inv", text: r.invoiceNo && r.invoiceNo !== "—" ? r.invoiceNo : "" },
        ],
        status: r.status,
        icon: "arrowLeft",
      })}
    />
  );
}

export function SalesReturnForm() {
  const { id } = useParams();
  const lookups = useSalesReturnLookups();
  return (
    <RecordFormScreen
      entity="Sales Return"
      endpoint="/api/sales/returns"
      fields={buildSalesReturnFields(lookups)}
      successMessage={id ? "Sales return updated." : "Return request logged."}
    />
  );
}
