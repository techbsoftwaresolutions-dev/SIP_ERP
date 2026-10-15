import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import FieldInput from "../components/FieldInput";
import { colors, radius } from "../theme";

const COMPANY_FIELDS = [
  { key: "companyName", label: "Company Name" },
  { key: "legalName", label: "Legal Name" },
  { key: "gstin", label: "GSTIN" },
  { key: "phone", label: "Mobile No", type: "phone" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "address", label: "Address" },
];

const NUMBERING_FIELDS = [
  { key: "invoicePrefix", label: "Invoice Prefix" },
  { key: "salesOrderPrefix", label: "Sales Order Prefix" },
  { key: "purchaseOrderPrefix", label: "Purchase Order Prefix" },
  { key: "quotationPrefix", label: "Quotation Prefix" },
  { key: "customerCodePrefix", label: "Customer Code Prefix" },
  { key: "supplierCodePrefix", label: "Supplier Code Prefix" },
];

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api.get("/api/settings");
      setSettings(r);
    } catch (err) {
      setError(err.message || "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const setField = (key, value) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const updated = await api.put("/api/settings", settings);
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Card style={{ marginBottom: 20 }}>
        <Text style={styles.profileName}>{user?.name || "Account"}</Text>
        <Text style={styles.profileRole}>{user?.role || "—"}</Text>
        <Text style={styles.profileEmail}>{user?.email || ""}</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </Card>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={{ color: colors.red, fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Company Settings</Text>
      <Card>
        {COMPANY_FIELDS.map((f) => (
          <FieldInput key={f.key} field={f} value={settings[f.key]} onChange={(v) => setField(f.key, v)} />
        ))}
      </Card>

      <Text style={styles.sectionTitle}>Numbering Settings</Text>
      <Card>
        {NUMBERING_FIELDS.map((f) => (
          <FieldInput key={f.key} field={f} value={settings[f.key]} onChange={(v) => setField(f.key, v)} />
        ))}
      </Card>

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveText}>{saving ? "Saving..." : saved ? "Saved ✓" : "Save Changes"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  errorBox: { backgroundColor: colors.redBg, borderRadius: radius, padding: 10, marginBottom: 14 },
  profileName: { fontSize: 17, fontWeight: "800", color: colors.text },
  profileRole: { fontSize: 13, color: colors.orangeDark, fontWeight: "600", marginTop: 2 },
  profileEmail: { fontSize: 12, color: colors.textMuted, marginTop: 2, marginBottom: 12 },
  logoutBtn: {
    borderWidth: 1,
    borderColor: colors.red,
    borderRadius: radius,
    paddingVertical: 10,
    alignItems: "center",
  },
  logoutText: { color: colors.red, fontWeight: "700" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 8, marginBottom: 10 },
  saveBtn: {
    backgroundColor: colors.navy,
    borderRadius: radius,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
  },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
