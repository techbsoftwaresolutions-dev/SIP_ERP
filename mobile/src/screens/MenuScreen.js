import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { colors, radius, ICON_BG } from "../theme";

// Mirrors the web app's "More" page exactly: same 5 groups, same tiles.
const GROUPS = [
  {
    label: "Management",
    items: [
      { title: "Customers", sub: "Manage your customers", icon: "👥", color: "purple", moduleKey: "customers" },
      { title: "Suppliers", sub: "Manage your suppliers", icon: "🚚", color: "orange", moduleKey: "suppliers" },
      { title: "Products", sub: "Manage your products & categories", icon: "📦", color: "green", moduleKey: "products" },
    ],
  },
  {
    label: "Transactions",
    items: [
      { title: "Purchase", sub: "Manage purchase orders and bills", icon: "🛒", color: "blue", moduleKey: "purchaseOrders", isItemModule: true },
      { title: "Sales", sub: "Manage sales orders and invoices", icon: "🛍️", color: "orange", moduleKey: "salesOrders" },
      { title: "Returns", sub: "Manage sales returns", icon: "📄", color: "green", moduleKey: "salesReturns" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Inventory", sub: "Stock overview and adjustment", icon: "📦", color: "purple", moduleKey: "stockIn" },
      { title: "Stock", sub: "Stock in and stock out", icon: "🏬", color: "orange", moduleKey: "stockOut" },
    ],
  },
  {
    label: "Reports",
    items: [
      { title: "Reports", sub: "View all business reports", icon: "📊", color: "green", screen: "Reports" },
      { title: "Analytics", sub: "Business analytics and insights", icon: "📈", color: "red", screen: "Reports" },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users & Roles", sub: "Manage users and permissions", icon: "👤", color: "blue", moduleKey: "users" },
      { title: "Settings", sub: "Company and system settings", icon: "⚙️", color: "purple", screen: "Settings" },
    ],
  },
];

export default function MenuScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [notifTotal, setNotifTotal] = useState(0);

  useEffect(() => {
    api.get("/api/activity-log?page=1&pageSize=1").then((r) => setNotifTotal(r.total || 0)).catch(() => {});
  }, []);

  const openItem = (item) => {
    if (item.screen) navigation.navigate(item.screen);
    else navigation.navigate("List", { moduleKey: item.moduleKey });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>More</Text>
          <Text style={styles.crumb}>Dashboard / More</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={{ position: "relative", marginRight: 12 }}>
            <Text style={{ fontSize: 19 }}>🔔</Text>
            {notifTotal > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{notifTotal > 9 ? "9+" : notifTotal}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.userChip} onPress={() => navigation.navigate("Settings")}>
            <View style={styles.avatar}>
              <Text style={{ fontSize: 13 }}>{user?.avatar || "🙂"}</Text>
            </View>
            <Text style={styles.userChipText} numberOfLines={1}>{user?.name || "Admin"} ▾</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {GROUPS.map((group) => (
          <View key={group.label} style={styles.group}>
            <Text style={styles.groupTitle}>{group.label}</Text>
            <View style={styles.groupCard}>
              {group.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.title}
                  style={[styles.tile, idx === group.items.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => openItem(item)}
                >
                  <View style={[styles.tileIcon, ICON_BG[item.color]]}>
                    <Text style={{ fontSize: 17 }}>{item.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.tileTitle}>{item.title}</Text>
                    <Text style={styles.tileSub}>{item.sub}</Text>
                  </View>
                  <Text style={styles.tileArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerRight: { flexDirection: "row", alignItems: "center" },
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
  userChip: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 130 },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.purpleBg, alignItems: "center", justifyContent: "center" },
  userChipText: { fontSize: 12, fontWeight: "700", color: colors.text },
  group: { marginBottom: 18 },
  groupTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
    marginLeft: 2,
  },
  groupCard: {
    backgroundColor: "#fff",
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tileIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tileTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  tileSub: { fontSize: 11.5, color: colors.textMuted, marginTop: 1 },
  tileArrow: { fontSize: 18, color: colors.textLight },
});
