// src/screens/RemitoDetail.tsx
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Platform } from "react-native";
import { DB } from "../db.native";
import * as SQLite from "expo-sqlite";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

type Remito = {
  id: string;
  tmp_number: string | null;
  official_number: string | null;
  branch_id: string;
  customer: string | null;
  notes: string | null;
  created_at: string;
  pdf_path: string | null;
};

type Item = {
  id: string;
  remito_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  code?: string;
  name?: string;
};

const db = SQLite.openDatabaseSync("stockeate.db");

export default function RemitoDetail({ route }: any) {
  const remitoId: string = route?.params?.remitoId;

  const [remito, setRemito] = useState<Remito | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dir, setDir] = useState<"IN" | "OUT" | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!remitoId) return;
    const r = DB.getRemitoById(remitoId);
    setRemito(r);
    const it = DB.getRemitoItems(remitoId);
    setItems(it || []);

    // obtener dirección desde stock_moves.ref = tmp_number
    if (r?.tmp_number) {
      const row = db.getFirstSync<{ type: string }>(
        `SELECT type FROM stock_moves WHERE ref = ? LIMIT 1`,
        [r.tmp_number]
      );
      if (row?.type === "IN" || row?.type === "OUT") setDir(row.type as "IN" | "OUT");
    }
  }, [remitoId]);

  const createdAt = useMemo(
    () => (remito?.created_at ? new Date(remito.created_at).toLocaleString() : ""),
    [remito?.created_at]
  );

  const totalQty = useMemo(() => items.reduce((a, r) => a + (r.qty ?? 0), 0), [items]);
  const totalAmount = useMemo(
    () => items.reduce((a, r) => a + (r.unit_price ?? 0) * (r.qty ?? 0), 0),
    [items]
  );

  const openPdf = async () => {
    if (!remito?.pdf_path) {
      Alert.alert("PDF", "Este remito no tiene archivo guardado.");
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert("Compartir", "Compartir no está disponible en este dispositivo.");
      return;
    }
    try {
      await Sharing.shareAsync(remito.pdf_path);
    } catch (e) {
      Alert.alert("Compartir", "No se pudo abrir/compartir el PDF.");
    }
  };

  const reprint = async () => {
    if (!remito) return;
    setBusy(true);
    try {
      const html =
        dir === "IN"
          ? buildHtmlIN(remito, items, totalAmount)
          : buildHtmlOUT(remito, items, totalAmount);
      const { uri } = await Print.printToFileAsync({ html });
      if (uri) {
        // opcional: guardar nuevo path
        // DB.setRemitoPdfPath(remito.id, uri);
        await Sharing.shareAsync(uri);
      }
    } catch (e) {
      Alert.alert("Imprimir", "No pude generar el PDF nuevamente.");
    } finally {
      setBusy(false);
    }
  };

  if (!remito) {
    return (
      <View style={{ flex: 1, padding: 16, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const isIN = dir === "IN";
  const badgeBg = isIN ? "#DCFCE7" : "#FEE2E2";
  const badgeTx = isIN ? "#166534" : "#991B1B";

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>
          {remito.tmp_number || "(sin nro.)"}
        </Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: badgeBg }}>
          <Text style={{ color: badgeTx, fontWeight: "700", fontSize: 12 }}>
            {dir || "?"}
          </Text>
        </View>
      </View>

      <Text style={{ color: "#475569", fontSize: 12 }}>
        {createdAt}
        {remito.customer ? ` — ${isIN ? "Proveedor" : "Cliente"}: ${remito.customer}` : ""}
      </Text>
      {remito.notes ? (
        <Text style={{ color: "#334155", fontSize: 12 }}>Notas: {remito.notes}</Text>
      ) : null}

      <View
        style={{
          borderWidth: 1,
          borderColor: "#e2e8f0",
          borderRadius: 10,
          padding: 10,
          gap: 6,
        }}
      >
        <Text style={{ fontWeight: "700" }}>Items</Text>
        {items.map((it) => (
          <View
            key={it.id}
            style={{
              borderBottomWidth: 1,
              borderColor: "#e5e7eb",
              paddingVertical: 8,
              gap: 4,
            }}
          >
            <Text style={{ fontWeight: "600" }}>{it.name}</Text>
            <Text style={{ color: "#64748b", fontSize: 12 }}>{it.code}</Text>
            <Text style={{ color: "#334155", fontSize: 12 }}>
              Cantidad: {it.qty} — P. Unit.: ${it.unit_price.toFixed(2)} — Importe: ${(it.unit_price * it.qty).toFixed(2)}
            </Text>
          </View>
        ))}

        <Text style={{ textAlign: "right", fontWeight: "800", marginTop: 6 }}>
          Total: ${totalAmount.toFixed(2)} ({totalQty} u.)
        </Text>
      </View>

      {/* Acciones */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          onPress={openPdf}
          style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: "#0ea5e9", alignItems: "center" }}
          activeOpacity={0.9}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>Abrir / compartir PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={reprint}
          style={{ paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#e5e7eb", alignItems: "center", opacity: busy ? 0.85 : 1 }}
          activeOpacity={0.9}
          disabled={busy}
        >
          {busy ? <ActivityIndicator /> : <Text style={{ color: "#111827", fontWeight: "800" }}>Reimprimir</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ===== Helpers PDF ===== */

function buildHtmlOUT(remito: Remito, items: Item[], total: number) {
  const rows = items
    .map(
      (r) => `
      <tr>
        <td style="padding:6px;border:1px solid #e5e7eb;">${r.code || ""}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;">${escapeHtml(r.name || "")}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">${r.qty}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">$${(r.unit_price ?? 0).toFixed(2)}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">$${((r.unit_price ?? 0) * r.qty).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
  <html>
    <head><meta charset="utf-8"/><title>Remito salida ${remito.tmp_number || ""}</title></head>
    <body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:16px;">
      <h2 style="margin:0 0 6px 0;">Remito de salida</h2>
      <div style="color:#334155;margin-bottom:12px;">
        <div><strong>N° temporal:</strong> ${remito.tmp_number || ""}</div>
        ${remito.customer ? `<div><strong>Cliente:</strong> ${escapeHtml(remito.customer)}</div>` : ""}
        <div><strong>Fecha:</strong> ${new Date(remito.created_at).toLocaleString()}</div>
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
      <div style="text-align:right;font-size:14px;margin:8px 0;"><strong>Total: $${total.toFixed(2)}</strong></div>
      ${remito.notes ? `<div style="margin-top:10px;color:#475569;"><strong>Notas:</strong> ${escapeHtml(remito.notes)}</div>` : ""}
      <div style="margin-top:24px;font-size:11px;color:#64748b;">ID interno: ${remito.id}</div>
    </body>
  </html>`;
}

function buildHtmlIN(remito: Remito, items: Item[], total: number) {
  const rows = items
    .map(
      (r) => `
      <tr>
        <td style="padding:6px;border:1px solid #e5e7eb;">${r.code || ""}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;">${escapeHtml(r.name || "")}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">${r.qty}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">$${(r.unit_price ?? 0).toFixed(2)}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">$${((r.unit_price ?? 0) * r.qty).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
  <html>
    <head><meta charset="utf-8"/><title>Remito entrada ${remito.tmp_number || ""}</title></head>
    <body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:16px;">
      <h2 style="margin:0 0 6px 0;">Remito de entrada</h2>
      <div style="color:#334155;margin-bottom:12px;">
        <div><strong>N° temporal:</strong> ${remito.tmp_number || ""}</div>
        ${remito.customer ? `<div><strong>Proveedor:</strong> ${escapeHtml(remito.customer)}</div>` : ""}
        <div><strong>Fecha:</strong> ${new Date(remito.created_at).toLocaleString()}</div>
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
      <div style="text-align:right;font-size:14px;margin:8px 0;"><strong>Total: $${total.toFixed(2)}</strong></div>
      ${remito.notes ? `<div style="margin-top:10px;color:#475569;"><strong>Notas:</strong> ${escapeHtml(remito.notes)}</div>` : ""}
      <div style="margin-top:24px;font-size:11px;color:#64748b;">ID interno: ${remito.id}</div>
    </body>
  </html>`;
}

function escapeHtml(s: string) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
