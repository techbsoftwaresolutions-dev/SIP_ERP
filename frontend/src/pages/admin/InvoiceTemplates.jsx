import { useEffect, useState } from "react";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Loader from "../../components/ui/Loader";
import Icon from "../../components/ui/Icon";
import StatusBadge from "../../components/ui/StatusBadge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Toast from "../../components/ui/Toast";
import Select from "../../components/forms/Select";

// Which tier unlocks each invoice layout, what it is called, and whether it is
// still on offer. The layouts themselves are React components in
// src/print/ — this screen never invents one, it prices the ones that exist.
function InvoiceTemplatesInner() {
  const [templates, setTemplates] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [plansByTier, setPlansByTier] = useState({});
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [pending, setPending] = useState(null);
  const relockOnInvalidKey = useRelockOnInvalidKey();

  const receive = (r) => {
    setTemplates(r.templates || []);
    if (r.tiers) setTiers(r.tiers);
    if (r.plansByTier) setPlansByTier(r.plansByTier);
  };

  const load = () => {
    api
      .get("/api/admin/invoice-templates", masterKeyHeader())
      .then(receive)
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setError(err.message || "Could not load invoice templates.");
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (m) => {
    setToast(m);
    setTimeout(() => setToast(""), 3500);
  };

  if (!templates) {
    return (
      <div>
        <PageHeader title="Invoice Templates" crumbs={["Admin", "Invoice Templates"]} />
        <div className="loading-row">{error ? error : <Loader />}</div>
      </div>
    );
  }

  const send = async (key, body, message) => {
    setBusyKey(key);
    try {
      const r = await api.put(`/api/admin/invoice-templates/${encodeURIComponent(key)}`, body, masterKeyHeader());
      receive(r);
      if (message) flash(message);
      return true;
    } catch (err) {
      if (relockOnInvalidKey(err)) return false;
      window.alert(err.message || "Could not save that change.");
      return false;
    } finally {
      setBusyKey("");
    }
  };

  // Moving a template between tiers is the one change with a direct
  // commercial effect, so it says who gains or loses it before it runs.
  const askTier = (row, tier) => {
    if (tier === row.tier) return;
    const before = new Set(tiers.slice(tiers.indexOf(row.tier)).flatMap((t) => plansByTier[t] || []));
    const after = new Set(tiers.slice(tiers.indexOf(tier)).flatMap((t) => plansByTier[t] || []));
    const gained = [...after].filter((p) => !before.has(p));
    const lost = [...before].filter((p) => !after.has(p));
    setPending({ row, tier, gained, lost });
  };

  const commitTier = async () => {
    const ok = await send(
      pending.row.key,
      { tier: pending.tier },
      `${pending.row.label} is now a ${pending.tier} template.`
    );
    if (ok) setPending(null);
  };

  const toggleStatus = (row) =>
    send(
      row.key,
      { status: row.status === "disabled" ? "active" : "disabled" },
      row.status === "disabled"
        ? `${row.label} is available again.`
        : `${row.label} withdrawn from every client.`
    );

  const makeDefault = async (row) => {
    setBusyKey(row.key);
    try {
      const r = await api.post(
        `/api/admin/invoice-templates/${encodeURIComponent(row.key)}/default`,
        {},
        masterKeyHeader()
      );
      receive(r);
      flash(`${row.label} is now the fallback template.`);
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      window.alert(err.message || "Could not change the fallback.");
    } finally {
      setBusyKey("");
    }
  };

  const reset = async (row) => {
    setBusyKey(row.key);
    try {
      const r = await api.delete(`/api/admin/invoice-templates/${encodeURIComponent(row.key)}`, masterKeyHeader());
      receive(r);
      flash(`${row.defaultLabel} is back to its shipped settings.`);
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      window.alert(err.message || "Could not reset that template.");
    } finally {
      setBusyKey("");
    }
  };

  const changedCount = templates.filter(
    (t) => t.tier !== t.defaultTier || t.label !== t.defaultLabel || t.status === "disabled"
  ).length;

  return (
    <div>
      <PageHeader title="Invoice Templates" crumbs={["Admin", "Invoice Templates"]} />
      {toast && <Toast message={toast} />}

      <div className="list-card">
        <div className="section-title">Templates and the tier that unlocks them</div>
        {changedCount > 0 && (
          <p className="field-hint" style={{ marginTop: 0 }}>
            {changedCount} differ{changedCount === 1 ? "s" : ""} from the shipped setup.
          </p>
        )}

        <div className="tpl-tier-key">
          {tiers.map((t) => (
            <span key={t} className="tpl-tier-key-item">
              <strong>{t}</strong>
              <em>{(plansByTier[t] || []).join(", ") || "no plans"}</em>
            </span>
          ))}
        </div>

        <div className="tpl-list">
          {templates.map((row) => {
            const busy = busyKey === row.key;
            const off = row.status === "disabled";
            const changed = row.tier !== row.defaultTier || row.label !== row.defaultLabel || off;
            return (
              <div key={row.key} className={`tpl-row${off ? " is-off" : ""}`}>
                <span className="tpl-row-main">
                  <span className="tpl-row-head">
                    {row.label}
                    <code>{row.key}</code>
                    <span className="tpl-row-paper">{String(row.paper || "").toUpperCase()}</span>
                    {row.isDefault && <StatusBadge status="Fallback" />}
                    {off && <StatusBadge status="Disabled" />}
                  </span>
                  <em>{row.description}</em>
                </span>

                <Select
                  className="tpl-row-tier"
                  value={row.tier}
                  disabled={busy || off}
                  onChange={(e) => askTier(row, e.target.value)}
                  title="Which subscription tier unlocks this template"
                >
                  {tiers.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </Select>

                <span className="tpl-row-actions">
                  {!row.isDefault && row.tier === tiers[0] && !off && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Make this the fallback template"
                      disabled={busy}
                      onClick={() => makeDefault(row)}
                    >
                      <Icon name="checkCircle" />
                    </button>
                  )}
                  {changed && (
                    <button
                      type="button"
                      className="icon-btn"
                      title="Reset to the shipped tier and name"
                      disabled={busy}
                      onClick={() => reset(row)}
                    >
                      <Icon name="arrowLeft" />
                    </button>
                  )}
                  <button
                    type="button"
                    className={`icon-btn${off ? "" : " danger"}`}
                    title={off ? "Make available again" : "Withdraw from every client"}
                    disabled={busy || row.isDefault}
                    onClick={() => toggleStatus(row)}
                  >
                    <Icon name={off ? "check" : "close"} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {pending && (
        <ConfirmDialog
          title={`Move "${pending.row.label}" to ${pending.tier}?`}
          message={
            [
              pending.gained.length
                ? `Clients on ${pending.gained.join(", ")} gain it.`
                : "",
              pending.lost.length
                ? `Clients on ${pending.lost.join(", ")} lose it — anyone currently using it falls back to the default template.`
                : "",
              !pending.gained.length && !pending.lost.length
                ? "No plan currently sits at either tier, so nothing changes for any client today."
                : "",
            ]
              .filter(Boolean)
              .join(" ")
          }
          confirmLabel="Move"
          onConfirm={commitTier}
          onCancel={() => setPending(null)}
          confirming={busyKey === pending.row.key}
        />
      )}
    </div>
  );
}

export default function InvoiceTemplates() {
  return (
    <MasterKeyGate>
      <InvoiceTemplatesInner />
    </MasterKeyGate>
  );
}
