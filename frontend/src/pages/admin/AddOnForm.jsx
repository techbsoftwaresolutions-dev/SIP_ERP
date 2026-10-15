import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import Loader from "../../components/ui/Loader";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import MenuPicker, { expandStored, useMenuTree } from "./MenuPicker";

const STATUS_OPTIONS = ["active", "archived"];
const BILLING_CYCLES = ["Monthly", "Quarterly", "Yearly"];

function AddOnFormInner() {
  const { code } = useParams();
  const isEdit = Boolean(code);
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();
  const tree = useMenuTree();
  const [initialValues, setInitialValues] = useState(isEdit ? null : {});
  // Which menus this add-on unlocks. Unlike a plan, empty means it unlocks
  // NOTHING — so an add-on saved with nothing ticked is a billable line item
  // and not an accidental grant of the whole app.
  const [modules, setModules] = useState([]);
  // Only meaningful once the catalogue has arrived, since a stored parent key
  // has to be expanded against it.
  const [storedModules, setStoredModules] = useState(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    api
      .get("/api/admin/add-ons", masterKeyHeader())
      .then((r) => {
        const found = (r.addOns || []).find((a) => a.code === code);
        if (!found) throw new Error("Add-on not found.");
        setInitialValues(found);
        setStoredModules(found.modules || []);
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setLoadError(err.message || "Could not load that add-on.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, isEdit]);

  // Tick the boxes once both the add-on and the catalogue are in.
  useEffect(() => {
    if (!tree.length || storedModules === null) return;
    setModules(expandStored(tree, storedModules));
  }, [tree, storedModules]);

  // `code` is what a client's record points at, so it is derived from the
  // name on create and fixed afterwards — changing it would strip the add-on
  // from every client already holding it.
  const fields = [
    { key: "name", label: "Add-on Name", required: true, placeholder: "e.g. Manufacturing Pack" },
    ...(isEdit ? [{ key: "code", label: "Add-on Code", readOnly: true }] : []),
    { key: "price", label: "Price (₹)", type: "number", required: true, min: 0, placeholder: "e.g. 1499" },
    { key: "billingCycle", label: "Billing Cycle", type: "select", options: BILLING_CYCLES },
    {
      key: "maxUsersBonus",
      label: "Extra Seats (added to the plan's limit)",
      type: "number",
      min: 0,
      placeholder: "e.g. 5",
    },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      full: true,
      placeholder: "What the client gets for this — shown wherever the add-on is listed",
    },
  ];

  const handleSubmit = async (values) => {
    const payload = {
      name: values.name,
      price: Number(values.price) || 0,
      billingCycle: values.billingCycle || "Monthly",
      maxUsersBonus: Number(values.maxUsersBonus) || 0,
      status: values.status || "active",
      description: values.description || "",
      modules,
    };
    if (isEdit) {
      await api.put(`/api/admin/add-ons/${encodeURIComponent(code)}`, payload, masterKeyHeader());
      navigate("/admin/add-ons", { state: { toast: "Add-on updated." } });
    } else {
      const created = await api.post("/api/admin/add-ons", payload, masterKeyHeader());
      navigate("/admin/add-ons", { state: { toast: `Add-on "${created.name}" added.` } });
    }
  };

  const title = isEdit ? `Edit Add-on — ${code}` : "Add Add-on";
  const crumbs = ["Admin", "Add-ons", title];

  if (isEdit && !initialValues) {
    return (
      <div>
        <PageHeader title="Edit Add-on" crumbs={["Admin", "Add-ons", "Edit Add-on"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={title} crumbs={crumbs} />
      <div className="list-card add-page-card">
        <div className="section-title">Add-on Details</div>
        <MenuPicker
          tree={tree}
          value={modules}
          onChange={setModules}
          label="Menus this add-on unlocks"
          note="granted on top of whatever the plan already includes"
        />

        <AddRecordForm
          fields={fields}
          initialValues={isEdit ? initialValues : { status: "active", billingCycle: "Monthly" }}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/admin/add-ons")}
          submitLabel={isEdit ? "Save Changes" : "Add Add-on"}
        />
      </div>
    </div>
  );
}

export default function AddOnForm() {
  return (
    <MasterKeyGate>
      <AddOnFormInner />
    </MasterKeyGate>
  );
}
