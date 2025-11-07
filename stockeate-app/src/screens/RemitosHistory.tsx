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
  StyleSheet, // <-- Importamos StyleSheet
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBranch } from "../stores/branch";
import { useThemeStore } from "../stores/themeProviders";

// 👇 1. Importamos la lógica de Sincronización
import { api, pullFromServer, PullPayload } from "../api";
import { applyPull } from "../sync/apply"; // Asegúrate que la ruta a 'apply.ts' sea correcta
import * as SQLite from "expo-sqlite";

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

// 👇 2. Función de BBDD con la consulta SQL corregida
const getRemitosHistoryFromLocalDB = (branchId: string, q: string, dir: string): Row[] => {
  if (Platform.OS === "web") {
    return [];
  }
  const db = SQLite.openDatabaseSync("stockeate.db");

  const qLike = `%${q.trim()}%`;
  const limit = 200;
  const off = 0;

  // Consulta SQL actualizada para detectar 'ENT-' y corregir el filtro 'dir'
  const data = (db as any).getAllSync(
    `
    SELECT
      r.*,
      COALESCE(
        (SELECT sm.type FROM stock_moves sm WHERE sm.ref LIKE '%' || r.tmp_number LIMIT 1),
        CASE WHEN r.tmp_number LIKE 'ENT-%' THEN 'IN' ELSE NULL END
      ) AS dir,
      (SELECT IFNULL(SUM(ri.qty),0) FROM remito_items ri WHERE ri.remito_id = r.id) AS total_qty,
      (SELECT IFNULL(SUM(ri.qty * ri.unit_price),0) FROM remito_items ri WHERE ri.remito_id = r.id) AS total_amount
    FROM remitos r
    WHERE r.branch_id = ?
      AND (? = '' OR r.tmp_number LIKE ? OR IFNULL(r.customer,'') LIKE ? OR EXISTS (
          SELECT 1 FROM remito_items ri JOIN products p ON p.id = ri.product_id
          WHERE ri.remito_id = r.id AND (p.code LIKE ? OR p.name LIKE ?)
        )
      )
    ORDER BY datetime(r.created_at) DESC
    LIMIT ? OFFSET ?;
    `,
    // Solo 8 argumentos, el filtro 'dir' lo hacemos en JS
    [branchId, q.trim(), qLike, qLike, qLike, qLike, limit, off]
  );
  
  // Filtramos por dirección en JS. Es más seguro y evita el NullPointerException.
  return data.filter((r: any) => dir === 'ALL' || r.dir === dir);
};

export default function RemitosHistory({ navigation }: any) {
  const { mode, theme, toggleTheme } = useThemeStore();
  const branchId = useBranch((s) => s.id);
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true); // Empezar cargando

  // ... (lógica del menú y header se mantiene igual) ...
  const [menuVisible, setMenuVisible] = useState(false);
  const menuItems = useMemo(
    () => [
      { label: mode === "light" ? "Tema Oscuro" : "Tema Claro", onPress: toggleTheme },
      { label: "Configuración", onPress: () => navigation.navigate("Settings") },
      { label: "Cerrar sesión", onPress: useAuth.getState().logout, isDestructive: true },
    ],
    [mode, toggleTheme, navigation]
  );
  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.colors.background }, 
      headerTitleStyle: { color: theme.colors.text },
      headerTintColor: theme.colors.text,
      headerRight: () => (
        <TouchableOpacity onPress={() => setMenuVisible(true)} /* ... */ >
          <Ionicons name="menu" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme, mode]);
  // ... (fin lógica menú) ...

  const subtitle = useMemo(() => {
    const label = dir === "ALL" ? "Entrada y salida" : dir === "IN" ? "Entrada" : "Salida";
    return `${label} — ${rows.length} remito${rows.length === 1 ? "" : "s"}`;
  }, [rows.length]);

  useEffect(() => {
    if (!branchId) {
      setLoading(false);
      return;
    }
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [q, dir, branchId]);

  // 👇 3. Función 'load' ACTUALIZADA con Sincronización
  const load = async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      // 1. TRAEMOS los datos del servidor
      const payload: PullPayload = await pullFromServer(branchId);
      
      // 2. APLICAMOS los datos a la BD local
      await applyPull(branchId, payload); 

      // 3. AHORA SÍ consultamos la BD local actualizada
      const data = getRemitosHistoryFromLocalDB(branchId, q, dir);
      
      setRows(
        data.map((r: any) => ({
          ...r,
          dir: (r.dir === "IN" || r.dir === "OUT") ? r.dir : null,
        }))
      );
    } catch (error) {
        console.error("Error loading history:", error);
        setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // 👇 4. 'renderItem' ACTUALIZADO con etiqueta de digitalización
  const renderItem = ({ item }: { item: Row }) => {
    const created = new Date(item.created_at).toLocaleString();
    const isIN = item.dir === "IN";
    const badgeBg = isIN ? theme.colors.success : theme.colors.danger;
    const isDigitalized = item.notes?.startsWith("Ingreso por digitalización");

    return (
      <View style={[styles.itemContainer, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        <View style={styles.header}>
          <Text style={[styles.remitoNumber, { color: theme.colors.text }]}>
            {item.tmp_number || "(sin nro.)"}
          </Text>
          {item.dir && (
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.badgeText, { color: "white" }]}>
                {item.dir}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.dateText, { color: theme.colors.textMuted }]}>
          {created}
          {item.customer ? ` — ${isIN ? "Proveedor" : "Cliente"}: ${item.customer}` : ""}
        </Text>
        <Text style={[styles.detailsText, { color: theme.colors.textSecondary }]}>
          Items: {item.total_qty} — Total: ${item.total_amount.toFixed(2)}
        </Text>
        {isDigitalized && (
          <Text style={styles.digitalizedTag}>
            ✔️ Ingresado por digitalización
          </Text>
        )}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => navigation.navigate("RemitoDetail", { remitoId: item.id })}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            activeOpacity={0.9}
          >
            <Text style={styles.buttonText}>Ver detalle</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!branchId) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.text }}>Primero seleccioná una sucursal.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.screenTitle, { color: theme.colors.text }]}>Historial de remitos</Text>

      {/* Filtros */}
      <View style={styles.filtersContainer}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por nro., cliente/proveedor..."
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.searchInput,
            { 
              borderColor: q ? theme.colors.primary : theme.colors.inputBorder,
              backgroundColor: theme.colors.inputBackground, 
              color: theme.colors.text, 
            }
          ]}
        />
        <View style={styles.filterButtons}>
          <TouchableOpacity 
            onPress={() => setDir("ALL")} 
            style={[
              styles.filterButton, 
              { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground },
              dir === 'ALL' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }
            ]}
          >
            <Text style={[styles.filterButtonText, { color: theme.colors.text }, dir === 'ALL' && { color: 'white' }]}>
              Todos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setDir("IN")} 
            style={[
              styles.filterButton, 
              { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground },
              dir === 'IN' && { borderColor: theme.colors.success, backgroundColor: theme.colors.success }
            ]}
          >
            <Text style={[styles.filterButtonText, { color: theme.colors.text }, dir === 'IN' && { color: 'white' }]}>
              Entrada
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setDir("OUT")} 
            style={[
              styles.filterButton, 
              { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground },
              dir === 'OUT' && { borderColor: theme.colors.danger, backgroundColor: theme.colors.danger }
            ]}
          >
            <Text style={[styles.filterButtonText, { color: theme.colors.text }, dir === 'OUT' && { color: 'white' }]}>
              Salida
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>{subtitle}</Text>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }}/>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(x) => x.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={[styles.emptyText, {color: theme.colors.textMuted}]}>No se encontraron remitos.</Text>}
          onRefresh={load} 
          refreshing={loading}
        />
      )}

       <HamburgerMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={menuItems}
        navigation={navigation}
      />
    </View>
  );
}

// 👇 5. Centralizamos todos los estilos en StyleSheet
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12 },
  centered: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center" },
  screenTitle: { fontSize: 22, fontWeight: "800", marginBottom: 8 },
  filtersContainer: { gap: 12 },
  searchInput: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  filterButtons: { flexDirection: "row", gap: 8 },
  filterButton: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  filterButtonText: { fontWeight: "600" },
  subtitle: { fontSize: 12, marginTop: 4 },
  emptyText: { textAlign: 'center', marginTop: 40, fontSize: 16 },
  itemContainer: { borderBottomWidth: 1, paddingVertical: 12, gap: 4, paddingHorizontal: 4, backgroundColor: 'white', marginBottom: 8, borderRadius: 8, elevation: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  remitoNumber: { fontWeight: "700", fontSize: 16 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontWeight: "bold", fontSize: 12 },
  dateText: { fontSize: 12 },
  detailsText: { fontSize: 14, fontWeight: '500' },
  digitalizedTag: { fontSize: 11, color: "#059669", fontWeight: 'bold', marginTop: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: "white", fontWeight: "600" },
});