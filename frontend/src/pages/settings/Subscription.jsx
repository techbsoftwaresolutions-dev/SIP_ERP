import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/ui/Icon";
import { loadRazorpayScript } from "../../utils/loadRazorpay";
import Loader from "../../components/ui/Loader";
import Toast from "../../components/ui/Toast";

function inr(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const ACCESS_LABEL = { full: "Full", partial: "Partial", none: "Not on this plan" };
const MENU_ICON = {
  dashboard: "home",
  reminders: "bell",
  "ai-assistant": "sparkles",
  customers: "users",
  suppliers: "truck",
  products: "package",
  purchase: "cart",
  inventory: "store",
  manufacturing: "wrench",
  sales: "chart",
  reports: "file",
  users: "user",
  settings: "settings",
};
const TIER_LABEL = { basic: "Basic", advanced: "Advanced", premium: "Premium" };

export default function Subscription() {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");

  const [upgrade, setUpgrade] = useState(null); // /api/subscription/upgrade-options response
  const [selectedTerm, setSelectedTerm] = useState(12);
  const [payingPlan, setPayingPlan] = useState(""); // planCode currently mid-checkout
  const [upgradeError, setUpgradeError] = useState("");
  const [upgradeToast, setUpgradeToast] = useState("");
  const [menusCollapsed, setMenusCollapsed] = useState(true);

  const loadDetails = useCallback(() => api.get("/api/subscription/details").then(setDetails), []);
  const loadUpgrade = useCallback(() => {
    api
      .get("/api/subscription/upgrade-options")
      .then((d) => {
        setUpgrade(d);
        if (d.termMonths && d.termMonths.length && !d.termMonths.includes(selectedTerm)) {
          setSelectedTerm(d.termMonths.includes(12) ? 12 : d.termMonths[0]);
        }
      })
      .catch(() => {}); // upgrade options are a bonus section — a failure here shouldn't block the page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDetails().catch((err) => setError(err.message || "Could not load subscription details."));
    loadUpgrade();
  }, [loadDetails, loadUpgrade]);

  const startUpgrade = async (plan) => {
    if (payingPlan) return;
    setUpgradeError("");
    setPayingPlan(plan.code);
    try {
      const order = await api.post("/api/subscription/upgrade/order", {
        planCode: plan.code,
        termMonths: selectedTerm,
      });
      await loadRazorpayScript();

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount * 100,
        currency: order.currency,
        name: "TechB Software Solutions",
        description: `${order.planName} — ${order.termMonths} month${order.termMonths === 1 ? "" : "s"}`,
        order_id: order.razorpayOrderId,
        prefill: { name: order.companyName },
        theme: { color: "#2563eb" },
        handler: async (response) => {
          try {
            const verifyRes = await api.post("/api/subscription/upgrade/verify", {
              localOrderId: order.localOrderId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            const isRenew = Boolean(verifyRes?.isRenewal || order.isRenewal);
            setUpgradeToast(
              isRenew
                ? `Subscription successfully renewed for ${order.planName} (${order.termMonths} mo)!`
                : `You're now on ${order.planName}.`
            );
            setTimeout(() => setUpgradeToast(""), 5000);
            await Promise.all([loadDetails(), loadUpgrade()]);
          } catch (err) {
            setUpgradeError(
              err.message ||
                "Payment succeeded but we couldn't confirm it on our side. Contact TechB Software Solutions with your payment ID: " +
                  response.razorpay_payment_id
            );
          } finally {
            setPayingPlan("");
          }
        },
        modal: {
          ondismiss: () => setPayingPlan(""), // client closed the widget without paying — not an error
        },
      });
      rzp.on("payment.failed", (resp) => {
        setUpgradeError(resp.error?.description || "Payment failed. You have not been charged.");
        setPayingPlan("");
      });
      rzp.open();
    } catch (err) {
      setUpgradeError(err.message || "Could not start checkout.");
      setPayingPlan("");
    }
  };

  const crumbs = ["Dashboard", "My Subscription"];

  if (!details) {
    return (
      <div>
        <PageHeader title="My Subscription" crumbs={crumbs} />
        <div className="loading-row">{error ? error : <Loader />}</div>
      </div>
    );
  }

  const upgradePlans = (upgrade?.plans || []).filter((p) => p.isUpgrade || p.isCurrent || !details.planName);

  if (!details.planName) {
    return (
      <div className="sb-page">
        <PageHeader
          title="My Subscription"
          subtitle="Choose a subscription plan to activate your account"
          crumbs={crumbs}
          actions={
            <span className="sb-status off">
              <Icon name="alertCircle" size={16} /> No Plan Active
            </span>
          }
        />
        {upgradeToast && <Toast message={upgradeToast} />}

        <div className="list-card" style={{ marginBottom: 24, borderLeft: "4px solid #3b82f6" }}>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="sparkles" size={18} /> Activate Your Subscription
          </div>
          <p className="field-hint" style={{ marginTop: 0, marginBottom: 0, fontSize: "0.95rem" }}>
            Select your preferred plan and term below. Payment is processed securely via <strong>Razorpay</strong> and activates your plan immediately.
          </p>
        </div>

        {upgradePlans.length > 0 ? (
          <section className="sb-card sb-upgrade">
            <header className="sb-card-head">
              <span className="sb-tile sm blue"><Icon name="tag" size={18} /></span>
              <div>
                <h2>Available Plans</h2>
                <p>Pick a term and plan to activate your account immediately.</p>
              </div>
            </header>

            {upgrade?.termMonths && (
              <div className="sb-terms">
                {upgrade.termMonths.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`sb-term${selectedTerm === m ? " active" : ""}`}
                    onClick={() => setSelectedTerm(m)}
                  >
                    {m === 1 ? "1 month" : m % 12 === 0 ? `${m / 12} year${m > 12 ? "s" : ""}` : `${m} months`}
                  </button>
                ))}
              </div>
            )}

            {!upgrade?.configured && (
              <div className="sb-notice">
                <Icon name="alertTriangle" size={15} /> Online payments are being configured. Contact{" "}
                <strong>TechB Software Solutions</strong>.
              </div>
            )}
            {upgradeError && <div className="login-error" style={{ marginBottom: 12 }}>{upgradeError}</div>}

            <div className="sb-plans">
              {upgradePlans.map((p) => {
                const total = p.price * selectedTerm;
                const busy = payingPlan === p.code;
                return (
                  <div key={p.code} className="sb-plan">
                    <div className="sb-plan-name">{p.name}</div>
                    <div className="sb-plan-price">{inr(p.price)} <span>/ month</span></div>
                    <div className="sb-plan-total">{inr(total)} for {selectedTerm} month{selectedTerm === 1 ? "" : "s"}</div>
                    {p.description && <p className="sb-plan-desc">{p.description}</p>}
                    {p.features?.length > 0 && (
                      <ul className="sb-plan-features">
                        {p.features.map((f, i) => (
                          <li key={i}><Icon name="check" size={13} /> {f}</li>
                        ))}
                      </ul>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary sb-plan-btn"
                      disabled={!upgrade?.configured || busy || Boolean(payingPlan)}
                      onClick={() => startUpgrade(p)}
                    >
                      {busy ? "Opening checkout…" : `Select & Pay ${inr(total)}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <div className="list-card">
            <p className="field-hint">No plans are currently published. Contact <strong>TechB Software Solutions</strong>.</p>
          </div>
        )}
      </div>
    );
  }

  const start = formatDate(details.subscriptionStart);
  const end = formatDate(details.subscriptionEnd);
  const renewalLabel = end
    ? details.daysRemaining != null
      ? `${end} · ${details.daysRemaining} day${details.daysRemaining === 1 ? "" : "s"} left`
      : end
    : "No expiry set";

  const includedMenus = details.menus.filter((m) => m.access === "full").length;
  const partialMenus = details.menus.filter((m) => m.access === "partial").length;
  const menuSummary =
    partialMenus > 0
      ? `${includedMenus} full, ${partialMenus} partial of ${details.menus.length}`
      : `${includedMenus} of ${details.menus.length}`;

  const statusLive = details.state === "active";
  const statusLabel = statusLive ? "Active Subscription" : details.state === "suspended" ? "Suspended" : "Expired";

  return (
    <div className="sb-page">
      <PageHeader
        title="My Subscription"
        subtitle="Manage your current plan, usage and billing details"
        crumbs={crumbs}
        actions={
          <span className={`sb-status${statusLive ? "" : " off"}`}>
            <Icon name={statusLive ? "checkCircle" : "alertCircle"} size={16} /> {statusLabel}
          </span>
        }
      />
      {upgradeToast && <Toast message={upgradeToast} />}

      <div className="sb-kpis">
        <div className="sb-kpi">
          <span className="sb-tile blue"><Icon name="tag" size={22} /></span>
          <span className="sb-kpi-label">Current Plan</span>
          <strong className="sb-kpi-value">{details.planName}</strong>
        </div>
        <div className="sb-kpi">
          <span className="sb-tile green"><Icon name="banknote" size={22} /></span>
          <span className="sb-kpi-label">Monthly Price</span>
          <strong className="sb-kpi-value">{inr(details.price)}</strong>
        </div>
        <div className="sb-kpi">
          <span className="sb-tile purple"><Icon name="calendar" size={22} /></span>
          <span className="sb-kpi-label">Renewal / Expires</span>
          <strong className="sb-kpi-value sm">{renewalLabel}</strong>
        </div>
        <div className="sb-kpi">
          <span className="sb-tile orange"><Icon name="user" size={22} /></span>
          <span className="sb-kpi-label">Menus Included</span>
          <strong className="sb-kpi-value">{menuSummary}</strong>
        </div>
      </div>

      <section className="sb-card">
        <header className="sb-card-head">
          <span className="sb-tile sm blue"><Icon name="file" size={18} /></span>
          <div>
            <h2>Plan Details</h2>
            {details.description && <p>{details.description}</p>}
          </div>
        </header>
        <div className="sb-facts">
          <div><span>Billing Cycle</span><strong>{details.billingCycle}</strong></div>
          <div><span>Term</span><strong>{details.termMonths} month{details.termMonths === 1 ? "" : "s"}</strong></div>
          {details.discountPercent > 0 && <div><span>Discount</span><strong>{details.discountPercent}%</strong></div>}
          <div><span>Amount payable (this term)</span><strong>{inr(details.amountPayable)}</strong></div>
          {start && <div><span>Started</span><strong>{start}</strong></div>}
          {details.maxUsers > 0 && <div><span>Max users</span><strong>{details.maxUsers}</strong></div>}
        </div>
        {details.features.length > 0 && (
          <>
            <div className="sb-subhead">Features</div>
            <ul className="sb-features">
              {details.features.map((f, i) => (
                <li key={i}><Icon name="check" size={15} /> {f}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="sb-card">
        <header
          className="sb-card-head"
          style={{
            cursor: "pointer",
            userSelect: "none",
            marginBottom: menusCollapsed ? 0 : 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            transition: "all 0.2s ease",
          }}
          onClick={() => setMenusCollapsed((v) => !v)}
          title={menusCollapsed ? "Click to expand menu access" : "Click to collapse menu access"}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <span className="sb-tile sm blue"><Icon name="menu" size={18} /></span>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0 }}>Menu Access</h2>
                {details.menus && (
                  <span className="sb-pill full" style={{ fontSize: 11, padding: "2px 10px" }}>
                    {details.menus.filter((m) => m.access !== "none").length} of {details.menus.length} Included
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0" }}>
                Which screens are included on your plan. A menu marked "Not on this plan" is hidden from your sidebar.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              flexShrink: 0,
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setMenusCollapsed((v) => !v);
            }}
            aria-expanded={!menusCollapsed}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>{menusCollapsed ? "Expand" : "Collapse"}</span>
            <Icon name={menusCollapsed ? "chevronDown" : "chevronUp"} size={16} />
          </button>
        </header>
        {!menusCollapsed && (
          <div className="sb-menus">
            {details.menus.map((m) => (
              <div key={m.key} className="sb-menu-row">
                <div className="sb-menu-head">
                  <span className="sb-menu-name">
                    <Icon name={MENU_ICON[m.key] || "settings"} size={18} /> {m.label}
                  </span>
                  <span className={`sb-pill ${m.access}`}>{ACCESS_LABEL[m.access]}</span>
                </div>
                {m.children && m.access === "partial" && (
                  <div className="sb-menu-children">
                    {m.children.map((c) => (
                      <span key={c.key} className={`mysub-chip${c.allowed ? " on" : ""}`}>
                        {c.allowed ? <Icon name="check" size={11} /> : <Icon name="close" size={11} />}
                        {c.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="sb-card">
        <header className="sb-card-head">
          <span className="sb-tile sm purple"><Icon name="palette" size={18} /></span>
          <div>
            <h2>
              Invoice Themes <span className="sb-tier">{TIER_LABEL[details.invoiceThemes.tier] || details.invoiceThemes.tier}</span>
            </h2>
            <p>
              {details.invoiceThemes.unlockedCount} of {details.invoiceThemes.totalCount} invoice themes unlocked.
              {details.invoiceThemes.canPickAccent
                ? " You can also choose your own invoice colour."
                : " Invoices print in the standard colour on this plan."}
            </p>
          </div>
          <Link to="/settings/invoice-theme" className="sb-card-link" aria-label="Open invoice themes">
            <Icon name="chevronRight" size={18} />
          </Link>
        </header>
        <div className="sb-chips">
          {details.invoiceThemes.unlocked.map((t) => (
            <span key={t.key} className="mysub-chip on">
              <Icon name="check" size={11} /> {t.label}
            </span>
          ))}
        </div>
      </section>

      {upgradePlans.length > 0 ? (
        <section className="sb-card sb-upgrade">
          <header className="sb-card-head">
            <span className="sb-tile sm blue"><Icon name="sparkles" size={18} /></span>
            <div>
              <h2>Top Up or Upgrade Your Plan</h2>
              <p>Top up your current plan or upgrade to a higher tier — payment takes effect immediately via Razorpay.</p>
            </div>
          </header>

          <div className="sb-terms">
            {upgrade?.termMonths && upgrade.termMonths.map((m) => (
              <button
                key={m}
                type="button"
                className={`sb-term${selectedTerm === m ? " active" : ""}`}
                onClick={() => setSelectedTerm(m)}
              >
                {m === 1 ? "1 month" : m % 12 === 0 ? `${m / 12} year${m > 12 ? "s" : ""}` : `${m} months`}
              </button>
            ))}
          </div>

          {!upgrade?.configured && (
            <div className="sb-notice">
              <Icon name="alertTriangle" size={15} /> Online payments are being configured. Contact{" "}
              <strong>TechB Software Solutions</strong>.
            </div>
          )}
          {upgradeError && <div className="login-error" style={{ marginBottom: 12 }}>{upgradeError}</div>}

          <div className="sb-plans">
            {upgradePlans.map((p) => {
              const total = p.price * selectedTerm;
              const busy = payingPlan === p.code;
              return (
                <div key={p.code} className="sb-plan">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div className="sb-plan-name">{p.name}</div>
                    {p.isCurrent && (
                      <span className="sb-pill full" style={{ fontSize: 11 }}>Current Plan</span>
                    )}
                    {p.isUpgrade && (
                      <span className="sb-pill partial" style={{ fontSize: 11 }}>Upgrade</span>
                    )}
                  </div>
                  <div className="sb-plan-price">{inr(p.price)} <span>/ month</span></div>
                  <div className="sb-plan-total">{inr(total)} for {selectedTerm} month{selectedTerm === 1 ? "" : "s"}</div>
                  {p.description && <p className="sb-plan-desc">{p.description}</p>}
                  {p.features?.length > 0 && (
                    <ul className="sb-plan-features">
                      {p.features.map((f, i) => (
                        <li key={i}><Icon name="check" size={13} /> {f}</li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary sb-plan-btn"
                    disabled={!upgrade?.configured || busy || Boolean(payingPlan)}
                    onClick={() => startUpgrade(p)}
                  >
                    {busy
                      ? "Opening checkout…"
                      : p.isCurrent
                      ? `Top Up / Renew for ${inr(total)}`
                      : `Upgrade & Pay ${inr(total)}`}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <p className="field-hint" style={{ marginTop: 14 }}>
          To change your plan, contact <strong>TechB Software Solutions</strong>.
        </p>
      )}
    </div>
  );
}
