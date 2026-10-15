import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import DataTable from "../../components/data/DataTable";
import StatusBadge from "../../components/ui/StatusBadge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Icon from "../../components/ui/Icon";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Toast from "../../components/ui/Toast";

// A small preview of the four colours a theme carries, so the list reads as
// a set of brands rather than a set of names.
function Swatches({ theme }) {
  const colours = [
    [theme.sidebar, "Sidebar"],
    [theme.sidebarActive, "Active menu"],
    [theme.primary, "Primary"],
    [theme.sidebarText, "Sidebar text"],
  ];
  return (
    <span className="theme-swatches">
      {colours.map(([c, label]) => (
        <span key={label} className="theme-swatch" style={{ background: c }} title={`${label} — ${c}`} />
      ))}
    </span>
  );
}

function ThemesInner() {
  const [themes, setThemes] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [defaultTarget, setDefaultTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const load = () => {
    api
      .get("/api/admin/themes", masterKeyHeader())
      .then((r) => setThemes(r.themes || []))
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load themes.");
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

  const handleDelete = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/admin/themes/${encodeURIComponent(deleteTarget.code)}`, masterKeyHeader());
      setDeleteTarget(null);
      flash(`Deleted the "${deleteTarget.name}" theme.`);
      load();
    } catch (err) {
      window.alert(err.message || "Could not delete this theme.");
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async () => {
    setBusy(true);
    try {
      await api.post(`/api/admin/themes/${encodeURIComponent(defaultTarget.code)}/default`, {}, masterKeyHeader());
      setDefaultTarget(null);
      flash(`"${defaultTarget.name}" is now the platform default.`);
      load();
    } catch (err) {
      window.alert(err.message || "Could not change the default theme.");
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Theme",
      render: (r) => (
        <Link to={`/admin/themes/${encodeURIComponent(r.code)}/edit`} className="cell-link">
          {r.name}
        </Link>
      ),
    },
    { key: "__swatches", header: "Colours", render: (r) => <Swatches theme={r} /> },
    { key: "radius", header: "Corners", render: (r) => `${r.radius}px` },
    {
      key: "modes",
      header: "Modes",
      render: (r) => (r.modes || []).join(", ") || "—",
    },
    {
      key: "usedBy",
      header: "Used By",
      render: (r) => {
        const list = r.usedBy || [];
        if (!list.length) return "—";
        return (
          <span className="cell-truncate" title={list.join(", ")}>
            {list.length === 1 ? list[0] : `${list.length} clients`}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (r) =>
        r.isDefault ? <StatusBadge status="Default" /> : <StatusBadge status={r.status === "archived" ? "Archived" : "Active"} />,
    },
    {
      key: "__actions",
      header: "Actions",
      render: (r) => (
        <div className="row-actions">
          {!r.isDefault && (
            <button
              type="button"
              className="icon-btn"
              title="Make this the platform default"
              onClick={() => setDefaultTarget(r)}
            >
              <Icon name="checkCircle" />
            </button>
          )}
          <Link to={`/admin/themes/${encodeURIComponent(r.code)}/edit`} className="icon-btn" title="Edit theme">
            <Icon name="edit" />
          </Link>
          {!r.isDefault && (
            <button
              type="button"
              className="icon-btn danger"
              title="Delete this theme"
              onClick={() => setDeleteTarget(r)}
            >
              <Icon name="trash" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Theme Management"
        crumbs={["Admin", "Theme Management"]}
        actions={
          <Link to="/admin/themes/new" className="btn btn-primary">
            + Add Theme
          </Link>
        }
      />
      {toast && <Toast message={toast} />}

      <div className="list-card">
        {error ? (
          <div className="loading-row">{error}</div>
        ) : (
          <DataTable columns={columns} rows={themes || []} loading={themes === null} emptyText="No themes yet." />
        )}
      </div>

      {defaultTarget && (
        <ConfirmDialog
          title="Make this the default theme?"
          message={`Every client without a theme of their own will be repainted in "${defaultTarget.name}" — including any who are signed in right now, the next time their app loads. Clients with a theme assigned are unaffected.`}
          confirmLabel="Make default"
          onConfirm={makeDefault}
          onCancel={() => setDefaultTarget(null)}
          confirming={busy}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this theme?"
          message={`Delete the "${deleteTarget.name}" theme? This cannot be undone. Clients still using it have to be moved to another theme first.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          confirming={busy}
        />
      )}
    </div>
  );
}

export default function Themes() {
  return (
    <MasterKeyGate>
      <ThemesInner />
    </MasterKeyGate>
  );
}
