<<<<<<< Updated upstream
﻿import React, { useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
=======
﻿// src/screens/Home.tsx
import React, { useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
>>>>>>> Stashed changes
import { useAuth } from "../stores/auth";

export default function Home({ navigation }: any) {
  const logout = useAuth((s) => s.logout);

  // Botón "Cerrar sesión" en el header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
<<<<<<< Updated upstream
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
=======
        <TouchableOpacity onPress={async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        }} style={styles.logoutButton}>
          <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
        </TouchableOpacity>
      ),
      title: "Menú Principal",
>>>>>>> Stashed changes
    });
  }, [navigation, logout]);

  return (
<<<<<<< Updated upstream
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
=======
    <View style={styles.container}>
      {/* Agregar productos (sólo catálogo / sucursal) */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#1d4ed8" }]}
        onPress={() => navigation.navigate("ScanAdd", { mode: "catalog", forceCatalog: true })}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonText}>📦 Agregar productos a la sucursal</Text>
>>>>>>> Stashed changes
      </TouchableOpacity>

      <TouchableOpacity
<<<<<<< Updated upstream
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
=======
        style={[styles.button, { backgroundColor: "#22c55e" }]}
        onPress={() => navigation.navigate("RemitosHub")}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonText}>📄 Gestionar Remitos</Text>
      </TouchableOpacity>
      
      {/* Ver productos de la sucursal */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#0ea5e9" }]}
        onPress={() => navigation.navigate("BranchProducts")}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonText}>🧰 Ver productos de la sucursal</Text>
      </TouchableOpacity>

      {/* Digitalizar Remito Externo */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#16a34a" }]}
        onPress={() => navigation.navigate("UploadRemito")}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonText}>📷 Digitalizar Remito Externo</Text>
      </TouchableOpacity>

      {/* Historial de Remitos */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#64748b" }]}
        onPress={() => navigation.navigate("RemitosHistory")}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonText}>📊 Historial de remitos</Text>
>>>>>>> Stashed changes
      </TouchableOpacity>
    </View>
  );
}

// Estilos centralizados para un código más limpio
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    elevation: 2,
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#dc3545",
    borderRadius: 16,
    marginRight: 8,
  },
  logoutButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
  }
});