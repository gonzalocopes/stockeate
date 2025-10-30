// src/screens/RemitosHistory.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBranch } from "../stores/branch";
import { useThemeStore } from "../stores/themeProviders";

// 👇 imports menú
import { useAuth } from "../stores/auth";
import HamburgerMenu from "../components/HamburgerMenu";

type Row = {
  id: string;
  tmp_number: string | null;
  official_number: string | null;
  branch_id: string;
  customer: string | null;
  notes: string | null;
  created_at: string;
  pdf_path: string | null;
  dir: "IN" | "OUT" | null;
  total_qty: number;
  total_amount: number;
};

const getRemitosHistory = (branchId: string, q: string, dir: string): any[] => {
  if (Platform.OS === "web") {
    return [];
  }
  const SQLite = require("expo-sqlite");
  const db = SQLite.openDatabaseSync("stockeate.db");

  const qLike = `%${q.trim()}%`;
  const limit = 200;
  const off = 0;

  return (db as any).getAllSync(
    `
    SELECT
      r.*,
      (
        SELECT sm.type
        FROM stock_moves sm
        WHERE sm.ref = r.tmp_number
        LIMIT 1
      ) AS dir,
      (
        SELECT IFNULL(SUM(ri.qty),0)
        FROM remito_items ri
        WHERE ri.remito_id = r.id
      ) AS total_qty,
      (
        SELECT IFNULL(SUM(ri.qty * ri.unit_price),0)
        FROM remito_items ri
        WHERE ri.remito_id = r.id
      ) AS total_amount
    FROM remitos r
    WHERE r.branch_id = ?
      AND (
        ? = '' OR
        r.tmp_number LIKE ? OR
        IFNULL(r.customer,'') LIKE ? OR
        EXISTS (
          SELECT 1
          FROM remito_items ri
          JOIN products p ON p.id = ri.product_id
          WHERE ri.remito_id = r.id
            AND (p.code LIKE ? OR p.name LIKE ?)
        )
      )
      AND (
        ? = 'ALL' OR EXISTS (
          SELECT 1
          FROM stock_moves sm
          WHERE sm.ref = r.tmp_number
            AND sm.type = ?
        )
      )
    ORDER BY datetime(r.created_at) DESC
    LIMIT ? OFFSET ?;
    `,
    [
      branchId,
      q.trim(),
      qLike,
      qLike,
      qLike,
      qLike,
      dir,
      dir === "ALL" ? null : dir,
      limit,
      off,
    ]
  );
};

export default function RemitosHistory({ navigation }: any) {
  const { mode, theme, toggleTheme } = useThemeStore();
  const branchId = useBranch((s) => s.id);
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // ── menú
  const [menuVisible, setMenuVisible] = useState(false);
  const menuItems = useMemo(
    () => [
      { label: mode === "light" ? "Tema Oscuro" : "Tema Claro", onPress: toggleTheme },
      { label: "Configuración", onPress: () => navigation.navigate("Settings") },
      { label: "Cerrar sesión", onPress: useAuth.getState().logout, isDestructive: true },
    ],
    [mode, toggleTheme]
  );

  // header con hamburguesa
  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.colors.header ?? theme.colors.background },
      headerTitleStyle: { color: theme.colors.text },
      headerTintColor: theme.colors.text,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Abrir menú"
        >
          <Ionicons name="menu" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme, mode]);

  const subtitle = useMemo(() => {
    const label = dir === "ALL" ? "Entrada y salida" : dir === "IN" ? "Entrada" : "Salida";
    return `${label} — ${rows.length} remito${rows.length === 1 ? "" : "s"}`;
  }, [dir, rows.length]);

  useEffect(() => {
    if (!branchId) return;
    const id = setTimeout(load, 180);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, dir, branchId]);

  const load = () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const data = getRemitosHistory(branchId, q, dir);
      setRows(
        data.map((r: any) => ({
          ...r,
          dir: r.dir === "IN" || r.dir === "OUT" ? r.dir : null,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Row }) => {
    const created = new Date(item.created_at).toLocaleString();
    const isIN = item.dir === "IN";
    const badgeBg = isIN ? theme.colors.success : theme.colors.danger;

    return (
      <View
        style={{
          borderBottomWidth: 1,
          borderColor: theme.colors.border,
          paddingVertical: 10,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontWeight: "700", color: theme.colors.text }}>
            {item.tmp_number || "(sin nro.)"}
          </Text>
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: badgeBg }}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 12 }}>
              {item.dir || "?"}
            </Text>
          </View>
        </View>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
          {created}
          {item.customer ? ` — ${item.dir === "IN" ? "Proveedor" : "Cliente"}: ${item.customer}` : ""}
        </Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
          Items: {item.total_qty} — Total: ${item.total_amount.toFixed(2)}
        </Text>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("RemitoDetail", { remitoId: item.id })}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 8,
              backgroundColor: theme.colors.primary
            }}
            activeOpacity={0.9}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Ver detalle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!branchId) {
    return (
      <View style={{ flex: 1, padding: 16, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.text }}>Primero seleccioná una sucursal.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: theme.colors.background }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: theme.colors.text }}>Historial de remitos</Text>

      {/* Filtros */}
      <View style={{ gap: 8 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por nro., cliente/proveedor, código o nombre"
          placeholderTextColor={theme.colors.textMuted}
          style={{
            borderWidth: 1,
            borderColor: q ? theme.colors.primary : theme.colors.inputBorder,
            borderRadius: 8,
            padding: 10,
            backgroundColor: theme.colors.inputBackground,
            color: theme.colors.text,
          }}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={() => setDir("ALL")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: dir === "ALL" ? theme.colors.primary : theme.colors.inputBorder,
              backgroundColor: dir === "ALL" ? theme.colors.primary : theme.colors.inputBackground,
              alignItems: "center",
            }}
            activeOpacity={0.9}
          >
            <Text style={{ fontWeight: "700", color: dir === "ALL" ? "white" : theme.colors.text }}>
              Todos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setDir("IN")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: dir === "IN" ? theme.colors.success : theme.colors.inputBorder,
              backgroundColor: dir === "IN" ? theme.colors.success : theme.colors.inputBackground,
              alignItems: "center",
            }}
            activeOpacity={0.9}
          >
            <Text style={{ fontWeight: "700", color: dir === "IN" ? "white" : theme.colors.text }}>
              Entrada
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setDir("OUT")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: dir === "OUT" ? theme.colors.danger : theme.colors.inputBorder,
              backgroundColor: dir === "OUT" ? theme.colors.danger : theme.colors.inputBackground,
              alignItems: "center",
            }}
            activeOpacity={0.9}
          >
            <Text style={{ fontWeight: "700", color: dir === "OUT" ? "white" : theme.colors.text }}>
              Salida
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{subtitle}</Text>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(x) => x.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* 👇 Modal del menú */}
      <HamburgerMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={menuItems}
        navigation={navigation}
      />
    </View>
  );
}
