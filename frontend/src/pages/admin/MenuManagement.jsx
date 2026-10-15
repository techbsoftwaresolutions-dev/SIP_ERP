import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import Icon from "../../components/ui/Icon";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Toast from "../../components/ui/Toast";

// Presentation only. Nothing on this screen decides what a client can REACH —
// that is the plan, their add-ons, their menu limit and their roles, all
// enforced on the server. Hiding an item here tidies the sidebar; the pages
// behind it keep working for anyone with the URL.
function MenuManagementInner() {
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [savingKey, setSavingKey] = useState("");
  const [resetAll, setResetAll] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const receive = (r) => setMenu(r.menu || []);

  const load = () => {
    api
      .get("/api/admin/menus", masterKeyHeader())
      .then(receive)
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load the menu.");
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

  if (!menu) {
    return (
      <div>
        <PageHeader title="Menu Management" crumbs={["Admin", "Menu Management"]} />
        <div className="loading-row">{error ? error : <Loader />}</div>
      </div>
    );
  }

  const send = async (key, body, message) => {
    setSavingKey(key);
    try {
      const r = await api.put(`/api/admin/menus/${encodeURIComponent(key)}`, body, masterKeyHeader());
      receive(r);
      if (message) flash(message);
      return true;
    } catch (err) {
      if (relockOnInvalidKey(err)) return false;
      window.alert(err.message || "Could not save that change.");
      return false;
    } finally {
      setSavingKey("");
    }
  };

  const toggleHidden = (row) =>
    send(
      row.key,
      { hidden: !row.hidden },
      row.hidden ? `${row.label} is back in the sidebar.` : `${row.label} is hidden from the sidebar.`
    );

  // Swapping two rows' order numbers is enough to move an item, and it never
  // renumbers the rest of the group.
  const move = async (row, delta) => {
    const siblings = menu.filter((m) => m.parentKey === row.parentKey);
    const i = siblings.findIndex((m) => m.key === row.key);
    const swap = siblings[i + delta];
    if (!swap) return;
    setSavingKey(row.key);
    try {
      await api.put(`/api/admin/menus/${encodeURIComponent(row.key)}`, { order: swap.order }, masterKeyHeader());
      const r = await api.put(
        `/api/admin/menus/${encodeURIComponent(swap.key)}`,
        { order: row.order },
        masterKeyHeader()
      );
      receive(r);
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      window.alert(err.message || "Could not reorder that item.");
    } finally {
      setSavingKey("");
    }
  };

  const doResetAll = async () => {
    try {
      const r = await api.post("/api/admin/menus/reset", {}, masterKeyHeader());
      receive(r);
      setResetAll(false);
      flash("Every menu is back to the way the platform ships it.");
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      window.alert(err.message || "Could not reset the menu.");
    }
  };

  const groups = menu.filter((m) => !m.parentKey);
  const childrenOf = (key) => menu.filter((m) => m.parentKey === key);
  const changedCount = menu.filter(
    (m) => m.hidden || m.label !== m.defaultLabel || m.icon !== m.defaultIcon
  ).length;

  const Row = ({ row, depth }) => {
    const siblings = menu.filter((m) => m.parentKey === row.parentKey);
    const i = siblings.findIndex((m) => m.key === row.key);
    const changed = row.hidden || row.label !== row.defaultLabel || row.icon !== row.defaultIcon;
    const busy = savingKey === row.key;

    return (
      <div className={`menu-row${depth ? " is-child" : ""}${row.hidden ? " is-hidden" : ""}`}>
        <span className="menu-row-icon">
          <Icon name={row.icon} size={depth ? 15 : 17} />
        </span>
        <span className="menu-row-label" title={row.key}>
          <Link to={`/admin/menus/${encodeURIComponent(row.key)}/edit`} className="cell-link">
            {row.label}
          </Link>
          {row.label !== row.defaultLabel && <em>was “{row.defaultLabel}”</em>}
        </span>
        {row.module && <span className="menu-row-module">{row.module}</span>}
        {changed && <span className="menu-row-flag">changed</span>}
        <span className="menu-row-actions">
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
            disabled={busy || i === siblings.length - 1}
            onClick={() => move(row, 1)}
          >
            <Icon name="chevronDown" />
          </button>
          <Link
            to={`/admin/menus/${encodeURIComponent(row.key)}/edit`}
            className="icon-btn"
            title="Rename or change the icon"
          >
            <Icon name="edit" />
          </Link>
          <button
            type="button"
            className={`icon-btn${row.hidden ? "" : " danger"}`}
            title={row.hidden ? "Show in the sidebar" : "Hide from the sidebar"}
            disabled={busy}
            onClick={() => toggleHidden(row)}
          >
            <Icon name={row.hidden ? "eyeOff" : "eye"} />
          </button>
        </span>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Menu Management"
        crumbs={["Admin", "Menu Management"]}
        actions={
          <button type="button" className="btn" onClick={() => setResetAll(true)} disabled={changedCount === 0}>
            Reset all
          </button>
        }
      />
      {toast && <Toast message={toast} />}

      <div className="list-card">
        <div className="section-title">Sidebar</div>

        <div className="menu-tree">
          {groups.map((g) => (
            <div key={g.key} className="menu-group">
              <Row row={g} depth={0} />
              {childrenOf(g.key).map((c) => (
                <Row key={c.key} row={c} depth={1} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {resetAll && (
        <ConfirmDialog
          title="Reset every menu?"
          message="Drops every label, icon, order and visibility change on this screen and puts the sidebar back to the way the platform ships it, for all clients. Nothing else is affected."
          confirmLabel="Reset all"
          onConfirm={doResetAll}
          onCancel={() => setResetAll(false)}
        />
      )}
    </div>
  );
}

export default function MenuManagement() {
  return (
    <MasterKeyGate>
      <MenuManagementInner />
    </MasterKeyGate>
  );
}
