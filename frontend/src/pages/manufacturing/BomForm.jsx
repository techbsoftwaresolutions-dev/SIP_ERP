import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import Loader from "../../components/ui/Loader";
import { BOM_STATUSES, UNITS, inr, useManufacturingLookups } from "./manufacturingLookups";
import { useCustomFields, packCustomFields, unpackCustomFields } from "../../hooks/useCustomFields";

// Mirrors the backend's costing exactly (see componentQtyWithWastage in
// backend/manufacturingRoutes.js) so the row amounts the user sees while
// typing match what the server stores on save.
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function componentRow(row) {
  const qty = Number(row.qty) || 0;
  const wastage = Number(row.wastagePercent) || 0;
  const rate = Number(row.rate) || 0;
  return { ...row, amount: round2(qty * (1 + wastage / 100) * rate) };
}

function operationRow(row) {
  return { ...row, amount: round2((Number(row.hours) || 0) * (Number(row.costPerHour) || 0)) };
}

export default function BomForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { items, workCenters, machines } = useManufacturingLookups({
    items: true,
    workCenters: true,
    machines: true,
  });

  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState("");
  const { fields: customFields } = useCustomFields("bom");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/api/manufacturing/boms/${encodeURIComponent(id)}`)
      .then((r) => setExisting(unpackCustomFields(r)))
      .catch((err) => setLoadError(err.message || "Could not load this BOM."))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const fields = [
    {
      key: "product",
      label: "Finished Product",
      type: "combo",
      required: true,
      options: items.map((i) => i.name),
      placeholder: "What this BOM builds",
      // Any catalog item may be a BOM output — a sub-assembly is a finished
      // good to this BOM and a component to the next one up.
      full: true,
    },
    { key: "version", label: "Version", placeholder: "e.g. 1.0", defaultValue: "1.0" },
    {
      key: "outputQty",
      label: "Batch Size (output qty)",
      type: "number",
      min: 1,
      defaultValue: 1,
      placeholder: "Units produced per run",
    },
    { key: "unit", label: "Unit", type: "select", options: UNITS, defaultValue: "Nos" },
    { key: "status", label: "Status", type: "select", options: BOM_STATUSES, defaultValue: "Draft" },
    { key: "effectiveFrom", label: "Effective From", type: "date" },
    {
      key: "components",
      label: "Components (per batch)",
      type: "items",
      required: true,
      full: true,
      addRowLabel: "+ Add Component",
      computeRow: componentRow,
      emptyDefaults: { unit: "Nos", qty: 1, wastagePercent: 0, rate: 0 },
      columns: [
        {
          key: "item",
          label: "Item",
          type: "combo",
          options: items.map((i) => i.name),
          // Picking an item pulls its unit and last purchase price through,
          // both still editable on the row.
          deriveFrom: {
            source: items,
            match: "name",
            fields: { unit: "unit", rate: "purchasePrice", itemCode: "itemCode" },
          },
        },
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
      full: true,
      addRowLabel: "+ Add Operation",
      computeRow: operationRow,
      emptyDefaults: { hours: 0, costPerHour: 0 },
      columns: [
        { key: "sequence", label: "Seq", type: "number" },
        { key: "operation", label: "Operation" },
        {
          key: "workCenter",
          label: "Work Center",
          type: "combo",
          options: workCenters.map((w) => w.name),
          // Cost per hour defaults from the work center's own rate.
          deriveFrom: { source: workCenters, match: "name", fields: { costPerHour: "costPerHour" } },
        },
        { key: "machine", label: "Machine", type: "combo", options: machines.map((m) => m.name) },
        { key: "hours", label: "Hours", type: "number" },
        { key: "costPerHour", label: "Cost / Hr (₹)", type: "number" },
        { key: "amount", label: "Amount (₹)", readOnly: true },
      ],
    },
    {
      key: "overheadCost",
      label: "Overhead Cost per Batch (₹)",
      type: "number",
      placeholder: "Fixed overhead absorbed by one batch",
    },
    { key: "notes", label: "Notes", type: "textarea", full: true },
    ...customFields,
  ];

  const handleSubmit = async (values) => {
    const payload = packCustomFields(values);
    if (isEdit) {
      await api.put(`/api/manufacturing/boms/${encodeURIComponent(id)}`, payload);
      navigate("/manufacturing/boms", { state: { toast: "BOM updated." } });
    } else {
      await api.post("/api/manufacturing/boms", payload);
      navigate("/manufacturing/boms", { state: { toast: "BOM created." } });
    }
  };

  const title = isEdit ? `Edit BOM ${id}` : "New Bill of Materials";
  const crumbs = ["Dashboard", "Manufacturing", "Bill of Materials", isEdit ? "Edit" : "New BOM"];

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

  const estimated = existing
    ? `Material ${inr(existing.materialCost)} + Operations ${inr(existing.operationCost)} + Overhead ${inr(
        existing.overheadCost
      )} = ${inr(existing.totalCost)}`
    : null;

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">BOM Details</div>
        {estimated && (
          <p className="muted" style={{ marginTop: 0 }}>
            Last saved cost — {estimated}. Costs recalculate on save.
          </p>
        )}
        <AddRecordForm
          fields={fields}
          initialValues={existing || undefined}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/manufacturing/boms")}
          submitLabel={isEdit ? "Save Changes" : "Create BOM"}
        />
      </div>
    </div>
  );
}
