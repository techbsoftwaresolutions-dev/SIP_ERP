import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import api, { API_BASE_URL } from "../../api/client";
import Screen from "../../components/layout/Screen";
import { Card, Icon, useFeedback, usePrimary } from "../../components/ui";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/SessionContext";
import { visibleNav } from "../../navigation/menu";
import { useNavigate } from "../../navigation/router";
import { colors } from "../../theme";

// The "More" tab: every menu group the web sidebar would show this user
// (same gating), plus account actions from the web Topbar profile menu.
export default function More() {
  const { user, logout, company } = useAuth();
  const { can, menuConfig, subscription } = usePermissions();
  const navigate = useNavigate();
  const { confirm } = useFeedback();
  const primary = usePrimary();
  const [settings, setSettings] = useState(null);
  const [open, setOpen] = useState({});

  useEffect(() => {
    api.get("/api/settings").then(setSettings).catch(() => {});
  }, []);

  const nav = visibleNav({ can, menuConfig, role: user?.role });

  const doLogout = async () => {
    if (await confirm({ title: "Sign out", message: "Sign out of this device?", confirmLabel: "Sign out", danger: true })) logout();
  };

  return (
    <Screen title="More">
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {settings?.logo ? (
          <Image source={{ uri: settings.logo }} style={{ width: 48, height: 48, borderRadius: 8 }} resizeMode="contain" />
        ) : (
          <View style={[styles.avatar, { backgroundColor: primary }]}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{(user?.name || "?").charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>{user?.name || user?.username}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            {user?.role}
            {settings?.companyName ? ` · ${settings.companyName}` : ""}
          </Text>
          {company ? <Text style={{ color: colors.textLight, fontSize: 12 }}>Company code: {company}</Text> : null}
        </View>
      </Card>

      {nav
        .filter((item) => item.to !== "/dashboard")
        .map((item) =>
          item.children ? (
            <Card key={item.label} style={{ padding: 0, overflow: "hidden" }}>
              <Pressable style={styles.groupHead} onPress={() => setOpen((o) => ({ ...o, [item.label]: !o[item.label] }))}>
                <View style={[styles.icon, { backgroundColor: `${primary}1A` }]}>
                  <Icon name={item.icon} size={18} color={primary} />
                </View>
                <Text style={styles.groupTitle}>{item.label}</Text>
                <Icon name={open[item.label] ? "chevronDown" : "chevronRight"} size={18} color={colors.textMuted} />
              </Pressable>
              {open[item.label]
                ? item.children.map((c) => (
                    <Pressable key={c.to} style={styles.child} onPress={() => navigate(c.to)}>
                      <Icon name={c.icon} size={16} color={colors.textMuted} />
                      <Text style={{ flex: 1, color: colors.text }}>{c.label}</Text>
                      <Icon name="chevronRight" size={16} color={colors.textLight} />
                    </Pressable>
                  ))
                : null}
            </Card>
          ) : (
            <Card key={item.to} style={{ padding: 0 }}>
              <Pressable style={styles.groupHead} onPress={() => navigate(item.to)}>
                <View style={[styles.icon, { backgroundColor: `${primary}1A` }]}>
                  <Icon name={item.icon} size={18} color={primary} />
                </View>
                <Text style={styles.groupTitle}>{item.label}</Text>
                <Icon name="chevronRight" size={18} color={colors.textMuted} />
              </Pressable>
            </Card>
          )
        )}

      <Card style={{ padding: 0 }}>
        <Pressable style={styles.groupHead} onPress={() => navigate("/subscription")}>
          <View style={[styles.icon, { backgroundColor: colors.greenBg }]}>
            <Icon name="wallet" size={18} color={colors.green} />
          </View>
          <Text style={styles.groupTitle}>My Subscription</Text>
          {subscription?.planName ? <Text style={{ color: colors.textMuted }}>{subscription.planName}</Text> : null}
          <Icon name="chevronRight" size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable style={[styles.groupHead, styles.divider]} onPress={() => navigate("/profile")}>
          <View style={[styles.icon, { backgroundColor: colors.blueBg }]}>
            <Icon name="lock" size={18} color={colors.blue} />
          </View>
          <Text style={styles.groupTitle}>Profile & Password</Text>
          <Icon name="chevronRight" size={18} color={colors.textMuted} />
        </Pressable>
        <Pressable style={[styles.groupHead, styles.divider]} onPress={doLogout}>
          <View style={[styles.icon, { backgroundColor: colors.redBg }]}>
            <Icon name="logout" size={18} color={colors.red} />
          </View>
          <Text style={[styles.groupTitle, { color: colors.red }]}>Sign out</Text>
        </Pressable>
      </Card>
      <Text style={{ textAlign: "center", color: colors.textLight, fontSize: 11 }}>{API_BASE_URL}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  groupHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  groupTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  child: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    paddingLeft: 60,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
});
