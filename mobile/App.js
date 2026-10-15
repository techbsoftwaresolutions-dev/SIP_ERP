import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/context/AuthContext";
import { SessionProvider } from "./src/context/SessionContext";
import { FeedbackProvider } from "./src/components/ui";
import AppNavigator from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SessionProvider>
          <FeedbackProvider>
            <StatusBar style="light" />
            <AppNavigator />
          </FeedbackProvider>
        </SessionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
