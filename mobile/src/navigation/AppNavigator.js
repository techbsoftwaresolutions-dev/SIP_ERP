import { ActivityIndicator, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/SessionContext";
import { Icon } from "../components/ui";
import { colors } from "../theme";
import { registerRoutes } from "./router";
import { ROUTES } from "./routes";
import Login from "../pages/auth/Login";
import SubscriptionBlocked from "../pages/auth/SubscriptionBlocked";
import Dashboard from "../pages/dashboard/Dashboard";
import More from "../pages/dashboard/More";
import Sales from "../pages/sales/Sales";
import { CustomerList as Customers } from "../pages/parties";
import { Items } from "../pages/products";

registerRoutes(Object.keys(ROUTES));

// URLs for every screen — the same paths as the web app. On the web preview
// they show in the address bar; on a phone they make siperp://… deep links
// (e.g. siperp://sales/invoices/INV-0001) open the right screen.
const linking = {
  prefixes: ["siperp://"],
  config: {
    screens: {
      Tabs: { screens: { Dashboard: "dashboard", Customers: "customers", Products: "products/items", Sales: "sales", More: "more" } },
      ...Object.fromEntries(Object.keys(ROUTES).map((p) => [p, p.slice(1)])),
    },
  },
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const headerOptions = (primary) => ({
  headerStyle: { backgroundColor: primary },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "700" },
  contentStyle: { backgroundColor: colors.bg },
});

// Bottom tabs mirror the web app's mobile nav (MobileNav.jsx): Dashboard,
// Customers, Products, Sales, More — each only if this user may open it.
function Tabs() {
  const { can, primary } = usePermissions();
  const p = primary || colors.primary;
  const tabs = [
    { name: "Dashboard", component: Dashboard, icon: "home", module: "dashboard" },
    { name: "Customers", component: Customers, icon: "users", module: "customers" },
    { name: "Products", component: Items, icon: "package", module: "products" },
    { name: "Sales", component: Sales, icon: "bag", module: "sales" },
    { name: "More", component: More, icon: "ellipsis", module: null },
  ].filter((t) => !t.module || can(t.module, "view"));

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...headerOptions(p),
        tabBarActiveTintColor: p,
        tabBarInactiveTintColor: colors.textLight,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarIcon: ({ color }) => <Icon name={tabs.find((t) => t.name === route.name)?.icon} size={21} color={color} />,
      })}
    >
      {tabs.map((t) => (
        <Tab.Screen key={t.name} name={t.name} component={t.component} options={{ tabBarLabel: t.name }} />
      ))}
    </Tab.Navigator>
  );
}

function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, initializing } = useAuth();
  const session = usePermissions();

  if (initializing) return <Loading />;

  return (
    <NavigationContainer linking={isAuthenticated ? linking : undefined}>
      {!isAuthenticated ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={Login} />
        </Stack.Navigator>
      ) : session.loading ? (
        <Loading />
      ) : session.blocked ? (
        <SubscriptionBlocked />
      ) : (
        <Stack.Navigator screenOptions={headerOptions(session.primary || colors.primary)}>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
          {Object.entries(ROUTES).map(([pattern, component]) => (
            <Stack.Screen key={pattern} name={pattern} component={component} options={{ title: "" }} />
          ))}
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
