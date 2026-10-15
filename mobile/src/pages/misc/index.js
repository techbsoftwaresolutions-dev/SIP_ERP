import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, Share, Text, View } from "react-native";
import api from "../../api/client";
import ListScreen from "../../components/data/ListScreen";
import Screen from "../../components/layout/Screen";
import { Button, Card, Chip, Empty, ErrorBox, Icon, Loader, Note, SectionTitle, useFeedback, usePrimary } from "../../components/ui";
import { FieldLabel, Input, SearchableSelect } from "../../components/forms";
import { useLocation, useNavigate } from "../../navigation/router";
import { colors } from "../../theme";

// Reminders, AI Assistant, AI payment reminder, Maintenance and global
// search — ports of pages/dashboard/Reminders.jsx, pages/ai/Assistant.jsx,
// components/share/AiReminderModal.jsx, pages/maintenance/* and the web
// Topbar search box.

// ---------------------------------------------------------------- Reminders
const TYPES = [
  { key: "all", label: "All" },
  { key: "receivable", label: "Payments In" },
  { key: "payable", label: "Payments Out" },
  { key: "low-stock", label: "Low Stock" },
  { key: "delivery", label: "Deliveries" },
  { key: "purchase-order", label: "Purchase Orders" },
];
const ICON_FOR = { receivable: "banknote", payable: "wallet", "low-stock": "package", delivery: "truck", "purchase-order": "cart" };
const SEVERITY = { overdue: colors.red, "due-soon": colors.amber, critical: colors.red, warning: colors.amber, info: colors.blue };

function whenLabel(item) {
  if (item.days === null || item.days === undefined) return item.dueDate || "";
  if (item.days < 0) return `${Math.abs(item.days)} day${Math.abs(item.days) === 1 ? "" : "s"} overdue`;
  if (item.days === 0) return "Due today";
  if (item.days === 1) return "Due tomorrow";
  return `Due in ${item.days} days`;
}

export function Reminders() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const load = () =>
    api
      .get("/api/reminders")
      .then(setData)
      .catch((err) => setError(err.message || "Could not load reminders."));
  useEffect(() => {
    load();
  }, []);
  if (error) return <Screen title="Reminders"><ErrorBox message={error} /></Screen>;
  if (!data) return <Screen title="Reminders"><Loader /></Screen>;
  const items = filter === "all" ? data.items : data.items.filter((i) => i.type === filter);
  return (
    <Screen title="Reminders" onRefresh={load}>
      <Note icon="bell">
        {data.counts.overdue} overdue · {data.counts.dueSoon} due soon
      </Note>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TYPES.map((t) => (
          <Chip key={t.key} label={t.label} count={t.key === "all" ? data.counts.total : data.byType[t.key] || 0} active={filter === t.key} onPress={() => setFilter(t.key)} />
        ))}
      </ScrollView>
      {items.length === 0 ? (
        <Empty icon="checkCircle" text="Nothing needs attention here." />
      ) : (
        items.map((item, i) => {
          const c = SEVERITY[item.severity] || colors.textMuted;
          return (
            <Card key={`${item.type}-${i}`} onPress={item.link ? () => navigate(item.link) : undefined} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${c}22`, alignItems: "center", justifyContent: "center" }}>
                <Icon name={ICON_FOR[item.type] || "bell"} size={16} color={c} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "700", color: colors.text }}>{item.title}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.subtitle}</Text>
              </View>
              <Text style={{ color: c, fontSize: 12, fontWeight: "700", maxWidth: 90, textAlign: "right" }}>{whenLabel(item)}</Text>
            </Card>
          );
        })
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------- AI Assistant
const EXAMPLES = [
  "Which customers have unpaid invoices?",
  "Show sales orders pending dispatch",
  "Top 10 customers by outstanding amount",
  "Invoices created in the last 7 days",
  "Items below minimum stock level",
  "Purchase orders that are still in draft",
];
const MONEY_KEYS = new Set(["amount", "paidAmount", "balance", "outstanding", "subTotal", "taxTotal", "sellingPrice", "purchasePrice", "unitPrice"]);
const fmtCell = (k, v) => (v == null || v === "" ? "—" : MONEY_KEYS.has(k) && typeof v === "number" ? `₹${v.toLocaleString("en-IN")}` : typeof v === "object" ? JSON.stringify(v) : String(v));

function ResultRows({ rows }) {
  if (!rows || !rows.length) return null;
  return (
    <View style={{ gap: 8, marginTop: 10 }}>
      {rows.slice(0, 50).map((r, i) => {
        const keys = Object.keys(r);
        return (
          <View key={i} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, flexDirection: "row", flexWrap: "wrap", rowGap: 4 }}>
            {keys.map((k) => (
              <View key={k} style={{ width: "50%", paddingRight: 6 }}>
                <Text style={{ fontSize: 10, color: colors.textMuted }}>{k}</Text>
                <Text style={{ fontSize: 13 }}>{fmtCell(k, r[k])}</Text>
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

export function AiAssistant() {
  const primary = usePrimary();
  const [configured, setConfigured] = useState(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [thread, setThread] = useState([]);
  useEffect(() => {
    api
      .get("/api/ai/status")
      .then((s) => setConfigured(Boolean(s && s.configured)))
      .catch(() => setConfigured(false));
  }, []);
  const ask = async (text) => {
    const q = (text ?? question).trim();
    if (!q || busy) return;
    setBusy(true);
    setQuestion("");
    setThread((t) => [{ q, pending: true }, ...t]);
    try {
      const res = await api.post("/api/ai/ask", { question: q });
      setThread((t) => t.map((it, i) => (i === 0 ? { q, a: res.answer, executed: res.executed || [], rows: res.rows || [] } : it)));
    } catch (err) {
      setThread((t) => t.map((it, i) => (i === 0 ? { q, error: err.message || "Something went wrong." } : it)));
    } finally {
      setBusy(false);
    }
  };
  const disabled = configured === false || busy;
  return (
    <Screen title="AI Assistant">
      {configured === false ? (
        <Note icon="info">AI Assistant is coming soon. We're getting it ready, and you'll be able to ask questions about your sales, customers and stock here shortly.</Note>
      ) : null}
      <Card>
        <Input value={question} onChangeText={setQuestion} multiline placeholder="e.g. Which customers have not paid their invoices?" editable={!disabled} />
        <Button title={busy ? "Thinking…" : "Ask"} icon="send" onPress={() => ask()} disabled={disabled || !question.trim()} loading={busy} style={{ marginTop: 10 }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
          {EXAMPLES.map((ex) => (
            <Pressable key={ex} disabled={disabled} onPress={() => ask(ex)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, opacity: disabled ? 0.5 : 1 }}>
              <Text style={{ fontSize: 12, color: primary }}>{ex}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      {thread.map((item, i) => (
        <Card key={thread.length - i}>
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
            <Icon name="user" size={14} color={colors.textMuted} />
            <Text style={{ fontWeight: "700", flex: 1 }}>{item.q}</Text>
          </View>
          {item.pending ? (
            <Loader style={{ padding: 8 }} />
          ) : item.error ? (
            <ErrorBox message={item.error} />
          ) : (
            <>
              <Text selectable style={{ color: colors.text, lineHeight: 20 }}>
                {item.a}
              </Text>
              <ResultRows rows={item.rows} />
              {item.executed && item.executed.length ? (
                <Text style={{ color: colors.textLight, fontSize: 11, marginTop: 8 }}>{item.executed.map((e) => `${e.count} ${e.collection} matched`).join(" · ")}</Text>
              ) : null}
            </>
          )}
        </Card>
      ))}
    </Screen>
  );
}

// ---------------------------------------------------------------- AI payment reminder
export function AiReminder() {
  const { state } = useLocation();
  const { toast } = useFeedback();
  const customer = state && state.customer;
  const phone = (state && state.phone) || "";
  const [email, setEmail] = useState((state && state.email) || "");
  const [channel, setChannel] = useState("whatsapp");
  const [tone, setTone] = useState("polite");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [meta, setMeta] = useState(null);

  // The invoice list doesn't carry the customer's email — look it up.
  useEffect(() => {
    if (!customer || email) return;
    api
      .get(`/api/customers?page=1&pageSize=5&search=${encodeURIComponent(customer)}`)
      .then((r) => {
        const m = (r.data || []).find((c) => c.name === customer);
        if (m && m.email) setEmail(m.email);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer]);

  if (!customer) return <Screen title="Payment Reminder"><ErrorBox message="Open this from a customer or an invoice." /></Screen>;

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.post("/api/ai/payment-reminder", { customer, channel, tone });
      setSubject(res.subject || "");
      setMessage(res.message || "");
      setMeta({ outstanding: res.outstanding || 0, invoiceCount: res.invoiceCount || 0 });
    } catch (err) {
      setError(err.message || "Could not generate a reminder.");
    } finally {
      setBusy(false);
    }
  };

  const send = () => {
    if (channel === "whatsapp") {
      const num = String(phone || "").replace(/\D/g, "");
      const to = num ? (num.length === 10 ? `91${num}` : num) : "";
      Linking.openURL(`https://wa.me/${to}?text=${encodeURIComponent(message)}`).catch(() => toast("Could not open WhatsApp."));
    } else {
      Linking.openURL(`mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`).catch(() => toast("No email app found."));
    }
  };

  return (
    <Screen title="Payment Reminder">
      <Card>
        <SectionTitle>{customer}</SectionTitle>
        <FieldLabel label="Channel" />
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          <Chip label="WhatsApp" active={channel === "whatsapp"} onPress={() => setChannel("whatsapp")} />
          <Chip label="Email" active={channel === "email"} onPress={() => setChannel("email")} />
        </View>
        <FieldLabel label="Tone" />
        <SearchableSelect
          value={tone}
          onChange={setTone}
          options={[
            { label: "Polite", value: "polite" },
            { label: "Friendly", value: "friendly" },
            { label: "Firm", value: "firm" },
          ]}
          title="Tone"
          searchable={false}
        />
        <Button title={busy ? "Generating…" : message ? "Regenerate" : "Generate with AI"} icon="sparkles" loading={busy} onPress={generate} style={{ marginTop: 12 }} />
        <ErrorBox message={error} style={{ marginTop: 10 }} />
        {meta ? (
          <Text style={{ color: colors.textMuted, marginTop: 10 }}>
            {meta.invoiceCount} unpaid invoice{meta.invoiceCount === 1 ? "" : "s"} · outstanding ₹{Number(meta.outstanding).toLocaleString("en-IN")}
          </Text>
        ) : null}
      </Card>
      {message ? (
        <Card>
          {channel === "email" ? (
            <>
              <FieldLabel label="Subject" />
              <Input value={subject} onChangeText={setSubject} style={{ marginBottom: 12 }} />
            </>
          ) : null}
          <FieldLabel label="Message" />
          <Input value={message} onChangeText={setMessage} multiline style={{ minHeight: 160 }} />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Button title="Share" icon="share" variant="secondary" style={{ flex: 1 }} onPress={() => Share.share({ message: subject ? `${subject}\n\n${message}` : message })} />
            <Button title={channel === "whatsapp" ? "Open WhatsApp" : "Open Email"} icon={channel === "whatsapp" ? "whatsapp" : "mail"} style={{ flex: 1 }} onPress={send} />
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------- Maintenance
export function ServiceDue() {
  return (
    <ListScreen
      title="Service Due"
      endpoint="/api/maintenance"
      params={{ view: "due" }}
      card={(r) => ({
        title: r.asset,
        subtitle: [r.id, r.type].filter(Boolean).join(" · "),
        meta: [
          { icon: "calendar", text: r.scheduledDate },
          { icon: "user", text: r.assignedTo },
        ],
        status: r.status,
        icon: "tool",
      })}
      addConfig={{
        buttonLabel: "+ New Task",
        modalTitle: "New Maintenance Task",
        successMessage: "Maintenance task scheduled.",
        fields: [
          { key: "asset", label: "Asset", required: true, placeholder: "Enter your asset" },
          { key: "type", label: "Type", type: "select", options: ["Preventive", "Corrective", "Inspection"] },
          { key: "assignedTo", label: "Assigned To", placeholder: "Enter your assigned to" },
        ],
      }}
    />
  );
}

export function ServiceHistory() {
  return (
    <ListScreen
      title="Service History"
      endpoint="/api/maintenance"
      params={{ view: "history" }}
      canAdd={false}
      card={(r) => ({
        title: r.asset,
        subtitle: [r.id, r.type].filter(Boolean).join(" · "),
        meta: [
          { icon: "calendar", label: "Completed", text: r.scheduledDate },
          { icon: "user", text: r.assignedTo },
        ],
        status: r.status,
        icon: "tool",
      })}
    />
  );
}

// ---------------------------------------------------------------- Global search
// Results open the record itself where the result identifies it.
function pathFor(r) {
  const idFromSub = String(r.sub || "").split(" · ")[0];
  switch (r.type) {
    case "Customer":
      return idFromSub ? `/customers/${encodeURIComponent(idFromSub)}` : "/customers";
    case "Supplier":
      return idFromSub ? `/suppliers/${encodeURIComponent(idFromSub)}` : "/suppliers";
    case "Sales Order":
      return `/sales/orders/${encodeURIComponent(r.label)}`;
    case "Purchase Order":
      return `/purchase/orders/${encodeURIComponent(r.label)}`;
    case "Sales Invoice":
      return `/sales/invoices/${encodeURIComponent(r.label)}`;
    default:
      return r.path;
  }
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);
  const onChange = (v) => {
    setQ(v);
    clearTimeout(timer.current);
    if (v.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const r = await api.get(`/api/search?q=${encodeURIComponent(v.trim())}`);
        setResults(r.results || []);
      } catch (_) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };
  return (
    <Screen title="Search">
      <Input value={q} onChangeText={onChange} placeholder="Search customers, items, orders, invoices…" autoFocus autoCorrect={false} />
      {loading ? <Loader /> : null}
      {!loading && q.trim().length >= 2 && results.length === 0 ? <Empty icon="search" text="No matches." /> : null}
      {results.map((r, i) => (
        <Card key={`${r.type}-${r.label}-${i}`} onPress={() => navigate(pathFor(r))} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700" }}>{r.label}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{r.sub}</Text>
          </View>
          <Text style={{ color: colors.primary, fontSize: 11, fontWeight: "700" }}>{r.type}</Text>
        </Card>
      ))}
    </Screen>
  );
}
