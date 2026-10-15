import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import Icon from "../../components/ui/Icon";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Toast from "../../components/ui/Toast";

// The platform's module registry. Rows come from the code catalogue (MODULES
// in backend/permissions.js) and are seeded on first load, so this screen is
// never empty and never invents a module that has no code behind it — which
// is also why there is no "Add Module" button.
function ModulesInner() {
  const [modules, setModules] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const load = () => {
    api
      .get("/api/admin/modules", masterKeyHeader())
      .then((r) => setModules(r.modules || []))
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load modules.");
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

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // Status is the one field worth toggling straight from the list — it is the
  // kill switch, and needing two clicks and a form to pull a broken module is
  // two clicks too many.
  const toggleStatus = async (row) => {
    const next = row.status === "disabled" ? "active" : "disabled";
    setBusyKey(row.key);
    try {
      await api.put(`/api/admin/modules/${encodeURIComponent(row.key)}`, { status: next }, masterKeyHeader());
      flash(next === "disabled" ? `${row.label} switched off for all clients.` : `${row.label} is available again.`);
      load();
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      window.alert(err.message || "Could not change this module.");
    } finally {
      setBusyKey("");
    }
  };

  const columns = [
    {
      key: "label",
      header: "Module",
      render: (r) => (
        <Link to={`/admin/modules/${encodeURIComponent(r.key)}/edit`} className="cell-link">
          {r.label || r.key}
        </Link>
      ),
    },
    { key: "key", header: "Key" },
    {
      key: "description",
      header: "Description",
      render: (r) => <span className="cell-truncate" title={r.description}>{r.description || "—"}</span>,
    },
    {
      key: "core",
      header: "Core",
      // A core module can't be taken away by a plan or a per-client override,
      // so it is the one flag here that changes what a client sees.
      render: (r) => (r.core ? <StatusBadge status="Core" /> : "—"),
    },
    {
      key: "addOnOnly",
      header: "Sold As",
      render: (r) => (r.addOnOnly ? "Add-on only" : "In plans"),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <StatusBadge status={r.status === "disabled" ? "Disabled" : "Active"} />,
    },
    {
      key: "__actions",
      header: "Actions",
      render: (r) => (
        <div className="row-actions">
          <Link to={`/admin/modules/${encodeURIComponent(r.key)}/edit`} className="icon-btn" title="Edit module">
            <Icon name="edit" />
          </Link>
          <button
            type="button"
            className={`icon-btn${r.status === "disabled" ? "" : " danger"}`}
            title={r.status === "disabled" ? "Make available again" : "Switch off for every client"}
            disabled={busyKey === r.key}
            onClick={() => toggleStatus(r)}
          >
            <Icon name={r.status === "disabled" ? "check" : "close"} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Modules" crumbs={["Admin", "Modules"]} />
      {toast && <Toast message={toast} />}
      <div className="list-card">
        {error ? (
          <div className="loading-row">{error}</div>
        ) : (
          <DataTable
            columns={columns}
            rows={modules || []}
            loading={modules === null}
            emptyText="No modules registered."
          />
        )}
      </div>
    </div>
  );
}

export default function Modules() {
  return (
    <MasterKeyGate>
      <ModulesInner />
    </MasterKeyGate>
  );
}
