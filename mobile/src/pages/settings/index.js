import { useEffect, useState } from "react";
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import api, { clearSettingsCache } from "../../api/client";
import Screen from "../../components/layout/Screen";
import { Button, Card, Empty, ErrorBox, Icon, IconButton, Loader, Note, SectionTitle, useFeedback, usePrimary } from "../../components/ui";
import { CheckboxField, FieldLabel, Input, SearchableSelect } from "../../components/forms";
import { usePermissions } from "../../context/SessionContext";
import { useNavigate } from "../../navigation/router";
import { colors } from "../../theme";

// Ports of pages/settings/* — each web settings tab is its own screen here,
// reached from the Settings index (which shows only the tabs this user's
// menu permissions allow, like the web SettingsTabs).

const TABS = [
  { key: "company", label: "Company", icon: "store", menu: "settings:company", sub: "Name, GSTIN, address, bank, logo & signature" },
  { key: "numbering", label: "Numbering", icon: "tag", menu: "settings:numbering", sub: "Invoice, order and code number series" },
  { key: "invoice-theme", label: "Invoice Theme", icon: "palette", menu: "settings:invoice-theme", sub: "How printed invoices look" },
  { key: "general", label: "General", icon: "settings", menu: "settings:general", sub: "Currency, fiscal year, date format" },
  { key: "email", label: "Email", icon: "mail", menu: "settings:email", sub: "Outgoing mail server (SMTP)" },
  { key: "whatsapp", label: "WhatsApp", icon: "whatsapp", menu: "settings:whatsapp", sub: "WhatsApp Business API connection" },
  { key: "tax", label: "Tax", icon: "banknote", menu: "settings:tax", sub: "Tax name, default rate, registration" },
  { key: "backup", label: "Backup & Restore", icon: "download", menu: "settings:backup", sub: "Export a full backup file" },
  { key: "custom-fields", label: "Custom Fields", icon: "edit", menu: "settings:custom-fields", sub: "Add your own fields to a menu's form" },
];

export function SettingsHome() {
  const { can } = usePermissions();
  const navigate = useNavigate();
  const primary = usePrimary();
  const visible = TABS.filter((t) => can(t.menu, "view"));
  return (
    <Screen title="Settings">
      {visible.length === 0 ? <Note>Your role has no settings pages.</Note> : null}
      {visible.map((t) => (
        <Card key={t.key} onPress={() => navigate(`/settings/${t.key}`)} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: `${primary}1A`, alignItems: "center", justifyContent: "center" }}>
            <Icon name={t.icon} color={primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: "700", fontSize: 15, color: colors.text }}>{t.label}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t.sub}</Text>
          </View>
          <Icon name="chevronRight" color={colors.textLight} />
        </Card>
      ))}
    </Screen>
  );
}

// ---------------------------------------------------------------- generic section (SettingsSectionPage port)

function useSettingsForm() {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api
      .get("/api/settings")
      .then((s) => {
        setSettings(s);
        setSaved(s);
      })
      .catch((err) => setError(err.message || "Could not load settings."));
  }, []);
  return { settings, setSettings, saved, setSaved, error, setError };
}

async function pickImage() {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true, allowsEditing: false });
  if (res.canceled || !res.assets || !res.assets[0]) return null;
  const a = res.assets[0];
  if (a.fileSize && a.fileSize > 5 * 1024 * 1024) throw new Error("That image is too large. Please choose a file under 5MB.");
  if (a.base64) return `data:${a.mimeType || "image/jpeg"};base64,${a.base64}`;
  return a.uri; // web returns a data: URI here
}

function SettingsSection({ title, sectionTitle, fields, imageFields = [], note }) {
  const { settings, setSettings, saved, setSaved, error, setError } = useSettingsForm();
  const { toast } = useFeedback();
  const [saving, setSaving] = useState(false);
  if (!settings) return <Screen title={title}>{error ? <ErrorBox message={error} /> : <Loader />}</Screen>;

  const set = (key, type) => (v) => setSettings((s) => ({ ...s, [key]: type === "phone" ? String(v).replace(/\D/g, "").slice(0, 10) : v }));

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      const result = await api.put("/api/settings", settings);
      setSaved(result || settings);
      setSettings(result || settings);
      toast("Settings saved.");
    } catch (err) {
      setError(err.message || "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title={title}>
      <Card>
        <SectionTitle>{sectionTitle}</SectionTitle>
        {note ? <Note>{note}</Note> : null}
        <ErrorBox message={error} />
        {imageFields.map((img) => (
          <View key={img.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <View style={{ width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", backgroundColor: "#fafbfc", overflow: "hidden" }}>
              {settings[img.key] ? <Image source={{ uri: settings[img.key] }} style={{ width: 68, height: 68 }} resizeMode="contain" /> : <Icon name="image" color={colors.textLight} />}
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ fontWeight: "600" }}>{img.label}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Button
                  small
                  variant="secondary"
                  icon="upload"
                  title={settings[img.key] ? "Change" : "Upload"}
                  onPress={async () => {
                    try {
                      const uri = await pickImage();
                      if (uri) setSettings((s) => ({ ...s, [img.key]: uri }));
                    } catch (err) {
                      setError(err.message);
                    }
                  }}
                />
                {settings[img.key] ? <Button small variant="secondary" icon="trash" title="Remove" onPress={() => setSettings((s) => ({ ...s, [img.key]: "" }))} /> : null}
              </View>
            </View>
          </View>
        ))}
        {fields.map(([key, label, type]) => (
          <View key={key} style={{ marginBottom: 14 }}>
            <FieldLabel label={label} />
            {Array.isArray(type) ? (
              <SearchableSelect value={settings[key] ?? ""} onChange={set(key)} options={type} title={label} placeholder="— Select —" />
            ) : (
              <Input
                value={settings[key] ?? ""}
                onChangeText={set(key, type)}
                keyboardType={type === "phone" ? "number-pad" : type === "number" ? "decimal-pad" : type === "email" ? "email-address" : "default"}
                secureTextEntry={type === "password"}
                autoCapitalize={type === "password" || type === "email" ? "none" : "sentences"}
                multiline={type === "multiline"}
              />
            )}
          </View>
        ))}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setSettings(saved)} disabled={saving} />
          <Button title="Save Changes" style={{ flex: 1 }} loading={saving} onPress={save} />
        </View>
      </Card>
    </Screen>
  );
}

export const CompanySettings = () => (
  <SettingsSection
    title="Company Settings"
    sectionTitle="Company Information"
    fields={[
      ["companyName", "Company Name"],
      ["legalName", "Legal Name"],
      ["gstin", "GSTIN"],
      ["phone", "Mobile No", "phone"],
      ["email", "Email", "email"],
      ["website", "Website"],
      ["address", "Address", "multiline"],
      ["bankAccountName", "Account Holder Name"],
      ["bankName", "Bank Name"],
      ["bankAccountNumber", "Bank Account Number"],
      ["bankIfsc", "IFSC Code"],
    ]}
    imageFields={[
      { key: "logo", label: "Company Logo" },
      { key: "signature", label: "Authorized Signature" },
      { key: "seal", label: "Company Seal / Stamp" },
    ]}
  />
);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const PAYMENT_TERMS = ["Immediate", "7 Days", "15 Days", "30 Days", "45 Days", "60 Days", "90 Days"];
export const GeneralSettings = () => (
  <SettingsSection
    title="General Settings"
    sectionTitle="General Preferences"
    fields={[
      ["currency", "Currency", ["INR (₹)", "USD ($)", "EUR (€)", "GBP (£)", "AED (د.إ)", "SGD (S$)"]],
      ["fiscalYearStart", "Fiscal Year Start", MONTHS],
      ["timezone", "Timezone", ["Asia/Kolkata (IST)", "Asia/Dubai (GST)", "Asia/Singapore (SGT)", "Europe/London (GMT)", "America/New_York (EST)", "UTC"]],
      ["dateFormat", "Date Format", ["DD MMM YYYY", "DD-MM-YYYY", "DD/MM/YYYY", "DD.MM.YYYY", "DD.MM.YY", "DD-MMM-YYYY", "MM/DD/YYYY", "MMM DD, YYYY", "YYYY-MM-DD"]],
      ["salesPaymentTerms", "Default Sales Payment Terms", PAYMENT_TERMS],
      ["purchasePaymentTerms", "Default Purchase Payment Terms", PAYMENT_TERMS],
      ["reminderDueSoonDays", "Remind Me This Many Days Ahead", "number"],
    ]}
  />
);

export const EmailSettings = () => (
  <SettingsSection
    title="Email Settings"
    sectionTitle="Outgoing Email (SMTP)"
    fields={[
      ["smtpHost", "SMTP Host"],
      ["smtpPort", "SMTP Port", "number"],
      ["smtpUser", "SMTP Username", "email"],
      ["smtpPassword", "SMTP Password (leave blank to keep the saved one)", "password"],
      ["fromEmail", "From Email", "email"],
    ]}
  />
);

export const TaxSettings = () => (
  <SettingsSection
    title="Tax Settings"
    sectionTitle="Tax Configuration"
    fields={[
      ["taxName", "Tax Name"],
      ["defaultTaxRate", "Default Tax Rate (%)", "number"],
      ["taxRegistrationNo", "Tax Registration No."],
    ]}
  />
);

// ---------------------------------------------------------------- numbering
const DOC_TYPES = [
  { key: "invoice", label: "Invoice", example: "SIS/26-27/" },
  { key: "salesOrder", label: "Sales Order", example: "SO/26-27/" },
  { key: "purchaseOrder", label: "Purchase Order", example: "PO/26-27/" },
  { key: "quotation", label: "Quotation", example: "RFQ/26-27/" },
  { key: "deliveryChallan", label: "Delivery Challan", example: "DC/26-27/" },
  { key: "customerCode", label: "Customer Code", example: "CUST-" },
  { key: "supplierCode", label: "Supplier Code", example: "SUP-" },
];
const preview = (prefix, next, digits) => {
  const n = Number(next);
  const d = Math.min(Math.max(Number(digits) || 4, 1), 12);
  return `${prefix || ""}${String(Number.isFinite(n) && n > 0 ? n : 1).padStart(d, "0")}`;
};

export function NumberingSettings() {
  const { settings, setSettings, saved, setSaved, error, setError } = useSettingsForm();
  const { toast } = useFeedback();
  const [saving, setSaving] = useState(false);
  if (!settings) return <Screen title="Numbering">{error ? <ErrorBox message={error} /> : <Loader />}</Screen>;
  const val = (k, d) => (settings[k] == null ? d : settings[k]);
  const set = (k) => (v) => setSettings((s) => ({ ...s, [k]: v }));
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const payload = { ...settings };
      DOC_TYPES.forEach(({ key }) => {
        payload[`${key}NextNumber`] = Number(payload[`${key}NextNumber`]) || 1;
        payload[`${key}Digits`] = Number(payload[`${key}Digits`]) || 4;
      });
      await api.put("/api/settings", payload);
      setSettings(payload);
      setSaved(payload);
      toast("Numbering saved.");
    } catch (err) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen title="Numbering Settings">
      <ErrorBox message={error} />
      {DOC_TYPES.map(({ key, label, example }) => {
        const prefix = val(`${key}Prefix`, "");
        const next = val(`${key}NextNumber`, 1);
        const digits = val(`${key}Digits`, 4);
        return (
          <Card key={key}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Text style={{ flex: 1, fontWeight: "700", fontSize: 15 }}>{label}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>Next: </Text>
              <Text style={{ fontWeight: "800", color: colors.primary }}>{preview(prefix, next, digits)}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 2 }}>
                <FieldLabel label="Prefix" />
                <Input value={prefix} onChangeText={set(`${key}Prefix`)} placeholder={example} autoCapitalize="characters" />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel label="Start" />
                <Input value={String(next)} onChangeText={set(`${key}NextNumber`)} keyboardType="number-pad" />
              </View>
              <View style={{ flex: 1 }}>
                <FieldLabel label="Digits" />
                <Input value={String(digits)} onChangeText={set(`${key}Digits`)} keyboardType="number-pad" />
              </View>
            </View>
          </Card>
        );
      })}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setSettings(saved)} disabled={saving} />
        <Button title="Save Changes" style={{ flex: 1 }} loading={saving} onPress={save} />
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------- invoice theme
const ACCENTS = [
  { value: "#2f4a7d", label: "Indigo" },
  { value: "#1f6b63", label: "Teal" },
  { value: "#8c2f39", label: "Maroon" },
  { value: "#1a1a1a", label: "Black" },
  { value: "#2b5d34", label: "Forest" },
  { value: "#7a4a1e", label: "Bronze" },
];
const TIER_LABEL = { basic: "Basic", advanced: "Advanced", premium: "Premium" };

export function InvoiceThemeSettings() {
  const { toast } = useFeedback();
  const primary = usePrimary();
  const [info, setInfo] = useState(null);
  const [theme, setTheme] = useState("");
  const [accent, setAccent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = () =>
    api
      .get("/api/invoice-themes")
      .then((d) => {
        setInfo(d);
        setTheme(d.theme);
        setAccent(d.accent);
      })
      .catch((err) => setError(err.message || "Could not load invoice themes."));
  useEffect(() => {
    load();
  }, []);
  if (!info) return <Screen title="Invoice Theme">{error ? <ErrorBox message={error} /> : <Loader />}</Screen>;
  const dirty = theme !== info.theme || accent !== info.accent;
  const locked = info.themes.length - info.allowed.length;
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const body = { invoiceTheme: theme };
      if (info.canPickAccent) body.invoiceAccent = accent;
      await api.put("/api/settings", body);
      clearSettingsCache();
      toast("Invoice theme saved.");
      setInfo((i) => ({ ...i, theme, accent }));
    } catch (err) {
      setError(err.message || "Could not save the invoice theme.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Screen title="Invoice Theme">
      <ErrorBox message={error} />
      <Note>
        {TIER_LABEL[info.tier] || info.tier}
        {info.planName ? ` · ${info.planName} plan` : ""}. PDFs made on the phone use the standard GST layout; this choice applies to invoices printed from the web app.
      </Note>
      {info.themes.map((t) => {
        const isLocked = !info.allowed.includes(t.key);
        const active = theme === t.key;
        return (
          <Card key={t.key} onPress={isLocked ? undefined : () => setTheme(t.key)} style={[{ flexDirection: "row", alignItems: "center", gap: 12 }, active && { borderColor: primary, borderWidth: 2 }, isLocked && { opacity: 0.55 }]}>
            <Icon name={isLocked ? "lock" : active ? "checkCircle" : "file"} color={active ? primary : colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "700" }}>{t.label}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t.description}</Text>
            </View>
            {isLocked ? <Text style={{ fontSize: 11, color: colors.purple, fontWeight: "700" }}>{TIER_LABEL[t.tier]}</Text> : null}
          </Card>
        );
      })}
      {locked > 0 ? <Text style={{ color: colors.textMuted }}>{locked} theme{locked === 1 ? "" : "s"} are available on a higher plan. Contact TechB Software Solutions to upgrade.</Text> : null}
      <Card>
        <SectionTitle>Colour</SectionTitle>
        {info.canPickAccent ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {ACCENTS.map((a) => (
              <Pressable key={a.value} onPress={() => setAccent(a.value)} style={{ alignItems: "center", gap: 4, width: 64 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: a.value, borderWidth: accent === a.value ? 3 : 0, borderColor: primary }} />
                <Text style={{ fontSize: 11 }}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={{ color: colors.textMuted }}>Invoices print in the standard colour on this plan.</Text>
        )}
      </Card>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={load} disabled={saving || !dirty} />
        <Button title="Save Theme" style={{ flex: 1 }} loading={saving} onPress={save} disabled={!dirty} />
      </View>
    </Screen>
  );
}

// ---------------------------------------------------------------- whatsapp
const TEMPLATE_BODY = "Hello {{1}}, please find your {{2}} for {{3}} attached. Thank you, {{4}}.";

export function WhatsAppSettings() {
  const { toast } = useFeedback();
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
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
  if (!settings) return <Screen title="WhatsApp"><Loader /></Screen>;
  const tokenSaved = Boolean(settings.waAccessTokenSet);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v.trimStart() }));

  const save = async () => {
    setError("");
    if (form.waStatus === "Enabled" && (!form.waPhoneNumberId.trim() || (!tokenSaved && !token.trim()) || !form.waTemplateName.trim())) {
      setError("To enable WhatsApp, fill in the Phone Number ID, Access Token and Template name.");
      return false;
    }
    setBusy("save");
    try {
      const payload = { ...form, waPhoneNumberId: form.waPhoneNumberId.trim(), waBusinessAccountId: form.waBusinessAccountId.trim(), waTemplateName: form.waTemplateName.trim(), waTemplateLang: form.waTemplateLang.trim() || "en" };
      if (token.trim()) payload.waAccessToken = token.trim();
      const saved = await api.put("/api/settings", payload);
      clearSettingsCache();
      setSettings(saved);
      setToken("");
      toast("WhatsApp settings saved.");
      return true;
    } catch (err) {
      setError(err.message || "Could not save the WhatsApp settings.");
      return false;
    } finally {
      setBusy("");
    }
  };

  const test = async () => {
    setResult(null);
    if (!(await save())) return;
    setBusy("test");
    try {
      setResult(await api.post("/api/whatsapp/test", {}));
    } catch (err) {
      setError(err.message || "The connection test failed.");
    } finally {
      setBusy("");
    }
  };

  const field = (k, label, props = {}) => (
    <View style={{ marginBottom: 14 }} key={k}>
      <FieldLabel label={label} />
      <Input value={form[k]} onChangeText={set(k)} autoCapitalize="none" autoCorrect={false} {...props} />
    </View>
  );

  return (
    <Screen title="WhatsApp Settings">
      <Card>
        <SectionTitle>WhatsApp Business connection</SectionTitle>
        <ErrorBox message={error} />
        {result ? (
          <Note icon="checkCircle">
            Connected — {result.verifiedName || "your business"} {result.displayPhoneNumber ? `(${result.displayPhoneNumber})` : ""}
            {result.quality ? ` · quality ${String(result.quality).toLowerCase()}` : ""}
          </Note>
        ) : null}
        <View style={{ marginBottom: 14 }}>
          <FieldLabel label="Status" />
          <SearchableSelect value={form.waStatus} onChange={(v) => setForm((f) => ({ ...f, waStatus: v }))} options={["Disabled", "Enabled"]} title="Status" searchable={false} />
        </View>
        {field("waPhoneNumberId", "Phone Number ID", { placeholder: "e.g. 109876543210987", keyboardType: "number-pad" })}
        {field("waBusinessAccountId", "WhatsApp Business Account ID", { placeholder: "e.g. 123456789012345", keyboardType: "number-pad" })}
        <View style={{ marginBottom: 14 }}>
          <FieldLabel label={`Access Token${tokenSaved ? " (a token is saved)" : ""}`} />
          <Input value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" placeholder={tokenSaved ? "Leave blank to keep the saved token" : "Paste the permanent access token"} />
        </View>
        {field("waTemplateName", "Template name", { placeholder: "document_share" })}
        {field("waTemplateLang", "Template language code", { placeholder: "en" })}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button title="Save & test" variant="secondary" style={{ flex: 1 }} loading={busy === "test"} disabled={!!busy} onPress={test} />
          <Button title="Save Changes" style={{ flex: 1 }} loading={busy === "save"} disabled={!!busy} onPress={save} />
        </View>
      </Card>
      <Card>
        <SectionTitle>How to set it up</SectionTitle>
        {[
          "Open Meta Business Suite → WhatsApp Manager and add your business phone number to a WhatsApp Business Account.",
          "Under API Setup, copy the Phone number ID and the WhatsApp Business Account ID into the boxes above.",
          "Create a permanent token: Business Settings → System users → Generate token with whatsapp_business_messaging and whatsapp_business_management. Paste it as the Access Token.",
          "In WhatsApp Manager → Message templates, create a Utility template named document_share (English), Header = Document, with the body below. Wait for approval.",
          "Come back, Save, then Test. When it succeeds, set Status to Enabled and save again.",
        ].map((s, i) => (
          <Text key={i} style={{ color: colors.textMuted, marginBottom: 6 }}>
            {i + 1}. {s}
          </Text>
        ))}
        <Text style={{ fontWeight: "600", marginTop: 6 }}>Template body (copy exactly)</Text>
        <Text selectable style={{ backgroundColor: colors.bg, borderRadius: 8, padding: 10, marginTop: 6 }}>{TEMPLATE_BODY}</Text>
      </Card>
    </Screen>
  );
}

// ---------------------------------------------------------------- backup
export function BackupSettings() {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const exportBackup = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.raw("/api/backup/export");
      if (!res.ok) {
        let msg = "Could not create the backup. Please try again.";
        try {
          msg = (await res.json()).message || msg;
        } catch (_) {
          // keep default
        }
        throw new Error(msg);
      }
      const disposition = res.headers.get("Content-Disposition") || "";
      const name = (/filename="?([^";]+)"?/.exec(disposition) || [])[1] || "siperp-backup.json";
      const text = await res.text();
      if (Platform.OS === "web") {
        const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
      } else {
        const FS = require("expo-file-system/legacy");
        const uri = `${FS.cacheDirectory}${name}`;
        await FS.writeAsStringAsync(uri, text);
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/json", dialogTitle: name });
      }
      toast(`Backup ready: ${name}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen title="Backup & Restore">
      <Card>
        <SectionTitle>Export Data</SectionTitle>
        <Text style={{ color: colors.textMuted, marginBottom: 10 }}>
          Create a backup file (JSON) of your company's data and save or send it somewhere safe — it is a complete copy of your records.
        </Text>
        {[
          "Customers and suppliers, with their groups",
          "Categories, brands, warehouses and items",
          "Purchase orders, goods receipts, invoices and returns",
          "Sales orders, enquiries, quotations, delivery challans, invoices and returns",
          "Stock movements, ledger entries and maintenance tasks",
          "Manufacturing: BOMs, work centres, machines, work orders, job cards, material issues and production receipts",
          "Users (without passwords), roles and company settings",
        ].map((l) => (
          <Text key={l} style={{ color: colors.textMuted, fontSize: 13 }}>
            • {l}
          </Text>
        ))}
        <Text style={{ color: colors.textLight, fontSize: 12, marginVertical: 10 }}>Passwords and the email-server password are never written to the file.</Text>
        <ErrorBox message={error} />
        <Button title={busy ? "Preparing backup…" : "Export Full Backup"} icon="download" loading={busy} onPress={exportBackup} />
      </Card>
      <Card>
        <SectionTitle>Restore Data</SectionTitle>
        <Text style={{ color: colors.textMuted }}>Restoring from a backup file isn't available yet (on the web either).</Text>
      </Card>
    </Screen>
  );
}

// ---------------------------------------------------------------- custom fields
// Port of pages/settings/CustomFields.jsx. Same entity groups, same
// label/key/type/options/required shape — the backend route (and the CUSTOM_FIELD_ENTITIES
// allowlist) is shared with the web app, so a field added here shows up there too.
// (Warehouse is left out for the same reason as the web page: it has no Add/Edit
// screen of its own, only a name-only quick-create, so there's nowhere for the field to show.)
const CF_ENTITY_GROUPS = [
  {
    group: "Master Data",
    entities: [
      { key: "customer", label: "Customers" },
      { key: "supplier", label: "Suppliers" },
      { key: "item", label: "Items" },
      { key: "category", label: "Categories" },
      { key: "brand", label: "Brands" },
    ],
  },
  {
    group: "Sales",
    entities: [
      { key: "enquiry", label: "Enquiries" },
      { key: "quotation", label: "Quotations" },
      { key: "sales-order", label: "Sales Orders" },
      { key: "delivery-challan", label: "Delivery Challan" },
      { key: "sales-invoice", label: "Sales Invoices" },
      { key: "sales-return", label: "Sales Return" },
    ],
  },
  {
    group: "Purchase",
    entities: [
      { key: "purchase-order", label: "Purchase Orders" },
      { key: "goods-receipt", label: "Goods Receipt" },
      { key: "purchase-invoice", label: "Purchase Invoices" },
      { key: "purchase-return", label: "Purchase Return" },
    ],
  },
  {
    group: "Manufacturing",
    entities: [
      { key: "bom", label: "Bill of Materials" },
      { key: "work-order", label: "Work Orders" },
      { key: "job-card", label: "Job Cards" },
      { key: "work-center", label: "Work Centers" },
      { key: "machine", label: "Machines" },
    ],
  },
  { group: "Other", entities: [{ key: "maintenance-task", label: "Maintenance Tasks" }] },
];
const CF_ENTITIES = CF_ENTITY_GROUPS.flatMap((g) => g.entities);
const CF_ENTITY_OPTIONS = CF_ENTITIES.map((e) => ({ label: e.label, value: e.key }));

const CF_TYPE_OPTIONS = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Long Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Dropdown" },
];
const CF_TYPE_LABEL = Object.fromEntries(CF_TYPE_OPTIONS.map((t) => [t.value, t.label]));

const CF_BLANK_FORM = { label: "", type: "text", options: "", required: false };

export function CustomFieldsSettings() {
  const { toast, confirm } = useFeedback();
  const primary = usePrimary();
  const [entity, setEntity] = useState("customer");
  const [fields, setFields] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // field being edited, or {} for a new one
  const [form, setForm] = useState(CF_BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [movingId, setMovingId] = useState("");

  const load = () => {
    setFields(null);
    setError("");
    api
      .get(`/api/custom-fields?entity=${entity}`)
      .then((r) => setFields(r.fields || []))
      .catch((err) => setError(err.message || "Could not load custom fields."));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  const openAdd = () => {
    setForm(CF_BLANK_FORM);
    setFormError("");
    setEditing({});
  };

  const openEdit = (f) => {
    setForm({ label: f.label, type: f.type, options: (f.options || []).join(", "), required: f.required });
    setFormError("");
    setEditing(f);
  };

  const save = async () => {
    const label = form.label.trim();
    if (!label) return setFormError("Label is required.");
    if (form.type === "select" && !form.options.trim()) {
      return setFormError("Add at least one option, separated by commas.");
    }
    setSaving(true);
    setFormError("");
    const payload = {
      label,
      type: form.type,
      required: form.required,
      options: form.type === "select" ? form.options.split(",").map((o) => o.trim()).filter(Boolean) : [],
    };
    try {
      if (editing.id) {
        await api.put(`/api/custom-fields/${encodeURIComponent(editing.id)}`, payload);
      } else {
        await api.post("/api/custom-fields", { ...payload, entity });
      }
      setEditing(null);
      load();
      toast(editing.id ? "Field updated." : "Field added.");
    } catch (err) {
      setFormError(err.message || "Could not save this field.");
    } finally {
      setSaving(false);
    }
  };

  // Swaps this field's `order` with its neighbor — same reordering as the web page.
  const move = async (row, delta) => {
    if (movingId) return;
    const i = fields.findIndex((f) => f.id === row.id);
    const swap = fields[i + delta];
    if (!swap) return;
    setMovingId(row.id);
    try {
      await api.put(`/api/custom-fields/${encodeURIComponent(row.id)}`, { order: swap.order });
      await api.put(`/api/custom-fields/${encodeURIComponent(swap.id)}`, { order: row.order });
      load();
    } catch (err) {
      setError(err.message || "Could not reorder that field.");
    } finally {
      setMovingId("");
    }
  };

  const handleDelete = async (f) => {
    const ok = await confirm({
      title: "Delete this field?",
      message: `Remove "${f.label}" from the ${CF_ENTITIES.find((e) => e.key === entity).label} form. Values already saved under it stay on existing records, but won't be shown or editable anymore.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/api/custom-fields/${encodeURIComponent(f.id)}`);
      load();
      toast(`Removed "${f.label}".`);
    } catch (err) {
      setError(err.message || "Could not remove this field.");
    }
  };

  const entityLabel = CF_ENTITIES.find((e) => e.key === entity)?.label || entity;

  return (
    <Screen title="Custom Fields">
      <Card>
        <SectionTitle>Menu</SectionTitle>
        <SearchableSelect value={entity} onChange={setEntity} options={CF_ENTITY_OPTIONS} title="Menu" placeholder="Select a menu" />
      </Card>

      <Card>
        <SectionTitle right={<IconButton name="plus" color={primary} onPress={openAdd} label="Add Field" />}>Fields</SectionTitle>
        <ErrorBox message={error} />
        {fields === null ? (
          <Loader />
        ) : fields.length === 0 ? (
          <Empty text={`No custom fields on ${entityLabel} yet.`} />
        ) : (
          <View style={{ gap: 12 }}>
            {fields.map((f, i) => (
              <View key={f.id} style={cfStyles.row}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>{f.label}</Text>
                    <Text style={cfStyles.pill}>{f.key}</Text>
                    <Text style={cfStyles.pill}>{CF_TYPE_LABEL[f.type] || f.type}</Text>
                    {f.required ? <Text style={cfStyles.pill}>Required</Text> : null}
                  </View>
                  {f.type === "select" && f.options && f.options.length > 0 ? (
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Options: {f.options.join(", ")}</Text>
                  ) : null}
                </View>
                <View style={{ flexDirection: "row" }}>
                  <IconButton name="chevron-up" onPress={() => move(f, -1)} label="Move up" style={i === 0 && { opacity: 0.3 }} />
                  <IconButton name="chevronDown" onPress={() => move(f, 1)} label="Move down" style={i === fields.length - 1 && { opacity: 0.3 }} />
                  <IconButton name="edit" onPress={() => openEdit(f)} label="Edit" />
                  <IconButton name="trash" color={colors.red} onPress={() => handleDelete(f)} label="Delete" />
                </View>
              </View>
            ))}
          </View>
        )}
        <Button title="+ Add Field" style={{ marginTop: 14 }} onPress={openAdd} />
      </Card>

      <Modal visible={!!editing} animationType="slide" onRequestClose={() => setEditing(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>{editing && editing.id ? "Edit Field" : "Add Field"}</Text>
            <IconButton name="close" color={colors.text} onPress={() => setEditing(null)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <ErrorBox message={formError} />
            <View style={{ marginBottom: 14 }}>
              <FieldLabel label="Label" required />
              <Input value={form.label} onChangeText={(v) => setForm((s) => ({ ...s, label: v }))} placeholder="e.g. PAN Number" autoFocus />
            </View>
            <View style={{ marginBottom: 14 }}>
              <FieldLabel label="Field Type" required />
              <SearchableSelect value={form.type} onChange={(v) => setForm((s) => ({ ...s, type: v }))} options={CF_TYPE_OPTIONS} title="Field Type" searchable={false} />
            </View>
            {form.type === "select" ? (
              <View style={{ marginBottom: 14 }}>
                <FieldLabel label="Options (comma separated)" />
                <Input value={form.options} onChangeText={(v) => setForm((s) => ({ ...s, options: v }))} placeholder="e.g. Individual, Company, Trust" />
              </View>
            ) : null}
            <CheckboxField label="Required on the form" value={form.required} onChange={(v) => setForm((s) => ({ ...s, required: v }))} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setEditing(null)} disabled={saving} />
              <Button title={saving ? "Saving..." : editing && editing.id ? "Save Changes" : "Add Field"} style={{ flex: 1 }} loading={saving} onPress={save} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

const cfStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12 },
  pill: { fontSize: 11, color: colors.textMuted, backgroundColor: colors.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: "hidden" },
});
