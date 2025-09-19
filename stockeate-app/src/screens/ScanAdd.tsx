// src/screens/ScanAdd.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { CameraView, Camera } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { DB } from "../db.native";
import { useBatch } from "../stores/batch";
import { useBranch } from "../stores/branch";
import ProductEditModal from "../components/ProductEditModal";
import { api } from "../api";

// Config de escaneo
const COOLDOWN_MS = 1000;        // bloquea ~1s después de leer
const SAME_CODE_BLOCK_MS = 900;  // evita mismo código por 0.9s

type Mode = "batch" | "catalog"; // batch = crear remito (lote) | catalog = agregar a sucursal

export default function ScanAdd({ navigation, route }: any) {
  // Sucursal
  const getBranchId = () => useBranch.getState().id;

  // Lote
  const { items, addOrInc, dec, remove, totalQty } = useBatch();

  // Cámara
  const [hasPerm, setHasPerm] = useState<boolean | null>(null);
  const isFocused = useIsFocused();

  // Habilitador del handler (estado para forzar re-render del CameraView)
  const [scanEnabled, setScanEnabled] = useState(true);

  // Anti-repetidos
  const lastDataRef = useRef<string | null>(null);
  const lastAtRef = useRef<number>(0);

  // Sonido
  const [beep, setBeep] = useState<Audio.Sound | null>(null);

  // Manual
  const [manualCode, setManualCode] = useState("");

  // Modal nuevo producto
  const [editVisible, setEditVisible] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  // Feedback visual
  const [lastScanned, setLastScanned] = useState<string>("");

  // Modo (toggle)
  const initialMode: Mode = route?.params?.mode === "catalog" ? "catalog" : "batch";
  const [mode, setMode] = useState<Mode>(initialMode);

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

  // Cargar beep
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/beep.mp3"),
          { volume: 0.9 }
        );
        if (mounted) setBeep(sound);
      } catch (e) {
        console.warn("No se pudo cargar assets/beep.mp3", e);
      }
    })();
    return () => {
      mounted = false;
      beep?.unloadAsync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addScannedToBatch = (p: any) => {
    addOrInc(
      {
        product_id: p.id,
        code: p.code,
        name: p.name,
        unit_price: p.price ?? 0,
      },
      1
    );
  };

  async function syncProductOnline(product: any, branchId: string | null) {
    try {
      await api.post("/sync", {
        branchId: branchId ?? null,
        products: [product],
        stockMoves: [],
        remitos: [],
        remitoItems: [],
      });
    } catch (e) {
      // Si falla, lo dejamos solo local y evitamos romper flujo
      console.log("⚠️ No se pudo sincronizar producto online:", e?.toString?.());
    }
  }

  const onScan = async (raw: string) => {
    const code = String(raw).trim();
    if (!code || !scanEnabled) return;

    const branchId = getBranchId();
    if (!branchId) {
      alert("Seleccioná una sucursal primero");
      return;
    }

    // Evitar “pegado” sobre el mismo código por un rato corto
    const now = Date.now();
    if (lastDataRef.current === code && now - lastAtRef.current < SAME_CODE_BLOCK_MS) {
      return;
    }
    lastDataRef.current = code;
    lastAtRef.current = now;

    // Bloqueamos el handler hasta que pase el cooldown
    setScanEnabled(false);

    console.log("Código escaneado:", code);
    setLastScanned(code);

    // Feedback: vibración + beep del dispositivo
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await beep?.replayAsync();
    } catch {}

    // Buscar producto local
    const p = DB.getProductByCode(code);

    if (mode === "batch") {
      // ---- MODO CREAR REMITO ----
      if (p) {
        addScannedToBatch(p);
        setManualCode("");
      } else {
        // Producto inexistente -> abrir modal para completar datos
        setPendingCode(code);
        setEditVisible(true);
        // el scanEnabled se re-activa al cerrar/guardar el modal
        return;
      }
      // Rehabilitar escaneo luego de ~1s
      setTimeout(() => setScanEnabled(true), COOLDOWN_MS);
      return;
    }

    // ---- MODO AGREGAR A SUCURSAL ----
    if (p) {
      // Ya existe en la sucursal → nada que editar; opcionalmente podríamos abrir edición rápida
      // Enviamos upsert online por si hay cambios futuros (no hace daño)
      await syncProductOnline(
        { code: p.code, name: p.name, price: p.price ?? 0, branch_id: branchId },
        branchId
      );
      // Mensajito en el banner superior
      setLastScanned(`${code} (ya estaba en la sucursal)`);
      setTimeout(() => setScanEnabled(true), COOLDOWN_MS);
      return;
    } else {
      // No existe → crear con modal (nombre, precio, stock inicial)
      setPendingCode(code);
      setEditVisible(true);
      // Rehabilitamos al cerrar/guardar
      return;
    }
  };

  const handleSaveNewProduct = async (data: { name: string; price: number; stock?: number }) => {
    const branchId = getBranchId();
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
      stock: data.stock ?? 0,
      branch_id: branchId,
    });

    if (mode === "batch") {
      addScannedToBatch(created);
    }

    // Intento de sync online (upsert por code)
    await syncProductOnline(
      { code: created.code, name: created.name, price: created.price ?? 0, branch_id: branchId },
      branchId
    );

    setEditVisible(false);
    setPendingCode(null);
    setManualCode("");

    // Pequeño delay por UX y re-habilitamos escaneo
    setTimeout(() => setScanEnabled(true), 250);
  };

  const handleCancelModal = () => {
    setEditVisible(false);
    setPendingCode(null);
    setScanEnabled(true);
  };

  const renderItem = ({ item }: any) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderColor: "#eee",
      }}
    >
      <Text style={{ flex: 1 }}>
        {item.code} — {item.name}
      </Text>
      <TouchableOpacity
        onPress={() => dec(item.code)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderWidth: 1,
          borderColor: "#007AFF",
          backgroundColor: "#f8f9fa",
          borderRadius: 6,
        }}
        activeOpacity={0.7}
      >
        <Text style={{ color: "#007AFF", fontWeight: "600" }}>-</Text>
      </TouchableOpacity>
      <Text style={{ width: 30, textAlign: "center", fontWeight: "600" }}>
        {item.qty}
      </Text>
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
        <Text style={{ color: "white", fontWeight: "600" }}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => remove(item.code)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          backgroundColor: "#dc3545",
          borderRadius: 6,
        }}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: 12 }}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 12, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>
        Escanear Código de Barras
      </Text>

      {/* Toggle de modo */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity
          onPress={() => setMode("batch")}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: mode === "batch" ? "#007AFF" : "#cbd5e1",
            backgroundColor: mode === "batch" ? "#e6f0ff" : "white",
            alignItems: "center",
          }}
          activeOpacity={0.9}
        >
          <Text style={{ fontWeight: "700", color: "#0f172a" }}>Crear remito</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setMode("catalog")}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: mode === "catalog" ? "#007AFF" : "#cbd5e1",
            backgroundColor: mode === "catalog" ? "#e6f0ff" : "white",
            alignItems: "center",
          }}
          activeOpacity={0.9}
        >
          <Text style={{ fontWeight: "700", color: "#0f172a" }}>Agregar a sucursal</Text>
        </TouchableOpacity>
      </View>

      {/* Último código escaneado */}
      {lastScanned ? (
        <View
          style={{
            backgroundColor: "#e3f2fd",
            padding: 8,
            borderRadius: 6,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: "#90caf9",
          }}
        >
          <Text style={{ fontSize: 12, color: "#1565c0" }}>
            ✅ Último escaneado: {lastScanned}
          </Text>
        </View>
      ) : null}

      {/* Cámara (solo nativo) */}
      {Platform.OS !== "web" ? (
        hasPerm === null ? (
          <Text>Solicitando permiso de cámara…</Text>
        ) : hasPerm ? (
          isFocused ? (
            <View
              style={{
                borderWidth: 1,
                borderRadius: 12,
                overflow: "hidden",
                height: 260,
                position: "relative",
              }}
            >
              <CameraView
                style={{ width: "100%", height: "100%" }}
                facing="back"
                onBarcodeScanned={
                  scanEnabled
                    ? ({ data }) => {
                        console.log("🔍 Detectado:", data);
                        onScan(String(data));
                      }
                    : undefined
                }
                barcodeScannerSettings={{
                  barcodeTypes: [
                    "ean13",
                    "ean8",
                    "code128",
                    "code39",
                    "code93",
                    "upc_a",
                    "upc_e",
                    "codabar",
                    "itf14",
                  ],
                }}
              />

              {/* Recuadro de enfoque */}
              <View
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: 200,
                  height: 80,
                  marginTop: -40,
                  marginLeft: -100,
                  borderWidth: 2,
                  borderColor: "#007AFF",
                  borderRadius: 4,
                  backgroundColor: "transparent",
                }}
              />

              {/* Texto de instrucción */}
              <View
                style={{
                  position: "absolute",
                  bottom: 20,
                  left: 0,
                  right: 0,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "white",
                    backgroundColor: "rgba(0,0,0,0.6)",
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    fontSize: 12,
                  }}
                >
                  Centrá el código de barras en el recuadro
                </Text>
              </View>
            </View>
          ) : (
            <Text>La cámara se pausa cuando salís de esta pantalla.</Text>
          )
        ) : (
          <Text>
            Sin permiso de cámara. Habilitalo en Ajustes o usá entrada manual.
          </Text>
        )
      ) : (
        <View
          style={{
            borderWidth: 1,
            borderRadius: 12,
            height: 200,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text>
            El escáner de códigos no está soportado en web — usá el campo manual.
          </Text>
        </View>
      )}

      {/* Entrada manual */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          style={{
            borderWidth: 1,
            borderColor: manualCode ? "#007AFF" : "#ddd",
            borderRadius: 8,
            padding: 8,
            flex: 1,
            backgroundColor: manualCode ? "#f8f9ff" : "white",
          }}
          placeholder="Código manual"
          value={manualCode}
          onChangeText={setManualCode}
          onSubmitEditing={() => {
            const c = manualCode.trim();
            if (c) onScan(c);
          }}
        />
        <TouchableOpacity
          style={{
            backgroundColor: manualCode.trim() ? "#007AFF" : "#6c757d",
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 8,
          }}
          onPress={() => {
            const c = manualCode.trim();
            if (c) onScan(c);
          }}
          activeOpacity={0.8}
          disabled={!manualCode.trim()}
        >
          <Text
            style={{
              color: "white",
              fontWeight: "600",
              opacity: manualCode.trim() ? 1 : 0.7,
            }}
          >
            Agregar
          </Text>
        </TouchableOpacity>
      </View>

      {/* Sección lote solo en modo "Crear remito" */}
      {mode === "batch" ? (
        <>
          <Text style={{ fontWeight: "600" }}>Lote actual: {totalQty()} items</Text>
          <FlatList data={items} keyExtractor={(i) => i.code} renderItem={renderItem} />

          <TouchableOpacity
            style={{
              backgroundColor: items.length > 0 ? "#007AFF" : "#6c757d",
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
              marginTop: 8,
            }}
            onPress={() => navigation.navigate("RemitoForm")}
            activeOpacity={0.8}
            disabled={items.length === 0}
          >
            <Text
              style={{
                color: "white",
                fontWeight: "600",
                fontSize: 16,
                opacity: items.length > 0 ? 1 : 0.7,
              }}
            >
              Formar remito ({totalQty()} items)
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <View
          style={{
            padding: 10,
            borderWidth: 1,
            borderColor: "#cbd5e1",
            borderRadius: 10,
            backgroundColor: "#f8fafc",
          }}
        >
          <Text style={{ color: "#0f172a" }}>
            Modo <Text style={{ fontWeight: "700" }}>Agregar a sucursal</Text>: los códigos escaneados se
            guardan en el catálogo de la sucursal. Los productos nuevos te pedirán Nombre, Precio y Stock inicial.
          </Text>
        </View>
      )}

      <ProductEditModal
        visible={editVisible}
        code={pendingCode}
        initialName={pendingCode ?? ""}
        initialPrice={0}
        onCancel={handleCancelModal}
        onSave={handleSaveNewProduct}
      />
    </View>
  );
}
