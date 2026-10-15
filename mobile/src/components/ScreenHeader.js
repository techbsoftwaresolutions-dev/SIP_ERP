import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

// Compact "Title / Dashboard > X" header used by every top-level tab screen
// (Dashboard, Customers, Sales, More), matching the web app's mobile
// PageHeader. `right` accepts arbitrary content (bell, avatar, add button).
export default function ScreenHeader({ title, crumb, right }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {crumb ? <Text style={styles.crumb}>{crumb}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 19, fontWeight: "800", color: colors.text },
  crumb: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  right: { flexDirection: "row", alignItems: "center", gap: 10 },
});
