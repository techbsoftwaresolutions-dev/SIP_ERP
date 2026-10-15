import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { colors, radius } from "../theme";

export default function ConfirmDialog({ visible, title = "Are you sure?", message, confirming, onConfirm, onCancel }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={confirming}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} onPress={onConfirm} disabled={confirming}>
              <Text style={styles.deleteText}>{confirming ? "Deleting..." : "Delete"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,20,30,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  box: {
    backgroundColor: "#fff",
    borderRadius: radius,
    padding: 20,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.text, marginBottom: 8 },
  message: { fontSize: 14, color: colors.textMuted, marginBottom: 20, lineHeight: 20 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.text, fontWeight: "600" },
  deleteBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius, backgroundColor: colors.red },
  deleteText: { color: "#fff", fontWeight: "700" },
});
