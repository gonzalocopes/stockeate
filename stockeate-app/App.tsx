
import React, { useEffect } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { useAuth } from "./src/stores/auth";
import { useBranch } from "./src/stores/branch";

import LoginScreen from "./src/screens/LoginScreen";
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

const Stack = createNativeStackNavigator();

export default function App() {
  const token = useAuth((s) => s.token);

  const hydrateBranch = useBranch((s) => s.hydrate); 

  useEffect(() => {
    initDb();
    hydrateBranch();
  }, []);

  return (
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
            options={{ title: "Elegir sucursal" }}
          />
          <Stack.Screen name="Home" component={Home} options={{ title: "Menú" }} />
          <Stack.Screen name="RemitosHub" component={RemitosHub} options={{ title: "Remitos" }} />
          <Stack.Screen name="ScanAdd" component={ScanAdd} options={{ title: "Escanear / Agregar" }} />
          <Stack.Screen name="RemitoForm" component={RemitoForm} options={{ title: "Formar remito" }} />
          <Stack.Screen name="RemitoIngreso" component={RemitoIngreso} options={{ title: "Remito de entrada" }} />
          <Stack.Screen name="RemitosHistory" component={RemitosHistory} options={{ title: "Historial de remitos" }} />
          <Stack.Screen name="RemitoDetail" component={RemitoDetail} options={{ title: "Remito" }} />

          <Stack.Screen name="RemitoResult" component={RemitoResult} options={{ title: "Remito generado" }} />
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
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );}