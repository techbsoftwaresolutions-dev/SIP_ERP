import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import AddRecordForm from "../../components/forms/AddRecordForm";
import MasterKeyGate, { masterKeyHeader, useRelockOnInvalidKey } from "./MasterKeyGate";
import Loader from "../../components/ui/Loader";
import MenuPicker, { expandStored, selectableKeys, useMenuTree } from "./MenuPicker";
import DateInput from "../../components/forms/DateInput";
import Select from "../../components/forms/Select";
import PasswordInput from "../../components/forms/PasswordInput";
import { clientAddress } from "../../utils/appDomain";

const STATUS_OPTIONS = ["active", "suspended"];
const TERM_MONTHS = [1, 3, 6, 12, 24, 36];
const NO_PLAN = "— No plan —";

const inr = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

// <DateInput > needs YYYY-MM-DD; the API returns ISO timestamps.
function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

// Renewal date = start + term. Day-of-month is clamped so 31 Jan + 1 month
// lands on 28/29 Feb instead of rolling into March.
function addMonths(dateStr, months) {
  if (!dateStr || !months) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.getDate();
  const end = new Date(d.getFullYear(), d.getMonth() + Number(months), 1);
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  end.setDate(Math.min(day, lastDay));
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

function termLabel(m) {
  if (m === 1) return "1 month";
  if (m === 12) return "12 months (1 year)";
  if (m === 24) return "24 months (2 years)";
  if (m === 36) return "36 months (3 years)";
  return `${m} months`;
}

function ClientFormInner() {
  const { subdomain } = useParams();
  const isEdit = Boolean(subdomain);
  const navigate = useNavigate();
  const relockOnInvalidKey = useRelockOnInvalidKey();
  const menuTree = useMenuTree();
  const [plans, setPlans] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [themes, setThemes] = useState([]);
  const [form, setForm] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  // Resetting the client administrator's password is its own action, separate
  // from Save, so it is never changed by accident while editing something else.
  const [resetPw, setResetPw] = useState("");
  const [resetPwConfirm, setResetPwConfirm] = useState("");
  const [resettingPw, setResettingPw] = useState(false);
  const [resetMsg, setResetMsg] = useState({ ok: false, text: "" });
  // The renewal date follows start + term until the user edits it directly.
  const [endTouched, setEndTouched] = useState(false);
  // Whether this client is restricted below their plan at all. Kept apart
  // from form.modules so unticking the last menu is a validation error, not
  // an accidental "back to the plan default".
  const [overrideOn, setOverrideOn] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    Promise.all([
      api.get("/api/admin/tenants", masterKeyHeader()),
      api.get("/api/admin/plans", masterKeyHeader()).catch(() => ({ plans: [] })),
      api.get("/api/admin/add-ons", masterKeyHeader()).catch(() => ({ addOns: [] })),
      api.get("/api/admin/themes", masterKeyHeader()).catch(() => ({ themes: [] })),
    ])
      .then(([tenantsRes, plansRes, addOnsRes, themesRes]) => {
        const t = (tenantsRes.tenants || []).find((x) => x.subdomain === subdomain);
        if (!t) throw new Error("Client not found.");
        setPlans(plansRes.plans || []);
        setCatalogue(addOnsRes.addOns || []);
        // An archived theme is off the menu for everyone except a client
        // already on it — who keeps it listed so it is visible and can be
        // moved off deliberately, rather than vanishing from the dropdown.
        setThemes(
          (themesRes.themes || []).filter((x) => x.status !== "archived" || x.code === t.themeCode)
        );
        const initial = {
          companyName: t.companyName || "",
          databaseName: t.databaseName || "",
          status: t.status || "active",
          planName: t.planName || NO_PLAN,
          termMonths: t.termMonths || 12,
          discountPercent: t.discountPercent || 0,
          subscriptionStart: toDateInput(t.subscriptionStart),
          subscriptionEnd: toDateInput(t.subscriptionEnd),
          graceDays: t.graceDays || 0,
          // Per-client menu override. Empty = no override, so the plan decides.
          modules: t.modules || [],
          // Add-ons bought on top of the plan, by code.
          addOns: t.addOns || [],
          // Blank = whichever theme is the platform default.
          themeCode: t.themeCode || "",
        };
        setForm(initial);
        setSaved(initial);
        setOverrideOn((t.modules || []).length > 0);
      })
      .catch((err) => {
        if (relockOnInvalidKey(err)) return;
        setLoadError(err.message || "Could not load that client.");
      });
  }, [subdomain, isEdit, relockOnInvalidKey]);

  const set = (key) => (e) => {
    const value = e.target.value;
    if (key === "subscriptionEnd") setEndTouched(true);
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Keep the renewal date in step with start/term until it's hand-edited.
      if ((key === "subscriptionStart" || key === "termMonths") && !endTouched) {
        const computed = addMonths(next.subscriptionStart, next.termMonths);
        if (computed) next.subscriptionEnd = computed;
      }
      return next;
    });
  };

  if (isEdit && !form) {
    return (
      <div>
        <PageHeader title="Edit Client" crumbs={["Admin", "Manage Clients", "Edit Client"]} />
        <div className="loading-row">{loadError ? loadError : <Loader />}</div>
      </div>
    );
  }

  // Adding a client only asks for the essentials — subdomain and database name
  // are auto-derived and never editable, since repointing them later is how two
  // clients' data ends up cross-wired. The subscription is set on edit.
  if (!isEdit) {
    const fields = [
      { key: "companyName", label: "Company Name", required: true, placeholder: "Enter the client's company name" },
      {
        key: "subdomain",
        label: "Subdomain (optional — auto-generated from the company name if left blank)",
        placeholder: "e.g. hcl",
      },
      {
        key: "adminPassword",
        label: "Admin Password (the client's first sign-in password)",
        type: "password",
        required: true,
        placeholder: "At least 8 characters, a letter and a number",
      },
      {
        key: "adminPasswordConfirm",
        label: "Confirm Admin Password",
        type: "password",
        required: true,
        placeholder: "Re-enter the password",
      },
    ];
    const handleAdd = async (values) => {
      if (values.adminPassword !== values.adminPasswordConfirm) {
        throw new Error("The two passwords do not match.");
      }
      const created = await api.post(
        "/api/admin/tenants",
        {
          companyName: values.companyName,
          subdomain: values.subdomain || undefined,
          adminPassword: values.adminPassword,
        },
        masterKeyHeader()
      );
      navigate("/admin/clients", {
        state: {
          toast: `Client added — ${clientAddress(created.subdomain)}. They sign in as "admin" with the password you set.`,
        },
      });
    };
    return (
      <div>
        <PageHeader title="Add Client" crumbs={["Admin", "Manage Clients", "Add Client"]} />
        <div className="list-card add-page-card">
          <div className="section-title">Client Details</div>
          <AddRecordForm
            fields={fields}
            onSubmit={handleAdd}
            onCancel={() => navigate("/admin/clients")}
            submitLabel="Add Client"
          />
        </div>
      </div>
    );
  }

  const plan = plans.find((p) => p.name === form.planName);
  const monthly = plan ? Number(plan.price) || 0 : 0;
  const months = Number(form.termMonths) || 0;
  const discount = Math.min(Math.max(Number(form.discountPercent) || 0, 0), 100);
  const subtotal = monthly * months;
  const discountValue = Math.round((subtotal * discount) / 100);
  const payable = subtotal - discountValue;

  // ---- Menu access ----
  // The plan sets the ceiling; this override can only narrow it. An empty
  // list means "no override", which is how every client behaves until a
  // super admin deliberately restricts one.
  const selectedTheme = form.themeCode
    ? themes.find((t) => t.code === form.themeCode)
    : themes.find((t) => t.isDefault);

  const boughtAddOns = form.addOns || [];
  const addOnMenus = catalogue
    .filter((a) => boughtAddOns.includes(a.code))
    .flatMap((a) => a.modules || []);
  // The ceiling an override can't exceed: what the plan includes, widened
  // by every add-on they hold. A plan with no menu list means "everything",
  // and everything plus an add-on is still everything — so it stays empty,
  // which the picker reads as "no ceiling".
  const planOwn = plan ? plan.modules || [] : [];
  const planMenus = planOwn.length ? [...new Set([...planOwn, ...addOnMenus])] : [];
  const menuValue = expandStored(menuTree, form.modules || []);
  const planMenuCount = planMenus.length
    ? expandStored(menuTree, planMenus).length
    : selectableKeys(menuTree).length;

  const setModules = (next) => setForm((f) => ({ ...f, modules: next }));

  const toggleAddOn = (code, on) =>
    setForm((f) => {
      const next = new Set(f.addOns || []);
      if (on) next.add(code);
      else next.delete(code);
      return { ...f, addOns: [...next] };
    });

  // Turning the override on starts from everything the plan already allows,
  // so the admin unticks their way down to the two menus they want rather
  // than starting from a blank slate that would lock the client out.
  const toggleOverride = (on) => {
    setOverrideOn(on);
    setModules(on ? expandStored(menuTree, planMenus.length ? planMenus : selectableKeys(menuTree)) : []);
  };

  const handleResetPassword = async () => {
    if (resettingPw) return;
    setResetMsg({ ok: false, text: "" });
    if (!resetPw) return setResetMsg({ ok: false, text: "Enter the new password." });
    if (resetPw !== resetPwConfirm) return setResetMsg({ ok: false, text: "The two passwords do not match." });
    setResettingPw(true);
    try {
      await api.put(`/api/admin/tenants/${encodeURIComponent(subdomain)}`, { adminPassword: resetPw }, masterKeyHeader());
      setResetPw("");
      setResetPwConfirm("");
      setResetMsg({ ok: true, text: "Password changed. Anyone signed in as this client's admin has been signed out." });
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      setResetMsg({ ok: false, text: err.message || "Could not change the password." });
    } finally {
      setResettingPw(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setError("");
    if (!form.companyName.trim()) return setError("Company name is required.");
    if (overrideOn && menuValue.length === 0) {
      return setError("Pick at least one menu, or switch the menu limit off.");
    }
    setSaving(true);
    try {
      await api.put(
        `/api/admin/tenants/${encodeURIComponent(subdomain)}`,
        {
          companyName: form.companyName,
          status: form.status,
          planCode: plan ? plan.code : "",
          termMonths: Number(form.termMonths) || 12,
          discountPercent: discount,
          subscriptionStart: form.subscriptionStart || "",
          subscriptionEnd: form.subscriptionEnd || "",
          graceDays: Number(form.graceDays) || 0,
          modules: overrideOn ? form.modules || [] : [],
          addOns: boughtAddOns,
          themeCode: form.themeCode || "",
        },
        masterKeyHeader()
      );
      navigate("/admin/clients", { state: { toast: "Client updated." } });
    } catch (err) {
      if (relockOnInvalidKey(err)) return;
      setError(err.message || "Could not save this client.");
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={`Edit Client — ${subdomain}`}
        crumbs={["Admin", "Manage Clients", `Edit Client — ${subdomain}`]}
      />

      <div className="list-card add-page-card">
        <div className="section-title">Client Details</div>
        {error && <div className="login-error">{error}</div>}

        <div className="settings-form">
          <div className="field">
            <label>Company Name <span style={{ color: "var(--red)" }}>*</span></label>
            <input type="text" value={form.companyName} onChange={set("companyName")} />
          </div>
          <div className="field">
            <label>Status</label>
            <Select value={form.status} onChange={set("status")}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label>Subdomain</label>
            <input type="text" value={subdomain} readOnly className="field-readonly" />
          </div>
          <div className="field">
            <label>Database</label>
            <input type="text" value={form.databaseName} readOnly className="field-readonly" />
          </div>
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Admin Password</div>
        <p className="field-hint" style={{ marginTop: 0 }}>
          Set a new password for this client's administrator (the "admin" account). They are signed out straight away.
          Leave blank if it needn't change.
        </p>
        {resetMsg.text && (
          <div className={resetMsg.ok ? "field-hint field-hint-ok" : "login-error"} style={{ marginBottom: 10 }}>
            {resetMsg.text}
          </div>
        )}
        <div className="settings-form">
          <div className="field">
            <label>New Password</label>
            <PasswordInput
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              placeholder="At least 8 characters, a letter and a number"
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label>Confirm New Password</label>
            <PasswordInput
              value={resetPwConfirm}
              onChange={(e) => setResetPwConfirm(e.target.value)}
              placeholder="Re-enter the new password"
              autoComplete="new-password"
            />
          </div>
        </div>
        <button
          type="button"
          className="btn"
          style={{ marginTop: 10 }}
          onClick={handleResetPassword}
          disabled={resettingPw || !resetPw}
        >
          {resettingPw ? "Changing…" : "Change Password"}
        </button>

        <div className="section-title" style={{ marginTop: 26 }}>Subscription</div>

        <div className="settings-form">
          <div className="field">
            <label>Plan</label>
            <Select value={form.planName} onChange={set("planName")}>
              {[NO_PLAN, ...plans.map((p) => p.name)].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label>Term</label>
            <Select value={form.termMonths} onChange={set("termMonths")}>
              {TERM_MONTHS.map((m) => (
                <option key={m} value={m}>{termLabel(m)}</option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label>Discount (%)</label>
            <input type="number" min="0" max="100" value={form.discountPercent} onChange={set("discountPercent")} />
          </div>
          <div className="field">
            <label>Grace Period (days after expiry)</label>
            <input type="number" min="0" value={form.graceDays} onChange={set("graceDays")} />
          </div>
          <div className="field">
            <label>Subscription Start</label>
            <DateInput value={form.subscriptionStart} onChange={set("subscriptionStart")} />
          </div>
          <div className="field">
            <label>Renewal / Expiry Date (blank = never expires)</label>
            <DateInput value={form.subscriptionEnd} onChange={set("subscriptionEnd")} />
          </div>
        </div>

        {plan ? (
          <div className="sub-price-card">
            <div className="sub-price-row">
              <span>{plan.name} — {inr(monthly)} / month × {months}</span>
              <strong>{inr(subtotal)}</strong>
            </div>
            {discount > 0 && (
              <div className="sub-price-row discount">
                <span>Discount ({discount}%)</span>
                <strong>− {inr(discountValue)}</strong>
              </div>
            )}
            <div className="sub-price-row total">
              <span>Amount payable</span>
              <strong>{inr(payable)}</strong>
            </div>
          </div>
        ) : (
          <div className="sub-price-card empty">No plan assigned — this client is not being billed.</div>
        )}

        <div className="section-title" style={{ marginTop: 26 }}>Appearance</div>

        <div className="settings-form">
          <div className="field">
            <label>Theme</label>
            <Select value={form.themeCode} onChange={set("themeCode")}>
              <option value="">— Platform default —</option>
              {themes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                  {t.isDefault ? " (default)" : ""}
                  {t.status === "archived" ? " — archived" : ""}
                </option>
              ))}
            </Select>
          </div>
          {selectedTheme && (
            <div className="field">
              <label>Colours</label>
              <span className="theme-swatches" style={{ paddingTop: 8 }}>
                {[selectedTheme.sidebar, selectedTheme.sidebarActive, selectedTheme.primary, selectedTheme.sidebarText].map(
                  (c, i) => (
                    <span key={i} className="theme-swatch" style={{ background: c }} title={c} />
                  )
                )}
              </span>
            </div>
          )}
        </div>

        <div className="section-title" style={{ marginTop: 26 }}>Add-ons</div>

        {catalogue.length === 0 ? (
          <div className="sub-price-card empty">
            No add-ons have been created yet. An add-on sells extra menus on top of a plan.
          </div>
        ) : (
          <div className="addon-picker">
            {catalogue.map((a) => {
              const on = boughtAddOns.includes(a.code);
              // An archived add-on is off sale, but a client already holding
              // one keeps it — so it is shown (and removable), just not
              // offered to anyone new.
              const retired = a.status === "archived";
              if (retired && !on) return null;
              return (
                <label key={a.code} className={`addon-option${on ? " is-on" : ""}`}>
                  <input type="checkbox" checked={on} onChange={(e) => toggleAddOn(a.code, e.target.checked)} />
                  <span className="addon-option-body">
                    <span className="addon-option-head">
                      {a.name}
                      {retired && <em className="addon-retired">off sale</em>}
                      <strong>{inr(a.price)}</strong>
                    </span>
                    <em>
                      {(a.modules || []).length
                        ? `Unlocks ${a.modules.length} menus`
                        : "Unlocks no menus"}
                      {Number(a.maxUsersBonus) > 0 ? ` · +${a.maxUsersBonus} seats` : ""}
                      {a.description ? ` · ${a.description}` : ""}
                    </em>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <div className="section-title" style={{ marginTop: 26 }}>Menu Access</div>

        <label className="menu-override-toggle">
          <input type="checkbox" checked={overrideOn} onChange={(e) => toggleOverride(e.target.checked)} />
          <span>
            Limit this client to specific menus
            <em>
              {overrideOn
                ? `${menuValue.length} of ${planMenuCount} plan menus enabled`
                : `Off — the client sees all ${planMenuCount} menus their plan includes`}
            </em>
          </span>
        </label>

        {overrideOn && (
          <MenuPicker
            tree={menuTree}
            value={menuValue}
            onChange={setModules}
            label="Menus this client can see"
            note="greyed-out menus are not on their plan"
            limitTo={planMenus}
            disabledTitle="Not included in this client's plan or add-ons"
          />
        )}
        <div className="add-form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setForm(saved);
              setEndTouched(false);
              setOverrideOn((saved.modules || []).length > 0);
            }}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ClientForm() {
  return (
    <MasterKeyGate>
      <ClientFormInner />
    </MasterKeyGate>
  );
}
