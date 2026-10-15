import { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import api from "../api/client";
import Card from "../components/Card";
import StatusBadge from "../components/StatusBadge";
import { colors, radius } from "../theme";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function KpiRow({ items }) {
  return (
    <View style={styles.kpiGrid}>
      {items.map((it) => (
        <View key={it.label} style={styles.kpiBox}>
          <Text style={styles.kpiLabel}>{it.label}</Text>
          <Text style={styles.kpiValue}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ReportsScreen() {
  const [sales, setSales] = useState(null);
  const [purchase, setPurchase] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [lowStock, setLowStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const [s, p, inv, ls] = await Promise.all([
        api.get("/api/reports/sales-summary"),
        api.get("/api/reports/purchase-summary"),
        api.get("/api/reports/inventory-valuation/summary"),
        api.get("/api/reports/low-stock"),
      ]);
      setSales(s);
      setPurchase(p);
      setInventory(inv);
      setLowStock(ls);
    } catch (err) {
      setError(err.message || "Failed to load reports.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.orange} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
    >
      {error ? (
        <View style={styles.errorBox}>
          <Text style={{ color: colors.red, fontSize: 13 }}>{error}</Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Sales Summary</Text>
      <Card>
        <KpiRow
          items={[
            { label: "Orders", value: (sales?.totals?.orders ?? 0).toLocaleString("en-IN") },
            { label: "Qty", value: (sales?.totals?.qty ?? 0).toLocaleString("en-IN") },
            { label: "Value", value: inr(sales?.totals?.value) },
          ]}
        />
        <Text style={styles.subTitle}>Top Customers</Text>
        {(sales?.rows || []).slice(0, 5).map((r, idx) => (
          <View key={`${r.customer}-${idx}`} style={styles.listRow}>
            <View>
              <Text style={styles.listRowTitle}>{r.customer}</Text>
              <Text style={styles.listRowSub}>{r.product} · {r.region}</Text>
            </View>
            <Text style={styles.listRowValue}>{inr(r.value)}</Text>
          </View>
        ))}
        {(sales?.rows || []).length === 0 && <Text style={styles.emptyText}>No sales data yet.</Text>}
      </Card>

      <Text style={styles.sectionTitle}>Purchase Analysis</Text>
      <Card>
        <KpiRow
          items={[
            { label: "Orders", value: (purchase?.totals?.orders ?? 0).toLocaleString("en-IN") },
            { label: "Purchase Value", value: inr(purchase?.totals?.purchaseValue) },
            { label: "Paid", value: inr(purchase?.totals?.paid) },
            { label: "Outstanding", value: inr(purchase?.totals?.outstanding) },
          ]}
        />
        <Text style={styles.subTitle}>Top Suppliers</Text>
        {(purchase?.rows || []).slice(0, 5).map((r, idx) => (
          <View key={`${r.supplier}-${idx}`} style={styles.listRow}>
            <View>
              <Text style={styles.listRowTitle}>{r.supplier}</Text>
              <Text style={styles.listRowSub}>{r.orders} orders</Text>
            </View>
            <Text style={styles.listRowValue}>{inr(r.purchaseValue)}</Text>
          </View>
        ))}
        {(purchase?.rows || []).length === 0 && <Text style={styles.emptyText}>No purchase data yet.</Text>}
      </Card>

      <Text style={styles.sectionTitle}>Inventory Valuation</Text>
      <Card>
        <KpiRow
          items={[
            { label: "Total Products", value: (inventory?.kpis?.totalProducts ?? 0).toLocaleString("en-IN") },
            { label: "Stock Qty", value: (inventory?.kpis?.totalStockQty ?? 0).toLocaleString("en-IN") },
            { label: "Available", value: (inventory?.kpis?.availableStock ?? 0).toLocaleString("en-IN") },
            { label: "Stock Value", value: inr(inventory?.kpis?.totalStockValue) },
          ]}
        />
      </Card>

      <Text style={styles.sectionTitle}>Low Stock Alerts</Text>
      <Card>
        <KpiRow
          items={[
            { label: "Total Alerts", value: (lowStock?.kpis?.totalLowStock ?? 0).toLocaleString("en-IN") },
            { label: "Critical", value: (lowStock?.kpis?.critical ?? 0).toLocaleString("en-IN") },
            { label: "Out of Stock", value: (lowStock?.kpis?.outOfStock ?? 0).toLocaleString("en-IN") },
            { label: "Reorder Value", value: inr(lowStock?.kpis?.estimatedReorderValue) },
          ]}
        />
        <Text style={styles.subTitle}>Items Needing Attention</Text>
        {(lowStock?.rows || []).slice(0, 6).map((r, idx) => (
          <View key={`${r.product}-${idx}`} style={styles.listRow}>
            <View>
              <Text style={styles.listRowTitle}>{r.product}</Text>
              <Text style={styles.listRowSub}>Stock: {r.currentStock} · Reorder: {r.reorderLevel}</Text>
            </View>
            <StatusBadge status={r.status} />
          </View>
        ))}
        {(lowStock?.rows || []).length === 0 && <Text style={styles.emptyText}>No low stock alerts.</Text>}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  errorBox: { backgroundColor: colors.redBg, borderRadius: radius, padding: 10, marginBottom: 14 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 18, marginBottom: 10 },
  subTitle: { fontSize: 13, fontWeight: "700", color: colors.textMuted, marginTop: 14, marginBottom: 4 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiBox: { minWidth: "45%", flexGrow: 1 },
  kpiLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  kpiValue: { fontSize: 16, fontWeight: "800", color: colors.text },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listRowTitle: { fontSize: 13, fontWeight: "600", color: colors.text },
  listRowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  listRowValue: { fontSize: 12, fontWeight: "700", color: colors.text },
  emptyText: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
