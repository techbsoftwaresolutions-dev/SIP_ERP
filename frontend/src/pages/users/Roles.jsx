import { useEffect, useState } from "react";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/ui/Icon";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Loader from "../../components/ui/Loader";
import PermissionMatrix from "../../components/forms/PermissionMatrix";
import Toast from "../../components/ui/Toast";

const ADMIN = "Administrator";

export default function RolesPermissions() {
  const [catalogue, setCatalogue] = useState({ modules: [], actions: [] });
  const [roles, setRoles] = useState(null);
  const [selected, setSelected] = useState(null); // role id being edited
  const [draft, setDraft] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [newRole, setNewRole] = useState("");

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };

  const load = () =>
    Promise.all([
      api.get("/api/permissions/catalogue"),
      api.get("/api/roles?page=1&pageSize=100"),
    ])
      .then(([cat, list]) => {
        setCatalogue(cat);
        setRoles(list.data || []);
      })
      .catch((err) => setError(err.message || "Could not load roles."));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdminRole = (r) => r && String(r.name).toLowerCase() === ADMIN.toLowerCase();

  const openRole = (r) => {
    setSelected(r.id);
    setDraft(new Set(r.permissions || []));
    setError("");
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api.put(`/api/roles/${encodeURIComponent(selected)}`, { permissions: [...draft] });
      await load();
      flash("Permissions saved.");
    } catch (err) {
      setError(err.message || "Could not save permissions.");
    } finally {
      setSaving(false);
    }
  };

  const seedDefaults = async () => {
    setSeeding(true);
    setError("");
    try {
      await api.post("/api/roles/seed-defaults", {});
      await load();
      flash("Default roles created.");
    } catch (err) {
      setError(err.message || "Could not create default roles.");
    } finally {
      setSeeding(false);
    }
  };

  const addRole = async () => {
    const name = newRole.trim();
    if (!name) return;
    setError("");
    try {
      await api.post("/api/roles", { name, permissions: [] });
      setNewRole("");
      await load();
      flash(`Role "${name}" added.`);
    } catch (err) {
      setError(err.message || "Could not add that role.");
    }
  };

  const removeRole = async () => {
    try {
      await api.delete(`/api/roles/${encodeURIComponent(deleteTarget.id)}`);
      if (selected === deleteTarget.id) setSelected(null);
      setDeleteTarget(null);
      await load();
      flash("Role deleted.");
    } catch (err) {
      window.alert(err.message || "Could not delete that role.");
    }
  };

  if (!roles) {
    return (
      <div>
        <PageHeader title="Roles & Permissions" crumbs={["Dashboard", "Users & Roles", "Roles & Permissions"]} />
        <div className="loading-row">{error ? error : <Loader />}</div>
      </div>
    );
  }

  const current = roles.find((r) => r.id === selected);
  const adminSelected = isAdminRole(current);

  return (
    <div>
      <PageHeader title="Roles & Permissions" crumbs={["Dashboard", "Users & Roles", "Roles & Permissions"]} />
      {toast && <Toast message={toast} />}
      {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

      {roles.length === 0 ? (
        <div className="list-card">
          <div className="section-title">No roles yet</div>
          <p className="field-hint" style={{ marginTop: 0 }}>
            While no roles exist, everyone has full access. Creating roles is what switches
            permission checks on.
          </p>
          <button type="button" className="btn btn-primary" onClick={seedDefaults} disabled={seeding}>
            {seeding ? "Creating…" : "Create default roles"}
          </button>
        </div>
      ) : (
        <div className="perm-layout">
          <div className="list-card perm-roles">
            <div className="section-title">Roles</div>
            {roles.map((r) => (
              <div key={r.id} className={`perm-role${selected === r.id ? " active" : ""}`}>
                <button type="button" className="perm-role-name" onClick={() => openRole(r)}>
                  <div>{r.name}</div>
                  <div className="perm-role-sub">
                    {isAdminRole(r) ? "Full access" : `${(r.permissions || []).length} permissions`}
                  </div>
                </button>
                {!isAdminRole(r) && (
                  <button
                    type="button"
                    className="icon-btn danger"
                    title="Delete role"
                    onClick={() => setDeleteTarget(r)}
                  >
                    <Icon name="trash" />
                  </button>
                )}
              </div>
            ))}
            <div className="perm-add">
              <input
                type="text"
                placeholder="New role name"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRole()}
              />
              <button type="button" className="btn" onClick={addRole} disabled={!newRole.trim()}>
                Add
              </button>
            </div>
          </div>

          <div className="list-card perm-matrix-card">
            {!current ? (
              <div className="rem-empty">
                <Icon name="user" size={24} />
                <div>Select a role to edit its permissions.</div>
              </div>
            ) : (
              <>
                <div className="section-title">{current.name}</div>
                {adminSelected ? (
                  <p className="field-hint" style={{ marginTop: 0 }}>
                    Administrator always has every permission and can't be restricted — this is
                    what guarantees you can never lock yourself out.
                  </p>
                ) : null}

                <PermissionMatrix
                  modules={catalogue.modules}
                  actions={catalogue.actions}
                  value={draft}
                  onChange={(next) => setDraft(new Set(next))}
                  disabled={adminSelected}
                />
                {!adminSelected && (
                  <div className="add-form-actions">
                    <button type="button" className="btn" onClick={() => openRole(current)} disabled={saving}>
                      Cancel
                    </button>
                    <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                      {saving ? "Saving…" : "Save Permissions"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this role?"
          message={`Delete "${deleteTarget.name}"? Users still assigned to it will lose access until they are given another role.`}
          confirmLabel="Delete"
          onConfirm={removeRole}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
