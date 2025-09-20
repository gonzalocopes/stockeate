// src/screens/RemitoHub.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";

export default function RemitoHub({ navigation }: any) {
  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Remitos</Text>

      {/* Remito de SALIDA (egreso) */}
      <TouchableOpacity
        onPress={() => navigation.navigate("RemitoForm")}
        style={{
          backgroundColor: "#22c55e",
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
          backgroundColor: "#38bdf8",
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
          🧾 Remito de entrada (ingreso)
        </Text>
        <Text
          style={{
            color: "white",
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
          backgroundColor: "#0ea5e9",
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
          backgroundColor: "#a78bfa",
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
