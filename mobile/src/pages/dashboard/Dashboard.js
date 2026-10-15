import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import api from "../../api/client";
import Screen from "../../components/layout/Screen";
import { Card, Chip, Empty, Icon, Loader, StatCard, StatGrid, StatusBadge, usePrimary } from "../../components/ui";
import BarChart from "../../components/data/BarChart";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/SessionContext";
import { useNavigate } from "../../navigation/router";
import { colors } from "../../theme";

const fmtINR = (n) => `₹${Math.round(n || 0).toLocaleString("en-IN")}`;

// Same KPI set and gating as frontend/src/pages/dashboard/Dashboard.jsx.
const KPIS = [
  { key: "totalRevenueYTD", module: "sales", label: "Total Sales (Invoiced)", icon: "banknote", tone: "blue", money: true, delta: "revenue" },
  { key: "totalPurchaseValue", module: "purchase", label: "Total Purchases", icon: "cart", tone: "green", money: true, delta: "purchases" },
  { key: "totalProducts", module: "products", label: "Total Products", icon: "package", tone: "purple" },
  { key: "totalOpenValue", module: "sales", label: "Open Sales Value", icon: "trending", tone: "teal", money: true },
  { key: "stockValue", module: "inventory", label: "Stock Value", icon: "tag", tone: "orange", money: true },
];
const MFG_KPIS = [
  { key: "openWorkOrders", label: "Open Work Orders", icon: "wrench", tone: "blue" },
  { key: "producedThisMonth", label: "Produced This Month", icon: "package", tone: "green" },
  { key: "yieldPct", label: "Yield", icon: "checkCircle", tone: "teal", percent: true },
  { key: "materialShortages", label: "Awaiting Material", icon: "alertTriangle", tone: "orange", alertWhenPositive: true },
];
const RANGES = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
];

export function SectionCard({ title, icon, viewAll, children }) {
  const navigate = useNavigate();
  const primary = usePrimary();
  return (
    <Card>
      <View style={styles.head}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
          <Icon name={icon} size={16} color={colors.textMuted} />
          <Text style={styles.headTitle}>{title}</Text>
        </View>
        {viewAll ? (
          <Pressable onPress={() => navigate(viewAll)} hitSlop={8}>
            <Text style={{ color: primary, fontWeight: "700", fontSize: 13 }}>View All ›</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

export function RecentRow({ title, sub, amount, status, date, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.recent}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: "700", color: colors.text }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }} numberOfLines={1}>
          {sub}
          {date ? ` · ${date}` : ""}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        {amount != null ? <Text style={{ fontWeight: "800", color: colors.text }}>{amount}</Text> : null}
        {status ? <StatusBadge status={status} /> : null}
      </View>
    </Pressable>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [adminName, setAdminName] = useState("");
  const [range, setRange] = useState(6);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await api.swr("/api/dashboard", setData).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    api.get("/api/settings").then((s) => setAdminName(s?.adminName || "")).catch(() => {});
  }, [load]);

  const name = adminName || user?.name || "Admin";
  const title = `Hi, ${name.split(" ")[0]}`;
  // The web Topbar's search box and reminders bell.
  const headerRight = [{ icon: "search", label: "Search", onPress: () => navigate("/search") }, can("reminders", "view") ? { icon: "bell", label: "Reminders", onPress: () => navigate("/reminders") } : null];

  if (!data) {
    return (
      <Screen title={title}>
        <Loader />
      </Screen>
    );
  }

  const { stats = {}, recentSalesOrders = [], recentInvoices = [], topCustomers = [] } = data;
  const showSales = can("sales", "view");
  const showCustomers = can("customers", "view");
  const showMfg = can("manufacturing", "view");
  const visibleKpis = KPIS.filter((k) => can(k.module, "view"));
  const deltas = data.deltas || {};
  const trend = (data.salesTrend || []).slice(-range).map((t) => ({ label: t.month, value: t.value }));
  const mfg = showMfg ? data.manufacturing?.stats : null;
  const recentWorkOrders = data.manufacturing?.recentWorkOrders || [];
  const nothing = !visibleKpis.length && !showSales && !showCustomers && !mfg;

  return (
    <Screen
      title={title}
      headerRight={headerRight}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
    >
      <Text style={{ color: colors.textMuted }}>
        {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "short", year: "numeric" })}
      </Text>

      {nothing ? <Empty text="There is nothing to show here yet — your account has no dashboard sections enabled." /> : null}

      {visibleKpis.length ? (
        <StatGrid>
          {visibleKpis.map((k) => {
            const d = k.delta ? deltas[k.delta] : undefined;
            return (
              <StatCard
                key={k.key}
                label={k.label}
                icon={k.icon}
                color={k.tone}
                value={k.money ? fmtINR(stats[k.key]) : (stats[k.key] ?? 0).toLocaleString("en-IN")}
                sub={d != null ? `${d >= 0 ? "▲ +" : "▼ "}${d}% vs last month` : undefined}
              />
            );
          })}
        </StatGrid>
      ) : null}

      {mfg ? (
        <>
          <Text style={styles.sectionHeading}>Production</Text>
          <StatGrid>
            {MFG_KPIS.map((k) => {
              const raw = mfg[k.key];
              const alert = k.alertWhenPositive && Number(raw) > 0;
              return (
                <StatCard
                  key={k.key}
                  label={k.label}
                  icon={k.icon}
                  color={alert ? "red" : k.tone}
                  value={raw == null ? "—" : `${Number(raw).toLocaleString("en-IN")}${k.percent ? "%" : ""}`}
                />
              );
            })}
          </StatGrid>
          <SectionCard title="Recent Work Orders" icon="file" viewAll="/manufacturing/work-orders">
            {recentWorkOrders.length === 0 ? (
              <Text style={styles.empty}>No work orders yet.</Text>
            ) : (
              recentWorkOrders.map((w) => {
                const planned = Number(w.plannedQty) || 0;
                const produced = Number(w.producedQty) || 0;
                const pct = planned > 0 ? Math.min(100, Math.round((produced / planned) * 100)) : 0;
                return (
                  <RecentRow
                    key={w.id}
                    title={w.id}
                    sub={`${w.product} · ${produced}/${planned} ${w.unit || ""} (${pct}%)`}
                    status={w.status}
                    onPress={() => navigate(`/manufacturing/work-orders/${encodeURIComponent(w.id)}`)}
                  />
                );
              })
            )}
          </SectionCard>
        </>
      ) : null}

      {showSales ? (
        <Card>
          <View style={styles.head}>
            <Text style={styles.headTitle}>Sales Trend (₹)</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {RANGES.map((r) => (
                <Chip key={r.label} label={r.label} active={range === r.months} onPress={() => setRange(r.months)} />
              ))}
            </View>
          </View>
          <BarChart data={trend} />
        </Card>
      ) : null}

      {showCustomers ? (
        <SectionCard title="Top Customers" icon="users" viewAll="/customers">
          {topCustomers.length === 0 ? (
            <Text style={styles.empty}>No customers yet.</Text>
          ) : (
            topCustomers.map((c) => (
              <RecentRow
                key={c.id || c.name}
                title={c.name}
                sub={`${c.city || "—"} · ${c.totalOrders ?? 0} orders`}
                amount={fmtINR(c.value)}
                onPress={c.id ? () => navigate(`/customers/${encodeURIComponent(c.id)}`) : undefined}
              />
            ))
          )}
        </SectionCard>
      ) : null}

      {showSales ? (
        <>
          <SectionCard title="Recent Sales Orders" icon="cart" viewAll="/sales/orders">
            {recentSalesOrders.length === 0 ? (
              <Text style={styles.empty}>No sales orders yet.</Text>
            ) : (
              recentSalesOrders.map((o) => (
                <RecentRow
                  key={o.id}
                  title={o.orderNo || o.id}
                  sub={o.customer}
                  date={o.orderDate}
                  amount={fmtINR(o.amount)}
                  status={o.status}
                  onPress={() => navigate(`/sales/orders/${encodeURIComponent(o.id)}`)}
                />
              ))
            )}
          </SectionCard>
          <SectionCard title="Recent Invoices" icon="banknote" viewAll="/sales/invoices">
            {recentInvoices.length === 0 ? (
              <Text style={styles.empty}>No invoices yet.</Text>
            ) : (
              recentInvoices.map((inv) => (
                <RecentRow
                  key={inv.id}
                  title={inv.id}
                  sub={inv.customer}
                  date={inv.date}
                  amount={fmtINR(inv.amount)}
                  status={inv.status}
                  onPress={() => navigate(`/sales/invoices/${encodeURIComponent(inv.id)}`)}
                />
              ))
            )}
          </SectionCard>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 8 },
  headTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  sectionHeading: { fontSize: 13, fontWeight: "800", color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  recent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  empty: { color: colors.textMuted, paddingVertical: 8 },
});
