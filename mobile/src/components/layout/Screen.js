import { useLayoutEffect, useRef } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { colors } from "../../theme";
import { IconButton } from "../ui";

// Standard scrolling page body. `title` sets the native header title;
// `headerRight` takes [{ icon, onPress, label }] buttons.
export default function Screen({ title, headerRight, children, scroll = true, refreshing, onRefresh, style, contentStyle }) {
  const navigation = useNavigation();
  // Callers pass a fresh headerRight array every render; re-apply header
  // options only when the set of buttons changes, reading the latest
  // handlers through a ref.
  const buttonsRef = useRef(headerRight);
  buttonsRef.current = headerRight;
  const buttonsKey = headerRight ? headerRight.filter(Boolean).map((b) => b.icon).join(",") : null;
  useLayoutEffect(() => {
    const opts = {};
    if (title) opts.title = title;
    if (buttonsKey !== null) {
      opts.headerRight = () => (
        <View style={{ flexDirection: "row", gap: 4 }}>
          {(buttonsRef.current || []).filter(Boolean).map((b) => (
            <IconButton
              key={b.icon}
              name={b.icon}
              onPress={() => {
                const current = (buttonsRef.current || []).filter(Boolean).find((x) => x.icon === b.icon);
                if (current) current.onPress();
              }}
              color="#fff"
              size={20}
              label={b.label}
            />
          ))}
        </View>
      );
    }
    navigation.setOptions(opts);
  }, [navigation, title, buttonsKey]);

  if (!scroll) return <View style={[styles.root, style]}>{children}</View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        style={[styles.root, style]}
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export const screenStyles = StyleSheet.create({
  gap: { gap: 14 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, gap: 14 },
});
