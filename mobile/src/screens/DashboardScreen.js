import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import BarTrendChart from "../components/BarTrendChart";
import { colors, radius } from "../theme";

function inr(n) {
  return `₹${(n || 0).toLocaleString("en-IN")}`;
}

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Mirrors the web dashboard's 5 headline KPIs exactly.
const STAT_CARDS = [
  { key: "totalRevenueYTD", label: "Total Sales (Invoiced)", color: colors.green, format: "currency" },
  { key: "totalPurchaseValue", label: "Total Purchases", color: colors.green, format: "currency" },
  { key: "totalProducts", label: "Total Products", color: colors.purple, format: "number" },
  { key: "totalOpenValue", label: "Open Sales Value", color: colors.teal, format: "currency" },
  { key: "stockValue", label: "Stock Value", color: colors.orange, format: "currency" },
];

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notifTotal, setNotifTotal] = useState(0);
  const [companyName, setCompanyName] = useState("");

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const r = await api.get("/api/dashboard");
      setData(r);
    } catch (err) {
      setError(err.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    api.get("/api/activity-log?page=1&pageSize=1").then((r) => setNotifTotal(r.total || 0)).catch(() => {});
    api.get("/api/settings").then((s) => setCompanyName(s?.companyName || "")).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.brandBar}>
        <View>
          <Text style={styles.brandName}>{companyName || "Your Company"}</Text>
        </View>
        <View style={styles.brandRight}>
          <View style={{ position: "relative", marginRight: 14 }}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
            {notifTotal > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{notifTotal > 9 ? "9+" : notifTotal}</Text>
              </View>
            )}
          </View>
          <View style={styles.avatar}>
            <Text style={{ fontSize: 15 }}>{user?.avatar || "🙂"}</Text>
          </View>
        </View>
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
          <View style={styles.welcomeRow}>
            <View>
              <Text style={styles.greeting}>Welcome back, {user?.name || "Admin"}!</Text>
              <Text style={styles.subGreeting}>Here's what's happening today.</Text>
            </View>
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>📅 {todayLabel()}</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={{ color: colors.red, fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.grid}>
            {STAT_CARDS.map((s) => (
              <Card key={s.key} style={styles.statCard}>
                <Text style={styles.statLabel}>{s.label}</Text>
                <Text style={[styles.statValue, { color: s.color }]}>
                  {s.format === "currency" ? inr(data?.stats?.[s.key]) : (data?.stats?.[s.key] ?? 0).toLocaleString("en-IN")}
                </Text>
              </Card>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Sales Trend (₹)</Text>
          <Card>
            <BarTrendChart data={data?.salesTrend || []} />
          </Card>

          <Text style={styles.sectionTitle}>Top Customers</Text>
          <Card>
            {(data?.topCustomers || []).length === 0 ? (
              <Text style={{ color: colors.textMuted }}>No customer data yet.</Text>
            ) : (
              (data.topCustomers || []).map((c, idx) => (
                <View key={`${c.name}-${idx}`} style={styles.listRow}>
                  <View>
                    <Text style={styles.listRowTitle}>{c.name}</Text>
                    <Text style={styles.listRowSub}>{c.city || "—"}</Text>
                  </View>
                  <Text style={styles.listRowValue}>{c.totalOrders || 0} orders</Text>
                </View>
              ))
            )}
          </Card>

          <Text style={styles.sectionTitle}>Recent Sales Orders</Text>
          <Card>
            {(data?.recentSalesOrders || []).length === 0 ? (
              <Text style={{ color: colors.textMuted }}>No recent sales orders.</Text>
            ) : (
              (data.recentSalesOrders || []).map((o) => (
                <TouchableOpacity
                  key={o.id}
                  style={styles.listRow}
                  onPress={() => navigation.navigate("Sales", { screen: "List", params: { moduleKey: "salesOrders" } })}
                >
                  <View>
                    <Text style={styles.listRowTitle}>{o.orderNo || o.id}</Text>
                    <Text style={styles.listRowSub}>{o.customer}</Text>
                  </View>
                  <Text style={styles.listRowValue}>{inr(o.amount)}</Text>
                </TouchableOpacity>
              ))
            )}
          </Card>

          <Text style={styles.sectionTitle}>Recent Invoices</Text>
          <Card>
            {(data?.recentInvoices || []).length === 0 ? (
              <Text style={{ color: colors.textMuted }}>No invoices yet.</Text>
            ) : (
              (data.recentInvoices || []).map((inv) => (
                <TouchableOpacity
                  key={inv.id}
                  style={styles.listRow}
                  onPress={() => navigation.navigate("Sales", { screen: "List", params: { moduleKey: "salesInvoices" } })}
                >
                  <View>
                    <Text style={styles.listRowTitle}>{inv.id}</Text>
                    <Text style={styles.listRowSub}>{inv.customer}</Text>
                  </View>
                  <Text style={styles.listRowValue}>{inr(inv.amount)}</Text>
                </TouchableOpacity>
              ))
            )}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  brandBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  brandName: { fontSize: 15, fontWeight: "800", color: colors.navy, letterSpacing: 0.3 },
  brandRight: { flexDirection: "row", alignItems: "center" },
  bellBadge: {
    position: "absolute",
    top: -6,
    right: -8,
    backgroundColor: colors.amber,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 15,
    alignItems: "center",
  },
  bellBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.purpleBg,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  greeting: { fontSize: 19, fontWeight: "800", color: colors.text },
  subGreeting: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  datePill: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  datePillText: { fontSize: 11.5, fontWeight: "600", color: colors.text },
  errorBox: { backgroundColor: colors.redBg, borderRadius: radius, padding: 10, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 8 },
  statCard: { width: "47%" },
  statLabel: { fontSize: 12, color: colors.textMuted, marginBottom: 6 },
  statValue: { fontSize: 17, fontWeight: "800" },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 20, marginBottom: 10 },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listRowTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  listRowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  listRowValue: { fontSize: 13, fontWeight: "700", color: colors.text },
});
