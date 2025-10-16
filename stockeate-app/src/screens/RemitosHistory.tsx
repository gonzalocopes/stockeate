// src/screens/RemitosHistory.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useBranch } from "../stores/branch";
import { api, pullFromServer } from "../api"; // <-- 1. Importamos pullFromServer
import * as SQLite from "expo-sqlite";

// ... (El tipo 'Row' se mantiene igual) ...
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


const db = SQLite.openDatabaseSync("stockeate.db");

export default function RemitosHistory({ navigation }: any) {
  const branchId = useBranch((s) => s.id);
  const [q, setQ] = useState("");
  const [dir, setDir] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true); // <-- Empezar en true

  const subtitle = useMemo(() => {
    const label =
      dir === "ALL" ? "Entrada y salida" : dir === "IN" ? "Entrada" : "Salida";
    return `${rows.length} remito${rows.length === 1 ? "" : "s"}`;
  }, [rows.length]);

  useEffect(() => {
    if (!branchId) return;
    // Debounce: espera un poco después de que el usuario deja de escribir para buscar
    const timerId = setTimeout(load, 250);
    return () => clearTimeout(timerId);
  }, [q, dir, branchId]);

  // 👇 2. La función de carga ahora es asíncrona para esperar la sincronización
  const load = async () => {
    if (!branchId) {
        setLoading(false);
        return;
    };
    setLoading(true);
    try {
      // --- LA CORRECCIÓN CLAVE ESTÁ AQUÍ ---
      // Primero, sincronizamos los datos del servidor a la BD local.
      await pullFromServer(branchId);
      // --- FIN DE LA CORRECCIÓN ---

      // Ahora que la BD local está actualizada, ejecutamos la consulta
      const qLike = `%${q.trim()}%`;
      const data = db.getAllSync<Row>(
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
        `,
        [branchId, q.trim(), qLike, qLike, qLike, qLike]
      );
      
      const filteredData = data.filter(r => dir === 'ALL' || r.dir === dir);
      setRows(filteredData);

    } catch (error) {
      console.error("Error loading history:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Row }) => {
    const created = new Date(item.created_at).toLocaleString();
    const isIN = item.dir === "IN";
    const badgeBg = isIN ? "#DCFCE7" : "#FEE2E2";
    const badgeTx = isIN ? "#166534" : "#991B1B";
    const isDigitalized = item.notes?.startsWith("Ingreso por digitalización");

    return (
      <View style={styles.itemContainer}>
        <View style={styles.header}>
          <Text style={styles.remitoNumber}>{item.tmp_number || "(sin nro.)"}</Text>
          {item.dir && (
            <View style={[styles.badge, { backgroundColor: badgeBg }]}>
              <Text style={[styles.badgeText, { color: badgeTx }]}>{item.dir}</Text>
            </View>
          )}
        </View>
        <Text style={styles.dateText}>
          {created}
          {item.customer ? ` — ${isIN ? "Proveedor" : "Cliente"}: ${item.customer}` : ""}
        </Text>
        <Text style={styles.detailsText}>Items: {item.total_qty}</Text>

        {isDigitalized && (
          <Text style={styles.digitalizedTag}>✔️ Ingresado por digitalización</Text>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => navigation.navigate("RemitoDetail", { remitoId: item.id })}
            style={styles.button}
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
      <View style={styles.centered}><Text>Primero seleccioná una sucursal.</Text></View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.screenTitle}>Historial de remitos</Text>
      
      <View style={styles.filtersContainer}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar..."
          style={styles.searchInput}
        />
        <View style={styles.filterButtons}>
          <TouchableOpacity onPress={() => setDir("ALL")} style={[styles.filterButton, dir === 'ALL' && styles.activeFilterAll]}>
            <Text style={styles.filterButtonText}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDir("IN")} style={[styles.filterButton, dir === 'IN' && styles.activeFilterIn]}>
            <Text style={[styles.filterButtonText, dir === 'IN' && {color: "#065f46"}]}>Entrada</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDir("OUT")} style={[styles.filterButton, dir === 'OUT' && styles.activeFilterOut]}>
            <Text style={[styles.filterButtonText, dir === 'OUT' && {color: "#7f1d1d"}]}>Salida</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.subtitle}>{subtitle}</Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(x) => x.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={styles.emptyText}>No se encontraron remitos.</Text>}
          onRefresh={load} // El pull-to-refresh ahora también sincroniza
          refreshing={loading}
        />
      )}
    </View>
  );
}

// Estilos centralizados para un código más limpio
const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12, backgroundColor: '#f8fafc' },
  centered: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center" },
  screenTitle: { fontSize: 22, fontWeight: "800" },
  filtersContainer: { gap: 12 },
  searchInput: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8, padding: 12, backgroundColor: "white", fontSize: 16 },
  filterButtons: { flexDirection: "row", gap: 8 },
  filterButton: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "white", alignItems: "center" },
  activeFilterAll: { borderColor: "#3b82f6", backgroundColor: "#eff6ff" },
  activeFilterIn: { borderColor: "#22c55e", backgroundColor: "#f0fdf4" },
  activeFilterOut: { borderColor: "#ef4444", backgroundColor: "#fef2f2" },
  filterButtonText: { fontWeight: "600", color: '#334155' },
  subtitle: { color: "#64748b", fontSize: 12 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#64748b' },
  itemContainer: { borderBottomWidth: 1, borderColor: "#f1f5f9", paddingVertical: 12, gap: 4, backgroundColor: 'white', paddingHorizontal: 16, borderRadius: 8, marginBottom: 8, elevation: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  remitoNumber: { fontWeight: "700", fontSize: 16, color: '#1e293b' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  badgeText: { fontWeight: "bold", fontSize: 12 },
  dateText: { color: "#64748b", fontSize: 12 },
  detailsText: { color: "#475569", fontSize: 14, fontWeight: '500' },
  digitalizedTag: { fontSize: 11, color: "#059669", fontWeight: 'bold', marginTop: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  button: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#3b82f6" },
  buttonText: { color: "white", fontWeight: "600" },
});