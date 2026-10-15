import { useEffect, useState } from "react";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Toast from "../../components/ui/Toast";

// Which actions each module offers, for the whole platform.
//
// This is the bluntest screen in the admin panel: unticking a box does not
// hide a checkbox somewhere, it refuses that action at the gate for every
// client and every role, a client's own Administrator included. So a change
// here is confirmed before it is sent, and `view` is never on offer at all —
// a module nobody may view is a module that is switched off, and that is what
// the Modules kill switch is for.
function GlobalPermissionsInner() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  // The pending change, held until it is confirmed.
  const [pending, setPending] = useState(null);
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const load = () => {
    api
      .get("/api/admin/global-permissions", masterKeyHeader())
      .then(setData)
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load global permissions.");
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 3000);
  };

  if (!data) {
    return (
      <div>
        <PageHeader title="Global Permissions" crumbs={["Admin", "Global Permissions"]} />
        <div className="loading-row">{error ? error : <Loader />}</div>
      </div>
    );
  }

  const { actions, alwaysAllowed, permissions } = data;

  const ask = (row, action) => {
    const on = row.actions.includes(action);
    setPending({ row, action, turningOff: on });
  };

  const commit = async () => {
    if (!pending || saving) return;
    setSaving(true);
    const { row, action, turningOff } = pending;
    const next = turningOff ? row.actions.filter((a) => a !== action) : [...row.actions, action];
    try {
      await api.put(
        `/api/admin/global-permissions/${encodeURIComponent(row.moduleKey)}`,
        { actions: next },
        masterKeyHeader()
      );
      setPending(null);
      flash(
        turningOff
          ? `${action} switched off for ${row.label} across every client.`
          : `${action} is available again for ${row.label}.`
      );
      load();
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      window.alert(err.message || "Could not change this permission.");
    } finally {
      setSaving(false);
    }
  };

  const restricted = permissions.filter((p) => p.actions.length < actions.length);

  return (
    <div>
      <PageHeader title="Global Permissions" crumbs={["Admin", "Global Permissions"]} />
      {toast && <Toast message={toast} />}

      <div className="list-card">
        <div className="section-title">Actions each module offers</div>
        {restricted.length > 0 && (
          <div className="sub-price-card empty" style={{ marginBottom: 14 }}>
            Restricted right now:{" "}
            <strong>
              {restricted
                .map((p) => `${p.label} (${actions.filter((a) => !p.actions.includes(a)).join(", ")} off)`)
                .join("; ")}
            </strong>
          </div>
        )}

        <div className="perm-matrix-wrap">
          <table className="perm-matrix">
            <thead>
              <tr>
                <th>Module</th>
                {actions.map((a) => (
                  <th key={a} className="num">
                    {a}
                    {a === alwaysAllowed && <span className="perm-locked-tag">locked</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((row) => (
                <tr key={row.moduleKey}>
                  <td>{row.label}</td>
                  {actions.map((a) => {
                    const locked = a === alwaysAllowed;
                    return (
                      <td key={a} className="num">
                        <input
                          type="checkbox"
                          checked={locked || row.actions.includes(a)}
                          disabled={locked || saving}
                          title={locked ? "Viewing is never withheld here" : undefined}
                          onChange={() => ask(row, a)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pending && (
        <ConfirmDialog
          title={pending.turningOff ? "Switch this action off everywhere?" : "Make this action available again?"}
          message={
            pending.turningOff
              ? `Nobody on any client will be able to ${pending.action} ${pending.row.label} records — not even a client's own Administrator. Existing roles keep the permission on file; it simply stops being honoured until you switch this back on.`
              : `${pending.action} becomes available again for ${pending.row.label} on every client. Roles that already hold the permission start working immediately.`
          }
          confirmLabel={pending.turningOff ? "Switch off" : "Allow"}
          onConfirm={commit}
          onCancel={() => setPending(null)}
          confirming={saving}
        />
      )}
    </div>
  );
}

export default function GlobalPermissions() {
  return (
    <MasterKeyGate>
      <GlobalPermissionsInner />
    </MasterKeyGate>
  );
}
