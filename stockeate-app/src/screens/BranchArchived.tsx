// src/screens/BranchArchived.tsx
import React, { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useBranch } from "../stores/branch";
import { DB } from "../db";

import { useThemeStore } from "../stores/themeProviders"; // 👈 Importar el store del tema

type Prod = {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  branch_id: string;
};

export default function BranchArchived() {
  const { theme } = useThemeStore(); // 👈 Obtener el tema
  const branchId = useBranch((s) => s.id);
  const isFocused = useIsFocused();

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const data = DB.listArchivedByBranch(branchId, search, 500, 0);
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  useEffect(() => {
    const id = setTimeout(load, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, branchId]);

  const unarchive = (p: Prod) => {
    DB.unarchiveProduct(p.id);
    setRows((cur) => cur.filter((r) => r.id !== p.id));
  };

  const confirmDelete = (p: Prod) => {
    if (!DB.canDeleteProduct(p.id)) {
      return Alert.alert(
        "No se puede eliminar",
        "Este producto tiene remitos asociados. Para no perder historial, no se permite eliminar."
      );
    }
    Alert.alert(
      "Eliminar producto",
      `¿Eliminar “${p.name}” (${p.code}) definitivamente?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => {
            DB.deleteProduct(p.id);
            setRows((cur) => cur.filter((r) => r.id !== p.id));
          }
        },
      ]
    );
  };

  if (!branchId) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.text }}>Primero seleccioná una sucursal.</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Prod }) => (
    <View style={{ 
        borderBottomWidth: 1, 
        borderColor: theme.colors.border, // 👈 Borde de la fila
        paddingVertical: 8, 
        gap: 6 
    }}>
      <Text style={{ fontWeight: "600", color: theme.colors.text }}>{item.name}</Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{item.code}</Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>
          Precio: ${item.price ?? 0} — Stock: {item.stock ?? 0}
        </Text>

        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {/* Botón Desarchivar */}
          <TouchableOpacity
            onPress={() => unarchive(item)}
            style={{ 
                paddingHorizontal: 12, 
                paddingVertical: 6, 
                borderRadius: 8, 
                backgroundColor: theme.colors.success // 👈 Success
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Desarchivar</Text>
          </TouchableOpacity>

          {/* Botón Eliminar */}
          <TouchableOpacity
            onPress={() => confirmDelete(item)}
            style={{ 
                paddingHorizontal: 12, 
                paddingVertical: 6, 
                borderRadius: 8, 
                backgroundColor: theme.colors.danger // 👈 Danger
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: theme.colors.background }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: theme.colors.text }}>Archivados</Text>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {/* Input de Búsqueda */}
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o código"
          placeholderTextColor={theme.colors.textMuted}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: search ? theme.colors.primary : theme.colors.inputBorder,
            borderRadius: 8,
            padding: 10,
            backgroundColor: theme.colors.inputBackground, // 👈 Fondo del input
            color: theme.colors.text, // 👈 Texto del input
          }}
        />
        {/* Botón Refrescar */}
        <TouchableOpacity
          onPress={load}
          style={{ 
              paddingHorizontal: 14, 
              paddingVertical: 10, 
              borderRadius: 8, 
              backgroundColor: theme.colors.primary // 👈 Primary
          }}
          activeOpacity={0.9}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>{loading ? "..." : "Refrescar"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {rows.length} archivado{rows.length === 1 ? "" : "s"} en esta sucursal
      </Text>

      <FlatList data={rows} keyExtractor={(x) => x.id} renderItem={renderItem} showsVerticalScrollIndicator={false} />
    </View>
  );
}