import React, { useEffect } from "react";
import { View, Button, Alert } from "react-native";
import { useAuth } from "../stores/auth";

export default function Home({ navigation }: any) {
  const logout = useAuth((s) => s.logout);

  // Botón "Cerrar sesión" en el header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button
          title="Cerrar sesión"
          color="#d00"
          onPress={async () => {
            // sin Alert para que funcione igual en web
            await logout();
            // forzamos volver al Login por si la navegación quedó en cache
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          }}
        />
      ),
    });
  }, [navigation, logout]);

  return (
    <View style={{ padding:16, gap:12 }}>
      <Button title="Agregar productos (escaneo)" onPress={()=>navigation.navigate("ScanAdd")} />
      <Button title="Formar remito con lote actual" onPress={()=>navigation.navigate("RemitoForm")} />
      <Button title="Historial de remitos (próximo)" onPress={()=>{}} />

      {/* Botón extra dentro de la pantalla */}
      <View style={{ marginTop: 8 }}>
        <Button
          title="Cerrar sesión"
          color="#d00"
          onPress={async () => {
            await logout();
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          }}
        />
      </View>
    </View>
  );
}
