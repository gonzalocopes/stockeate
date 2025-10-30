﻿// App.tsx
import React, { useEffect } from "react";
// 👇 Importamos DarkTheme y DefaultTheme si los vas a usar
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "./src/stores/auth";
import { useBranch } from "./src/stores/branch";
import { useThemeStore } from "./src/stores/themeProviders"; // <-- Importamos el store del tema

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
import SettingsScreen from "./src/screens/SettingsScreen"; // <-- Mantenemos Settings
import ProfileScreen from "./src/screens/ProfileScreen";   // <-- Mantenemos Profile

// 👇 1. Importamos las 3 pantallas nuevas de digitalización
import { UploadRemitoScreen } from './src/screens/UploadRemitoScreen';
import { PendingRemitosScreen } from './src/screens/PendingRemitosScreen';
import { ValidationScreen } from './src/screens/ValidationScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const hydrateAuth = useAuth((s) => s.hydrate);
  const token = useAuth((s) => s.token);
  const hydrateBranch = useBranch((s) => s.hydrate);
  // Leemos el tema del store
  const { theme, mode } = useThemeStore();

  useEffect(() => {
    initDb();
    hydrateAuth();
    hydrateBranch();
  }, []);

  // Seleccionamos el tema de navegación basado en el modo
  const navigationTheme = mode === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <SafeAreaProvider>
      {/* Aplicamos el color de fondo del tema al SafeAreaView */}
      <SafeAreaView style={{ flex: 1, backgroundColor: navigationTheme.colors.background }}>
        <NavigationContainer theme={navigationTheme}>
          {!token ? (
            <Stack.Navigator>
              <Stack.Screen name="Login" component={LoginScreen} options={{ title: "Stockeate - Acceso" }}/>
              <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Registro" }}/>
            </Stack.Navigator>
          ) : (
            <Stack.Navigator>
              {/* --- Pantallas existentes (mantenemos las de tu versión nueva) --- */}
              <Stack.Screen name="BranchSelect" component={BranchSelect} options={{ title: "Elegir sucursal", headerBackVisible: false }}/>
              <Stack.Screen name="Home" component={Home} options={{ title: "Menú" }} />
              <Stack.Screen name="RemitosHub" component={RemitosHub} options={{ title: "Remitos" }} />
              <Stack.Screen name="ScanAdd" component={ScanAdd} options={{ title: "Escanear / Agregar" }} />
              <Stack.Screen name="RemitoForm" component={RemitoForm} options={{ title: "Formar remito" }} />
              <Stack.Screen name="RemitoIngreso" component={RemitoIngreso} options={{ title: "Remito de entrada" }} />
              <Stack.Screen name="RemitosHistory" component={RemitosHistory} options={{ title: "Historial de remitos" }} />
              <Stack.Screen name="RemitoDetail" component={RemitoDetail} options={{ title: "Remito" }} />
              <Stack.Screen name="RemitoResult" component={RemitoResult} options={{ title: "Remito generado" }} />
              <Stack.Screen name="BranchProducts" component={BranchProducts} options={{ title: "Productos de la sucursal" }} />
              <Stack.Screen name="BranchArchived" component={BranchArchived} options={{ title: "Archivados" }} />
              <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Configuración" }} />
              <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Mi Perfil" }} />

              {/* --- 👇 2. Añadimos las 3 nuevas pantallas al Stack --- */}
              <Stack.Screen
                name="UploadRemito"
                component={UploadRemitoScreen}
                options={{ title: "Digitalizar Remito" }}
              />
              <Stack.Screen
                name="PendingRemitos"
                component={PendingRemitosScreen}
                options={{ title: "Remitos por Validar" }}
              />
              <Stack.Screen
                name="Validation"
                component={ValidationScreen}
                options={{ title: "Validar Remito" }}
              />
            </Stack.Navigator>
          )}
        </NavigationContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}