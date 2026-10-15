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

// How customers may pay, offered on every client's invoice form.
function PaymentMethodsInner() {
  const [methods, setMethods] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyCode, setBusyCode] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const receive = (r) => setMethods(r.methods || []);

  const load = () => {
    api
      .get("/api/admin/payment-methods", masterKeyHeader())
      .then(receive)
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load payment methods.");
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

  if (!methods) {
    return (
      <div>
        <PageHeader title="Payment Methods" crumbs={["Admin", "Payment Methods"]} />
        <div className="loading-row">{error ? error : <Loader />}</div>
      </div>
    );
  }

  const call = async (fn, message) => {
    try {
      receive(await fn());
      if (message) flash(message);
      return true;
    } catch (err) {
      if (relockOnInvalidKey(err)) return false;
      window.alert(err.message || "Could not save that change.");
      return false;
    }
  };

  const toggleStatus = async (row) => {
    setBusyCode(row.code);
    await call(
      () =>
        api.put(
          `/api/admin/payment-methods/${encodeURIComponent(row.code)}`,
          { status: row.status === "disabled" ? "active" : "disabled" },
          masterKeyHeader()
        ),
      row.status === "disabled" ? `${row.label} is available again.` : `${row.label} removed from invoice forms.`
    );
    setBusyCode("");
  };

  // Swapping two rows' order numbers moves one without renumbering the rest.
  const move = async (row, delta) => {
    const i = methods.findIndex((m) => m.code === row.code);
    const swap = methods[i + delta];
    if (!swap) return;
    setBusyCode(row.code);
    try {
      await api.put(
        `/api/admin/payment-methods/${encodeURIComponent(row.code)}`,
        { order: swap.order },
        masterKeyHeader()
      );
      receive(
        await api.put(
          `/api/admin/payment-methods/${encodeURIComponent(swap.code)}`,
          { order: row.order },
          masterKeyHeader()
        )
      );
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      window.alert(err.message || "Could not reorder that method.");
    } finally {
      setBusyCode("");
    }
  };

  const makeDefault = async (row) => {
    setBusyCode(row.code);
    await call(
      () => api.post(`/api/admin/payment-methods/${encodeURIComponent(row.code)}/default`, {}, masterKeyHeader()),
      `New invoices now start on ${row.label}.`
    );
    setBusyCode("");
  };

  const handleDelete = async () => {
    setBusyCode(deleteTarget.code);
    const ok = await call(
      () => api.delete(`/api/admin/payment-methods/${encodeURIComponent(deleteTarget.code)}`, masterKeyHeader()),
      `Deleted "${deleteTarget.label}".`
    );
    setBusyCode("");
    if (ok) setDeleteTarget(null);
  };

  return (
    <div>
      <PageHeader
        title="Payment Methods"
        crumbs={["Admin", "Payment Methods"]}
        actions={
          <Link to="/admin/payment-methods/new" className="btn btn-primary">
            + Add Method
          </Link>
        }
      />
      {toast && <Toast message={toast} />}

      <div className="list-card">
        <div className="section-title">Offered on every client’s invoice form</div>
        <div className="tpl-list">
          {methods.map((row) => {
            const busy = busyCode === row.code;
            const off = row.status === "disabled";
            const i = methods.findIndex((m) => m.code === row.code);
            return (
              <div key={row.code} className={`tpl-row${off ? " is-off" : ""}`}>
                <span className="tpl-row-main">
                  <span className="tpl-row-head">
                    <Link to={`/admin/payment-methods/${encodeURIComponent(row.code)}/edit`} className="cell-link">
                      {row.label}
                    </Link>
                    <code>{row.code}</code>
                    {row.isDefault && <StatusBadge status="Default" />}
                    {row.requiresReference && <span className="tpl-row-paper">needs a reference</span>}
                    {off && <StatusBadge status="Disabled" />}
                  </span>
                  <em>
                    {row.description || "—"}
                    {row.requiresReference && ` · asks for: ${row.referenceLabel || "Reference"}`}
                  </em>
                </span>

                <span className="tpl-row-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Move up"
                    disabled={busy || i === 0}
                    onClick={() => move(row, -1)}
                  >
                    <Icon name="chevronUp" />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Move down"
                    disabled={busy || i === methods.length - 1}
                    onClick={() => move(row, 1)}
                  >
                    <Icon name="chevronDown" />
                  </button>
                  {!row.isDefault && !off && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Preselect this on new invoices"
                      disabled={busy}
                      onClick={() => makeDefault(row)}
                    >
                      <Icon name="checkCircle" />
                    </button>
                  )}
                  <Link
                    to={`/admin/payment-methods/${encodeURIComponent(row.code)}/edit`}
                    className="icon-btn"
                    title="Rename or change what it asks for"
                  >
                    <Icon name="edit" />
                  </Link>
                  <button
                    type="button"
                    className={`icon-btn${off ? "" : " danger"}`}
                    title={off ? "Offer it again" : "Take it off invoice forms"}
                    disabled={busy || row.isDefault}
                    onClick={() => toggleStatus(row)}
                  >
                    <Icon name={off ? "check" : "close"} />
                  </button>
                  {!row.builtIn && (
                    <button
                      type="button"
                      className="icon-btn danger"
                      title="Delete this method"
                      disabled={busy || row.isDefault}
                      onClick={() => setDeleteTarget(row)}
                    >
                      <Icon name="trash" />
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this payment method?"
          message={`Remove "${deleteTarget.label}" from every client's invoice form. Invoices already recorded against it keep the name they were filed under, so nothing in the books changes.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirming={busyCode === deleteTarget.code}
        />
      )}
    </div>
  );
}

export default function PaymentMethods() {
  return (
    <MasterKeyGate>
      <PaymentMethodsInner />
    </MasterKeyGate>
  );
}
