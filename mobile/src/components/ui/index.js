import { createContext, useCallback, useContext, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, radius, statusColors } from "../../theme";
import { useSession } from "../../context/SessionContext";

// Web icon names (frontend/src/components/ui/Icon.jsx, and the icon keys the
// super admin can pick in Menu Management) mapped onto Feather glyphs.
const ICONS = {
  home: "home", users: "users", user: "user", truck: "truck", package: "package", cart: "shopping-cart",
  bag: "shopping-bag", store: "archive", chart: "bar-chart-2", trending: "trending-up", coins: "dollar-sign",
  banknote: "credit-card", wallet: "briefcase", tag: "tag", file: "file-text", settings: "settings",
  wrench: "tool", lock: "lock", calendar: "calendar", bell: "bell", image: "image", palette: "droplet",
  mail: "mail", phone: "phone", whatsapp: "message-circle", share: "share-2", sparkles: "star", eye: "eye",
  printer: "printer", upload: "upload", download: "download", search: "search", filter: "filter",
  arrowLeft: "corner-up-left", checkCircle: "check-circle", alertCircle: "alert-circle",
  alertTriangle: "alert-triangle", edit: "edit-2", trash: "trash-2", plus: "plus", close: "x",
  chevronRight: "chevron-right", chevronDown: "chevron-down", ellipsis: "more-horizontal",
  logout: "log-out", refresh: "refresh-cw", check: "check", copy: "copy", list: "list", grid: "grid",
  clock: "clock", building: "briefcase", info: "info", send: "send", layers: "layers", repeat: "repeat",
};

export function Icon({ name, size = 18, color = colors.text, style }) {
  return <Feather name={ICONS[name] || name || "circle"} size={size} color={color} style={style} />;
}

export function usePrimary() {
  try {
    return useSession().primary || colors.primary;
  } catch (_) {
    return colors.primary;
  }
}

export function Button({ title, onPress, variant = "primary", icon, disabled, loading, style, small }) {
  const primary = usePrimary();
  const bg =
    variant === "primary" ? primary : variant === "danger" ? colors.red : variant === "ghost" ? "transparent" : colors.card;
  const fg = variant === "primary" || variant === "danger" ? "#fff" : variant === "ghost" ? primary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { backgroundColor: bg, borderColor: variant === "secondary" ? colors.border : bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={small ? 14 : 16} color={fg} /> : null}
          {title ? <Text style={[styles.btnText, small && { fontSize: 13 }, { color: fg }]}>{title}</Text> : null}
        </>
      )}
    </Pressable>
  );
}

export function IconButton({ name, onPress, color = colors.textMuted, size = 18, style, label }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Icon name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Card({ children, style, onPress }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.92 : 1 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right, style }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function StatusBadge({ status }) {
  if (!status) return null;
  const c = statusColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]} numberOfLines={1}>
        {status}
      </Text>
    </View>
  );
}

export function Loader({ style }) {
  const primary = usePrimary();
  return (
    <View style={[{ padding: 32, alignItems: "center" }, style]}>
      <ActivityIndicator color={primary} size="large" />
    </View>
  );
}

export function Empty({ text = "No records found.", icon = "file" }) {
  return (
    <View style={{ padding: 36, alignItems: "center", gap: 10 }}>
      <Icon name={icon} size={30} color={colors.textLight} />
      <Text style={{ color: colors.textMuted, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

export function ErrorBox({ message, style }) {
  if (!message) return null;
  return (
    <View style={[styles.errorBox, style]}>
      <Icon name="alertCircle" size={16} color={colors.red} />
      <Text style={{ color: colors.red, flex: 1 }}>{message}</Text>
    </View>
  );
}

export function Note({ children, icon = "info" }) {
  return (
    <View style={styles.note}>
      <Icon name={icon} size={16} color={colors.blue} />
      <Text style={{ color: colors.text, flex: 1, fontSize: 13 }}>{children}</Text>
    </View>
  );
}

export function StatCard({ label, value, color = "blue", icon, sub }) {
  return (
    <View style={styles.stat}>
      {icon ? (
        <View style={[styles.statIcon, { backgroundColor: colors[`${color}Bg`] || colors.blueBg }]}>
          <Icon name={icon} size={16} color={colors[color] || colors.blue} />
        </View>
      ) : null}
      <Text style={styles.statLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.statValue, { color: colors[color] || colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value ?? "—"}
      </Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

export function StatGrid({ children }) {
  return <View style={styles.statGrid}>{children}</View>;
}

// Label/value pairs in two columns — the mobile form of the web .detail-grid.
export function KeyValueGrid({ rows }) {
  return (
    <View style={styles.kvGrid}>
      {rows
        .filter(Boolean)
        .map(([label, value, opts = {}]) => (
          <View key={label} style={[styles.kvCell, opts.full && { width: "100%" }]}>
            <Text style={styles.kvLabel}>{label}</Text>
            {typeof value === "string" || typeof value === "number" || value == null ? (
              <Text style={styles.kvValue} selectable>
                {value === "" || value == null ? "—" : String(value)}
              </Text>
            ) : (
              value
            )}
          </View>
        ))}
    </View>
  );
}

// A compact read-only table (line items on detail screens). Scrolls
// horizontally when it has more columns than fit.
// Cells may render strings or elements (badges, buttons). Elements must not
// be nested inside <Text> — that breaks on native — so only wrap primitives.
function Cell({ value, style }) {
  if (value === null || value === undefined || value === "") return <Text style={style}>—</Text>;
  if (typeof value === "string" || typeof value === "number") return <Text style={style}>{value}</Text>;
  return value;
}

export function MiniTable({ columns, rows, empty = "No items." }) {
  if (!rows || rows.length === 0) return <Text style={{ color: colors.textMuted, paddingVertical: 8 }}>{empty}</Text>;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <View key={i} style={styles.miniRow}>
          {columns.map((c, ci) => {
            const value = c.render ? c.render(r, i) : r[c.key];
            // A render function returning null means "nothing here" (e.g. an
            // action that doesn't apply to this row) — not a missing value.
            if (c.render && value === null && ci > 0) return <View key={c.key} style={styles.miniCell} />;
            if (ci === 0) {
              return (
                <View key={c.key} style={{ width: "100%", marginBottom: 2 }}>
                  <Cell value={value} style={{ fontWeight: "700", color: colors.text }} />
                </View>
              );
            }
            return (
              <View key={c.key} style={styles.miniCell}>
                {c.label ? <Text style={styles.kvLabel}>{c.label}</Text> : null}
                <Cell value={value} style={{ color: colors.text, fontSize: 13 }} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function TotalsBox({ rows }) {
  return (
    <View style={styles.totals}>
      {rows.filter(Boolean).map(([label, value, grand]) => (
        <View key={label} style={[styles.totalsRow, grand && styles.totalsGrand]}>
          <Text style={[{ color: colors.textMuted }, grand && { color: colors.text, fontWeight: "700" }]}>{label}</Text>
          <Text style={[{ color: colors.text, fontWeight: "600" }, grand && { fontWeight: "800", fontSize: 16 }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export function Chip({ label, active, onPress, count }) {
  const primary = usePrimary();
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: primary, borderColor: primary }]}>
      <Text style={[styles.chipText, active && { color: "#fff" }]}>
        {label}
        {count != null ? `  ${count}` : ""}
      </Text>
    </Pressable>
  );
}

// ---------- Toasts + confirm dialogs (work on native AND web) ----------

const FeedbackContext = createContext({ toast: () => {}, confirm: async () => false, choose: async () => null });

export function FeedbackProvider({ children }) {
  const [toastMsg, setToastMsg] = useState("");
  const timer = useRef(null);
  const [dialog, setDialog] = useState(null);

  const toast = useCallback((msg, ms = 2600) => {
    setToastMsg(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastMsg(""), ms);
  }, []);

  // confirm({ title, message, confirmLabel, danger }) -> Promise<boolean>
  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setDialog({ kind: "confirm", ...opts, resolve });
      }),
    []
  );

  // choose({ title, options: [{ label, value, icon, danger }] }) -> Promise<value|null>
  const choose = useCallback(
    (opts) =>
      new Promise((resolve) => {
        setDialog({ kind: "choose", ...opts, resolve });
      }),
    []
  );

  const close = (result) => {
    if (dialog) dialog.resolve(result);
    setDialog(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm, choose }}>
      {children}
      {toastMsg ? (
        <View pointerEvents="none" style={styles.toastWrap}>
          <View style={styles.toast}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>{toastMsg}</Text>
          </View>
        </View>
      ) : null}
      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => close(dialog?.kind === "confirm" ? false : null)}>
        <Pressable style={styles.backdrop} onPress={() => close(dialog?.kind === "confirm" ? false : null)}>
          <Pressable style={dialog?.kind === "choose" ? styles.sheet : styles.dialog} onPress={() => {}}>
            {dialog?.title ? <Text style={styles.dialogTitle}>{dialog.title}</Text> : null}
            {dialog?.message ? <Text style={styles.dialogMsg}>{dialog.message}</Text> : null}
            {dialog?.kind === "confirm" ? (
              <View style={styles.dialogActions}>
                <Button title={dialog.cancelLabel || "Cancel"} variant="secondary" onPress={() => close(false)} style={{ flex: 1 }} />
                <Button
                  title={dialog.confirmLabel || "Confirm"}
                  variant={dialog.danger ? "danger" : "primary"}
                  onPress={() => close(true)}
                  style={{ flex: 1 }}
                />
              </View>
            ) : dialog?.kind === "choose" ? (
              <View>
                {(dialog.options || []).map((o) => (
                  <Pressable key={String(o.value)} style={styles.sheetOption} onPress={() => close(o.value)}>
                    {o.icon ? <Icon name={o.icon} size={18} color={o.danger ? colors.red : colors.text} /> : null}
                    <Text style={{ fontSize: 15, color: o.danger ? colors.red : colors.text }}>{o.label}</Text>
                  </Pressable>
                ))}
                <Pressable style={[styles.sheetOption, { justifyContent: "center" }]} onPress={() => close(null)}>
                  <Text style={{ fontSize: 15, color: colors.textMuted, fontWeight: "600" }}>Cancel</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  return useContext(FeedbackContext);
}

export const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnSmall: { paddingVertical: 7, paddingHorizontal: 12 },
  btnText: { fontWeight: "700", fontSize: 15 },
  iconBtn: { padding: 6 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "700" },
  errorBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: colors.redBg,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  note: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: colors.blueBg,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  statIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  statLabel: { fontSize: 12, color: colors.textMuted },
  statValue: { fontSize: 20, fontWeight: "800" },
  statSub: { fontSize: 11, color: colors.textLight },
  kvGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 12 },
  kvCell: { width: "50%", paddingRight: 8, gap: 2 },
  kvLabel: { fontSize: 11, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.3 },
  kvValue: { fontSize: 14, color: colors.text, fontWeight: "500" },
  miniRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 10,
    rowGap: 6,
  },
  miniCell: { width: "33.3%", paddingRight: 6 },
  totals: { borderTopWidth: 1, borderColor: colors.border, marginTop: 12, paddingTop: 8, gap: 6 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between" },
  totalsGrand: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 13, color: colors.text, fontWeight: "600" },
  toastWrap: { position: "absolute", left: 0, right: 0, bottom: 90, alignItems: "center" },
  toast: { backgroundColor: "#111827", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, maxWidth: "90%" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 24 },
  dialog: { backgroundColor: "#fff", borderRadius: 14, padding: 20, gap: 10 },
  sheet: { backgroundColor: "#fff", borderRadius: 14, paddingVertical: 8, paddingHorizontal: 4 },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dialogTitle: { fontSize: 17, fontWeight: "700", color: colors.text, paddingHorizontal: 12, paddingTop: 4 },
  dialogMsg: { fontSize: 14, color: colors.textMuted, paddingHorizontal: 12 },
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 8 },
});
