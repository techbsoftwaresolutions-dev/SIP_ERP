import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import api from "../../api/client";
import ListScreen from "../../components/data/ListScreen";
import RecordFormScreen from "../../components/forms/RecordFormScreen";
import FormSheet from "../../components/forms/FormSheet";
import Screen from "../../components/layout/Screen";
import { Button, Card, ErrorBox, IconButton, KeyValueGrid, Loader, MiniTable, Note, SectionTitle, StatusBadge, useFeedback } from "../../components/ui";
import { usePermissions } from "../../context/SessionContext";
import { useLocation, useNavigate, useParams } from "../../navigation/router";
import { buildJobCardFields, buildMachineFields, WORK_CENTER_FIELDS } from "./manufacturingFields";
import { BOM_STATUSES, PRIORITIES, UNITS, WORK_ORDER_STATUSES, inr, num, useManufacturingLookups } from "./manufacturingLookups";
import { colors } from "../../theme";

// Ports of pages/manufacturing/* — BOMs, Work Orders (+ detail with
// release / issue material / book production / job cards / cancel),
// Job Cards, Material Issues, Production Receipts, Work Centers, Machines.

const pct = (r) => {
  const planned = Number(r.plannedQty) || 0;
  return planned > 0 ? Math.min(100, Math.round(((Number(r.producedQty) || 0) / planned) * 100)) : 0;
};

function ProgressBar({ value }) {
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
      <View style={{ width: `${value}%`, height: "100%", backgroundColor: value >= 100 ? colors.green : colors.primary }} />
    </View>
  );
}

// ---------------------------------------------------------------- BOMs
export function Boms() {
  return (
    <ListScreen
      title="Bill of Materials"
      endpoint="/api/manufacturing/boms"
      addPath="/manufacturing/boms/new"
      editPath={(r) => `/manufacturing/boms/${encodeURIComponent(r.id)}/edit`}
      card={(r) => ({
        title: r.product,
        subtitle: [r.id, r.version ? `v${r.version}` : ""].filter(Boolean).join(" · "),
        amount: inr(r.totalCost),
        meta: [
          { label: "Batch", text: `${num(r.outputQty)} ${r.unit || ""}` },
          { label: "Components", text: (r.components || []).length },
          { label: "Ops", text: (r.operations || []).length },
          { label: "Per unit", text: inr((Number(r.totalCost) || 0) / (Number(r.outputQty) || 1)) },
        ],
        status: r.status,
        icon: "layers",
      })}
    />
  );
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const componentRow = (row) => ({ ...row, amount: round2((Number(row.qty) || 0) * (1 + (Number(row.wastagePercent) || 0) / 100) * (Number(row.rate) || 0)) });
const operationRow = (row) => ({ ...row, amount: round2((Number(row.hours) || 0) * (Number(row.costPerHour) || 0)) });

export function BomForm() {
  const { items, workCenters, machines } = useManufacturingLookups({ items: true, workCenters: true, machines: true });
  return (
    <RecordFormScreen
      entity="BOM"
      endpoint="/api/manufacturing/boms"
      sectionTitle="BOM Details"
      note="Costs recalculate on save."
      fields={[
        { key: "product", label: "Finished Product", type: "combo", required: true, options: items.map((i) => i.name), placeholder: "What this BOM builds" },
        { key: "version", label: "Version", placeholder: "e.g. 1.0", defaultValue: "1.0" },
        { key: "outputQty", label: "Batch Size (output qty)", type: "number", min: 1, defaultValue: 1 },
        { key: "unit", label: "Unit", type: "select", options: UNITS, defaultValue: "Nos" },
        { key: "status", label: "Status", type: "select", options: BOM_STATUSES, defaultValue: "Draft" },
        { key: "effectiveFrom", label: "Effective From", type: "date" },
        {
          key: "components",
          label: "Components (per batch)",
          type: "items",
          required: true,
          addRowLabel: "+ Add Component",
          computeRow: componentRow,
          emptyDefaults: { unit: "Nos", qty: 1, wastagePercent: 0, rate: 0 },
          columns: [
            { key: "item", label: "Item", type: "combo", options: items.map((i) => i.name), deriveFrom: { source: items, match: "name", fields: { unit: "unit", rate: "purchasePrice", itemCode: "itemCode" } } },
            { key: "qty", label: "Qty", type: "number" },
            { key: "unit", label: "Unit", type: "select", options: UNITS },
            { key: "wastagePercent", label: "Wastage %", type: "number" },
            { key: "rate", label: "Rate (₹)", type: "number" },
            { key: "amount", label: "Amount (₹)", readOnly: true },
          ],
        },
        {
          key: "operations",
          label: "Routing / Operations (per batch)",
          type: "items",
          addRowLabel: "+ Add Operation",
          computeRow: operationRow,
          emptyDefaults: { hours: 0, costPerHour: 0 },
          columns: [
            { key: "operation", label: "Operation", wide: true },
            { key: "sequence", label: "Seq", type: "number" },
            { key: "workCenter", label: "Work Center", type: "combo", options: workCenters.map((w) => w.name), deriveFrom: { source: workCenters, match: "name", fields: { costPerHour: "costPerHour" } } },
            { key: "machine", label: "Machine", type: "combo", options: machines.map((m) => m.name) },
            { key: "hours", label: "Hours", type: "number" },
            { key: "costPerHour", label: "Cost / Hr (₹)", type: "number" },
            { key: "amount", label: "Amount (₹)", readOnly: true },
          ],
        },
        { key: "overheadCost", label: "Overhead Cost per Batch (₹)", type: "number" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
    />
  );
}

// ---------------------------------------------------------------- Work orders
export function WorkOrders() {
  return (
    <ListScreen
      title="Work Orders"
      endpoint="/api/manufacturing/work-orders"
      addPath="/manufacturing/work-orders/new"
      editPath={(r) => `/manufacturing/work-orders/${encodeURIComponent(r.id)}/edit`}
      detailPath={(r) => `/manufacturing/work-orders/${encodeURIComponent(r.id)}`}
      tabs={{ field: "status", options: [{ label: "All", value: undefined }, ...WORK_ORDER_STATUSES.map((s) => ({ label: s, value: s }))] }}
      card={(r) => ({
        title: r.product,
        subtitle: [r.id, r.bom, r.workCenter].filter(Boolean).join(" · "),
        amount: `${pct(r)}%`,
        meta: [
          { label: "Produced", text: `${num(r.producedQty)} / ${num(r.plannedQty)} ${r.unit || ""}` },
          { label: "Rejected", text: num(r.rejectedQty) },
          { icon: "calendar", label: "Due", text: r.dueDate },
        ],
        badges: r.priority ? [r.priority] : [],
        status: r.status,
        icon: "tool",
      })}
    />
  );
}

export function WorkOrderForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const { items, boms, workCenters, machines, warehouses } = useManufacturingLookups({ items: true, boms: true, workCenters: true, machines: true, warehouses: true });
  const [salesOrders, setSalesOrders] = useState([]);
  useEffect(() => {
    api.get("/api/sales/orders?page=1&pageSize=200").then((r) => setSalesOrders(r.data || [])).catch(() => {});
  }, []);
  return (
    <RecordFormScreen
      entity="Work Order"
      endpoint="/api/manufacturing/work-orders"
      sectionTitle="Work Order Details"
      note="Material requirements are exploded from the BOM when the order is created, and frozen once it leaves Draft."
      fields={(existing) => [
        { key: "bom", label: "Bill of Materials", type: "combo", options: boms.filter((b) => b.status === "Active" || (existing && b.id === existing.bom)).map((b) => b.id), placeholder: "Pick a BOM to explode its materials" },
        { key: "product", label: "Product", type: "combo", required: true, options: items.map((i) => i.name), deriveFrom: { field: "bom", source: boms, match: "id", pick: "product" } },
        { key: "plannedQty", label: "Planned Quantity", type: "number", required: true, min: 1 },
        { key: "unit", label: "Unit", type: "select", options: UNITS, defaultValue: "Nos" },
        { key: "warehouse", label: "Warehouse", type: "combo", options: warehouses.map((w) => w.name), defaultValue: "Main Warehouse" },
        { key: "workCenter", label: "Work Center", type: "combo", options: workCenters.map((w) => w.name) },
        { key: "machine", label: "Machine", type: "combo", options: machines.map((m) => m.name) },
        { key: "salesOrder", label: "Against Sales Order", type: "combo", options: salesOrders.map((s) => s.id), placeholder: "Leave blank when building to stock" },
        { key: "customer", label: "Customer", deriveFrom: { field: "salesOrder", source: salesOrders, match: "id", pick: "customer" }, placeholder: "Filled in from the sales order" },
        { key: "startDate", label: "Start Date", type: "date" },
        { key: "dueDate", label: "Due Date", type: "date" },
        { key: "priority", label: "Priority", type: "select", options: PRIORITIES, defaultValue: "Normal" },
        { key: "status", label: "Status", type: "select", options: WORK_ORDER_STATUSES, defaultValue: "Draft" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
      onSubmit={async (values, ctx) => {
        if (ctx.isEdit) {
          await api.put(`/api/manufacturing/work-orders/${encodeURIComponent(id)}`, values);
          return;
        }
        const created = await api.post("/api/manufacturing/work-orders", values);
        // Straight on to the new order, like the web.
        toast("Work order created.");
        navigate(`/manufacturing/work-orders/${encodeURIComponent(created.id)}`, { replace: true });
        return "handled";
      }}
      successMessage={isEdit ? "Work order updated." : undefined}
    />
  );
}

export function WorkOrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { toast, confirm } = useFeedback();
  const canEdit = can("manufacturing", "edit");
  const canCreate = can("manufacturing", "create");
  const [order, setOrder] = useState(null);
  const [jobCards, setJobCards] = useState([]);
  const [issues, setIssues] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [sheet, setSheet] = useState(""); // "issue" | "receipt"

  const load = useCallback(async () => {
    const q = `?workOrder=${encodeURIComponent(id)}&page=1&pageSize=100`;
    const [o, jc, mi, pr] = await Promise.all([
      api.get(`/api/manufacturing/work-orders/${encodeURIComponent(id)}`),
      api.get(`/api/manufacturing/job-cards${q}`).catch(() => ({ data: [] })),
      api.get(`/api/manufacturing/material-issues${q}`).catch(() => ({ data: [] })),
      api.get(`/api/manufacturing/production-receipts${q}`).catch(() => ({ data: [] })),
    ]);
    setOrder(o);
    setJobCards(jc.data || []);
    setIssues(mi.data || []);
    setReceipts(pr.data || []);
  }, [id]);

  useEffect(() => {
    load().catch((err) => setError(err.message || "Could not load this work order."));
  }, [load]);

  const act = async (key, fn, msg) => {
    setBusy(key);
    try {
      await fn();
      await load();
      if (msg) toast(msg);
    } catch (err) {
      toast(err.message || "Something went wrong.");
    } finally {
      setBusy("");
    }
  };

  if (error) return <Screen title="Work Order"><ErrorBox message={error} /></Screen>;
  if (!order) return <Screen title="Work Order"><Loader /></Screen>;

  const isDraft = order.status === "Draft";
  const isClosed = order.status === "Cancelled";
  const planned = Number(order.plannedQty) || 0;
  const remaining = Math.max(0, planned - (Number(order.producedQty) || 0));
  const shortfall = (order.requirements || [])
    .map((r) => ({ ...r, pending: Math.max(0, (Number(r.requiredQty) || 0) - (Number(r.issuedQty) || 0)) }))
    .filter((r) => r.pending > 0);

  const cancelDoc = async (kind, row) => {
    const ok = await confirm({
      title: kind === "material-issues" ? "Cancel material issue" : "Cancel production receipt",
      message:
        kind === "material-issues"
          ? `Cancel ${row.id}? Its material goes back into stock and the issued quantities on this order are rewound.`
          : `Cancel ${row.id}? Its finished goods are removed from stock and this order's produced quantity is rewound.`,
      confirmLabel: "Cancel it",
      danger: true,
    });
    if (ok) act("cancel", () => api.post(`/api/manufacturing/${kind}/${encodeURIComponent(row.id)}/cancel`), `${row.id} cancelled and its stock movement reversed.`);
  };

  const issueFields = [
    {
      key: "items",
      label: "Material to Issue",
      type: "items",
      required: true,
      addRowLabel: "+ Add Line",
      computeRow: (row) => ({ ...row, amount: round2((Number(row.qty) || 0) * (Number(row.rate) || 0)) }),
      emptyDefaults: { unit: order.unit || "Nos", qty: 0, rate: 0 },
      columns: [
        { key: "item", label: "Item", type: "combo", options: (order.requirements || []).map((r) => r.item), deriveFrom: { source: order.requirements || [], match: "item", fields: { unit: "unit", rate: "rate" } } },
        { key: "qty", label: "Qty", type: "number" },
        { key: "unit", label: "Unit", type: "select", options: UNITS },
        { key: "rate", label: "Rate (₹)", type: "number" },
        { key: "amount", label: "Amount (₹)", readOnly: true },
        { key: "batchNo", label: "Batch" },
      ],
    },
    { key: "issueDate", label: "Issue Date", type: "date" },
    { key: "issuedBy", label: "Issued By" },
    { key: "receivedBy", label: "Received By" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  const receiptFields = [
    { key: "acceptedQty", label: "Accepted Quantity", type: "number", defaultValue: remaining || "", placeholder: `${num(remaining)} still to produce` },
    { key: "rejectedQty", label: "Rejected Quantity", type: "number" },
    { key: "unit", label: "Unit", type: "select", options: UNITS, defaultValue: order.unit || "Nos" },
    { key: "batchNo", label: "Batch No." },
    { key: "receiptDate", label: "Receipt Date", type: "date" },
    { key: "receivedBy", label: "Received By" },
    { key: "inspectedBy", label: "Inspected By" },
    { key: "rejectionReason", label: "Rejection Reason" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <Screen title={order.id} onRefresh={load} headerRight={canEdit ? [{ icon: "edit", onPress: () => navigate(`/manufacturing/work-orders/${encodeURIComponent(order.id)}/edit`) }] : undefined}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ flex: 1, fontSize: 18, fontWeight: "800" }}>{order.product}</Text>
          <StatusBadge status={order.status} />
        </View>
        <Text style={{ color: colors.textMuted, marginBottom: 6 }}>
          {num(order.producedQty)} of {num(order.plannedQty)} {order.unit} produced ({pct(order)}%)
        </Text>
        <ProgressBar value={pct(order)} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {canEdit && isDraft ? (
            <Button
              small
              title="Release Order"
              loading={busy === "release"}
              onPress={() => act("release", () => api.put(`/api/manufacturing/work-orders/${encodeURIComponent(order.id)}`, { status: "Released" }), "Work order released — material can now be issued.")}
            />
          ) : null}
          {canCreate && !isDraft && !isClosed ? (
            <>
              <Button small variant="secondary" icon="upload" title="Issue Material" onPress={() => setSheet("issue")} />
              <Button small icon="download" title="Book Production" onPress={() => setSheet("receipt")} />
            </>
          ) : null}
          {canCreate && jobCards.length === 0 && order.bom ? (
            <Button
              small
              variant="secondary"
              icon="tag"
              title="Generate Job Cards"
              loading={busy === "jc"}
              onPress={() => act("jc", () => api.post(`/api/manufacturing/work-orders/${encodeURIComponent(order.id)}/job-cards`), "Job cards generated from the BOM routing.")}
            />
          ) : null}
        </View>
      </Card>

      <Card>
        <SectionTitle>Order Summary</SectionTitle>
        <KeyValueGrid
          rows={[
            ["BOM", order.bom || "— (manual requirements)"],
            ["Rejected", num(order.rejectedQty)],
            ["Priority", order.priority],
            ["Work Center", order.workCenter],
            ["Machine", order.machine],
            ["Warehouse", order.warehouse],
            ["Sales Order", order.salesOrder || "— (to stock)"],
            ["Customer", order.customer],
            ["Start / Due", `${order.startDate || "—"} → ${order.dueDate || "—"}`],
            ["Completed", order.completedDate],
            ["Material Cost", inr(order.materialCost)],
            ["Total Cost", inr(order.totalCost)],
          ]}
        />
        {order.notes ? <Text style={{ color: colors.textMuted, marginTop: 10 }}>{order.notes}</Text> : null}
      </Card>

      <Card>
        <SectionTitle>Material Requirements</SectionTitle>
        <MiniTable
          rows={order.requirements || []}
          empty="No material requirements."
          columns={[
            { key: "item", label: "Item" },
            { key: "requiredQty", label: "Required", render: (r) => `${num(r.requiredQty)} ${r.unit || ""}` },
            { key: "issuedQty", label: "Issued", render: (r) => num(r.issuedQty) },
            {
              key: "pending",
              label: "Pending",
              render: (r) => {
                const p = (Number(r.requiredQty) || 0) - (Number(r.issuedQty) || 0);
                return <Text style={{ color: p > 0 ? colors.red : colors.green, fontWeight: "700" }}>{num(p)}</Text>;
              },
            },
            { key: "rate", label: "Rate", render: (r) => inr(r.rate) },
            { key: "amount", label: "Amount", render: (r) => inr(r.amount) },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>Job Cards ({jobCards.length})</SectionTitle>
        <MiniTable
          rows={jobCards}
          empty="No job cards yet."
          columns={[
            { key: "operation", label: "Operation", render: (r) => `${r.sequence ? `${r.sequence}. ` : ""}${r.operation} · ${r.id}` },
            { key: "workCenter", label: "Work Center", render: (r) => r.workCenter || "—" },
            { key: "operator", label: "Operator", render: (r) => r.operator || "—" },
            { key: "completedQty", label: "Done / Rej", render: (r) => `${num(r.completedQty)} / ${num(r.rejectedQty)}` },
            { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "__edit", label: "", render: (r) => (canEdit ? <IconButton name="edit" onPress={() => navigate(`/manufacturing/job-cards/${encodeURIComponent(r.id)}/edit`)} /> : null) },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>Material Issues ({issues.length})</SectionTitle>
        <MiniTable
          rows={issues}
          empty="Nothing issued yet."
          columns={[
            { key: "id", label: "Issue", render: (r) => `${r.id} · ${r.issueDate || "—"}` },
            { key: "totalQty", label: "Qty", render: (r) => num(r.totalQty) },
            { key: "totalValue", label: "Value", render: (r) => inr(r.totalValue) },
            { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "__c", label: "", render: (r) => (canEdit && r.status === "Issued" ? <Button small variant="ghost" title="Cancel" onPress={() => cancelDoc("material-issues", r)} /> : null) },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>Production Receipts ({receipts.length})</SectionTitle>
        <MiniTable
          rows={receipts}
          empty="No production booked yet."
          columns={[
            { key: "id", label: "Receipt", render: (r) => `${r.id} · ${r.receiptDate || "—"}` },
            { key: "acceptedQty", label: "Accepted", render: (r) => num(r.acceptedQty) },
            { key: "rejectedQty", label: "Rejected", render: (r) => num(r.rejectedQty) },
            { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
            { key: "__c", label: "", render: (r) => (canEdit && r.status === "Accepted" ? <Button small variant="ghost" title="Cancel" onPress={() => cancelDoc("production-receipts", r)} /> : null) },
          ]}
        />
      </Card>

      <FormSheet
        visible={sheet === "issue"}
        title={`Issue Material to ${order.id}`}
        fields={issueFields}
        initialValues={{ items: shortfall.map((r) => ({ item: r.item, qty: r.pending, unit: r.unit, rate: r.rate, batchNo: "" })) }}
        submitLabel="Post Issue"
        onClose={() => setSheet("")}
        onSubmit={async (values) => {
          await api.post("/api/manufacturing/material-issues", { ...values, workOrder: order.id });
          setSheet("");
          await load();
          toast("Material issued — raw material stock reduced.");
        }}
      />
      <FormSheet
        visible={sheet === "receipt"}
        title={`Book Production from ${order.id}`}
        note="Only the accepted quantity is added to stock; rejects are recorded for yield reporting."
        fields={receiptFields}
        submitLabel="Post Receipt"
        onClose={() => setSheet("")}
        onSubmit={async (values) => {
          await api.post("/api/manufacturing/production-receipts", { ...values, workOrder: order.id });
          setSheet("");
          await load();
          toast("Production booked — finished goods added to stock.");
        }}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------- Job cards
export function JobCards() {
  const navigate = useNavigate();
  return (
    <ListScreen
      title="Job Cards"
      endpoint="/api/manufacturing/job-cards"
      addPath="/manufacturing/job-cards/new"
      editPath={(r) => `/manufacturing/job-cards/${encodeURIComponent(r.id)}/edit`}
      card={(r) => ({
        title: r.operation,
        subtitle: [r.id, r.workOrder].filter(Boolean).join(" · "),
        meta: [
          { label: "WC", text: r.workCenter },
          { label: "Machine", text: r.machine },
          { icon: "user", text: r.operator },
          { label: "Done", text: `${num(r.completedQty)}/${num(r.plannedQty)}` },
          { label: "Rej", text: num(r.rejectedQty) },
          { icon: "clock", text: r.hours ? `${num(r.hours)} h` : "" },
        ],
        status: r.status,
        icon: "tag",
      })}
      rowActions={(r) => [r.workOrder ? { label: `Open ${r.workOrder}`, icon: "file", onPress: () => navigate(`/manufacturing/work-orders/${encodeURIComponent(r.workOrder)}`) } : null]}
    />
  );
}

export function JobCardForm() {
  const { state } = useLocation();
  const { workOrders, workCenters, machines } = useManufacturingLookups({ workOrders: true, workCenters: true, machines: true });
  return <RecordFormScreen entity="Job Card" endpoint="/api/manufacturing/job-cards" fields={buildJobCardFields({ workOrders, workCenters, machines })} initialValues={state && state.seed} />;
}

// ---------------------------------------------------------------- Material issues / production receipts (read-only registers)
export function MaterialIssues() {
  const navigate = useNavigate();
  return (
    <ListScreen
      title="Material Issue"
      endpoint="/api/manufacturing/material-issues"
      canAdd={false}
      note="Material is issued from a work order, which knows what is still outstanding — open one and use Issue Material. To correct a posted issue, cancel it there; that returns the stock."
      onPressRow={(r) => navigate(`/manufacturing/work-orders/${encodeURIComponent(r.workOrder)}`)}
      card={(r) => ({
        title: r.product || r.workOrder,
        subtitle: [r.id, r.workOrder, r.issueDate].filter(Boolean).join(" · "),
        amount: inr(r.totalValue),
        meta: [
          { label: "Lines", text: (r.items || []).length },
          { label: "Qty", text: num(r.totalQty) },
          { icon: "store", text: r.warehouse },
          { icon: "user", text: r.issuedBy },
        ],
        status: r.status,
        icon: "upload",
      })}
    />
  );
}

export function ProductionReceipts() {
  const navigate = useNavigate();
  const yieldPct = (r) => {
    const a = Number(r.acceptedQty) || 0;
    const t = a + (Number(r.rejectedQty) || 0);
    return t ? `${Math.round((a / t) * 100)}%` : "—";
  };
  return (
    <ListScreen
      title="Production Receipt"
      endpoint="/api/manufacturing/production-receipts"
      canAdd={false}
      note="Finished goods are booked in from a work order — open one and use Book Production. Only the accepted quantity is added to stock."
      onPressRow={(r) => navigate(`/manufacturing/work-orders/${encodeURIComponent(r.workOrder)}`)}
      card={(r) => ({
        title: r.product,
        subtitle: [r.id, r.workOrder, r.receiptDate].filter(Boolean).join(" · "),
        amount: `${num(r.acceptedQty)} ${r.unit || ""}`,
        meta: [
          { label: "Rejected", text: num(r.rejectedQty) },
          { label: "Yield", text: yieldPct(r) },
          { label: "Batch", text: r.batchNo },
          { icon: "store", text: r.warehouse },
        ],
        status: r.status,
        icon: "download",
      })}
    />
  );
}

// ---------------------------------------------------------------- Work centers / machines
export function WorkCenters() {
  return (
    <ListScreen
      title="Work Centers"
      endpoint="/api/manufacturing/work-centers"
      addPath="/manufacturing/work-centers/new"
      editPath={(r) => `/manufacturing/work-centers/${encodeURIComponent(r.id)}/edit`}
      card={(r) => ({
        title: r.name,
        subtitle: [r.id, r.location].filter(Boolean).join(" · "),
        amount: `${inr(r.costPerHour)}/h`,
        meta: [
          { icon: "user", text: r.supervisor },
          { label: "Capacity", text: `${num(r.capacityPerDay)} ${r.unit || ""}/day` },
          { label: "Hours", text: num(r.workingHoursPerDay) },
        ],
        status: r.status,
        icon: "store",
      })}
    />
  );
}

export function WorkCenterForm() {
  return <RecordFormScreen entity="Work Center" endpoint="/api/manufacturing/work-centers" fields={WORK_CENTER_FIELDS} />;
}

export function Machines() {
  return (
    <ListScreen
      title="Machines"
      endpoint="/api/manufacturing/machines"
      addPath="/manufacturing/machines/new"
      editPath={(r) => `/manufacturing/machines/${encodeURIComponent(r.id)}/edit`}
      card={(r) => ({
        title: r.name,
        subtitle: [r.id, r.workCenter, r.machineType].filter(Boolean).join(" · "),
        meta: [
          { label: "Capacity", text: `${num(r.capacityPerHour)} ${r.unit || ""}/h` },
          { icon: "calendar", label: "Next service", text: r.nextServiceDate },
        ],
        status: r.status,
        icon: "settings",
      })}
    />
  );
}

export function MachineForm() {
  const { workCenters } = useManufacturingLookups({ workCenters: true });
  return <RecordFormScreen entity="Machine" endpoint="/api/manufacturing/machines" fields={buildMachineFields({ workCenters })} />;
}
