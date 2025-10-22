// src/screens/RemitoForm.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useBranch } from "../stores/branch";
import { useBatch } from "../stores/batch";
import { DB } from "../db";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { api } from "../api";
import { pushMovesBatchByCodes } from "../sync/push";

type LoteItem = {
  product_id: string;
  code: string;
  name: string;
  unit_price: number;
  qty: number;
};

export default function RemitoForm({ navigation }: any) {
  const branchId = useBranch((s) => s.id);
  const branchName = useBranch((s) => s.name);

  const { items, addOrInc, dec, remove } = useBatch();
  const totalQty = useBatch((s) => s.totalQty)();
  const totalImporte = useMemo(
    () => items.reduce((a, r) => a + (r.unit_price ?? 0) * (r.qty ?? 0), 0),
    [items]
  );

  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  if (!branchId) {
    return (
      <View style={{ flex: 1, padding: 16, alignItems: "center", justifyContent: "center" }}>
        <Text>Primero elegí una sucursal.</Text>
      </View>
    );
  }

  const tmpNumber = () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `R-${(branchName || branchId).slice(0, 4).toUpperCase()}-${ymd}-${rnd}`;
    // Es un número temporal legible. El “oficial_number” lo podés asignar después desde backend.
  };

  const renderItem = ({ item }: { item: LoteItem }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderColor: "#eee",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "600" }}>{item.name}</Text>
        <Text style={{ color: "#475569", fontSize: 12 }}>{item.code}</Text>
        <Text style={{ color: "#334155", fontSize: 12 }}>
          ${item.unit_price ?? 0} c/u
        </Text>
      </View>

      <TouchableOpacity
        onPress={() =>
          dec(item.code) /* baja 1 en el lote (no mueve stock aún) */
        }
        style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderWidth: 1,
          borderColor: "#007AFF",
          backgroundColor: "#f8f9fa",
          borderRadius: 6,
        }}
        activeOpacity={0.8}
      >
        <Text style={{ color: "#007AFF", fontWeight: "700" }}>-</Text>
      </TouchableOpacity>
      <Text style={{ width: 28, textAlign: "center", fontWeight: "700" }}>{item.qty}</Text>
      <TouchableOpacity
        onPress={() => addOrInc(item, 1)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderWidth: 1,
          borderColor: "#007AFF",
          backgroundColor: "#007AFF",
          borderRadius: 6,
        }}
        activeOpacity={0.8}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>+</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => remove(item.code)}
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          backgroundColor: "#dc3545",
          borderRadius: 6,
          marginLeft: 6,
        }}
        activeOpacity={0.8}
      >
        <Text style={{ color: "white", fontWeight: "700" }}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  const confirmAndSave = async () => {
    if (items.length === 0) {
      Alert.alert("Remito", "No hay items en el lote.");
      return;
    }
    setSaving(true);
    try {
      const tmpNum = tmpNumber();

      // 1) Crear remito
      const remitoId = DB.insertRemito({
        tmp_number: tmpNum,
        official_number: null,
        branch_id: branchId,
        customer: customer?.trim() || null,
        notes: notes?.trim() || null,
        pdf_path: null,
      });

      // 2) Items + movimientos de stock (OUT) + update stock
      for (const r of items) {
        DB.insertRemitoItem({
          remito_id: remitoId,
          product_id: r.product_id,
          qty: r.qty,
          unit_price: r.unit_price ?? 0,
        });
        // OUT: restar stock (incrementStock con delta negativo)
        DB.incrementStock(r.product_id, -r.qty);
        DB.insertStockMove({
          product_id: r.product_id,
          branch_id: branchId,
          qty: -r.qty,
          type: "OUT",
          ref: tmpNum,
        });
      }

      // 3) Intentar PDF (si falla, seguimos igual)
      let pdfPath: string | null = null;
      try {
        const html = buildHtml(remitoId, tmpNum, branchName || branchId, customer, items, notes, totalImporte);
        const { uri } = await Print.printToFileAsync({ html });
        pdfPath = uri || null;
        if (pdfPath) {
          DB.setRemitoPdfPath(remitoId, pdfPath);
        }
      } catch (e) {
        console.log("⚠️ No pude generar PDF:", e?.toString?.());
      }

      // 4) Sync online “/sync”: OUT moves + remito + items
      try {
  // a) movimientos OUT
  await pushMovesBatchByCodes(branchId, items.map(r => ({
    code: r.code,
    qty: r.qty,
    reason: "Remito egreso"
  })), "OUT");

  // b) remito + items (con productId)
  const remitoItems = items.map((r) => ({
  remito_id: remitoId,
  productId: r.product_id,         // 👈 usar el id del lote
  qty: r.qty,
  unit_price: r.unit_price ?? 0,
}));

  await api.post("/sync", {
    branchId,
    products: [],
    stockMoves: [],
    remitos: [
      {
        id: remitoId,
        tmp_number: tmpNum,
        official_number: null,
        branch_id: branchId,
        customer: customer?.trim() || null,
        notes: notes?.trim() || "Remito de EGRESO",
        created_at: new Date().toISOString(),
      },
    ],
    remitoItems,
  });
} catch (e) {
  console.log("⚠️ Sync remito OUT falló (local ok):", e?.toString?.());
}

      // 5) Vaciar lote
      // Si tu store no tiene "clear()", borramos item por item:
      try {
        // @ts-ignore (si tenés clear, usalo)
        typeof (useBatch.getState() as any).clear === "function"
          ? (useBatch.getState() as any).clear()
          : items.forEach((it) => remove(it.code));
      } catch {}

      // 6) Navegar a resultado
      navigation.replace("RemitoResult", {
        remitoId,
        tmpNumber: tmpNum,
        pdfPath,
      });
    } catch (e) {
      console.log(e);
      Alert.alert("Remito", "Hubo un problema al guardar el remito.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Remito de salida (egreso)</Text>

      <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10 }}>
        <Text style={{ fontWeight: "600", marginBottom: 6 }}>Datos</Text>
        <Text style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>
          Sucursal: <Text style={{ fontWeight: "700", color: "#0f172a" }}>{branchName || branchId}</Text>
        </Text>

        <Text style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>Cliente / destino</Text>
        <TextInput
          placeholder="Ej: Juan Pérez"
          value={customer}
          onChangeText={setCustomer}
          style={{
            borderWidth: 1,
            borderColor: "#cbd5e1",
            borderRadius: 8,
            padding: 10,
            marginBottom: 8,
            backgroundColor: "white",
          }}
        />

        <Text style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>Notas</Text>
        <TextInput
          placeholder="Observaciones"
          value={notes}
          onChangeText={setNotes}
          style={{
            borderWidth: 1,
            borderColor: "#cbd5e1",
            borderRadius: 8,
            padding: 10,
            backgroundColor: "white",
          }}
          multiline
        />
      </View>

      <Text style={{ fontWeight: "700", marginTop: 8 }}>Items ({totalQty} u.)</Text>
      <FlatList data={items} keyExtractor={(i) => i.code} renderItem={renderItem} />

      <View
        style={{
          borderTopWidth: 1,
          borderColor: "#e5e7eb",
          paddingTop: 10,
          gap: 6,
        }}
      >
        <Text style={{ fontWeight: "700" }}>
          Total estimado: ${totalImporte.toFixed(2)}
        </Text>

        <TouchableOpacity
          onPress={() => navigation.navigate("ScanAdd", { mode: "batch" })}
          style={{
            paddingVertical: 12,
            borderRadius: 8,
            backgroundColor: "#0ea5e9",
            alignItems: "center",
          }}
          activeOpacity={0.9}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Agregar más con el escáner</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={confirmAndSave}
          style={{
            paddingVertical: 14,
            borderRadius: 8,
            backgroundColor: items.length > 0 ? "#22c55e" : "#94a3b8",
            alignItems: "center",
            opacity: saving ? 0.85 : 1,
          }}
          activeOpacity={0.9}
          disabled={saving || items.length === 0}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "white", fontWeight: "800" }}>Guardar remito (egreso)</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ======================= helpers ======================= */

function buildHtml(
  remitoId: string,
  tmpNumber: string,
  branchLabel: string,
  customer: string,
  items: LoteItem[],
  notes: string,
  totalImporte: number
) {
  const rows = items
    .map(
      (r) => `
        <tr>
          <td style="padding:6px;border:1px solid #e5e7eb;">${r.code}</td>
          <td style="padding:6px;border:1px solid #e5e7eb;">${escapeHtml(r.name)}</td>
          <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">${r.qty}</td>
          <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">$${(r.unit_price ?? 0).toFixed(2)}</td>
          <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">$${((r.unit_price ?? 0) * r.qty).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Remito ${tmpNumber}</title>
      </head>
      <body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:16px;">
        <h2 style="margin:0 0 6px 0;">Remito de salida</h2>
        <div style="color:#334155;margin-bottom:12px;">
          <div><strong>N° temporal:</strong> ${tmpNumber}</div>
          <div><strong>Sucursal:</strong> ${escapeHtml(branchLabel)}</div>
          ${customer ? `<div><strong>Cliente:</strong> ${escapeHtml(customer)}</div>` : ""}
          <div><strong>Fecha:</strong> ${new Date().toLocaleString()}</div>
        </div>

        <table style="border-collapse:collapse;width:100%;font-size:12px;margin-bottom:10px;">
          <thead>
            <tr>
              <th style="padding:6px;border:1px solid #e5e7eb;background:#f1f5f9;text-align:left;">Código</th>
              <th style="padding:6px;border:1px solid #e5e7eb;background:#f1f5f9;text-align:left;">Producto</th>
              <th style="padding:6px;border:1px solid #e5e7eb;background:#f1f5f9;text-align:right;">Cantidad</th>
              <th style="padding:6px;border:1px solid #e5e7eb;background:#f1f5f9;text-align:right;">P. Unit.</th>
              <th style="padding:6px;border:1px solid #e5e7eb;background:#f1f5f9;text-align:right;">Importe</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <div style="text-align:right;font-size:14px;margin:8px 0;">
          <strong>Total: $${totalImporte.toFixed(2)}</strong>
        </div>

        ${
          notes
            ? `<div style="margin-top:10px;color:#475569;"><strong>Notas:</strong> ${escapeHtml(notes)}</div>`
            : ""
        }

        <div style="margin-top:24px;font-size:11px;color:#64748b;">ID interno: ${remitoId}</div>
      </body>
    </html>
  `;
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
