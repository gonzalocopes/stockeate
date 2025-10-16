// src/screens/RemitoHub.tsx
import React from "react";
// 👇 1. Importa StyleSheet para definir los estilos de forma organizada
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function RemitoHub({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Remitos</Text>

      {/* Remito de SALIDA (egreso) */}
      <TouchableOpacity
        onPress={() => navigation.navigate("RemitoForm")}
        style={[styles.button, { backgroundColor: "#22c55e" }]}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonTitle}>📦 Remito de salida (egreso)</Text>
        <Text style={styles.buttonSubtitle}>
          Usa el lote actual o armá uno nuevo. Descuenta stock.
        </Text>
      </TouchableOpacity>

      {/* Remito de ENTRADA (ingreso) */}
      <TouchableOpacity
        onPress={() => navigation.navigate("RemitoIngreso")}
        style={[styles.button, { backgroundColor: "#38bdf8" }]}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonTitle}>🧾 Remito de entrada (ingreso)</Text>
        <Text style={styles.buttonSubtitle}>
          Escaneá lo recibido y suma stock.
        </Text>
      </TouchableOpacity>

      {/* BOTÓN NUEVO: Validar Remitos Externos */}
      <TouchableOpacity
        onPress={() => navigation.navigate("PendingRemitos")}
        style={[styles.button, { backgroundColor: "#ffc107" }]}
        activeOpacity={0.9}
      >
        <Text style={[styles.buttonTitle, { color: "#212529" }]}>
          📸 Validar Remitos Externos
        </Text>
        <Text style={[styles.buttonSubtitle, { color: "#212529" }]}>
          Aprueba los remitos digitalizados para actualizar el stock.
        </Text>
      </TouchableOpacity>

      {/* Historial de remitos */}
      <TouchableOpacity
        onPress={() => navigation.navigate("RemitosHistory")}
        style={[styles.button, { backgroundColor: "#0ea5e9" }]}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonTitle}>🗂️ Historial de remitos</Text>
        <Text style={styles.buttonSubtitle}>
          Busca por número, cliente/proveedor o producto.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// 👇 2. Define todos los estilos en un solo lugar
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16, // 'gap' es genial para espaciar elementos
  },
  header: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center', // Centra el texto horizontalmente
  },
  buttonTitle: {
    color: "white",
    fontWeight: "800",
    textAlign: "center",
    fontSize: 16,
  },
  buttonSubtitle: {
    color: "white",
    opacity: 0.9,
    textAlign: "center",
    marginTop: 4,
    fontSize: 13,
  },
});