import { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import api from "../api/client";
import Card from "../components/Card";
import StatusBadge from "../components/StatusBadge";
import BarTrendChart from "../components/BarTrendChart";
import { colors, radius, ICON_BG } from "../theme";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const PERIODS = [
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "This Year", value: "year" },
];

const QUICK_ACTIONS = [
  { label: "New Order", icon: "🛒", color: "green", moduleKey: "salesOrders" },
  { label: "Create Invoice", icon: "📄", color: "purple", moduleKey: "salesInvoices" },
  { label: "Sales Return", icon: "₹", color: "orange", moduleKey: "salesReturns" },
  { label: "Sales Report", icon: "📊", color: "blue", report: true },
];

export default function SalesScreen() {
  const navigation = useNavigation();
  const [range, setRange] = useState("month");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("orders");

  const load = useCallback(
    async (isRefresh) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const r = await api.get(`/api/sales/overview?range=${range}`);
        setData(r);
      } catch (_e) {
        // Keep last-known data on failure.
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range]
  );

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const stats = data?.stats || {};

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sales</Text>
          <Text style={styles.crumb}>Dashboard / Sales</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate("Form", { moduleKey: "salesOrders", editing: null })}
        >
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.orange} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
        >
          <View style={styles.filterRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>📅 {todayLabel()}</Text>
            </View>
            <TouchableOpacity style={styles.pill} onPress={() => setPeriodOpen((v) => !v)}>
              <Text style={styles.pillText}>{PERIODS.find((p) => p.value === range)?.label} ▾</Text>
            </TouchableOpacity>
          </View>
          {periodOpen && (
            <View style={styles.periodMenu}>
              {PERIODS.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={styles.periodItem}
                  onPress={() => {
                    setRange(p.value);
                    setPeriodOpen(false);
                  }}
                >
                  <Text style={{ color: p.value === range ? colors.blue : colors.text, fontWeight: p.value === range ? "700" : "500" }}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.grid}>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Total Sales (Invoiced)</Text>
              <Text style={[styles.statValue, { color: colors.green }]}>{inr(stats.totalSalesInvoiced)}</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Total Orders</Text>
              <Text style={[styles.statValue, { color: colors.blue }]}>{(stats.totalOrders ?? 0).toLocaleString("en-IN")}</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Total Invoices</Text>
              <Text style={[styles.statValue, { color: colors.purple }]}>{(stats.totalInvoices ?? 0).toLocaleString("en-IN")}</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statLabel}>Average Order Value</Text>
              <Text style={[styles.statValue, { color: colors.orangeDark }]}>{inr(stats.averageOrderValue)}</Text>
            </Card>
          </View>

          <Text style={styles.sectionTitle}>Sales Trend (₹)</Text>
          <Card>
            <BarTrendChart data={data?.salesTrend || []} />
          </Card>

          <View style={styles.tabsWrap}>
            <TouchableOpacity style={[styles.tab, tab === "orders" && styles.tabActive]} onPress={() => setTab("orders")}>
              <Text style={[styles.tabText, tab === "orders" && styles.tabTextActive]}>Recent Orders</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, tab === "invoices" && styles.tabActive]} onPress={() => setTab("invoices")}>
              <Text style={[styles.tabText, tab === "invoices" && styles.tabTextActive]}>Recent Invoices</Text>
            </TouchableOpacity>
          </View>

          <Card>
            {tab === "orders" ? (
              <>
                {(data?.recentOrders || []).length === 0 && <Text style={{ color: colors.textMuted }}>No sales orders yet.</Text>}
                {(data?.recentOrders || []).map((o) => (
                  <TouchableOpacity
                    key={o.id}
                    style={styles.row}
                    onPress={() => navigation.navigate("List", { moduleKey: "salesOrders" })}
                  >
                    <View style={styles.rowAvatar}>
                      <Text style={{ color: colors.purple, fontWeight: "700" }}>{(o.customer || "?").charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{o.orderNo}</Text>
                      <Text style={styles.rowSub}>{o.customer}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <StatusBadge status={o.status} />
                      <Text style={styles.rowValue}>{inr(o.amount)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => navigation.navigate("List", { moduleKey: "salesOrders" })}>
                  <Text style={styles.viewAll}>View All Orders</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {(data?.recentInvoices || []).length === 0 && <Text style={{ color: colors.textMuted }}>No invoices yet.</Text>}
                {(data?.recentInvoices || []).map((inv) => (
                  <TouchableOpacity
                    key={inv.id}
                    style={styles.row}
                    onPress={() => navigation.navigate("List", { moduleKey: "salesInvoices" })}
                  >
                    <View style={styles.rowAvatar}>
                      <Text style={{ color: colors.purple, fontWeight: "700" }}>{(inv.customer || "?").charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{inv.id}</Text>
                      <Text style={styles.rowSub}>{inv.customer}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <StatusBadge status={inv.status} />
                      <Text style={styles.rowValue}>{inr(inv.amount)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => navigation.navigate("List", { moduleKey: "salesInvoices" })}>
                  <Text style={styles.viewAll}>View All Invoices</Text>
                </TouchableOpacity>
              </>
            )}
          </Card>

          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map((qa) => (
              <TouchableOpacity
                key={qa.label}
                style={styles.quickTile}
                onPress={() =>
                  qa.report
                    ? navigation.navigate("More", { screen: "Reports" })
                    : navigation.navigate("Form", { moduleKey: qa.moduleKey, editing: null })
                }
              >
                <View style={[styles.quickIcon, ICON_BG[qa.color]]}>
                  <Text style={{ fontSize: 18 }}>{qa.icon}</Text>
                </View>
                <Text style={styles.quickLabel}>{qa.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 19, fontWeight: "800", color: colors.text },
  crumb: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center" },
  addBtnText: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: -2 },
  filterRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  pill: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pillText: { fontSize: 12.5, fontWeight: "600", color: colors.text, textAlign: "center" },
  periodMenu: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    marginBottom: 12,
    overflow: "hidden",
  },
  periodItem: { paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8, marginBottom: 8 },
  statCard: { width: "47%" },
  statLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  statValue: { fontSize: 16, fontWeight: "800" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 20, marginBottom: 10 },
  tabsWrap: { flexDirection: "row", gap: 4, backgroundColor: colors.bg, borderRadius: 10, padding: 4, marginBottom: -1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 8 },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.purpleBg, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  rowValue: { fontSize: 12.5, fontWeight: "700", color: colors.text, marginTop: 4 },
  viewAll: { textAlign: "center", color: colors.blue, fontWeight: "700", fontSize: 13, paddingVertical: 10 },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickTile: { width: "22%", alignItems: "center", gap: 6 },
  quickIcon: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 10.5, fontWeight: "600", color: colors.text, textAlign: "center" },
});
