import { useEffect, useState } from "react";
import api, { clearSettingsCache } from "../../api/client";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";
import Toast from "../../components/ui/Toast";
import Select from "../../components/forms/Select";
import PasswordInput from "../../components/forms/PasswordInput";

const TEMPLATE_BODY = "Hello {{1}}, please find your {{2}} for {{3}} attached. Thank you, {{4}}.";

const STEPS = [
  <>Open <b>Meta Business Suite → WhatsApp Manager</b> (business.facebook.com) and add your business phone number to a WhatsApp Business Account.</>,
  <>Under <b>API Setup</b>, copy the <b>Phone number ID</b> and the <b>WhatsApp Business Account ID</b> into the boxes below.</>,
  <>Create a permanent token: <b>Business Settings → System users</b> → add a system user → <b>Generate token</b> with the <i>whatsapp_business_messaging</i> and <i>whatsapp_business_management</i> permissions. Paste it as the Access Token.</>,
  <>In <b>WhatsApp Manager → Message templates</b>, create a template: category <b>Utility</b>, name <code>document_share</code>, language English, <b>Header = Document</b> (upload any sample PDF), and the body text shown below. Wait for Meta to approve it (usually minutes).</>,
  <>Come back here, click <b>Save</b>, then <b>Test connection</b>. When it succeeds, set Status to <b>Enabled</b> and save again.</>,
];

export default function WhatsAppSettings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [testResult, setTestResult] = useState(null);
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get("/api/settings").then((s) => {
      setSettings(s);
      setForm({
        waStatus: s.waStatus || "Disabled",
        waPhoneNumberId: s.waPhoneNumberId || "",
        waBusinessAccountId: s.waBusinessAccountId || "",
        waTemplateName: s.waTemplateName || "document_share",
        waTemplateLang: s.waTemplateLang || "en",
      });
    });
  }, []);

  if (!settings) {
    return (
      <div>
        <PageHeader title="WhatsApp Settings" crumbs={["Dashboard", "Settings", "WhatsApp Settings"]} />
        <div className="loading-row"><Loader /></div>
      </div>
    );
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value.trimStart() }));
  const tokenSaved = Boolean(settings.waAccessTokenSet);

  // Only the WhatsApp fields are sent — never the whole settings object — so
  // saving here cannot touch anything else. The token is included only when a
  // new one was typed; leaving it blank keeps the saved one.
  const save = async () => {
    setError("");
    if (form.waStatus === "Enabled" && (!form.waPhoneNumberId.trim() || (!tokenSaved && !token.trim()) || !form.waTemplateName.trim())) {
      setError("To enable WhatsApp, fill in the Phone Number ID, Access Token and Template name.");
      return false;
    }
    setSaving(true);
    try {
      const payload = { ...form, waPhoneNumberId: form.waPhoneNumberId.trim(), waBusinessAccountId: form.waBusinessAccountId.trim(), waTemplateName: form.waTemplateName.trim(), waTemplateLang: form.waTemplateLang.trim() || "en" };
      if (token.trim()) payload.waAccessToken = token.trim();
      const saved = await api.put("/api/settings", payload);
      clearSettingsCache();
      setSettings(saved);
      setToken("");
      setToast("WhatsApp settings saved.");
      setTimeout(() => setToast(""), 3500);
      return true;
    } catch (err) {
      setError(err.message || "Could not save the WhatsApp settings.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setError("");
    setTestResult(null);
    // Test what is on screen: save first so the server checks the same values.
    if (!(await save())) return;
    setTesting(true);
    try {
      setTestResult(await api.post("/api/whatsapp/test", {}));
    } catch (err) {
      setError(err.message || "The connection test failed.");
    } finally {
      setTesting(false);
    }
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(TEMPLATE_BODY);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch  {
      // clipboard blocked — the text is on screen to copy by hand
    }
  };

  return (
    <div>
      <PageHeader title="WhatsApp Settings" crumbs={["Dashboard", "Settings", "WhatsApp Settings"]} />

      <div className="list-card" style={{ marginBottom: 18 }}>
        <div className="section-title">WhatsApp Business connection</div>
        {error && <div className="login-error">{error}</div>}
        {testResult && (
          <div className="login-error" style={{ background: "var(--green-bg, #e8f7ee)", color: "var(--green-dark, #15803d)", borderColor: "rgba(22,163,74,.3)", borderLeftColor: "#16a34a" }}>
            Connected — {testResult.verifiedName || "your business"} {testResult.displayPhoneNumber ? `(${testResult.displayPhoneNumber})` : ""}
            {testResult.quality ? ` · quality ${String(testResult.quality).toLowerCase()}` : ""}
          </div>
        )}

        <div className="settings-form">
          <div className="field">
            <label>Status</label>
            <Select value={form.waStatus} onChange={set("waStatus")}>
              <option value="Disabled">Disabled</option>
              <option value="Enabled">Enabled</option>
            </Select>
          </div>
          <div className="field">
            <label>Phone Number ID</label>
            <input value={form.waPhoneNumberId} onChange={set("waPhoneNumberId")} placeholder="e.g. 109876543210987" autoComplete="off" />
          </div>
          <div className="field">
            <label>WhatsApp Business Account ID</label>
            <input value={form.waBusinessAccountId} onChange={set("waBusinessAccountId")} placeholder="e.g. 123456789012345" autoComplete="off" />
          </div>
          <div className="field">
            <label>Access Token {tokenSaved && <span className="field-hint field-hint-ok" style={{ display: "inline", marginLeft: 6 }}>a token is saved</span>}</label>
            <PasswordInput
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={tokenSaved ? "Leave blank to keep the saved token" : "Paste the permanent access token"}
              autoComplete="new-password"
            />
          </div>
          <div className="field">
            <label>Template name</label>
            <input value={form.waTemplateName} onChange={set("waTemplateName")} placeholder="document_share" autoComplete="off" />
          </div>
          <div className="field">
            <label>Template language code</label>
            <input value={form.waTemplateLang} onChange={set("waTemplateLang")} placeholder="en" autoComplete="off" />
          </div>
        </div>

        <div className="add-form-actions">
          <button type="button" className="btn" onClick={test} disabled={saving || testing}>
            {testing ? "Testing…" : "Save & test connection"}
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving || testing}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="list-card">
        <div className="section-title"><Icon name="whatsapp" size={16} /> How to set it up</div>
        <ol style={{ color: "var(--text-muted)", fontSize: "13.5px", lineHeight: 1.75, margin: "0 0 16px", paddingLeft: 20 }}>
          {STEPS.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
        <div className="field-label-row" style={{ marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: "13px" }}>Template body (copy exactly — four variables)</span>
          <button type="button" className="btn" onClick={copyTemplate}>{copied ? "Copied!" : "Copy"}</button>
        </div>
        <pre style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", fontSize: "13px", whiteSpace: "pre-wrap", margin: 0 }}>{TEMPLATE_BODY}</pre>
        <p style={{ color: "var(--text-light)", fontSize: "12.5px", margin: "10px 0 0" }}>
          {"{{1}}"} = customer or supplier name · {"{{2}}"} = document and number (e.g. Invoice INV-0007) · {"{{3}}"} = amount · {"{{4}}"} = your company name.
          WhatsApp lets a business start a conversation only with an approved template, which is why this is needed. Meta charges per conversation as per their pricing.
        </p>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
