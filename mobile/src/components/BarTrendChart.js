import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme";

// A dependency-free bar chart (no chart library installed) used for the
// "Sales Trend (₹)" card. All bar heights come from the `data` prop — never
// hardcoded — so an empty/live database renders flat, honest bars.
export default function BarTrendChart({ data = [], height = 150 }) {
  const max = Math.max(1, ...data.map((d) => d.value || 0));
  return (
    <View style={[styles.barsRow, { height }]}>
      {data.map((d) => {
        const barHeight = Math.max(3, Math.round((d.value / max) * (height - 34)));
        return (
          <View key={d.month} style={styles.barCol}>
            <Text style={styles.barValue}>{d.value ? `${(d.value / 100000).toFixed(1)}L` : "0"}</Text>
            <View style={[styles.bar, { height: barHeight }]} />
            <Text style={styles.barLabel}>{d.month}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barsRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 6 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: { width: "55%", backgroundColor: colors.orange, borderRadius: 4, minHeight: 3 },
  barValue: { fontSize: 9, color: colors.textLight, marginBottom: 3 },
  barLabel: { fontSize: 10.5, color: colors.textMuted, marginTop: 6 },
});
