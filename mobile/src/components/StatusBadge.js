import { View, Text, StyleSheet } from "react-native";
import { getStatusColor, radius } from "../theme";

export default function StatusBadge({ status }) {
  if (!status) return null;
  const { fg, bg } = getStatusColor(status);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});
