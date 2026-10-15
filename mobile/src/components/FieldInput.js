import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet } from "react-native";
import { colors, radius } from "../theme";

// Renders one form field based on a config object like:
// { key, label, type: 'text'|'number'|'phone'|'password'|'select', required, placeholder, options }
export default function FieldInput({ field, value, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  if (field.type === "select") {
    const options = field.options || [];
    return (
      <View style={styles.field}>
        <Text style={styles.label}>
          {field.label}
          {field.required ? " *" : ""}
        </Text>
        <TouchableOpacity style={styles.selectInput} onPress={() => setPickerOpen(true)}>
          <Text style={value ? styles.selectText : styles.selectPlaceholder}>
            {value || `Select ${field.label.toLowerCase()}`}
          </Text>
        </TouchableOpacity>
        <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{field.label}</Text>
              <FlatList
                data={options}
                keyExtractor={(item, idx) => `${item}-${idx}`}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                      onChange(item);
                      setPickerOpen(false);
                    }}
                  >
                    <Text style={{ color: colors.text, fontSize: 15 }}>{item}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={{ color: colors.textMuted, padding: 12 }}>No options available.</Text>
                }
              />
              <TouchableOpacity style={styles.sheetCancel} onPress={() => setPickerOpen(false)}>
                <Text style={{ color: colors.textMuted, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  const handleChangeText = (text) => {
    if (field.type === "phone") {
      onChange(text.replace(/\D/g, "").slice(0, 10));
    } else if (field.type === "pincode") {
      onChange(text.replace(/\D/g, "").slice(0, 6));
    } else {
      onChange(text);
    }
  };

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {field.label}
        {field.required ? " *" : ""}
      </Text>
      <TextInput
        style={styles.input}
        value={value !== undefined && value !== null ? String(value) : ""}
        onChangeText={handleChangeText}
        placeholder={field.placeholder || `Enter your ${field.label.toLowerCase()}`}
        placeholderTextColor={colors.textLight}
        keyboardType={field.type === "number" || field.type === "pincode" ? "numeric" : field.type === "phone" ? "phone-pad" : "default"}
        maxLength={field.type === "phone" ? 10 : field.type === "pincode" ? 6 : undefined}
        secureTextEntry={field.type === "password"}
        autoCapitalize={field.type === "password" ? "none" : "sentences"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
    backgroundColor: "#fff",
  },
  selectInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#fff",
  },
  selectText: { fontSize: 14, color: colors.text },
  selectPlaceholder: { fontSize: 14, color: colors.textLight },
  overlay: { flex: 1, backgroundColor: "rgba(15,20,30,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "70%" },
  sheetTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 10 },
  optionRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  sheetCancel: { paddingVertical: 14, alignItems: "center" },
});
