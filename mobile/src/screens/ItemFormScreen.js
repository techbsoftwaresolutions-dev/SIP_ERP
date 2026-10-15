import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import api from "../api/client";
import { ITEM_MODULES } from "../config/itemModules";
import { OPTION_SOURCES } from "../config/optionSources";
import FieldInput from "../components/FieldInput";
import { colors, radius } from "../theme";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function emptyItem(itemColumns) {
  const row = {};
  itemColumns.forEach((c) => {
    row[c.key] = "";
  });
  return row;
}

export default function ItemFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { moduleKey, editing } = route.params;
  const config = ITEM_MODULES[moduleKey];

  const [header, setHeader] = useState(() => {
    const initial = {};
    (config?.headerFields || []).forEach((f) => {
      initial[f.key] = editing ? editing[f.key] ?? "" : "";
    });
    return initial;
  });
  const [items, setItems] = useState(() => (editing?.items || []).map((i) => (config.computeRow ? config.computeRow(i) : i)));
  const [dynamicOptions, setDynamicOptions] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editing ? `Edit ${config?.title}` : `Add ${config?.title}` });
  }, [navigation, config, editing]);

  useEffect(() => {
    const sources = new Set(
      [...(config?.headerFields || []), ...(config?.itemColumns || [])]
        .filter((f) => f.optionsSource)
        .map((f) => f.optionsSource)
    );
    sources.forEach(async (sourceKey) => {
      const src = OPTION_SOURCES[sourceKey];
      if (!src) return;
      try {
        const r = await api.get(src.endpoint);
        setDynamicOptions((prev) => ({ ...prev, [sourceKey]: src.map(r) }));
      } catch (_e) {
        setDynamicOptions((prev) => ({ ...prev, [sourceKey]: [] }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!config) {
    return (
      <View style={styles.center}>
        <Text>Unknown module.</Text>
      </View>
    );
  }

  const setHeaderField = (key, value) => setHeader((v) => ({ ...v, [key]: value }));

  const updateItem = (idx, key, value) => {
    setItems((prev) => {
      const next = prev.map((row, i) => (i === idx ? { ...row, [key]: value } : row));
      return config.computeRow ? next.map((r) => config.computeRow(r)) : next;
    });
  };

  const addItem = () => setItems((prev) => [...prev, emptyItem(config.itemColumns)]);
  const removeItem = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const grandTotal = items.reduce((a, i) => a + (Number(i.amount) || 0), 0);

  const handleSubmit = async () => {
    setError("");
    const missingHeader = config.headerFields.find(
      (f) => f.required && !f.editOnly && !String(header[f.key] || "").trim()
    );
    if (missingHeader) {
      setError(`${missingHeader.label} is required.`);
      return;
    }
    if (items.length === 0) {
      setError("Add at least one item.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...header, items };
      config.headerFields
        .filter((f) => f.type === "number")
        .forEach((f) => {
          if (payload[f.key] !== "" && payload[f.key] !== undefined) payload[f.key] = Number(payload[f.key]);
        });

      if (editing) {
        await api.put(`${config.endpoint}/${editing.id}`, payload);
      } else {
        await api.post(config.endpoint, payload);
      }
      navigation.goBack();
    } catch (err) {
      setError(err.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {config.headerFields
          .filter((f) => !f.editOnly || editing)
          .map((f) => (
            <FieldInput
              key={f.key}
              field={f.optionsSource ? { ...f, options: dynamicOptions[f.optionsSource] || [] } : f}
              value={header[f.key]}
              onChange={(v) => setHeaderField(f.key, v)}
            />
          ))}

        <Text style={styles.sectionTitle}>Items</Text>

        {items.length === 0 ? (
          <Text style={{ color: colors.textMuted, marginBottom: 12 }}>No items added yet.</Text>
        ) : null}

        {items.map((row, idx) => (
          <View key={idx} style={styles.itemCard}>
            <View style={styles.itemCardHeader}>
              <Text style={styles.itemCardTitle}>Item {idx + 1}</Text>
              <TouchableOpacity onPress={() => removeItem(idx)}>
                <Text style={{ fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
            {config.itemColumns.map((c) => (
              <FieldInput
                key={c.key}
                field={c.optionsSource ? { ...c, options: dynamicOptions[c.optionsSource] || [] } : c}
                value={row[c.key]}
                onChange={(v) => updateItem(idx, c.key, v)}
              />
            ))}
            {config.computeRow ? (
              <Text style={styles.itemAmount}>Amount: {inr(row.amount)}</Text>
            ) : null}
          </View>
        ))}

        <TouchableOpacity style={styles.addItemBtn} onPress={addItem}>
          <Text style={styles.addItemText}>+ Add Item</Text>
        </TouchableOpacity>

        {config.computeRow ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{inr(grandTotal)}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={[styles.submitBtn, saving && { opacity: 0.7 }]} onPress={handleSubmit} disabled={saving}>
          <Text style={styles.submitText}>{saving ? "Saving..." : editing ? "Save Changes" : "Save"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 60, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorBox: { backgroundColor: colors.redBg, borderRadius: radius, padding: 12, marginBottom: 14 },
  errorText: { color: colors.red, fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 8, marginBottom: 10 },
  itemCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: 12,
    marginBottom: 12,
  },
  itemCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemCardTitle: { fontSize: 13, fontWeight: "700", color: colors.textMuted },
  itemAmount: { fontSize: 13, fontWeight: "700", color: colors.teal, marginTop: 4 },
  addItemBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#fff",
  },
  addItemText: { color: colors.text, fontWeight: "600" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginBottom: 16,
  },
  totalLabel: { fontSize: 15, fontWeight: "700", color: colors.text },
  totalValue: { fontSize: 16, fontWeight: "800", color: colors.teal },
  submitBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
