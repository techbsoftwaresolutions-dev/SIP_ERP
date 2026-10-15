import { useEffect, useState } from "react";
import adminApi from "../../api/adminClient";
import PageHeader from "../../components/layout/PageHeader";
import Icon from "../../components/ui/Icon";
import Loader from "../../components/ui/Loader";
import Toast from "../../components/ui/Toast";
import StatusBadge from "../../components/ui/StatusBadge";

export default function PaymentGateway() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const [form, setForm] = useState({
    enabled: true,
    keyId: "",
    keySecret: "",
    webhookSecret: "",
    companyName: "SIPERP",
    themeColor: "#2563eb",
  });

  const [showSecret, setShowSecret] = useState(false);
  const [isChangingSecret, setIsChangingSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = () => {
    setLoading(true);
    adminApi
      .get("/api/admin/payment-gateway")
      .then((data) => {
        setConfig(data);
        setForm({
          enabled: data.enabled ?? true,
          keyId: data.keyId || "",
          keySecret: data.keySecretMasked || "",
          webhookSecret: data.webhookSecret || "",
          companyName: data.companyName || "SIPERP",
          themeColor: data.themeColor || "#2563eb",
        });
        setError("");
      })
      .catch((err) => setError(err.message || "Failed to load payment gateway settings."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await adminApi.post("/api/admin/payment-gateway/test", {
        keyId: form.keyId,
        keySecret: isChangingSecret ? form.keySecret : undefined,
      });
      setTestResult({
        success: true,
        message: res.message || "Razorpay API connected successfully!",
        mode: res.mode,
      });
      flash(res.message || "Connection test succeeded!");
    } catch (err) {
      setTestResult({
        success: false,
        message: err.message || "Failed to connect to Razorpay. Check your Key ID & Secret.",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const payload = {
      enabled: form.enabled,
      keyId: form.keyId,
      webhookSecret: form.webhookSecret,
      companyName: form.companyName,
      themeColor: form.themeColor,
    };

    if (isChangingSecret || !form.keySecret.includes("••••")) {
      payload.keySecret = form.keySecret;
    }

    try {
      const updated = await adminApi.put("/api/admin/payment-gateway", payload);
      setConfig(updated);
      setForm((prev) => ({
        ...prev,
        keySecret: updated.keySecretMasked || "",
      }));
      setIsChangingSecret(false);
      flash("Payment Gateway configuration saved successfully!");
    } catch (err) {
      setError(err.message || "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="Payment Gateway" crumbs={["Admin", "Payment Gateway"]} />
        <div className="loading-row">
          <Loader />
        </div>
      </div>
    );
  }

  const isTestKey = (form.keyId || "").startsWith("rzp_test_");
  const isLiveKey = (form.keyId || "").startsWith("rzp_live_");

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <PageHeader
        title="Payment Gateway (Razorpay)"
        subtitle="Configure your Razorpay API keys, webhooks, and checkout appearance"
        crumbs={["Admin", "Payment Gateway"]}
        actions={
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              className="btn"
              disabled={testing || !form.keyId}
              onClick={handleTest}
              title="Test connection against Razorpay API"
            >
              <Icon name="checkCircle" size={15} />
              {testing ? "Testing..." : "Test Connection"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving}
              onClick={handleSubmit}
            >
              <Icon name="check" size={15} />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        }
      />

      {toast && <Toast message={toast} />}

      {error && (
        <div className="login-error" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      {testResult && (
        <div
          style={{
            padding: "14px 18px",
            marginBottom: 20,
            borderRadius: 8,
            border: `1px solid ${testResult.success ? "#86efac" : "#fca5a5"}`,
            background: testResult.success ? "#f0fdf4" : "#fef2f2",
            color: testResult.success ? "#166534" : "#991b1b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon name={testResult.success ? "checkCircle" : "alertTriangle"} size={18} />
            <div>
              <strong>{testResult.success ? "Connection Verified" : "Connection Failed"}</strong>
              <div style={{ fontSize: "0.88rem", marginTop: 2 }}>{testResult.message}</div>
            </div>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setTestResult(null)}
            title="Dismiss"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {/* Gateway Status Summary Card */}
      <div
        className="list-card"
        style={{
          marginBottom: 24,
          background: "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(79,70,229,0.03))",
          borderColor: "rgba(37,99,235,0.2)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: form.enabled ? "#2563eb" : "#64748b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
              }}
            >
              <Icon name="wallet" size={24} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700 }}>Razorpay Payments</h3>
                <span className={`status-badge ${form.enabled ? "status-active" : "status-disabled"}`}>
                  {form.enabled ? "Active" : "Disabled"}
                </span>
                {isTestKey && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: "#fef3c7",
                      color: "#92400e",
                    }}
                  >
                    Test Mode
                  </span>
                )}
                {isLiveKey && (
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      background: "#dcfce7",
                      color: "#166534",
                    }}
                  >
                    Live Mode
                  </span>
                )}
              </div>
              <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.875rem" }}>
                Powers client subscription upgrades and online billing.
              </p>
            </div>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              userSelect: "none",
              fontWeight: 600,
            }}
          >
            <span>Enable Gateway</span>
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => setForm((prev) => ({ ...prev, enabled: e.target.checked }))}
              style={{ width: 18, height: 18, cursor: "pointer" }}
            />
          </label>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* API Credentials */}
        <div className="list-card" style={{ marginBottom: 24 }}>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="lock" size={17} /> API Credentials
          </div>
          <p className="field-hint" style={{ marginTop: 0, marginBottom: 18 }}>
            Get your Key ID and Key Secret from the{" "}
            <a
              href="https://dashboard.razorpay.com/app/website-app-settings/api-keys"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#2563eb", textDecoration: "underline" }}
            >
              Razorpay Dashboard &gt; Settings &gt; API Keys
            </a>
            .
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.9rem" }}>
                Razorpay Key ID <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="rzp_test_... or rzp_live_..."
                  value={form.keyId}
                  onChange={(e) => setForm((prev) => ({ ...prev, keyId: e.target.value }))}
                  required
                  style={{ width: "100%", fontFamily: "monospace" }}
                />
              </div>
              <small className="field-hint">
                Public identifier (e.g. <code>rzp_test_TnHsngwCFvKmEc</code>). Safe to expose to browsers.
              </small>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  Razorpay Key Secret <span style={{ color: "#ef4444" }}>*</span>
                </label>
                {config?.hasKeySecret && !isChangingSecret && (
                  <button
                    type="button"
                    className="btn"
                    style={{ padding: "3px 10px", fontSize: "0.8rem" }}
                    onClick={() => {
                      setIsChangingSecret(true);
                      setForm((prev) => ({ ...prev, keySecret: "" }));
                    }}
                  >
                    Change Secret
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type={showSecret ? "text" : "password"}
                  className="input-field"
                  placeholder={config?.hasKeySecret && !isChangingSecret ? "••••••••••••••••••••" : "Enter Razorpay Key Secret"}
                  value={form.keySecret}
                  onChange={(e) => setForm((prev) => ({ ...prev, keySecret: e.target.value }))}
                  disabled={config?.hasKeySecret && !isChangingSecret}
                  style={{ width: "100%", fontFamily: "monospace" }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowSecret((v) => !v)}
                  title={showSecret ? "Hide secret" : "Show secret"}
                  style={{ flexShrink: 0 }}
                >
                  <Icon name={showSecret ? "close" : "lock"} size={14} />
                  {showSecret ? "Hide" : "Show"}
                </button>
              </div>
              <small className="field-hint">
                Private key used to sign and verify checkout transactions server-side. Never exposed to browsers.
              </small>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.9rem" }}>
                Webhook Secret (Optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Secret configured in Razorpay Webhooks tab"
                value={form.webhookSecret}
                onChange={(e) => setForm((prev) => ({ ...prev, webhookSecret: e.target.value }))}
                style={{ width: "100%", fontFamily: "monospace" }}
              />
              <small className="field-hint">
                Used to verify server-to-server webhook notifications from Razorpay.
              </small>
            </div>
          </div>
        </div>

        {/* Checkout Appearance */}
        <div className="list-card" style={{ marginBottom: 24 }}>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="palette" size={17} /> Checkout Appearance
          </div>
          <p className="field-hint" style={{ marginTop: 0, marginBottom: 18 }}>
            Customize how the Razorpay Checkout modal appears to clients when upgrading their subscription.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.9rem" }}>
                Business Name
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="TechB Software Solutions / SIPERP"
                value={form.companyName}
                onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
                style={{ width: "100%" }}
              />
              <small className="field-hint">Shown in the header of the Razorpay payment modal.</small>
            </div>

            <div>
              <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.9rem" }}>
                Theme Color
              </label>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="color"
                  value={form.themeColor}
                  onChange={(e) => setForm((prev) => ({ ...prev, themeColor: e.target.value }))}
                  style={{
                    width: 44,
                    height: 38,
                    padding: 2,
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    cursor: "pointer",
                  }}
                />
                <input
                  type="text"
                  className="input-field"
                  value={form.themeColor}
                  onChange={(e) => setForm((prev) => ({ ...prev, themeColor: e.target.value }))}
                  style={{ width: 120, fontFamily: "monospace" }}
                />
              </div>
              <small className="field-hint">Primary color for buttons and header in Checkout.</small>
            </div>
          </div>
        </div>

        {/* Webhook Configuration Guide */}
        <div
          className="list-card"
          style={{
            marginBottom: 24,
            background: "rgba(241,245,249,0.6)",
            border: "1px dashed #cbd5e1",
          }}
        >
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.98rem" }}>
            <Icon name="bell" size={17} /> Webhook Setup Instructions
          </div>
          <p style={{ fontSize: "0.88rem", color: "#475569", margin: "6px 0 12px" }}>
            To enable automatic asynchronous payment notifications, register a webhook in your Razorpay Dashboard:
          </p>
          <ol style={{ fontSize: "0.88rem", color: "#334155", paddingLeft: 20, margin: 0, lineHeight: 1.6 }}>
            <li>Go to <strong>Razorpay Dashboard &gt; Settings &gt; Webhooks</strong>.</li>
            <li>Click <strong>Add New Webhook</strong>.</li>
            <li>
              Enter your Webhook URL:
              <div
                style={{
                  display: "inline-block",
                  background: "#fff",
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: "1px solid #cbd5e1",
                  fontFamily: "monospace",
                  marginLeft: 6,
                }}
              >
                {window.location.origin}/api/webhooks/razorpay
              </div>
            </li>
            <li>Select events: <code>order.paid</code>, <code>payment.captured</code>, <code>payment.failed</code>.</li>
            <li>Enter a Webhook Secret, save it in Razorpay, and paste it into the Webhook Secret field above.</li>
          </ol>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
          <button
            type="button"
            className="btn"
            disabled={testing || !form.keyId}
            onClick={handleTest}
          >
            <Icon name="checkCircle" size={15} />
            {testing ? "Testing..." : "Test Connection"}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            <Icon name="check" size={15} />
            {saving ? "Saving Changes..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
