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
import { MODULES } from "../config/modules";
import { OPTION_SOURCES } from "../config/optionSources";
import FieldInput from "../components/FieldInput";
import { colors, radius } from "../theme";

export default function FormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { moduleKey, editing } = route.params;
  const config = MODULES[moduleKey];

  const [values, setValues] = useState(() => {
    const initial = {};
    (config?.fields || []).forEach((f) => {
      initial[f.key] = editing ? editing[f.key] ?? "" : "";
    });
    return initial;
  });
  const [dynamicOptions, setDynamicOptions] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: editing ? `Edit ${config?.title}` : `Add ${config?.title}` });
  }, [navigation, config, editing]);

  useEffect(() => {
    const sources = new Set((config?.fields || []).filter((f) => f.optionsSource).map((f) => f.optionsSource));
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

  const setField = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = async () => {
    setError("");
    const missing = (config.fields || []).find((f) => f.required && !String(values[f.key] || "").trim());
    if (missing) {
      setError(`${missing.label} is required.`);
      return;
    }
    setSaving(true);
    try {
      const payload = { ...values };
      (config.fields || [])
        .filter((f) => f.type === "number")
        .forEach((f) => {
          if (payload[f.key] !== "" && payload[f.key] !== undefined) {
            payload[f.key] = Number(payload[f.key]);
          }
        });
      // Don't overwrite an existing password on edit if left blank.
      if (editing && "password" in payload && !payload.password) delete payload.password;

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

        {config.fields.map((f) => (
          <FieldInput
            key={f.key}
            field={f.optionsSource ? { ...f, options: dynamicOptions[f.optionsSource] || [] } : f}
            value={values[f.key]}
            onChange={(v) => setField(f.key, v)}
          />
        ))}

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
  submitBtn: {
    backgroundColor: colors.orange,
    borderRadius: radius,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
