// src/screens/Home.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export default function Home({ navigation }: any) {
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
        Menú Principal
      </Text>

      {/* Agregar productos (sólo catálogo / sucursal) */}
      <TouchableOpacity
        style={{
          backgroundColor: "#1d4ed8",
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 8,
          alignItems: "center",
        }}
        onPress={() =>
          navigation.navigate("ScanAdd", {
            mode: "catalog",
            forceCatalog: true,
          })
        }
        activeOpacity={0.9}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
          📦 Agregar productos (a la sucursal)
        </Text>
      </TouchableOpacity>

      {/* Remitos → Hub nuevo */}
      <TouchableOpacity
        style={{
          backgroundColor: "#22c55e",
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 8,
          alignItems: "center",
        }}
        onPress={() => navigation.navigate("RemitosHub")}
        activeOpacity={0.9}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
          📄 Remitos (crear / recibir / transferir)
        </Text>
      </TouchableOpacity>

      {/* Ver productos de la sucursal */}
      <TouchableOpacity
        style={{
          backgroundColor: "#0ea5e9",
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 8,
          alignItems: "center",
        }}
        onPress={() => navigation.navigate("BranchProducts")}
        activeOpacity={0.9}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
          🧰 Ver productos de la sucursal
        </Text>
      </TouchableOpacity>

      {/* Historial (placeholder) */}
      {/* <TouchableOpacity
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
        disabled
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
          📊 Historial de remitos (próximo)
        </Text>
      </TouchableOpacity> */}
    </View>
  );
}
