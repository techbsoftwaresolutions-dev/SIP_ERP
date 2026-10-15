import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import api from "../../api/client";
import Screen from "../../components/layout/Screen";
import { Card, Chip, Icon, StatCard, StatGrid } from "../../components/ui";
import BarChart from "../../components/data/BarChart";
import { RecentRow } from "../dashboard/Dashboard";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/SessionContext";
import { canReach, visibleNav } from "../../navigation/menu";
import { useNavigate } from "../../navigation/router";
import { colors } from "../../theme";

const inr = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;
const PERIODS = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
];

// The "Sales" bottom tab — port of frontend/src/pages/sales/Sales.jsx plus a
// tile for every Sales sub-page this user can open.
export default function Sales() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { can, menuConfig } = usePermissions();
  const ctx = { can, menuConfig, role: user?.role };
  const [range, setRange] = useState("month");
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("orders");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api.get(`/api/sales/overview?range=${range}`).then(setData).catch(() => {}), [range]);
  useEffect(() => {
    load();
  }, [load]);

  const stats = data?.stats || {};
  const salesGroup = visibleNav(ctx).find((g) => g.module === "sales");
  const pages = (salesGroup && salesGroup.children) || [];
  const extra = [{ label: "Sales Reports", icon: "chart", to: "/reports/sales" }].filter((p) => canReach(p.to, ctx));

  return (
    <Screen
      title="Sales"
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <View style={{ flexDirection: "row", gap: 8 }}>
        {PERIODS.map((p) => (
          <Chip key={p.value} label={p.label} active={range === p.value} onPress={() => setRange(p.value)} />
        ))}
      </View>

      <StatGrid>
        <StatCard label="Total Sales (Invoiced)" icon="banknote" color="green" value={inr(stats.totalSalesInvoiced)} />
        <StatCard label="Total Orders" icon="cart" color="blue" value={(stats.totalOrders ?? 0).toLocaleString("en-IN")} />
        <StatCard label="Total Invoices" icon="file" color="purple" value={(stats.totalInvoices ?? 0).toLocaleString("en-IN")} />
        <StatCard label="Average Order Value" icon="wallet" color="orange" value={inr(stats.averageOrderValue)} />
      </StatGrid>

      <View style={styles.tiles}>
        {[...pages, ...extra].map((p) => (
          <Pressable key={p.to} style={styles.tile} onPress={() => navigate(p.to)}>
            <View style={styles.tileIcon}>
              <Icon name={p.icon} size={20} color={colors.primary} />
            </View>
            <Text style={styles.tileLabel} numberOfLines={2}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <Text style={{ fontWeight: "700", marginBottom: 10 }}>Sales Trend (₹)</Text>
        <BarChart data={(data?.salesTrend || []).map((t) => ({ label: t.month, value: t.value }))} color={colors.orange} />
      </Card>

      <Card>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 6 }}>
          <Chip label="Recent Orders" active={tab === "orders"} onPress={() => setTab("orders")} />
          <Chip label="Recent Invoices" active={tab === "invoices"} onPress={() => setTab("invoices")} />
        </View>
        {tab === "orders"
          ? (data?.recentOrders || []).map((o) => (
              <RecentRow
                key={o.id}
                title={o.orderNo}
                sub={o.customer}
                amount={inr(o.amount)}
                status={o.status}
                onPress={() => navigate(`/sales/orders/${encodeURIComponent(o.id)}`)}
              />
            ))
          : (data?.recentInvoices || []).map((inv) => (
              <RecentRow
                key={inv.id}
                title={inv.id}
                sub={inv.customer}
                amount={inr(inv.amount)}
                status={inv.status}
                onPress={() => navigate(`/sales/invoices/${encodeURIComponent(inv.id)}`)}
              />
            ))}
        {(tab === "orders" ? data?.recentOrders : data?.recentInvoices)?.length ? null : (
          <Text style={{ color: colors.textMuted, paddingVertical: 10 }}>{tab === "orders" ? "No sales orders yet." : "No invoices yet."}</Text>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "31%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryBg, alignItems: "center", justifyContent: "center" },
  tileLabel: { fontSize: 12, fontWeight: "600", color: colors.text, textAlign: "center" },
});
