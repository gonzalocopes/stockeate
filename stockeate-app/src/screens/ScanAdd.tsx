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
import { DB } from "../db.native";
import { useBatch } from "../stores/batch";
import { useBranch } from "../stores/branch";
import ProductEditModal from "../components/ProductEditModal";

export default function ScanAdd({ navigation }: any) {
  // Sucursal
  const getBranchId = () => useBranch.getState().id;

  // Lote
  const { items, addOrInc, dec, remove, totalQty } = useBatch();

  // Cámara
  const [hasPerm, setHasPerm] = useState<boolean | null>(null);
  const isFocused = useIsFocused();
  const scanLock = useRef(false); // evita dobles lecturas

  // Manual
  const [manualCode, setManualCode] = useState("");

  // Modal nuevo producto
  const [editVisible, setEditVisible] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  // Feedback visual
  const [lastScanned, setLastScanned] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        setHasPerm(true);
        return;
      }
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPerm(status === "granted");
    })();
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

  const onScan = async (code: string) => {
    const branchId = getBranchId();
    if (!branchId) {
      alert("Seleccioná una sucursal primero");
      return;
    }

    console.log("Código escaneado:", code);
    setLastScanned(code);

    // Feedback sonoro y táctil ANTES de verificar scanLock
    try {
      // Múltiples tipos de feedback para asegurar que se escuche/sienta
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await Haptics.selectionAsync(); // Sonido más confiable
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.log("Error con feedback:", error);
    }

    // Buscar producto existente en la base de datos
    let p = DB.getProductByCode(code);
    if (p) {
      // SIEMPRE agregar al lote, sin importar scanLock (para stackear productos iguales)
      addScannedToBatch(p);
      setManualCode("");

      // Aplicar scanLock DESPUÉS de agregar el producto
      if (scanLock.current) {
        console.log("⏸️ ScanLock activo, pero producto agregado");
        return;
      }
      scanLock.current = true;
      setTimeout(() => {
        scanLock.current = false;
        console.log("🔓 ScanLock liberado");
      }, 300);
      return;
    }

    // Para productos nuevos, sí verificar scanLock para evitar múltiples modales
    if (scanLock.current) {
      console.log("⏸️ onScan bloqueado por scanLock para producto nuevo");
      return;
    }
    scanLock.current = true;

    // Producto inexistente -> abrir modal para completar nombre y precio
    setPendingCode(code);
    setEditVisible(true);

    // Pausa cuando aparece el modal para evitar escaneos múltiples
    setTimeout(() => {
      scanLock.current = false;
      console.log("🔓 ScanLock liberado después del modal");
    }, 300); // 300ms de pausa
  };

  const handleSaveNewProduct = (data: { name: string; price: number }) => {
    const branchId = getBranchId();
    if (!branchId || !pendingCode) {
      setEditVisible(false);
      setPendingCode(null);
      // Liberar scanLock al cancelar
      scanLock.current = false;
      return;
    }

    const created = DB.upsertProduct({
      code: pendingCode,
      name: data.name,
      price: data.price,
      stock: 0,
      branch_id: branchId,
    });

    addScannedToBatch(created);
    setEditVisible(false);
    setPendingCode(null);
    setManualCode("");

    // Liberar scanLock después de guardar, con una pequeña pausa adicional
    setTimeout(() => {
      scanLock.current = false;
      console.log("🔓 ScanLock liberado después de guardar producto");
    }, 300);
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

      {/* Último código escaneado */}
      {lastScanned && (
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
      )}

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
                onBarcodeScanned={({ data, type }) => {
                  console.log("🔍 Detectado:", data, "Tipo:", type);

                  if (scanLock.current) {
                    console.log("⏸️ Escáner bloqueado, ignorando...");
                    return;
                  }

                  console.log("✅ Procesando código:", data);
                  onScan(String(data));
                }}
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
            El escáner de códigos no está soportado en web — usá el campo
            manual.
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

      <Text style={{ fontWeight: "600" }}>Lote actual: {totalQty()} items</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.code}
        renderItem={renderItem}
      />

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

      <ProductEditModal
        visible={editVisible}
        code={pendingCode}
        initialName={pendingCode ?? ""}
        initialPrice={0}
        onCancel={() => {
          setEditVisible(false);
          setPendingCode(null);
          // Liberar scanLock al cancelar el modal
          scanLock.current = false;
          console.log("🔓 ScanLock liberado al cancelar modal");
        }}
        onSave={handleSaveNewProduct}
      />
    </View>
  );
}
