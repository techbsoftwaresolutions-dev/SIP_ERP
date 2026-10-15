import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import Loader from "../../components/ui/Loader";
import {
  PRIORITIES,
  UNITS,
  WORK_ORDER_STATUSES,
  useManufacturingLookups,
} from "./manufacturingLookups";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

export default function WorkOrderForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { items, boms, workCenters, machines, warehouses } = useManufacturingLookups({
    items: true,
    boms: true,
    workCenters: true,
    machines: true,
    warehouses: true,
  });
  const [salesOrders, setSalesOrders] = useState([]);

  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const { fields: customFields } = useCustomFields("work-order");

  useEffect(() => {
    api
      .get("/api/sales/orders?page=1&pageSize=200")
      .then((r) => setSalesOrders(r.data || []))
      .catch(() => setSalesOrders([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/manufacturing/work-orders/${encodeURIComponent(id)}`)
      .then((r) => setExisting(unpackCustomFields(r)))
      .catch((err) => setLoadError(err.message || "Could not load this work order."))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // Only Active BOMs are offered for a new order; an edit still shows whatever
  // the order already points at, even if that BOM has since gone Obsolete.
  const bomOptions = boms
    .filter((b) => b.status === "Active" || (existing && b.id === existing.bom))
    .map((b) => b.id);

  const fields = [
    {
      key: "bom",
      label: "Bill of Materials",
      type: "combo",
      options: bomOptions,
      placeholder: "Pick a BOM to explode its materials",
      // Choosing a BOM fills in what it builds; both stay editable, and an
      // order with no BOM (rework, trial run) is allowed.
      full: true,
    },
    {
      key: "product",
      label: "Product",
      type: "combo",
      required: true,
      options: items.map((i) => i.name),
      deriveFrom: { field: "bom", source: boms, match: "id", pick: "product" },
    },
    { key: "plannedQty", label: "Planned Quantity", type: "number", required: true, min: 1 },
    { key: "unit", label: "Unit", type: "select", options: UNITS, defaultValue: "Nos" },
    {
      key: "warehouse",
      label: "Warehouse",
      type: "combo",
      options: warehouses.map((w) => w.name),
      defaultValue: "Main Warehouse",
      placeholder: "Where material is drawn from and output booked in",
    },
    { key: "workCenter", label: "Work Center", type: "combo", options: workCenters.map((w) => w.name) },
    { key: "machine", label: "Machine", type: "combo", options: machines.map((m) => m.name) },
    {
      key: "salesOrder",
      label: "Against Sales Order",
      type: "combo",
      options: salesOrders.map((s) => s.id),
      placeholder: "Leave blank when building to stock",
    },
    {
      key: "customer",
      label: "Customer",
      deriveFrom: { field: "salesOrder", source: salesOrders, match: "id", pick: "customer" },
      placeholder: "Filled in from the sales order",
    },
    { key: "startDate", label: "Start Date", type: "date" },
    { key: "dueDate", label: "Due Date", type: "date" },
    { key: "priority", label: "Priority", type: "select", options: PRIORITIES, defaultValue: "Normal" },
    { key: "status", label: "Status", type: "select", options: WORK_ORDER_STATUSES, defaultValue: "Draft" },
    { key: "notes", label: "Notes", type: "textarea", full: true },
    ...customFields,
  ];

  const handleSubmit = async (values) => {
    const payload = packCustomFields(values);
    if (isEdit) {
      await api.put(`/api/manufacturing/work-orders/${encodeURIComponent(id)}`, payload);
      navigate("/manufacturing/work-orders", { state: { toast: "Work order updated." } });
    } else {
      const created = await api.post("/api/manufacturing/work-orders", payload);
      navigate(`/manufacturing/work-orders/${created.id}`, { state: { toast: "Work order created." } });
    }
  };

  const title = isEdit ? `Edit Work Order ${id}` : "New Work Order";
  const crumbs = ["Dashboard", "Manufacturing", "Work Orders", isEdit ? "Edit" : "New Work Order"];

  if (loading) {
    return (
      <div>
        <PageHeader title={title} crumbs={crumbs} />
        <div className="loading-row" style={{ padding: "48px", textAlign: "center" }}>
          <Loader />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title={title} crumbs={crumbs} />
        <div className="list-card add-page-card">
          <div className="login-error">{loadError}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Work Order Details</div>
        <p className="muted" style={{ marginTop: 0 }}>
          Material requirements are exploded from the BOM when the order is created, and frozen once it leaves Draft
          so later BOM revisions don&apos;t rewrite an order already in production.
        </p>
        <AddRecordForm
          fields={fields}
          initialValues={existing || undefined}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/manufacturing/work-orders")}
          submitLabel={isEdit ? "Save Changes" : "Create Work Order"}
        />
      </div>
    </div>
  );
}
