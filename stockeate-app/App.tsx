import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "./src/stores/auth";
import LoginScreen from "./src/screens/LoginScreen";
import BranchSelect from "./src/screens/BranchSelect";
import Home from "./src/screens/Home";
import ScanAdd from "./src/screens/ScanAdd";
import RemitoForm from "./src/screens/RemitoForm";
import RemitoResult from "./src/screens/RemitoResult";
import { initDb } from "./src/db";

const Stack = createNativeStackNavigator();

export default function App() {
  const hydrate = useAuth((s) => s.hydrate);
  const token = useAuth((s) => s.token);

  useEffect(() => { initDb(); hydrate(); }, []);

  return (
    <NavigationContainer>
      {!token ? (
        <Stack.Navigator>
          <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Stockeate - Acceso" }} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator>
          <Stack.Screen name="BranchSelect" component={BranchSelect} options={{ title: "Elegir sucursal" }} />
          <Stack.Screen name="Home" component={Home} options={{ title: "Menú" }} />
          <Stack.Screen name="ScanAdd" component={ScanAdd} options={{ title: "Escanear / Agregar" }} />
          <Stack.Screen name="RemitoForm" component={RemitoForm} options={{ title: "Formar remito" }} />
          <Stack.Screen name="RemitoResult" component={RemitoResult} options={{ title: "Remito generado" }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
