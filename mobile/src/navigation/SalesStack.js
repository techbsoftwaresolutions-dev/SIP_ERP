import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SalesScreen from "../screens/SalesScreen";
import ListScreen from "../screens/ListScreen";
import FormScreen from "../screens/FormScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

const headerOptions = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "700" },
};

export default function SalesStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="SalesHome" component={SalesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="List" component={ListScreen} />
      <Stack.Screen name="Form" component={FormScreen} />
    </Stack.Navigator>
  );
}
