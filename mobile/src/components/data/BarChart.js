import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme";

export function fmtCompact(n) {
  const v = Math.abs(n || 0);
  if (v >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (v >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (v >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n || 0)}`;
}

// Plain-View bar chart (no native chart dependency). Tap a bar to read its value.
// data: [{ label, value }]
export default function BarChart({ data = [], color = colors.primary, height = 160, format = fmtCompact }) {
  const [active, setActive] = useState(null);
  const peak = Math.max(0, ...data.map((d) => Number(d.value) || 0));
  const max = peak || 1; // bar-height divisor only
  if (!data.length) return <Text style={{ color: colors.textMuted, paddingVertical: 20, textAlign: "center" }}>No data yet.</Text>;
  const sel = active != null ? data[active] : null;
  return (
    <View>
      <Text style={styles.readout}>
        {sel ? `${sel.label}: ${format(sel.value)}` : peak ? `Peak ${format(peak)} · tap a bar for its value` : "Nothing recorded in this period yet."}
      </Text>
      <View style={[styles.chart, { height }]}>
        {data.map((d, i) => {
          const h = Math.max(2, ((Number(d.value) || 0) / max) * (height - 8));
          return (
            <Pressable key={`${d.label}-${i}`} style={styles.col} onPress={() => setActive(i === active ? null : i)}>
              <View style={[styles.bar, { height: h, backgroundColor: color, opacity: active == null || active === i ? 1 : 0.35 }]} />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labels}>
        {data.map((d, i) => (
          <Text key={`${d.label}-l${i}`} style={styles.label} numberOfLines={1}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  chart: { flexDirection: "row", alignItems: "flex-end", gap: 6, borderBottomWidth: 1, borderColor: colors.border },
  col: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { borderTopLeftRadius: 4, borderTopRightRadius: 4, width: "100%" },
  labels: { flexDirection: "row", gap: 6, marginTop: 4 },
  label: { flex: 1, fontSize: 10, color: colors.textMuted, textAlign: "center" },
});
