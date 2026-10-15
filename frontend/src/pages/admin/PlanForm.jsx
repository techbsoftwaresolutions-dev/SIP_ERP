import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Loader from "../../components/ui/Loader";
import MenuPicker, { expandStored, useMenuTree } from "./MenuPicker";

// Plan price is a monthly rate — the subscription term (1/3/6/12/24/36
// months) is chosen per client on the Manage Clients screen.
const STATUS_OPTIONS = ["active", "archived"];

// Which invoice themes the plan unlocks. Higher tiers include the lower
// ones, and advanced and up also unlock the colour picker.
const THEME_TIERS = ["basic", "advanced", "premium"];

function PlanFormInner() {
  const { code } = useParams();
  const isEdit = Boolean(code);
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();
  const [initialValues, setInitialValues] = useState(isEdit ? null : {});
  const tree = useMenuTree();
  // Which menus this plan unlocks. Empty = no restriction, which is what
  // every existing plan has, so nothing changes until it's configured.
  const [planModules, setPlanModules] = useState([]);
  // The stored list is only meaningful once the catalogue has arrived, since
  // parent keys have to be expanded against it.
  const [storedModules, setStoredModules] = useState(null);
  const [loadError, setLoadError] = useState("");
  // Modules flagged "sold as an add-on only" in the module registry. A plan
  // must not be able to include them, or the add-on would have nothing left
  // to sell — so they show greyed out rather than silently missing.
  const [addOnOnly, setAddOnOnly] = useState([]);

  useEffect(() => {
    api
      .get("/api/admin/modules", masterKeyHeader())
      .then((r) => setAddOnOnly((r.modules || []).filter((m) => m.addOnOnly).map((m) => m.key)))
      .catch(() => setAddOnOnly([]));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get("/api/admin/plans", masterKeyHeader())
      .then((r) => {
        const plan = (r.plans || []).find((p) => p.code === code);
        if (!plan) throw new Error("Plan not found.");
        // AddRecordForm joins array values with ", " for non-items fields, so
        // hand it a newline-separated string and re-split it on save.
        setInitialValues({ ...plan, features: (plan.features || []).join("\n") });
        setStoredModules(plan.modules || []);
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setLoadError(err.message || "Could not load that plan.");
      });
  }, [code, isEdit]);

  // Tick the boxes once both the plan and the catalogue are in.
  useEffect(() => {
    if (!tree.length || storedModules === null) return;
    setPlanModules(expandStored(tree, storedModules));
  }, [tree, storedModules]);

  // `code` is what clients are assigned by, so it's derived from the name on
  // create and never editable afterwards — changing it would orphan every
  // client already on the plan.
  const fields = [
    { key: "name", label: "Plan Name", required: true, placeholder: "e.g. Professional" },
    ...(isEdit ? [{ key: "code", label: "Plan Code", readOnly: true }] : []),
    { key: "price", label: "Monthly Price (₹)", type: "number", required: true, min: 0, placeholder: "e.g. 2499" },
    {
      key: "maxUsers",
      label: "Max Users (0 = unlimited)",
      type: "number",
      min: 0,
      placeholder: "e.g. 20",
    },
    {
      key: "invoiceThemeTier",
      label: "Invoice Themes",
      type: "select",
      options: THEME_TIERS,
    },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      full: true,
      placeholder: "Best for growing businesses",
    },
    {
      key: "features",
      label: "Features (one per line — shown for reference, not enforced)",
      type: "textarea",
      full: true,
      placeholder: "Advanced Reports\nAI Assistant\nPriority Support",
    },
  ];

  const handleSubmit = async (values) => {
    const payload = {
      name: values.name,
      price: Number(values.price) || 0,
      maxUsers: Number(values.maxUsers) || 0,
      status: values.status || "active",
      invoiceThemeTier: values.invoiceThemeTier || "basic",
      description: values.description || "",
      modules: planModules,
      features: String(values.features || "")
        .split(/[\n,]/)
        .map((f) => f.trim())
        .filter(Boolean),
    };
    if (isEdit) {
      await api.put(`/api/admin/plans/${encodeURIComponent(code)}`, payload, masterKeyHeader());
      navigate("/admin/plans", { state: { toast: "Plan updated." } });
    } else {
      const created = await api.post("/api/admin/plans", payload, masterKeyHeader());
      navigate("/admin/plans", { state: { toast: `Plan "${created.name}" added.` } });
    }
  };

  const title = isEdit ? `Edit Plan — ${code}` : "Add Plan";
  const crumbs = ["Admin", "Manage Plans", title];

  if (isEdit && !initialValues) {
    return (
      <div>
        <PageHeader title="Edit Plan" crumbs={["Admin", "Manage Plans", "Edit Plan"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Plan Details</div>
        <MenuPicker
          tree={tree}
          value={planModules}
          onChange={setPlanModules}
          label="Menu access"
          note="none ticked = all menus"
          exclude={addOnOnly}
          disabledTitle="Sold as an add-on only — not available in plans"
        />

        <AddRecordForm
          fields={fields}
          initialValues={isEdit ? initialValues : { status: "active", invoiceThemeTier: "basic" }}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/admin/plans")}
          submitLabel={isEdit ? "Save Changes" : "Add Plan"}
        />
      </div>
    </div>
  );
}

export default function PlanForm() {
  return (
    <MasterKeyGate>
      <PlanFormInner />
    </MasterKeyGate>
  );
}
