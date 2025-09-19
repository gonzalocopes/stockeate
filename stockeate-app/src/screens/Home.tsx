import React, { useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useAuth } from "../stores/auth";

export default function Home({ navigation }: any) {
  const logout = useAuth((s) => s.logout);

  // Botón "Cerrar sesión" en el header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={async () => {
            await logout();
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          }}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: "#dc3545",
            borderRadius: 6,
            marginRight: 8,
          }}
          activeOpacity={0.8}
        >
          <Text style={{ color: "white", fontWeight: "600", fontSize: 14 }}>
            Cerrar sesión
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, logout]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
        Menú Principal
      </Text>

      <TouchableOpacity
        style={{
          backgroundColor: "#007AFF",
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 8,
          alignItems: "center",
        }}
        onPress={() => navigation.navigate("ScanAdd")}
        activeOpacity={0.8}
      >
        <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
          📱 Agregar productos (escaneo)
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          backgroundColor: "#28a745",
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 8,
          alignItems: "center",
        }}
        onPress={() => navigation.navigate("RemitoForm")}
        activeOpacity={0.8}
      >
        <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
          📋 Formar remito con lote actual
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          backgroundColor: "#0ea5e9",
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 8,
          alignItems: "center",
        }}
        onPress={() => navigation.navigate("BranchProducts")}
        activeOpacity={0.8}
      >
        <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
          📦 Ver productos de la sucursal
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          backgroundColor: "#6c757d",
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 8,
          alignItems: "center",
          opacity: 0.7,
        }}
        onPress={() => {}}
        activeOpacity={0.8}
        disabled={true}
      >
        <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>
          📊 Historial de remitos (próximo)
        </Text>
      </TouchableOpacity>
    </View>
  );
}
