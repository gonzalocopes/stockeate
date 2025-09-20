// src/screens/RemitoIngreso.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { CameraView, Camera } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";

import { useBranch } from "../stores/branch";
import { DB } from "../db.native";
import ProductEditModal from "../components/ProductEditModal";
import * as Print from "expo-print";
import { api } from "../api";

type Row = {
  id: string;
  code: string;
  name: string;
  unit_price: number;
  count: number; // cantidad a ingresar
};

const COOLDOWN_MS = 900;
const SAME_CODE_BLOCK_MS = 800;

export default function RemitoIngreso({ navigation }: any) {
  const branchId = useBranch((s) => s.id);
  const branchName = useBranch((s) => s.name);
  const isFocused = useIsFocused();

  // cámara + feedback
  const [hasPerm, setHasPerm] = useState<boolean | null>(null);
  const [scanEnabled, setScanEnabled] = useState(true);
  const lastDataRef = useRef<string | null>(null);
  const lastAtRef = useRef<number>(0);
  const [beep, setBeep] = useState<Audio.Sound | null>(null);

  // manual
  const [manual, setManual] = useState("");

  // modal crear/editar
  const [editVisible, setEditVisible] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);

  // datos remito
  const [provider, setProvider] = useState(""); // proveedor / origen
  const [notes, setNotes] = useState("");

  // items de esta entrada
  const [rows, setRows] = useState<Row[]>([]);
  const totalQty = useMemo(() => rows.reduce((a, r) => a + r.count, 0), [rows]);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        setHasPerm(true);
      } else {
        const { status } = await Camera.requestCameraPermissionsAsync();
        setHasPerm(status === "granted");
      }
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/beep.mp3"),
          { volume: 0.9 }
        );
        if (mounted) setBeep(sound);
      } catch {}
    })();
    return () => {
      mounted = false;
      beep?.unloadAsync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bump = (p: { id: string; code: string; name: string; price: number }) => {
    setRows((cur) => {
      const ix = cur.findIndex((r) => r.code === p.code);
      if (ix >= 0) {
        const copy = [...cur];
        copy[ix] = { ...copy[ix], name: p.name, unit_price: p.price ?? 0, count: copy[ix].count + 1 };
        return copy;
      }
      return [{ id: p.id, code: p.code, name: p.name, unit_price: p?.price ?? 0, count: 1 }, ...cur];
    });
  };

  const setCount = (code: string, delta: number) => {
    setRows((cur) => {
      const ix = cur.findIndex((r) => r.code === code);
      if (ix < 0) return cur;
      const copy = [...cur];
      const next = Math.max(0, copy[ix].count + delta);
      if (next === 0) copy.splice(ix, 1);
      else copy[ix] = { ...copy[ix], count: next };
      return copy;
    });
  };

  const tmpNumber = () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `IN-${(branchName || branchId).slice(0, 4).toUpperCase()}-${ymd}-${rnd}`;
  };

  const onScan = async (raw: string) => {
    if (!branchId) {
      Alert.alert("Sucursal", "Seleccioná una sucursal primero.");
      return;
    }
    const code = String(raw || "").trim();
    if (!code || !scanEnabled) return;

    const now = Date.now();
    if (lastDataRef.current === code && now - lastAtRef.current < SAME_CODE_BLOCK_MS) return;
    lastDataRef.current = code;
    lastAtRef.current = now;

    setScanEnabled(false);

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await beep?.replayAsync();
    } catch {}

    const p = DB.getProductByCode(code);
    if (p) {
      bump({ id: p.id, code: p.code, name: p.name, price: p.price ?? 0 });
      setTimeout(() => setScanEnabled(true), COOLDOWN_MS);
    } else {
      // crear nuevo
      setPendingCode(code);
      setEditName(code);
      setEditPrice(0);
      setEditVisible(true);
    }
  };

  const onSaveNewProduct = async (data: { name: string; price: number; stock?: number }) => {
    if (!branchId || !pendingCode) {
      setEditVisible(false);
      setPendingCode(null);
      setScanEnabled(true);
      return;
    }
    const created = DB.upsertProduct({
      code: pendingCode,
      name: data.name,
      price: data.price,
      stock: 0, // stock inicial 0, el ingreso lo suma al confirmar
      branch_id: branchId,
    });

    // sumar a la lista de ingreso
    bump({ id: created.id, code: created.code, name: created.name, price: created.price ?? 0 });
    // opcionalmente sincronizamos el upsert
    try {
      await api.post("/sync", {
        branchId,
        products: [{ code: created.code, name: created.name, price: created.price ?? 0, branch_id: branchId }],
        stockMoves: [],
        remitos: [],
        remitoItems: [],
      });
    } catch {}

    setEditVisible(false);
    setPendingCode(null);
    setTimeout(() => setScanEnabled(true), 250);
  };

  const renderRow = ({ item }: { item: Row }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: "#eef2f7" }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "600" }}>{item.name}</Text>
        <Text style={{ color: "#64748b", fontSize: 12 }}>{item.code}</Text>
        <Text style={{ color: "#334155", fontSize: 12 }}>${item.unit_price} c/u</Text>
      </View>
      <TouchableOpacity onPress={() => setCount(item.code, -1)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: "#007AFF", backgroundColor: "#f8f9fa", borderRadius: 8 }} activeOpacity={0.9}>
        <Text style={{ color: "#007AFF", fontWeight: "800" }}>-</Text>
      </TouchableOpacity>
      <Text style={{ width: 28, textAlign: "center", fontWeight: "800" }}>{item.count}</Text>
      <TouchableOpacity onPress={() => setCount(item.code, +1)} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#22c55e", borderRadius: 8 }} activeOpacity={0.9}>
        <Text style={{ color: "white", fontWeight: "800" }}>+</Text>
      </TouchableOpacity>
    </View>
  );

  const totalImporte = useMemo(
    () => rows.reduce((a, r) => a + (r.unit_price ?? 0) * (r.count ?? 0), 0),
    [rows]
  );

  const confirmAndSave = async () => {
    if (!branchId) {
      Alert.alert("Sucursal", "Seleccioná una sucursal primero.");
      return;
    }
    if (rows.length === 0) {
      Alert.alert("Ingreso", "No hay productos en la lista.");
      return;
    }
    setSaving(true);
    try {
      const tmpNum = tmpNumber();

      // 1) remito
      const remitoId = DB.insertRemito({
        tmp_number: tmpNum,
        official_number: null,
        branch_id: branchId,
        customer: provider?.trim() || null, // usamos 'customer' como proveedor/origen
        notes: notes?.trim() || "Remito de ENTRADA",
        pdf_path: null,
      });

      // 2) items + movimientos IN + sumar stock
      for (const r of rows) {
        const p = DB.getProductByCode(r.code); // por si editaste antes
        if (!p) continue;
        DB.insertRemitoItem({
          remito_id: remitoId,
          product_id: p.id,
          qty: r.count,
          unit_price: r.unit_price ?? 0,
        });
        DB.incrementStock(p.id, r.count);
        DB.insertStockMove({
          product_id: p.id,
          branch_id: branchId,
          qty: r.count,
          type: "IN",
          ref: tmpNum,
        });
      }

      // 3) PDF
      let pdfPath: string | null = null;
      try {
        const html = buildHtmlIN(remitoId, tmpNum, branchName || branchId, provider, rows, notes, totalImporte);
        const { uri } = await Print.printToFileAsync({ html });
        pdfPath = uri || null;
        if (pdfPath) DB.setRemitoPdfPath(remitoId, pdfPath);
      } catch (e) {
        console.log("PDF ingreso falló:", e?.toString?.());
      }

      // 4) sync
      try {
        await api.post("/sync", {
          branchId,
          products: [],
          stockMoves: rows.map((r) => ({
            productCode: r.code,
            branchId,
            delta: r.count,
            reason: "Remito ingreso",
          })),
          remitos: [
            {
              id: remitoId,
              tmp_number: tmpNum,
              official_number: null,
              branch_id: branchId,
              customer: provider?.trim() || null,
              notes: notes?.trim() || "Remito de ENTRADA",
              created_at: new Date().toISOString(),
            },
          ],
          remitoItems: rows.map((r) => ({
            remito_id: remitoId,
            productCode: r.code,
            qty: r.count,
            unit_price: r.unit_price ?? 0,
          })),
        });
      } catch (e) {
        console.log("Sync IN fallo:", e?.toString?.());
      }

      // 5) limpiar y navegar
      setRows([]);
      navigation.replace("RemitoResult", { remitoId, tmpNumber: tmpNum, pdfPath });
    } finally {
      setSaving(false);
    }
  };

  if (!branchId) {
    return (
      <View style={{ flex: 1, padding: 16, alignItems: "center", justifyContent: "center" }}>
        <Text>Primero elegí una sucursal.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Remito de entrada (ingreso)</Text>

      {/* Datos del remito */}
      <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, padding: 10 }}>
        <Text style={{ fontWeight: "600", marginBottom: 6 }}>Datos</Text>
        <Text style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>
          Sucursal: <Text style={{ fontWeight: "700", color: "#0f172a" }}>{branchName || branchId}</Text>
        </Text>

        <Text style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>Proveedor / origen</Text>
        <TextInput
          placeholder="Ej: Distribuidora S.A."
          value={provider}
          onChangeText={setProvider}
          style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: "white" }}
        />

        <Text style={{ fontSize: 12, color: "#475569", marginBottom: 4 }}>Notas</Text>
        <TextInput
          placeholder="Observaciones"
          value={notes}
          onChangeText={setNotes}
          style={{ borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10, backgroundColor: "white" }}
          multiline
        />
      </View>

      {/* Scanner */}
      {Platform.OS !== "web" ? (
        hasPerm === null ? (
          <Text>Solicitando permiso de cámara…</Text>
        ) : hasPerm ? (
          isFocused ? (
            <View style={{ borderWidth: 1, borderRadius: 12, overflow: "hidden", height: 220, position: "relative" }}>
              <CameraView
                style={{ width: "100%", height: "100%" }}
                facing="back"
                onBarcodeScanned={scanEnabled ? ({ data }) => onScan(String(data)) : undefined}
                barcodeScannerSettings={{ barcodeTypes: ["ean13","ean8","code128","code39","code93","upc_a","upc_e","codabar","itf14"] }}
              />
              <View style={{ position: "absolute", top: "50%", left: "50%", width: 200, height: 80, marginTop: -40, marginLeft: -100, borderWidth: 2, borderColor: "#22c55e", borderRadius: 4 }} />
              <View style={{ position: "absolute", bottom: 12, left: 0, right: 0, alignItems: "center" }}>
                <Text style={{ color: "white", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, fontSize: 12 }}>
                  Escaneá productos para agregar al ingreso
                </Text>
              </View>
            </View>
          ) : (
            <Text>La cámara se pausa cuando salís de esta pantalla.</Text>
          )
        ) : (
          <Text>Sin permiso de cámara.</Text>
        )
      ) : null}

      {/* Manual */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={manual}
          onChangeText={setManual}
          placeholder="Código manual"
          style={{ flex: 1, borderWidth: 1, borderColor: manual ? "#007AFF" : "#cbd5e1", borderRadius: 8, padding: 10, backgroundColor: manual ? "#f8f9ff" : "white" }}
          onSubmitEditing={() => { const c = manual.trim(); if (c) onScan(c); }}
        />
        <TouchableOpacity
          onPress={() => { const c = manual.trim(); if (c) onScan(c); }}
          style={{ paddingHorizontal: 14, paddingVertical: 10, backgroundColor: manual ? "#007AFF" : "#94a3b8", borderRadius: 8 }}
          activeOpacity={0.9}
          disabled={!manual.trim()}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Agregar</Text>
        </TouchableOpacity>
      </View>

      {/* Lista */}
      <Text style={{ fontWeight: "700", marginTop: 4 }}>Items del ingreso ({totalQty})</Text>
      <FlatList data={rows} keyExtractor={(x) => x.code} renderItem={renderRow} />

      {/* Acciones */}
      <View style={{ gap: 8, borderTopWidth: 1, borderColor: "#e5e7eb", paddingTop: 10 }}>
        <Text style={{ fontWeight: "700" }}>Total estimado: ${totalImporte.toFixed(2)}</Text>
        <TouchableOpacity
          onPress={confirmAndSave}
          style={{ paddingVertical: 14, borderRadius: 8, backgroundColor: rows.length > 0 ? "#22c55e" : "#94a3b8", alignItems: "center", opacity: saving ? 0.85 : 1 }}
          activeOpacity={0.9}
          disabled={saving || rows.length === 0}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "white", fontWeight: "800" }}>Confirmar ingreso</Text>}
        </TouchableOpacity>
      </View>

      <ProductEditModal
        visible={editVisible}
        code={pendingCode}
        initialName={editName}
        initialPrice={editPrice}
        onCancel={() => { setEditVisible(false); setPendingCode(null); setScanEnabled(true); }}
        onSave={onSaveNewProduct}
      />
    </View>
  );
}

function buildHtmlIN(
  remitoId: string,
  tmpNumber: string,
  branchLabel: string,
  provider: string,
  rows: Row[],
  notes: string,
  totalImporte: number
) {
  const tr = rows
    .map(
      (r) => `
      <tr>
        <td style="padding:6px;border:1px solid #e5e7eb;">${r.code}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;">${escapeHtml(r.name)}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">${r.count}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">$${(r.unit_price ?? 0).toFixed(2)}</td>
        <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">$${((r.unit_price ?? 0) * r.count).toFixed(2)}</td>
      </tr>`
    )
    .join("");

  return `
    <html>
      <head><meta charset="utf-8"/><title>Remito de entrada ${tmpNumber}</title></head>
      <body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:16px;">
        <h2 style="margin:0 0 6px 0;">Remito de entrada</h2>
        <div style="color:#334155;margin-bottom:12px;">
          <div><strong>N° temporal:</strong> ${tmpNumber}</div>
          <div><strong>Sucursal:</strong> ${escapeHtml(branchLabel)}</div>
          ${provider ? `<div><strong>Proveedor:</strong> ${escapeHtml(provider)}</div>` : ""}
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
          <tbody>${tr}</tbody>
        </table>
        <div style="text-align:right;font-size:14px;margin:8px 0;"><strong>Total: $${totalImporte.toFixed(2)}</strong></div>
        ${notes ? `<div style="margin-top:10px;color:#475569;"><strong>Notas:</strong> ${escapeHtml(notes)}</div>` : ""}
        <div style="margin-top:24px;font-size:11px;color:#64748b;">ID interno: ${remitoId}</div>
      </body>
    </html>
  `;
}

function escapeHtml(s: string) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}
