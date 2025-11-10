import React, { useEffect } from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "./src/stores/auth";
import { useBranch } from "./src/stores/branch";

import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import BranchSelect from "./src/screens/BranchSelect";
import Home from "./src/screens/Home";
import ScanAdd from "./src/screens/ScanAdd";
import RemitoForm from "./src/screens/RemitoForm";
import RemitoResult from "./src/screens/RemitoResult";
import { initDb } from "./src/db";

import BranchProducts from "./src/screens/BranchProducts";
import BranchArchived from "./src/screens/BranchArchived";
import RemitosHub from "./src/screens/RemitoHub";
import RemitoIngreso from "./src/screens/RemitoIngreso";
import RemitosHistory from "./src/screens/RemitosHistory";
import RemitoDetail from "./src/screens/RemitoDetail";
import ExternalRemitoResult from "./src/screens/ExternalRemitoResult";
import UploadRemitoScreen from "./src/screens/UploadRemitoScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";

import { useThemeStore } from "./src/stores/themeProviders";

const Stack = createNativeStackNavigator();

export default function App() {
  const hydrateAuth = useAuth((s) => s.hydrate);
  const token = useAuth((s) => s.token);
  const hydrateBranch = useBranch((s) => s.hydrate);
  const { theme, mode } = useThemeStore();

  useEffect(() => {
    initDb();
    hydrateAuth();
    hydrateBranch();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={mode === "dark" ? DarkTheme : DefaultTheme}>
        {!token ? (
          <Stack.Navigator>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ title: "Registro" }}
            />
          </Stack.Navigator>
        ) : (
          <Stack.Navigator>
            <Stack.Screen
              name="BranchSelect"
              component={BranchSelect}
              options={{
                title: "Elegir sucursal",
                headerBackVisible: false,
              }}
            />
            <Stack.Screen
              name="Home"
              component={Home}
              options={{ title: "Menú" }}
            />
            <Stack.Screen
              name="RemitosHub"
              component={RemitosHub}
              options={{ title: "Remitos" }}
            />
            <Stack.Screen
              name="ScanAdd"
              component={ScanAdd}
              options={{ title: "Escanear / Agregar" }}
            />
            <Stack.Screen
              name="RemitoForm"
              component={RemitoForm}
              options={{ title: "Formar remito" }}
            />
            <Stack.Screen
              name="RemitoIngreso"
              component={RemitoIngreso}
              options={{ title: "Remito de entrada" }}
            />
            <Stack.Screen
              name="RemitosHistory"
              component={RemitosHistory}
              options={{ title: "Historial de remitos" }}
            />
            <Stack.Screen
              name="RemitoDetail"
              component={RemitoDetail}
              options={{ title: "Remito" }}
            />
            <Stack.Screen
              name="RemitoResult"
              component={RemitoResult}
              options={{ title: "Remito generado" }}
            />
            <Stack.Screen
              name="BranchProducts"
              component={BranchProducts}
              options={{ title: "Productos de la sucursal" }}
            />
            <Stack.Screen
              name="BranchArchived"
              component={BranchArchived}
              options={{ title: "Archivados" }}
            />
            <Stack.Screen
              name="ExternalRemitoResult"
              component={ExternalRemitoResult}
              options={{ title: "Remito Procesado" }}
            />
            <Stack.Screen
              name="UploadRemito"
              component={UploadRemitoScreen}
              options={{ title: "Digitalizar Remito" }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: "Configuración" }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              options={{ title: "Mi Perfil" }}
            />
          </Stack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}