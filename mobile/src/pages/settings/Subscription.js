import { useCallback, useEffect, useState } from "react";
import { Modal, Platform, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../../api/client";
import Screen from "../../components/layout/Screen";
import { Button, Card, Chip, ErrorBox, Icon, IconButton, Loader, Note, SectionTitle, StatCard, StatGrid, useFeedback } from "../../components/ui";
import { usePermissions } from "../../context/SessionContext";
import { useNavigate } from "../../navigation/router";
import { colors } from "../../theme";

// Port of pages/settings/Subscription.jsx — plan, menu access, invoice-theme
// tier and in-app upgrade. Razorpay Checkout is a web widget, so on the
// phone it runs inside a WebView and reports back via postMessage; the
// payment is then verified server-side exactly as the web app does.

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const ACCESS_LABEL = { full: "Full", partial: "Partial", none: "Not on this plan" };
const TIER_LABEL = { basic: "Basic", advanced: "Advanced", premium: "Premium" };

function checkoutHtml(order) {
  const opts = {
    key: order.keyId,
    amount: order.amount * 100,
    currency: order.currency,
    name: "TechB Software Solutions",
    description: `${order.planName} — ${order.termMonths} month${order.termMonths === 1 ? "" : "s"}`,
    order_id: order.razorpayOrderId,
    prefill: { name: order.companyName },
    theme: { color: "#2563eb" },
  };
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#6b7280">Opening secure checkout…
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  const send = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
  const o = ${JSON.stringify(opts)};
  o.handler = (r) => send({ type: "success", r });
  o.modal = { ondismiss: () => send({ type: "dismiss" }) };
  const rzp = new Razorpay(o);
  rzp.on("payment.failed", (e) => send({ type: "failed", message: (e.error && e.error.description) || "Payment failed. You have not been charged." }));
  rzp.open();
</script></body></html>`;
}

export default function Subscription() {
  const navigate = useNavigate();
  const { toast } = useFeedback();
  const { recheck } = usePermissions();
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const [upgrade, setUpgrade] = useState(null);
  const [term, setTerm] = useState(12);
  const [paying, setPaying] = useState(null); // { order, plan }
  const [upgradeError, setUpgradeError] = useState("");

  const loadDetails = useCallback(() => api.get("/api/subscription/details").then(setDetails), []);
  const loadUpgrade = useCallback(
    () =>
      api
        .get("/api/subscription/upgrade-options")
        .then((d) => {
          setUpgrade(d);
          if (d.termMonths && d.termMonths.length && !d.termMonths.includes(12)) setTerm(d.termMonths[0]);
        })
        .catch(() => {}),
    []
  );
  useEffect(() => {
    loadDetails().catch((err) => setError(err.message || "Could not load subscription details."));
    loadUpgrade();
  }, [loadDetails, loadUpgrade]);

  const startUpgrade = async (plan) => {
    setUpgradeError("");
    if (Platform.OS === "web") return setUpgradeError("Upgrades run in the phone app or on the web app's My Subscription page.");
    try {
      const order = await api.post("/api/subscription/upgrade/order", { planCode: plan.code, termMonths: term });
      setPaying({ order, plan });
    } catch (err) {
      setUpgradeError(err.message || "Could not start checkout.");
    }
  };

  const onCheckoutMessage = async (event) => {
    let msg = {};
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch (_) {
      return;
    }
    const { order } = paying || {};
    if (msg.type === "dismiss") return setPaying(null);
    if (msg.type === "failed") {
      setPaying(null);
      return setUpgradeError(msg.message);
    }
    if (msg.type === "success" && order) {
      setPaying(null);
      try {
        await api.post("/api/subscription/upgrade/verify", {
          localOrderId: order.localOrderId,
          razorpay_order_id: msg.r.razorpay_order_id,
          razorpay_payment_id: msg.r.razorpay_payment_id,
          razorpay_signature: msg.r.razorpay_signature,
        });
        toast(`You're now on ${order.planName}.`);
        await Promise.all([loadDetails(), loadUpgrade(), recheck()]);
      } catch (err) {
        setUpgradeError(err.message || `Payment succeeded but we couldn't confirm it. Contact TechB Software Solutions with your payment ID: ${msg.r.razorpay_payment_id}`);
      }
    }
  };

  if (!details) return <Screen title="My Subscription">{error ? <ErrorBox message={error} /> : <Loader />}</Screen>;
  if (!details.planName) {
    return (
      <Screen title="My Subscription">
        <Card>
          <SectionTitle>No plan assigned</SectionTitle>
          <Text style={{ color: colors.textMuted }}>This account has no subscription plan set up yet. Contact TechB Software Solutions to get one assigned.</Text>
        </Card>
      </Screen>
    );
  }

  const end = fmtDate(details.subscriptionEnd);
  const live = details.state === "active";
  const full = details.menus.filter((m) => m.access === "full").length;
  const partial = details.menus.filter((m) => m.access === "partial").length;
  const plans = (upgrade?.plans || []).filter((p) => p.isUpgrade);
  let WebView = null;
  if (Platform.OS !== "web") WebView = require("react-native-webview").WebView;

  return (
    <Screen title="My Subscription">
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: live ? colors.greenBg : colors.redBg, borderColor: "transparent" }}>
        <Icon name={live ? "checkCircle" : "alertCircle"} color={live ? colors.green : colors.red} />
        <Text style={{ fontWeight: "700", color: live ? colors.green : colors.red }}>{live ? "Active Subscription" : details.state === "suspended" ? "Suspended" : "Expired"}</Text>
      </Card>
      <StatGrid>
        <StatCard label="Current Plan" value={details.planName} icon="tag" />
        <StatCard label="Monthly Price" value={inr(details.price)} icon="banknote" color="green" />
        <StatCard label="Renewal / Expires" value={end || "No expiry"} sub={details.daysRemaining != null ? `${details.daysRemaining} day${details.daysRemaining === 1 ? "" : "s"} left` : undefined} icon="calendar" color="purple" />
        <StatCard label="Menus Included" value={partial ? `${full} full, ${partial} partial` : `${full} of ${details.menus.length}`} icon="grid" color="orange" />
      </StatGrid>

      <Card>
        <SectionTitle>Plan Details</SectionTitle>
        {details.description ? <Text style={{ color: colors.textMuted, marginBottom: 8 }}>{details.description}</Text> : null}
        {[
          ["Billing Cycle", details.billingCycle],
          ["Term", `${details.termMonths} month${details.termMonths === 1 ? "" : "s"}`],
          details.discountPercent > 0 ? ["Discount", `${details.discountPercent}%`] : null,
          ["Amount payable (this term)", inr(details.amountPayable)],
          fmtDate(details.subscriptionStart) ? ["Started", fmtDate(details.subscriptionStart)] : null,
          details.maxUsers > 0 ? ["Max users", details.maxUsers] : null,
        ]
          .filter(Boolean)
          .map(([k, v]) => (
            <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <Text style={{ color: colors.textMuted }}>{k}</Text>
              <Text style={{ fontWeight: "600" }}>{v}</Text>
            </View>
          ))}
        {details.features.length ? (
          <View style={{ marginTop: 8, gap: 4 }}>
            {details.features.map((f, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 6 }}>
                <Icon name="check" size={15} color={colors.green} />
                <Text style={{ flex: 1 }}>{f}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card>
        <SectionTitle>Menu Access</SectionTitle>
        {details.menus.map((m) => (
          <View key={m.key} style={{ paddingVertical: 6, borderTopWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ flex: 1, fontWeight: "600" }}>{m.label}</Text>
              <Text style={{ fontSize: 12, fontWeight: "700", color: m.access === "full" ? colors.green : m.access === "partial" ? colors.amber : colors.textLight }}>{ACCESS_LABEL[m.access]}</Text>
            </View>
            {m.children && m.access === "partial" ? (
              <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                {m.children.map((c) => `${c.allowed ? "✓" : "✕"} ${c.label}`).join("   ")}
              </Text>
            ) : null}
          </View>
        ))}
      </Card>

      <Card onPress={() => navigate("/settings/invoice-theme")}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ flex: 1, fontWeight: "700" }}>Invoice Themes · {TIER_LABEL[details.invoiceThemes.tier] || details.invoiceThemes.tier}</Text>
          <Icon name="chevronRight" color={colors.textLight} />
        </View>
        <Text style={{ color: colors.textMuted, marginTop: 4 }}>
          {details.invoiceThemes.unlockedCount} of {details.invoiceThemes.totalCount} themes unlocked.
          {details.invoiceThemes.canPickAccent ? " You can also choose your own invoice colour." : ""}
        </Text>
      </Card>

      {plans.length ? (
        <Card>
          <SectionTitle>Upgrade Your Plan</SectionTitle>
          <Text style={{ color: colors.textMuted, marginBottom: 10 }}>Pick a term, then upgrade — it takes effect immediately and starts a new billing period from today.</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {upgrade.termMonths.map((m) => (
              <Chip key={m} label={m === 1 ? "1 month" : m % 12 === 0 ? `${m / 12} year${m > 12 ? "s" : ""}` : `${m} months`} active={term === m} onPress={() => setTerm(m)} />
            ))}
          </View>
          {!upgrade.configured ? <Note icon="alertTriangle">Online upgrades aren't set up yet. Contact TechB Software Solutions to upgrade.</Note> : null}
          <ErrorBox message={upgradeError} />
          {plans.map((p) => (
            <View key={p.code} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, marginBottom: 10, gap: 4 }}>
              <Text style={{ fontWeight: "800", fontSize: 16 }}>{p.name}</Text>
              <Text>
                <Text style={{ fontWeight: "800" }}>{inr(p.price)}</Text> / month · {inr(p.price * term)} for {term} month{term === 1 ? "" : "s"}
              </Text>
              {p.description ? <Text style={{ color: colors.textMuted }}>{p.description}</Text> : null}
              {p.features.map((f, i) => (
                <Text key={i} style={{ color: colors.textMuted, fontSize: 13 }}>
                  ✓ {f}
                </Text>
              ))}
              <Button title={`Upgrade & Pay ${inr(p.price * term)}`} disabled={!upgrade.configured || !!paying} onPress={() => startUpgrade(p)} style={{ marginTop: 6 }} />
            </View>
          ))}
        </Card>
      ) : (
        <Text style={{ color: colors.textMuted }}>To change your plan, contact TechB Software Solutions.</Text>
      )}

      {WebView ? (
        <Modal visible={!!paying} animationType="slide" onRequestClose={() => setPaying(null)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12 }}>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>Secure checkout</Text>
              <IconButton name="close" color={colors.text} onPress={() => setPaying(null)} />
            </View>
            {paying ? <WebView originWhitelist={["*"]} source={{ html: checkoutHtml(paying.order) }} onMessage={onCheckoutMessage} javaScriptEnabled /> : null}
          </SafeAreaView>
        </Modal>
      ) : null}
    </Screen>
  );
}
