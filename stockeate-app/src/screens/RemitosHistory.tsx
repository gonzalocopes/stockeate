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
import { useBranch } from "../stores/branch";
import * as SQLite from "expo-sqlite";

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
  const [loading, setLoading] = useState(false);

  const subtitle = useMemo(() => {
    const label =
      dir === "ALL" ? "Entrada y salida" : dir === "IN" ? "Entrada" : "Salida";
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
      const qLike = `%${q.trim()}%`;
      const limit = 200;
      const off = 0;

      // Obtenemos remitos de la sucursal con: dirección (IN/OUT), total de ítems y total $
      const data = db.getAllSync<Row>(
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

      // Normalizamos dir por si viene null
      setRows(
        data.map((r) => ({
          ...r,
          dir: (r.dir === "IN" || r.dir === "OUT") ? r.dir : null,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: Row }) => {
    const created = new Date(item.created_at).toLocaleString();
    const isIN = item.dir === "IN";
    const badgeBg = isIN ? "#DCFCE7" : "#FEE2E2";
    const badgeTx = isIN ? "#166534" : "#991B1B";
    return (
      <View
        style={{
          borderBottomWidth: 1,
          borderColor: "#e5e7eb",
          paddingVertical: 10,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontWeight: "700" }}>
            {item.tmp_number || "(sin nro.)"}
          </Text>
          <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: badgeBg }}>
            <Text style={{ color: badgeTx, fontWeight: "700", fontSize: 12 }}>
              {item.dir || "?"}
            </Text>
          </View>
        </View>
        <Text style={{ color: "#475569", fontSize: 12 }}>
          {created}
          {item.customer ? ` — ${item.dir === "IN" ? "Proveedor" : "Cliente"}: ${item.customer}` : ""}
        </Text>
        <Text style={{ color: "#334155", fontSize: 12 }}>
          Items: {item.total_qty} — Total: ${item.total_amount.toFixed(2)}
        </Text>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate("RemitoDetail", { remitoId: item.id })}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#0ea5e9" }}
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
      <View style={{ flex: 1, padding: 16, alignItems: "center", justifyContent: "center" }}>
        <Text>Primero seleccioná una sucursal.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Historial de remitos</Text>

      {/* Filtros */}
      <View style={{ gap: 8 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Buscar por nro., cliente/proveedor, código o nombre"
          style={{
            borderWidth: 1,
            borderColor: q ? "#007AFF" : "#cbd5e1",
            borderRadius: 8,
            padding: 10,
            backgroundColor: q ? "#f8f9ff" : "white",
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
              borderColor: dir === "ALL" ? "#007AFF" : "#cbd5e1",
              backgroundColor: dir === "ALL" ? "#e6f0ff" : "white",
              alignItems: "center",
            }}
            activeOpacity={0.9}
          >
            <Text style={{ fontWeight: "700" }}>Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDir("IN")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: dir === "IN" ? "#16a34a" : "#cbd5e1",
              backgroundColor: dir === "IN" ? "#ecfdf5" : "white",
              alignItems: "center",
            }}
            activeOpacity={0.9}
          >
            <Text style={{ fontWeight: "700", color: "#065f46" }}>Entrada</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setDir("OUT")}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: dir === "OUT" ? "#ef4444" : "#cbd5e1",
              backgroundColor: dir === "OUT" ? "#fef2f2" : "white",
              alignItems: "center",
            }}
            activeOpacity={0.9}
          >
            <Text style={{ fontWeight: "700", color: "#7f1d1d" }}>Salida</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ color: "#64748b", fontSize: 12 }}>{subtitle}</Text>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(x) => x.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}
