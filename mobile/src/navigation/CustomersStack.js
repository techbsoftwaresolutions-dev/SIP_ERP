import { createNativeStackNavigator } from "@react-navigation/native-stack";
import CustomersScreen from "../screens/CustomersScreen";
import FormScreen from "../screens/FormScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

const headerOptions = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "700" },
};

export default function CustomersStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="CustomersHome" component={CustomersScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Form" component={FormScreen} />
    </Stack.Navigator>
  );
}
