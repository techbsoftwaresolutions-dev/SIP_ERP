import { useCallback, useState } from "react";
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import api from "../api/client";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";
import { colors, radius } from "../theme";

const TABS = [
  { label: "All Customers", value: null },
  { label: "Active Customers", value: "Active" },
];

export default function CustomersScreen() {
  const navigation = useNavigation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState(null);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (isRefresh) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const r = await api.get("/api/customers?page=1&pageSize=200");
      setRows(r.data || []);
    } catch (err) {
      setError(err.message || "Failed to load customers.");
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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/customers/${deleteTarget.id}`);
      setDeleteTarget(null);
      load(true);
    } catch (err) {
      setError(err.message || "Failed to delete.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = rows.filter((r) => {
    if (tab && r.status !== tab) return false;
    if (!search.trim()) return true;
    return JSON.stringify(r).toLowerCase().includes(search.trim().toLowerCase());
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Customers</Text>
          <Text style={styles.crumb}>Dashboard / Customers</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate("Form", { moduleKey: "customers", editing: null })}>
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
          <View style={styles.searchRow}>
            <View style={styles.searchInput}>
              <Text style={{ color: colors.textLight }}>🔍</Text>
              <TextInput
                style={{ flex: 1, fontSize: 14, color: colors.text, marginLeft: 8 }}
                placeholder="Search customers..."
                placeholderTextColor={colors.textLight}
                value={search}
                onChangeText={setSearch}
              />
            </View>
            <TouchableOpacity style={styles.filterBtn}>
              <Text style={{ color: colors.textMuted }}>▤</Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={{ color: colors.red, fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.tabsRow}>
            {TABS.map((t) => {
              const count = rows.filter((r) => t.value === null || r.status === t.value).length;
              const active = tab === t.value;
              return (
                <TouchableOpacity
                  key={t.label}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setTab(t.value)}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {t.label} <Text style={styles.tabCount}>{count}</Text>
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {filtered.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 30 }}>No customers found.</Text>
          ) : (
            filtered.map((row) => (
              <TouchableOpacity
                key={row.id}
                style={styles.card}
                activeOpacity={0.7}
                onPress={() => navigation.navigate("Form", { moduleKey: "customers", editing: row })}
              >
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{(row.name || "?").charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardName} numberOfLines={1}>{row.name}</Text>
                      <StatusBadge status={row.status} />
                    </View>
                    <Text style={styles.cardSub}>{row.city || "—"}</Text>
                  </View>
                  <TouchableOpacity
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => setDeleteTarget(row)}
                  >
                    <Text style={{ fontSize: 18, color: colors.textLight }}>⋮</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ marginTop: 8, gap: 4 }}>
                  {row.phone ? <Text style={styles.metaRow}>📞 {row.phone}</Text> : null}
                  {row.email ? <Text style={styles.metaRow}>✉️ {row.email}</Text> : null}
                </View>
                <View style={styles.cardFooter}>
                  <Text style={styles.ordersText}>{row.totalOrders ?? 0} Orders</Text>
                </View>
              </TouchableOpacity>
            ))
          )}

          <View style={styles.summaryCard}>
            <View style={styles.summaryIcon}>
              <Text style={{ fontSize: 18 }}>👥</Text>
            </View>
            <View>
              <Text style={styles.summaryTitle}>{rows.length} Total Customer{rows.length === 1 ? "" : "s"}</Text>
              <Text style={styles.summarySub}>Manage your customer relationships and track orders</Text>
            </View>
          </View>
        </ScrollView>
      )}

      <ConfirmDialog
        visible={!!deleteTarget}
        message={deleteTarget ? `Delete ${deleteTarget.id}? This cannot be undone.` : ""}
        confirming={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
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
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: -2 },
  searchRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  searchInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  filterBtn: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  errorBox: { backgroundColor: colors.redBg, borderRadius: radius, padding: 10, marginBottom: 10 },
  tabsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#fff",
  },
  tabActive: { backgroundColor: colors.blueBg, borderColor: colors.blue },
  tabText: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: colors.blue },
  tabCount: { fontSize: 11 },
  card: {
    backgroundColor: "#fff",
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.purpleBg,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.purple, fontWeight: "700", fontSize: 15 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardName: { fontSize: 14.5, fontWeight: "700", color: colors.text, flexShrink: 1 },
  cardSub: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  metaRow: { fontSize: 12.5, color: colors.textMuted },
  cardFooter: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, alignItems: "flex-end" },
  ordersText: { fontSize: 13, fontWeight: "700", color: colors.text },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 4,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.blueBg,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: { fontSize: 13.5, fontWeight: "700", color: colors.text },
  summarySub: { fontSize: 12, color: colors.textMuted, marginTop: 1, maxWidth: 240 },
});
