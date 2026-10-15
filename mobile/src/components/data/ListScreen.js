import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import api from "../../api/client";
import { colors } from "../../theme";
import { usePermissions } from "../../context/SessionContext";
import { useLocation, useNavigate } from "../../navigation/router";
import { Chip, Empty, ErrorBox, Icon, IconButton, Note, StatusBadge, useFeedback, usePrimary } from "../ui";
import { AddRecordForm, DateInput, Input, SearchableSelect } from "../forms";

const inr = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
export { inr };

// Mobile counterpart of frontend/src/components/data/SimpleListPage.jsx:
// infinite-scroll list with server search, pull-to-refresh, optional status
// tabs / filters, a create button, per-row actions (edit, delete, extras) —
// all gated by the same permissions as the web page.
//
// card(row) => { title, subtitle, meta: [{ icon, text }], amount, status, avatar }
export default function ListScreen({
  title,
  endpoint,
  params,
  pageSize = 20,
  card,
  onPressRow,
  detailPath, // (row) => path — tap opens detail
  addPath, // path of a standalone add screen
  editPath, // (row) => path
  addConfig, // { buttonLabel, modalTitle, fields, successMessage, endpoint } — inline form (web modal)
  rowActions, // (row, helpers) => [{ label, icon, onPress, danger }]
  tabs, // { field, options: [{ label, value }] }
  filters, // [{ key, label, options: [{label,value}] | string[] }]
  header, // element rendered above the list (stats, notes)
  note,
  canAdd: canAddProp,
  deleteLabel = (row) => row.id,
  searchPlaceholder,
  emptyText,
  reloadKey,
  clientSearch, // endpoint has no ?search= — filter loaded rows locally instead
}) {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const { canEndpoint } = usePermissions();
  const { toast, confirm, choose } = useFeedback();
  const primary = usePrimary();
  const base = (addConfig && addConfig.endpoint) || endpoint;
  const canCreate = canAddProp !== undefined ? canAddProp : canEndpoint(endpoint, "create");
  const canEdit = canEndpoint(endpoint, "edit");
  const canDelete = canEndpoint(endpoint, "delete");

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [tab, setTab] = useState(tabs ? tabs.options[0].value : undefined);
  const [filterValues, setFilterValues] = useState({});
  const [showFilters, setShowFilters] = useState(false);
  const [formRow, setFormRow] = useState(null); // {} for add, row for edit
  const ticket = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const activeFilters = Object.fromEntries(Object.entries(filterValues).filter(([, v]) => v !== "" && v != null));
  const query = JSON.stringify({ ...(params || {}), ...activeFilters, ...(tabs && tab != null && tabs.server ? { [tabs.field]: tab } : {}) });

  const load = useCallback(
    async (p = 1, mode = "initial") => {
      const my = ++ticket.current;
      if (mode === "initial") setLoading(true);
      if (mode === "more") setLoadingMore(true);
      if (mode === "refresh") setRefreshing(true);
      setError("");
      try {
        const qs = new URLSearchParams({
          page: String(p),
          pageSize: String(pageSize),
          ...JSON.parse(query),
          ...(debounced && !clientSearch ? { search: debounced } : {}),
        });
        const res = await api.get(`${endpoint}?${qs.toString()}`);
        if (my !== ticket.current) return;
        const data = Array.isArray(res) ? res : res.data || [];
        setRows((prev) => (p === 1 ? data : [...prev, ...data]));
        setTotal(Array.isArray(res) ? data.length : res.total ?? data.length);
        setTotalPages(Array.isArray(res) ? 1 : res.totalPages || 1);
        setPage(p);
      } catch (err) {
        if (my === ticket.current) setError(err.message || "Could not load.");
      } finally {
        if (my === ticket.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [endpoint, pageSize, query, clientSearch ? "" : debounced]
  );

  useEffect(() => {
    load(1, "initial");
  }, [load, reloadKey]);

  // Coming back from an add/edit screen refreshes the list.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      load(1, "refresh");
    }, [load])
  );

  useEffect(() => {
    if (location.state && location.state.toast) toast(location.state.toast);
  }, [location.state, toast]);

  const openAdd = () => {
    if (addPath) navigate(addPath);
    else if (addConfig && addConfig.fields) setFormRow({});
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      headerRight: () =>
        canCreate && (addPath || (addConfig && addConfig.fields)) ? (
          <IconButton name="plus" color="#fff" size={22} onPress={openAdd} label="Add" />
        ) : null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, title, canCreate, addPath, addConfig]);

  const doDelete = async (row) => {
    const ok = await confirm({
      title: "Delete record",
      message: `Delete ${deleteLabel(row)}? This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`${base}/${encodeURIComponent(row.id)}`);
      toast("Deleted successfully.");
      load(1, "refresh");
    } catch (err) {
      toast(err.message || "Failed to delete.");
    }
  };

  const reload = () => load(1, "refresh");

  const actionsFor = (row) => {
    const list = [];
    if (detailPath) list.push({ label: "View details", icon: "eye", onPress: () => navigate(detailPath(row)) });
    const extra = rowActions ? rowActions(row, { reload, toast }) || [] : [];
    list.push(...extra.filter(Boolean));
    if (canEdit && (editPath || (addConfig && addConfig.fields)))
      list.push({ label: "Edit", icon: "edit", onPress: () => (editPath ? navigate(editPath(row)) : setFormRow(row)) });
    if (canDelete && (addConfig || addPath || editPath)) list.push({ label: "Delete", icon: "trash", danger: true, onPress: () => doDelete(row) });
    return list;
  };

  const openActions = async (row) => {
    const list = actionsFor(row);
    if (list.length === 0) return;
    const picked = await choose({
      title: card(row).title,
      options: list.map((a, i) => ({ label: a.label, icon: a.icon, danger: a.danger, value: i })),
    });
    if (picked != null) list[picked].onPress();
  };

  const onPress = (row) => {
    if (onPressRow) return onPressRow(row);
    if (detailPath) return navigate(detailPath(row));
    if (canEdit && editPath) return navigate(editPath(row));
    if (canEdit && addConfig && addConfig.fields) return setFormRow(row);
    return openActions(row);
  };

  // Tabs filter client-side over what's loaded (as on the web) unless
  // `tabs.server` asks the API to filter.
  const tabbed = tabs && tab != null && !tabs.server ? rows.filter((r) => r[tabs.field] === tab) : rows;
  const needle = debounced.toLowerCase();
  const visible = clientSearch && needle ? tabbed.filter((r) => JSON.stringify(r).toLowerCase().includes(needle)) : tabbed;

  const submitForm = async (values) => {
    const editing = formRow && formRow.id;
    if (editing) await api.put(`${base}/${encodeURIComponent(formRow.id)}`, values);
    else await api.post(base, values);
    setFormRow(null);
    toast(editing ? "Updated successfully." : addConfig.successMessage || "Added successfully.");
    if (addConfig.onSuccess) addConfig.onSuccess();
    load(1, "refresh");
  };

  const activeFilterCount = Object.values(filterValues).filter((v) => v !== "" && v != null && v !== "all").length;

  const renderItem = ({ item: row }) => {
    const c = card(row);
    return (
      <Pressable onPress={() => onPress(row)} onLongPress={() => openActions(row)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}>
        <View style={styles.rowTop}>
          {c.avatar !== false ? (
            <View style={[styles.avatar, { backgroundColor: `${primary}1A` }]}>
              {c.icon ? (
                <Icon name={c.icon} size={18} color={primary} />
              ) : (
                <Text style={{ color: primary, fontWeight: "800", fontSize: 16 }}>{String(c.title || "?").charAt(0).toUpperCase()}</Text>
              )}
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {c.title || "—"}
              </Text>
              {c.amount != null ? <Text style={styles.amount}>{c.amount}</Text> : null}
            </View>
            {c.subtitle ? (
              <Text style={styles.sub} numberOfLines={1}>
                {c.subtitle}
              </Text>
            ) : null}
          </View>
          {actionsFor(row).length ? <IconButton name="ellipsis" onPress={() => openActions(row)} label="More options" /> : null}
        </View>
        {(c.meta && c.meta.filter((m) => m && m.text).length) || c.status || c.badges ? (
          <View style={styles.metaRow}>
            {(c.meta || [])
              .filter((m) => m && m.text !== undefined && m.text !== null && m.text !== "")
              .map((m, i) => (
                <View key={i} style={styles.metaItem}>
                  {m.icon ? <Icon name={m.icon} size={12} color={colors.textMuted} /> : null}
                  <Text style={styles.metaText} numberOfLines={1}>
                    {m.label ? `${m.label}: ` : ""}
                    {m.text}
                  </Text>
                </View>
              ))}
            <View style={{ flexDirection: "row", gap: 6, marginLeft: "auto" }}>
              {(c.badges || []).map((b) => (
                <StatusBadge key={b} status={b} />
              ))}
              {c.status ? <StatusBadge status={c.status} /> : null}
            </View>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={visible}
        keyExtractor={(r, i) => String(r.id ?? i)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 90, gap: 10 }}
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && !loadingMore && page < totalPages) load(page + 1, "more");
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(1, "refresh")} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            {header}
            {note ? <Note>{note}</Note> : null}
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Input
                  value={search}
                  onChangeText={setSearch}
                  placeholder={searchPlaceholder || `Search ${String(title).toLowerCase()}...`}
                  autoCorrect={false}
                  returnKeyType="search"
                />
              </View>
              {filters && filters.length ? (
                <Pressable style={[styles.filterBtn, activeFilterCount && { borderColor: primary }]} onPress={() => setShowFilters(true)}>
                  <Icon name="filter" size={18} color={activeFilterCount ? primary : colors.textMuted} />
                  {activeFilterCount ? <Text style={{ color: primary, fontWeight: "700" }}>{activeFilterCount}</Text> : null}
                </Pressable>
              ) : null}
            </View>
            {tabs ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {tabs.options.map((o) => (
                  <Chip
                    key={String(o.value)}
                    label={o.label}
                    active={tab === o.value}
                    onPress={() => setTab(o.value)}
                    count={tabs.server ? undefined : rows.filter((r) => o.value == null || r[tabs.field] === o.value).length}
                  />
                ))}
              </ScrollView>
            ) : null}
            <ErrorBox message={error} />
            {!loading ? (
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {total} record{total === 1 ? "" : "s"}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 30 }} color={primary} /> : <Empty text={search ? "No records match your search." : emptyText} />}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={primary} /> : null}
      />

      {canCreate && (addPath || (addConfig && addConfig.fields)) ? (
        <Pressable style={[styles.fab, { backgroundColor: primary }]} onPress={openAdd} accessibilityLabel={addConfig?.buttonLabel || "Add"}>
          <Icon name="plus" size={26} color="#fff" />
        </Pressable>
      ) : null}

      {/* Inline add/edit form — the web app's modal */}
      <Modal visible={!!formRow} animationType="slide" onRequestClose={() => setFormRow(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {formRow && formRow.id
                ? `Edit ${addConfig?.modalTitle ? addConfig.modalTitle.replace(/^Add /, "") : "Record"}`
                : addConfig?.modalTitle || addConfig?.buttonLabel?.replace(/^\+\s*/, "") || "Add"}
            </Text>
            <IconButton name="close" color={colors.text} onPress={() => setFormRow(null)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {formRow && addConfig ? (
              <AddRecordForm
                fields={addConfig.fields}
                initialValues={formRow.id ? formRow : undefined}
                onSubmit={submitForm}
                onCancel={() => setFormRow(null)}
                submitLabel={formRow.id ? "Save Changes" : addConfig.submitLabel || "Add"}
              />
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Filters sheet */}
      <Modal visible={showFilters} animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            <IconButton name="close" color={colors.text} onPress={() => setShowFilters(false)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {(filters || []).map((f) => (
              <View key={f.key}>
                <Text style={{ fontWeight: "600", marginBottom: 6 }}>{f.label}</Text>
                {f.type === "date" ? (
                  <DateInput value={filterValues[f.key] || ""} onChange={(v) => setFilterValues((fv) => ({ ...fv, [f.key]: v }))} />
                ) : (
                  <SearchableSelect
                    value={filterValues[f.key] ?? ""}
                    onChange={(v) => setFilterValues((fv) => ({ ...fv, [f.key]: v }))}
                    options={[{ label: "All", value: "" }, ...(f.options || []).map((o) => (typeof o === "object" ? o : { label: String(o), value: o }))]}
                    title={f.label}
                    placeholder="All"
                  />
                )}
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={[styles.sheetBtn, { borderColor: colors.border }]} onPress={() => setFilterValues({})}>
                <Text style={{ fontWeight: "700" }}>Reset</Text>
              </Pressable>
              <Pressable style={[styles.sheetBtn, { backgroundColor: primary, borderColor: primary }]} onPress={() => setShowFilters(false)}>
                <Text style={{ fontWeight: "700", color: "#fff" }}>Apply</Text>
              </Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 8 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  amount: { fontSize: 14, fontWeight: "800", color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4, maxWidth: "100%" },
  metaText: { fontSize: 12, color: colors.textMuted },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#fff",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
  sheetBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1 },
});
