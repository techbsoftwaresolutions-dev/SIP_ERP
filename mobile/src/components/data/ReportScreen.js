import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Screen from "../layout/Screen";
import { Button, Card, Chip, Empty, ErrorBox, Icon, IconButton, Loader, StatCard, StatGrid, StatusBadge, useFeedback } from "../ui";
import { DateInput, SearchableSelect } from "../forms";
import { shareCsv, shareTablePdf } from "../../utils/exportTable";
import { colors } from "../../theme";

// Mobile form of the web report pages (pages/reports/*): tab chips for the
// breakdowns, a filter sheet, KPI tiles, and each row as a card — first
// column is the card title, the rest are label/value pairs. CSV and PDF go
// out through the share sheet.
//
// columns: { [tab]: [{ key, header, fmt: "inr"|"qty"|"status"|undefined }] }
// load(filters, tab) => Promise<{ rows, kpis?: [[label, value, color]], extra?: node }>
export const fmtInr = (n) => `₹${(Number(n) || 0).toLocaleString("en-IN")}`;
export const fmtQty = (n) => (Number(n) || 0).toLocaleString("en-IN");

function display(col, row) {
  const v = row[col.key];
  if (col.fmt === "inr") return fmtInr(v);
  if (col.fmt === "qty") return fmtQty(v);
  return v === undefined || v === null || v === "" ? "—" : String(v);
}

export default function ReportScreen({ title, tabs, columns, filters = [], defaultFilters = {}, load }) {
  const { toast } = useFeedback();
  const [tab, setTab] = useState(tabs[0].key);
  const [values, setValues] = useState(defaultFilters);
  const [applied, setApplied] = useState(defaultFilters);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [busy, setBusy] = useState("");

  // `load` is usually an inline function; keep the latest in a ref so a
  // parent re-render (e.g. filter options arriving) doesn't re-run the report.
  const loadRef = useRef(load);
  loadRef.current = load;
  const run = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loadRef.current(applied, tab));
    } catch (err) {
      setError(err.message || "Could not run the report.");
    } finally {
      setLoading(false);
    }
  }, [applied, tab]);

  useEffect(() => {
    run();
  }, [run]);

  const cols = columns[tab] || [];
  const rows = (data && data.rows) || [];
  const tabLabel = tabs.find((t) => t.key === tab)?.label || "";
  const activeCount = Object.entries(applied).filter(([k, v]) => v && v !== "all" && v !== defaultFilters[k]).length;
  const exportCols = cols.map((c) => ({ header: c.header, key: c.key, value: (r) => (c.fmt === "status" ? r[c.key] : display(c, r)) }));

  const doExport = async (kind) => {
    setBusy(kind);
    try {
      const name = `${title}-${tabLabel}`.toLowerCase();
      if (kind === "csv") await shareCsv(exportCols, rows, name);
      else await shareTablePdf({ title: `${title} — ${tabLabel}`, columns: exportCols, rows, summary: (data?.kpis || []).map(([l, v]) => [l, v]), filename: name });
    } catch (err) {
      toast(err.message || "Export failed.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Screen title={title} refreshing={false} onRefresh={run} headerRight={filters.length ? [{ icon: "filter", onPress: () => setShowFilters(true), label: "Filters" }] : undefined}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {tabs.map((t) => (
          <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </ScrollView>

      {activeCount ? (
        <Pressable onPress={() => setShowFilters(true)} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
          <Icon name="filter" size={14} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: "600" }}>{activeCount} filter{activeCount === 1 ? "" : "s"} applied — tap to change</Text>
        </Pressable>
      ) : null}

      <ErrorBox message={error} />

      {data && data.kpis && data.kpis.length ? (
        <StatGrid>
          {data.kpis.map(([label, value, color]) => (
            <StatCard key={label} label={label} value={value} color={color || "blue"} />
          ))}
        </StatGrid>
      ) : null}
      {data && data.extra ? data.extra : null}

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Text style={{ flex: 1, color: colors.textMuted, fontSize: 12 }}>
          {loading ? "Loading…" : `${rows.length} row${rows.length === 1 ? "" : "s"} · ${tabLabel}`}
        </Text>
        <Button small variant="secondary" icon="download" title="CSV" loading={busy === "csv"} onPress={() => doExport("csv")} disabled={!rows.length} />
        <Button small variant="secondary" icon="share" title="PDF" loading={busy === "pdf"} onPress={() => doExport("pdf")} disabled={!rows.length} />
      </View>

      {loading ? (
        <Loader />
      ) : rows.length === 0 ? (
        <Empty text="No rows for these filters." icon="chart" />
      ) : (
        rows.slice(0, 300).map((r, i) => (
          <Card key={i} style={{ paddingVertical: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Text style={{ flex: 1, fontWeight: "700", color: colors.text }} numberOfLines={2}>
                {display(cols[0], r)}
              </Text>
              {cols.filter((c) => c.fmt === "status").map((c) => (
                <StatusBadge key={c.key} status={r[c.key]} />
              ))}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 6 }}>
              {cols.slice(1).filter((c) => c.fmt !== "status").map((c) => (
                <View key={c.key} style={{ width: "50%", paddingRight: 6 }}>
                  <Text style={{ fontSize: 10.5, color: colors.textMuted, textTransform: "uppercase" }}>{c.header}</Text>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: c.fmt === "inr" ? "700" : "400" }}>{display(c, r)}</Text>
                </View>
              ))}
            </View>
          </Card>
        ))
      )}
      {rows.length > 300 ? <Text style={{ color: colors.textMuted, textAlign: "center" }}>Showing 300 of {rows.length} rows — export for the full list.</Text> : null}

      <Modal visible={showFilters} animationType="slide" onRequestClose={() => setShowFilters(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: "700" }}>Filters</Text>
            <IconButton name="close" color={colors.text} onPress={() => setShowFilters(false)} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            {filters.map((f) => (
              <View key={f.key}>
                <Text style={{ fontWeight: "600", marginBottom: 6 }}>{f.label}</Text>
                {f.type === "date" ? (
                  <DateInput value={values[f.key] || ""} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
                ) : (
                  <SearchableSelect
                    value={values[f.key] ?? "all"}
                    onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                    options={[{ label: f.allLabel || "All", value: "all" }, ...(f.options || []).map((o) => (typeof o === "object" ? o : { label: String(o), value: o }))]}
                    title={f.label}
                  />
                )}
              </View>
            ))}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button
                title="Reset"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  setValues(defaultFilters);
                  setApplied(defaultFilters);
                  setShowFilters(false);
                }}
              />
              <Button
                title="Apply"
                style={{ flex: 1 }}
                onPress={() => {
                  setApplied(values);
                  setShowFilters(false);
                }}
              />
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
