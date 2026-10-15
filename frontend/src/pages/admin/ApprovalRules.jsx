import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import Icon from "../../components/ui/Icon";
import StatusBadge from "../../components/ui/StatusBadge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Toast from "../../components/ui/Toast";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// When a document has to be signed off before it counts.
function ApprovalRulesInner() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const load = () => {
    api
      .get("/api/admin/approval-rules", masterKeyHeader())
      .then(setData)
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load approval rules.");
      });
  };

  useEffect(() => {
    if (location.state && location.state.toast) {
      setToast(location.state.toast);
      setTimeout(() => setToast(""), 2500);
      navigate(location.pathname, { replace: true, state: {} });
    }
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
        <PageHeader title="Approval Engine" crumbs={["Admin", "Approval Engine"]} />
        <div className="loading-row">{error ? error : <Loader />}</div>
      </div>
    );
  }

  const { rules, documentTypes, conditions } = data;
  const docLabel = (key) => (documentTypes.find((d) => d.key === key) || {}).label || key;
  const condition = (key) => conditions.find((c) => c.key === key) || conditions[0];

  const describe = (r) => {
    const c = condition(r.condition);
    if (!c.needsThreshold) return `${docLabel(r.documentType)} — every one`;
    const value = c.unit === "₹" ? inr(r.threshold) : `${r.threshold}%`;
    return `${docLabel(r.documentType)} — ${c.label.toLowerCase()} ${value}`;
  };

  const scopeOf = (r) => {
    if (r.appliesTo === "plans") return `${(r.planCodes || []).length} plan(s)`;
    if (r.appliesTo === "clients") return `${(r.subdomains || []).length} client(s)`;
    return "Every client";
  };

  const run = async (fn, message) => {
    try {
      await fn();
      load();
      if (message) flash(message);
      return true;
    } catch (err) {
      if (relockOnInvalidKey(err)) return false;
      window.alert(err.message || "Could not save that change.");
      return false;
    }
  };

  const toggleStatus = async (r) => {
    setBusy(r.code);
    await run(
      () =>
        api.put(
          `/api/admin/approval-rules/${encodeURIComponent(r.code)}`,
          { status: r.status === "disabled" ? "active" : "disabled" },
          masterKeyHeader()
        ),
      r.status === "disabled" ? `"${r.name}" is active again.` : `"${r.name}" switched off.`
    );
    setBusy("");
  };

  const handleDelete = async () => {
    setBusy(deleteTarget.code);
    const ok = await run(
      () => api.delete(`/api/admin/approval-rules/${encodeURIComponent(deleteTarget.code)}`, masterKeyHeader()),
      `Deleted "${deleteTarget.name}".`
    );
    setBusy("");
    if (ok) setDeleteTarget(null);
  };

  return (
    <div>
      <PageHeader
        title="Approval Engine"
        crumbs={["Admin", "Approval Engine"]}
        actions={
          <Link to="/admin/approval-rules/new" className="btn btn-primary">
            + Add Rule
          </Link>
        }
      />
      {toast && <Toast message={toast} />}

      <div className="list-card">
        <div className="section-title">Rules</div>
        <p className="field-hint" style={{ marginTop: 0 }}>
          A rule holds a document until someone with the right role signs it off. There are none by default —
          approvals exist only where you ask for them. Rules are <strong>additive</strong>: a document is held if
          any rule fires, and Administrator can always clear one, so a rule can never strand a document.
        </p>

        {rules.length === 0 ? (
          <div className="sub-price-card empty">
            No approval rules yet. Nothing on the platform currently requires sign-off.
          </div>
        ) : (
          <div className="tpl-list">
            {rules.map((r) => {
              const off = r.status === "disabled";
              const b = busy === r.code;
              return (
                <div key={r.code} className={`tpl-row${off ? " is-off" : ""}`}>
                  <span className="tpl-row-main">
                    <span className="tpl-row-head">
                      <Link to={`/admin/approval-rules/${encodeURIComponent(r.code)}/edit`} className="cell-link">
                        {r.name}
                      </Link>
                      <code>{r.code}</code>
                      <span className="tpl-row-paper">{scopeOf(r)}</span>
                      {off && <StatusBadge status="Disabled" />}
                    </span>
                    <em>
                      {describe(r)}
                      {" · approved by "}
                      {(r.approverRoles || []).length ? r.approverRoles.join(", ") : "Administrator"}
                      {r.description ? ` · ${r.description}` : ""}
                    </em>
                  </span>
                  <span className="tpl-row-actions">
                    <Link
                      to={`/admin/approval-rules/${encodeURIComponent(r.code)}/edit`}
                      className="icon-btn"
                      title="Edit rule"
                    >
                      <Icon name="edit" />
                    </Link>
                    <button
                      type="button"
                      className={`icon-btn${off ? "" : " danger"}`}
                      title={off ? "Switch on" : "Switch off"}
                      disabled={b}
                      onClick={() => toggleStatus(r)}
                    >
                      <Icon name={off ? "check" : "close"} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Delete rule"
                      disabled={b}
                      onClick={() => setDeleteTarget(r)}
                    >
                      <Icon name="trash" />
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this rule?"
          message={`Delete "${deleteTarget.name}"? New documents stop being held straight away. Documents already waiting keep their pending state — they are not released automatically, so nothing slips through unnoticed.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirming={busy === deleteTarget.code}
        />
      )}
    </div>
  );
}

export default function ApprovalRules() {
  return (
    <MasterKeyGate>
      <ApprovalRulesInner />
    </MasterKeyGate>
  );
}
