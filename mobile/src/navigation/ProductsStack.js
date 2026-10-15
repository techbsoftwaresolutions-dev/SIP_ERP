import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ListScreen from "../screens/ListScreen";
import FormScreen from "../screens/FormScreen";
import { colors } from "../theme";

const Stack = createNativeStackNavigator();

const headerOptions = {
  headerStyle: { backgroundColor: colors.navy },
  headerTintColor: "#fff",
  headerTitleStyle: { fontWeight: "700" },
};

export default function ProductsStack() {
  return (
    <Stack.Navigator screenOptions={headerOptions}>
      <Stack.Screen name="ProductsHome" component={ListScreen} initialParams={{ moduleKey: "products" }} options={{ title: "Products" }} />
      <Stack.Screen name="Form" component={FormScreen} />
    </Stack.Navigator>
  );
}
