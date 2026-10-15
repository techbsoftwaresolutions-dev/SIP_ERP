import { useState } from "react";
import { Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import api, { getTenant, setTenant } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { Button, ErrorBox, Icon, Note } from "../../components/ui";
import { TextField } from "../../components/forms";
import { colors } from "../../theme";

// Sign in. On the web the client is picked by the subdomain
// (acme.<domain>); a phone has no subdomain, so it asks for that same code
// once and remembers it.
export default function Login() {
  const { login, company, sessionExpired } = useAuth();
  const [mode, setMode] = useState("login"); // login | forgot
  const [companyCode, setCompanyCode] = useState(company || "");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!username.trim() || !password) return setError("Enter your username and password.");
    setBusy(true);
    try {
      const res = await login(companyCode, username.trim(), password);
      if (!res || !res.success) setError((res && res.message) || "Invalid username or password.");
    } catch (err) {
      if (err.code === "SUBSCRIPTION_INACTIVE") setError(err.message || "This company's subscription is not active.");
      else setError(err.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async () => {
    setError("");
    setInfo("");
    if (!email.trim()) return setError("Enter the email address on your account.");
    setBusy(true);
    try {
      await setTenant(companyCode);
      await api.post("/api/auth/forgot-password", { email: email.trim() });
      setInfo("If that email belongs to an account, a reset link is on its way. Open it on any device to set a new password.");
    } catch (err) {
      setError(err.message || "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.navy }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            {/* The logo's dark lettering needs a light surface, so it sits on a white card. */}
            <View style={styles.logoCard}>
              <Image source={require("../../../assets/logo-full.png")} style={styles.logoImage} resizeMode="contain" accessibilityLabel="SIPERP – Smart Industry Platform" />
            </View>
            <Text style={styles.brandSub}>Manage sales, purchase, inventory and production on the go</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>{mode === "login" ? "Sign in" : "Reset password"}</Text>
            {sessionExpired && mode === "login" ? <Note icon="clock">Your session ended. Please sign in again.</Note> : null}
            <ErrorBox message={error} />
            {info ? <Note icon="mail">{info}</Note> : null}

            <TextField
              label="Company code"
              value={companyCode}
              onChangeText={(v) => setCompanyCode(v.replace(/\s/g, "").toLowerCase())}
              placeholder="e.g. acme"
              autoCapitalize="none"
              autoCorrect={false}
              hint="The company code your administrator gave you: the first part of your SIPERP web address."
            />

            {mode === "login" ? (
              <>
                <TextField
                  label="Username"
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter your username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="username"
                />
                <View>
                  <TextField
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    textContentType="password"
                    onSubmitEditing={submit}
                  />
                  <Pressable style={styles.eye} onPress={() => setShowPassword((v) => !v)} hitSlop={10}>
                    <Icon name={showPassword ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
                <Button title="Sign in" onPress={submit} loading={busy} />
                <Pressable onPress={() => { setMode("forgot"); setError(""); }} style={{ alignSelf: "center", marginTop: 16 }}>
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>Forgot password?</Text>
                </Pressable>
              </>
            ) : (
              <>
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Button title="Send reset link" onPress={sendReset} loading={busy} />
                <Pressable onPress={() => { setMode("login"); setError(""); setInfo(""); }} style={{ alignSelf: "center", marginTop: 16 }}>
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>Back to sign in</Text>
                </Pressable>
              </>
            )}
          </View>
          <Text style={styles.footer}>
            {getTenant() ? `Signing in to ${getTenant()}` : "Leave company code empty for the main workspace."}
          </Text>
          <Text style={styles.footer}>
            By signing in you agree to the{" "}
            <Text style={styles.link} onPress={() => Linking.openURL("https://siperp.in/terms-and-conditions/")}>Terms &amp; Conditions</Text>
            {" "}and{" "}
            <Text style={styles.link} onPress={() => Linking.openURL("https://siperp.in/privacy-policy/")}>Privacy Policy</Text>.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: "center", padding: 20, gap: 18 },
  brand: { alignItems: "center", gap: 10 },
  logoCard: { backgroundColor: "#fff", borderRadius: 18, paddingHorizontal: 18, paddingVertical: 12 },
  logoImage: { width: 230, height: 91 },
  brandSub: { color: "#aab2c0", fontSize: 13, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 20 },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 14 },
  eye: { position: "absolute", right: 12, top: 36 },
  footer: { color: "#aab2c0", fontSize: 12, textAlign: "center" },
  link: { color: "#cfe0ff", textDecorationLine: "underline" },
});
