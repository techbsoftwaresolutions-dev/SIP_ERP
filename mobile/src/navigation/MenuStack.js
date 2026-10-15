import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MenuScreen from "../screens/MenuScreen";
import ListScreen from "../screens/ListScreen";
import FormScreen from "../screens/FormScreen";
import ItemFormScreen from "../screens/ItemFormScreen";
import ReportsScreen from "../screens/ReportsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

const headerOptions = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "700" },
};

// The "More" tab: grouped navigation home + every screen that doesn't have
// its own bottom tab (Reports, Settings, and every List/Form module page).
export default function MenuStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="MenuHome" component={MenuScreen} options={{ headerShown: false }} />
      <Stack.Screen name="List" component={ListScreen} />
      <Stack.Screen name="Form" component={FormScreen} />
      <Stack.Screen name="ItemForm" component={ItemFormScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: "Reports & Analytics" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Account & Settings" }} />
    </Stack.Navigator>
  );
}
