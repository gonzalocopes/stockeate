import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context"; // cambio para los botones de navegacion
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "./src/stores/auth";
import { useBranch } from "./src/stores/branch"; // 👈 NUEVO

import LoginScreen from "./src/screens/LoginScreen";
import BranchSelect from "./src/screens/BranchSelect";
import Home from "./src/screens/Home";
import ScanAdd from "./src/screens/ScanAdd";
import RemitoForm from "./src/screens/RemitoForm";
import RemitoResult from "./src/screens/RemitoResult";
import { initDb } from "./src/db";

// 👇 NUEVO: importar la pantalla de productos de la sucursal
import BranchProducts from "./src/screens/BranchProducts";
// 👇 NUEVO: importar archivados
import BranchArchived from "./src/screens/BranchArchived";
// 👇 NUEVO: hub de remitos
import RemitosHub from "./src/screens/RemitoHub";
// 👇 NUEVO: remito de ENTRADA (ingreso)
import RemitoIngreso from "./src/screens/RemitoIngreso";
// 👇 NUEVO: historial + detalle
import RemitosHistory from "./src/screens/RemitosHistory";
import RemitoDetail from "./src/screens/RemitoDetail";

const Stack = createNativeStackNavigator();

export default function App() {
  // auth
  const hydrateAuth = useAuth((s) => s.hydrate); // 👈 cambio de nombre para claridad
  const token = useAuth((s) => s.token);

  // branch
  const hydrateBranch = useBranch((s) => s.hydrate); // 👈 NUEVO

  useEffect(() => {
    initDb();
    hydrateAuth(); // hidrata token guardado
    hydrateBranch(); // 👈 hidrata sucursal guardada
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1 }}>
        <NavigationContainer>
          {!token ? (
            <Stack.Navigator>
              <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{ title: "Stockeate - Acceso" }}
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
                options={{ 
                  title: "Menú"
                }}
              />
              {/* 👇 NUEVO: hub de remitos */}
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
              {/* 👇 NUEVO: remito de ENTRADA */}
              <Stack.Screen
                name="RemitoIngreso"
                component={RemitoIngreso}
                options={{ title: "Remito de entrada" }}
              />
              {/* 👇 NUEVO: historial + detalle */}
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
              {/* 👇 NUEVO: pantalla para ver/editar productos de la sucursal */}
              <Stack.Screen
                name="BranchProducts"
                component={BranchProducts}
                options={{ title: "Productos de la sucursal" }}
              />
              {/* 👇 NUEVO: pantalla para ver/desarchivar/elim. productos archivados */}
              <Stack.Screen
                name="BranchArchived"
                component={BranchArchived}
                options={{ title: "Archivados" }}
              />
            </Stack.Navigator>
          )}
        </NavigationContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
