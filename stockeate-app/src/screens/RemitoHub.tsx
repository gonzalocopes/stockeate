// src/screens/RemitoHub.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useThemeStore } from "../stores/themeProviders"; // 👈 Importar el store del tema

export default function RemitoHub({ navigation }: any) {
  const { theme } = useThemeStore(); // 👈 Obtener el tema
  
  // Usaremos un color auxiliar para "Ingreso" y "Transferencia"
  // Para Ingreso, usaremos el primary ya que es una acción positiva/clave.
  // Para Transferencia, usaremos el neutral para indicar que está deshabilitado/pendiente.
  const colorIngreso = theme.colors.primary;
  const colorTransferencia = theme.colors.neutral; 

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: theme.colors.background }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: theme.colors.text }}>Remitos</Text>

      {/* Remito de SALIDA (egreso) */}
      <TouchableOpacity
        onPress={() => navigation.navigate("RemitoForm")}
        style={{
          backgroundColor: theme.colors.success, // 👈 Usamos Success
          paddingVertical: 16,
          borderRadius: 10,
        }}
        activeOpacity={0.9}
      >
        <Text
          style={{
            color: "white",
            fontWeight: "800",
            textAlign: "center",
            fontSize: 16,
          }}
        >
          📦 Remito de salida (egreso)
        </Text>
        <Text
          style={{
            color: "white",
            opacity: 0.9,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          Usa el lote actual o armá uno nuevo. Descuenta stock.
        </Text>
      </TouchableOpacity>

      {/* Remito de ENTRADA (ingreso) */}
      <TouchableOpacity
        onPress={() => navigation.navigate("RemitoIngreso")}
        style={{
          backgroundColor: colorIngreso, // 👈 Usamos Primary
          paddingVertical: 16,
          borderRadius: 10,
        }}
        activeOpacity={0.9}
      >
        <Text
          style={{
            color: theme.colors.text,
            fontWeight: "800",
            textAlign: "center",
            fontSize: 16,
          }}
        >
          🧾 Remito de entrada (ingreso)
        </Text>
        <Text
          style={{
            color: theme.colors.text,
            opacity: 0.9,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          Escaneá lo recibido y suma stock.
        </Text>
      </TouchableOpacity>

      {/* Historial de remitos */}
      <TouchableOpacity
        onPress={() => navigation.navigate("RemitosHistory")}
        style={{
          backgroundColor: theme.colors.neutral, // 👈 Usamos Neutral (un tono más sobrio para historial)
          paddingVertical: 16,
          borderRadius: 10,
        }}
        activeOpacity={0.9}
      >
        <Text
          style={{
            color: "white",
            fontWeight: "800",
            textAlign: "center",
            fontSize: 16,
          }}
        >
          🗂️ Historial de remitos
        </Text>
        <Text
          style={{
            color: "white",
            opacity: 0.9,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          Buscá por número, cliente/proveedor o producto.
        </Text>
      </TouchableOpacity>

      {/* Transferencia entre sucursales (próximo) */}
      <TouchableOpacity
        disabled
        style={{
          backgroundColor: colorTransferencia, // 👈 Usamos Neutral para deshabilitado
          paddingVertical: 16,
          borderRadius: 10,
          opacity: 0.6,
        }}
        activeOpacity={1}
      >
        <Text
          style={{
            color: "white",
            fontWeight: "800",
            textAlign: "center",
            fontSize: 16,
          }}
        >
          🔁 Transferencia entre sucursales
        </Text>
        <Text
          style={{
            color: "white",
            opacity: 0.9,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          Enviar/recibir entre depósitos. (Próximo)
        </Text>
      </TouchableOpacity>
    </View>
  );
}