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
  StyleSheet,
  SafeAreaView,         // FIX: importar SafeAreaView
  useWindowDimensions,  // FIX: ya lo usás; aseguramos import
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

import { DB } from "../db";

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
    const qTrim = q.trim().toLowerCase();
    const all = (DB as any).listAllRemitos?.() ?? [];
    const byBranch = all.filter((r: any) => r.branch_id === branchId);

    const withComputed = byBranch.map((r: any) => {
      const items = DB.getRemitoItems(r.id) || [];
      const total_qty = items.reduce((acc: number, it: any) => acc + Number(it.qty || 0), 0);
      const total_amount = items.reduce((acc: number, it: any) => acc + Number((it.qty || 0) * (it.unit_price || 0)), 0);
      const inferredDir = r.tmp_number?.startsWith("ENT-") ? "IN" : null;
      return {
        id: r.id,
        tmp_number: r.tmp_number ?? null,
        official_number: r.official_number ?? null,
        branch_id: r.branch_id,
        customer: r.customer ?? null,
        notes: r.notes ?? null,
        created_at: r.created_at,
        pdf_path: r.pdf_path ?? null,
        dir: inferredDir,
        total_qty,
        total_amount,
      } as Row;
    });

    const filtered = withComputed.filter((row) => {
      if (dir !== "ALL" && row.dir !== dir) return false;
      if (!qTrim) return true;
      const matchesHeader =
        (row.tmp_number ?? "").toLowerCase().includes(qTrim) ||
        (row.customer ?? "").toLowerCase().includes(qTrim);
      if (matchesHeader) return true;

      const items = DB.getRemitoItems(row.id) || [];
      return items.some((it: any) =>
        (it.code ?? "").toLowerCase().includes(qTrim) ||
        (it.name ?? "").toLowerCase().includes(qTrim)
      );
    });

    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
  const { height, width } = useWindowDimensions();
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

  // 👇 4. 'renderItem' ACTUALIZADO con items detallados
  const renderItem = ({ item }: { item: Row }) => {
    const created = new Date(item.created_at).toLocaleString();
    const isIN = item.dir === "IN";
    const badgeBg = isIN ? theme.colors.success : theme.colors.danger;
    const isDigitalized = item.notes?.startsWith("Ingreso por digitalización");
    
    // Obtener los items del remito para mostrar detalles
    const remitoItems = DB.getRemitoItems(item.id) || [];
    
    // Verificar si el remito tiene precios válidos
    const hasValidPrices = remitoItems.some(ri => (Number(ri.unit_price) || 0) > 0);

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
        
        {isDigitalized && (
          <Text style={styles.digitalizedTag}>
            ✔️ Ingresado por digitalización
          </Text>
        )}
        
        {/* Items detallados */}
        {remitoItems.length > 0 && (
          <View style={styles.itemsContainer}>
            <Text style={[styles.itemsHeader, { color: theme.colors.text }]}>
              📦 Productos ({remitoItems.length} items):
            </Text>
            {remitoItems.slice(0, 3).map((rItem, index) => (
              <View key={rItem.id} style={styles.itemRow}>
                <Text style={[styles.itemName, { color: theme.colors.text }]} numberOfLines={1}>
                  • {rItem.name || `Producto ${index + 1}`}
                </Text>
                <View style={styles.itemDetails}>
                  <Text style={[styles.itemQty, { color: theme.colors.textSecondary }]}>
                    {Number(rItem.qty) || 0} unid.
                  </Text>
                  {hasValidPrices ? (
                    <>
                      <Text style={[styles.itemPrice, { color: theme.colors.textSecondary }]}>
                        ${(Number(rItem.unit_price) || 0).toFixed(2)} c/u
                      </Text>
                      <Text style={[styles.itemTotal, { color: theme.colors.text }]}>
                        ${((Number(rItem.qty) || 0) * (Number(rItem.unit_price) || 0)).toFixed(2)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.itemPrice, { color: theme.colors.textMuted, fontStyle: 'italic' }]}>
                      Sin precio
                    </Text>
                  )}
                </View>
              </View>
            ))}
            {remitoItems.length > 3 && (
              <Text style={[styles.moreItems, { color: theme.colors.textMuted }]}>
                ... y {remitoItems.length - 3} productos más
              </Text>
            )}
          </View>
        )}
        
        {/* Total */}
        <View style={styles.totalContainer}>
          <Text style={[styles.totalText, { color: theme.colors.text }]}>
            {hasValidPrices ? (
              `💰 Total: $${item.total_amount.toFixed(2)} (${item.total_qty} unidades)`
            ) : (
              `📦 ${item.total_qty} unidades (remito sin precios)`
            )}
          </Text>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => navigation.navigate("RemitoDetail", { remitoId: item.id })}
            style={[styles.button, { backgroundColor: theme.colors.primary }]}
            activeOpacity={0.9}
          >
            <Text style={styles.buttonText}>Ver detalle completo</Text>
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
    <SafeAreaView style={{ flex: 1 }}>
      <View style={[styles.screen, { maxWidth: 1000, alignSelf: 'center', width: '100%' }]}>
        {/* Encabezado, búsqueda y filtros */}
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

        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>

        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24, paddingHorizontal: 4, minHeight: height }}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginTop: 24 }} />
            ) : (
              <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>No hay remitos</Text>
            )
          }
        />
      </View>
    </SafeAreaView>
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
  itemContainer: { borderBottomWidth: 1, paddingVertical: 12, gap: 8, paddingHorizontal: 12, backgroundColor: 'white', marginBottom: 12, borderRadius: 12, elevation: 2 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  remitoNumber: { fontWeight: "700", fontSize: 16 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontWeight: "bold", fontSize: 12 },
  dateText: { fontSize: 12 },
  detailsText: { fontSize: 14, fontWeight: '500' },
  digitalizedTag: { fontSize: 11, color: "#059669", fontWeight: 'bold', marginTop: 4 },
  // Nuevos estilos para items detallados
  itemsContainer: { marginTop: 8, padding: 8, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  itemsHeader: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  itemName: { flex: 1, fontSize: 12, marginRight: 8 },
  itemDetails: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  itemQty: { fontSize: 11, minWidth: 45, textAlign: 'center' },
  itemPrice: { fontSize: 11, minWidth: 55, textAlign: 'center' },
  itemTotal: { fontSize: 12, fontWeight: '600', minWidth: 50, textAlign: 'right' },
  moreItems: { fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  totalContainer: { marginTop: 8, padding: 8, backgroundColor: '#dbeafe', borderRadius: 6 },
  totalText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  buttonText: { color: "white", fontWeight: "600" },
});