import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../context/SessionContext";
import { Button, Icon } from "../../components/ui";
import { colors } from "../../theme";

// Port of frontend/src/components/layout/SubscriptionBlocked.jsx.
export default function SubscriptionBlocked() {
  const { subscription, recheck } = usePermissions();
  const { logout } = useAuth();
  const [checking, setChecking] = useState(false);
  const { state, planName, subscriptionEnd, companyName, message } = subscription || {};
  const suspended = state === "suspended";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={[styles.icon, { backgroundColor: suspended ? colors.purpleBg : colors.amberBg }]}>
          <Icon name={suspended ? "lock" : "clock"} size={30} color={suspended ? colors.purple : colors.amber} />
        </View>
        <Text style={styles.title}>{suspended ? "Account suspended" : "Subscription expired"}</Text>
        {companyName ? <Text style={styles.company}>{companyName}</Text> : null}
        <Text style={styles.msg}>
          {message ||
            (suspended
              ? "Access to this account has been suspended."
              : "Your subscription has ended, so access to the app is paused. Your data is safe.")}
        </Text>
        {planName || subscriptionEnd ? (
          <View style={styles.box}>
            {planName ? <Text style={styles.row}>Plan: {planName}</Text> : null}
            {subscriptionEnd ? <Text style={styles.row}>Ended: {String(subscriptionEnd).slice(0, 10)}</Text> : null}
          </View>
        ) : null}
        <Text style={styles.msg}>Contact TechB Software Solutions to {suspended ? "restore" : "renew"} access.</Text>
        <Button
          title={checking ? "Checking…" : "Check again"}
          loading={checking}
          onPress={async () => {
            setChecking(true);
            await recheck();
            setChecking(false);
          }}
          style={{ alignSelf: "stretch" }}
        />
        <Button title="Sign out" variant="secondary" onPress={logout} style={{ alignSelf: "stretch" }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 14 },
  icon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", color: colors.text },
  company: { fontSize: 15, color: colors.textMuted, fontWeight: "600" },
  msg: { fontSize: 14, color: colors.textMuted, textAlign: "center" },
  box: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, alignSelf: "stretch", gap: 4 },
  row: { color: colors.text },
});
