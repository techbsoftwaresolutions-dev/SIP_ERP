import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import api from "../api/client";
import { MODULES } from "../config/modules";
import { ITEM_MODULES } from "../config/itemModules";
import StatusBadge from "../components/StatusBadge";
import ConfirmDialog from "../components/ConfirmDialog";
import { colors, radius } from "../theme";

function formatMeta(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return value.toLocaleString("en-IN");
  return String(value);
}

export default function ListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { moduleKey } = route.params;
  const config = MODULES[moduleKey] || ITEM_MODULES[moduleKey];
  const isItemModule = !!ITEM_MODULES[moduleKey];

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: config?.title || "List" });
  }, [navigation, config]);

  const load = useCallback(async (isRefresh) => {
    if (!config) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const r = await api.get(`${config.endpoint}?page=1&pageSize=100`);
      setRows(r.data || []);
    } catch (err) {
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [config]);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load])
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`${config.endpoint}/${deleteTarget.id}`);
      setDeleteTarget(null);
      load(true);
    } catch (err) {
      setError(err.message || "Failed to delete.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = search.trim()
    ? rows.filter((r) => JSON.stringify(r).toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  const openForm = (row) => {
    if (isItemModule) {
      navigation.navigate("ItemForm", { moduleKey, editing: row || null });
    } else {
      navigation.navigate("Form", { moduleKey, editing: row || null });
    }
  };

  if (!config) {
    return (
      <View style={styles.center}>
        <Text>Unknown module.</Text>
      </View>
    );
  }

  const { card } = config;

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${config.title.toLowerCase()}...`}
          placeholderTextColor={colors.textLight}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.orange} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: colors.textMuted }}>No records found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openForm(item)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowId}>{item.id}</Text>
                <Text style={styles.rowTitle}>{item[card.title] || "—"}</Text>
                {card.subtitle ? (
                  <Text style={styles.rowSubtitle}>{formatMeta(item[card.subtitle]) || "—"}</Text>
                ) : null}
                {card.meta && card.meta.length > 0 ? (
                  <View style={styles.metaRow}>
                    {card.meta.map((mKey) =>
                      formatMeta(item[mKey]) ? (
                        <Text key={mKey} style={styles.metaText}>
                          {mKey}: {formatMeta(item[mKey])}
                        </Text>
                      ) : null
                    )}
                  </View>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 8 }}>
                {card.status ? <StatusBadge status={item[card.status]} /> : null}
                <TouchableOpacity
                  onPress={() => setDeleteTarget(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={{ fontSize: 16 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => openForm(null)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

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
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center", paddingTop: 40 },
  searchRow: { padding: 12, backgroundColor: colors.bg },
  searchInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  errorBox: { marginHorizontal: 12, backgroundColor: colors.redBg, borderRadius: radius, padding: 10, marginBottom: 8 },
  errorText: { color: colors.red, fontSize: 13 },
  row: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  rowId: { fontSize: 11, color: colors.textLight, fontWeight: "600", marginBottom: 2 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  metaText: { fontSize: 12, color: colors.textLight },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: "#fff", fontSize: 30, fontWeight: "400", marginTop: -2 },
});
