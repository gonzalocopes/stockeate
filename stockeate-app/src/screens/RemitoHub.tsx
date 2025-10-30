// src/screens/RemitoHub.tsx
import React from "react";
// 👇 Importamos StyleSheet
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useThemeStore } from "../stores/themeProviders"; // Importamos el store del tema

export default function RemitoHub({ navigation }: any) {
  const { theme } = useThemeStore(); // Obtenemos el tema

  // Colores del tema para los botones
  const colorSalida = theme.colors.success || '#22c55e'; // Verde
  const colorEntradaManual = theme.colors.primary || '#38bdf8'; // Azul claro
  const colorDigitalizar = theme.colors.digitalizar || '#16a34a'; // Verde oscuro (o define 'digitalizar' en tu tema)
  const colorValidar = theme.colors.warning || '#ffc107'; // Amarillo (o define 'warning' en tu tema)
  const colorHistorial = theme.colors.info || '#0ea5e9'; // Azul medio (o define 'info' en tu tema)
  const colorTransferencia = theme.colors.neutral || '#a78bfa'; // Violeta/Gris

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.header, { color: theme.colors.text }]}>Remitos</Text>

      {/* Remito de SALIDA (egreso) */}
      <TouchableOpacity
        onPress={() => navigation.navigate("RemitoForm")}
        style={[styles.button, { backgroundColor: colorSalida }]}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonTitle}>📦 Remito de salida</Text>
        <Text style={styles.buttonSubtitle}>
          Descuenta stock del inventario.
        </Text>
      </TouchableOpacity>

      {/* Remito de ENTRADA (ingreso manual) */}
      <TouchableOpacity
        onPress={() => navigation.navigate("RemitoIngreso")}
        style={[styles.button, { backgroundColor: colorEntradaManual }]}
        activeOpacity={0.9}
      >
        {/* Ajustamos color de texto si el fondo es claro */}
        <Text style={[styles.buttonTitle, { color: theme.colors.textOnPrimary || 'white' }]}>
          🧾 Remito de entrada (Manual)
        </Text>
        <Text style={[styles.buttonSubtitle, { color: theme.colors.textOnPrimary || 'white', opacity: 0.9 }]}>
          Escanea o ingresa productos recibidos.
        </Text>
      </TouchableOpacity>

      {/* --- 👇 BOTONES NUEVOS DE DIGITALIZACIÓN --- */}
      <TouchableOpacity
        onPress={() => navigation.navigate("UploadRemito")}
        style={[styles.button, { backgroundColor: colorDigitalizar }]}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonTitle}>📷 Digitalizar Remito Externo</Text>
        <Text style={styles.buttonSubtitle}>
          Sube una foto o PDF de un remito de proveedor.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate("PendingRemitos")}
        style={[styles.button, { backgroundColor: colorValidar }]}
        activeOpacity={0.9}
      >
        <Text style={[styles.buttonTitle, { color: theme.colors.textOnWarning || '#212529' }]}> {/* Texto oscuro sobre amarillo */}
          ✔️ Validar Remitos Digitalizados
        </Text>
        <Text style={[styles.buttonSubtitle, { color: theme.colors.textOnWarning || '#212529', opacity: 0.9 }]}>
          Aprueba los datos para actualizar el stock.
        </Text>
      </TouchableOpacity>
      {/* --- FIN DE BOTONES NUEVOS --- */}


      {/* Historial de remitos */}
      <TouchableOpacity
        onPress={() => navigation.navigate("RemitosHistory")}
        style={[styles.button, { backgroundColor: colorHistorial }]}
        activeOpacity={0.9}
      >
        <Text style={styles.buttonTitle}>🗂️ Historial de remitos</Text>
        <Text style={styles.buttonSubtitle}>
          Busca remitos anteriores (entrada/salida).
        </Text>
      </TouchableOpacity>

      {/* Transferencia entre sucursales (deshabilitado) */}
      <TouchableOpacity
        disabled
        style={[styles.button, { backgroundColor: colorTransferencia, opacity: 0.6 }]}
        activeOpacity={1}
      >
        <Text style={styles.buttonTitle}>🔁 Transferencia (Próximo)</Text>
        <Text style={styles.buttonSubtitle}>
          Enviar/recibir stock entre sucursales.
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// 👇 StyleSheet completo con estilos consistentes
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  header: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12, // Bordes un poco más redondeados
    alignItems: 'center',
    elevation: 3, // Sombra sutil
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonTitle: {
    // Color se aplica en línea basado en el fondo
    fontWeight: "800",
    textAlign: "center",
    fontSize: 16,
  },
  buttonSubtitle: {
    // Color se aplica en línea basado en el fondo
    opacity: 0.9,
    textAlign: "center",
    marginTop: 4,
    fontSize: 13,
  },
});