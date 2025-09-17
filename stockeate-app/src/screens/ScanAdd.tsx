// src/screens/ScanAdd.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Button,
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
  const [scanMode, setScanMode] = useState<"barcode" | "qr">("barcode");

  // Manual
  const [manualCode, setManualCode] = useState("");

  // Modal nuevo producto
  const [editVisible, setEditVisible] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [pendingProductData, setPendingProductData] = useState<{
    name: string;
    price: number;
  } | null>(null);

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

  const parseQRData = (qrData: string) => {
    try {
      // Intentar parsear como JSON (formato estructurado)
      const parsed = JSON.parse(qrData);
      if (parsed.code || parsed.name || parsed.price) {
        return {
          code: parsed.code || parsed.barcode || qrData,
          name: parsed.name || parsed.product || "",
          price: parsed.price || 0,
        };
      }
    } catch {
      // Si no es JSON válido, tratar como código simple
    }

    // Buscar patrones comunes en QR de productos
    if (qrData.includes("|")) {
      // Formato: codigo|nombre|precio
      const parts = qrData.split("|");
      return {
        code: parts[0] || qrData,
        name: parts[1] || "",
        price: parseFloat(parts[2]) || 0,
      };
    }

    // Si no hay formato especial, usar como código simple
    return { code: qrData, name: "", price: 0 };
  };

  const onScan = async (code: string) => {
    const branchId = getBranchId();
    if (!branchId) {
      alert("Seleccioná una sucursal primero");
      return;
    }
    // evitar doble evento
    if (scanLock.current) return;
    scanLock.current = true;
    setTimeout(() => (scanLock.current = false), 1000);

    try {
      await Haptics.selectionAsync();
    } catch {}

    console.log("Código escaneado:", code);
    setLastScanned(code);

    // Si es modo QR, intentar extraer datos del producto
    if (scanMode === "qr") {
      const qrData = parseQRData(code);

      // Buscar por código en la base de datos
      let p = DB.getProductByCode(qrData.code);
      if (p) {
        addScannedToBatch(p);
        setManualCode("");
        return;
      }

      // Si no existe pero el QR tiene datos del producto, pre-llenar el modal
      if (qrData.name || qrData.price > 0) {
        setPendingCode(qrData.code);
        setPendingProductData({ name: qrData.name, price: qrData.price });
        setEditVisible(true);
        return;
      }
    }

    // Buscar producto existente en la base de datos (modo barcode o QR simple)
    let p = DB.getProductByCode(code);
    if (p) {
      addScannedToBatch(p);
      setManualCode("");
      return;
    }

    // Producto inexistente -> abrir modal para completar nombre y precio
    setPendingCode(code);
    setPendingProductData(null);
    setEditVisible(true);
  };

  const handleSaveNewProduct = (data: { name: string; price: number }) => {
    const branchId = getBranchId();
    if (!branchId || !pendingCode) {
      setEditVisible(false);
      setPendingCode(null);
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
    setPendingProductData(null);
    setManualCode("");
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
          borderRadius: 6,
        }}
      >
        <Text>-</Text>
      </TouchableOpacity>
      <Text style={{ width: 30, textAlign: "center" }}>{item.qty}</Text>
      <TouchableOpacity
        onPress={() => addOrInc(item, 1)}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderWidth: 1,
          borderRadius: 6,
        }}
      >
        <Text>+</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => remove(item.code)}
        style={{ paddingHorizontal: 12, paddingVertical: 4 }}
      >
        <Text>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, padding: 12, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>
        Escanear / Agregar
      </Text>

      {/* Selector de tipo de código */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <TouchableOpacity
          style={{
            padding: 8,
            backgroundColor: scanMode === "barcode" ? "#007AFF" : "#E5E5E5",
            borderRadius: 6,
          }}
          onPress={() => setScanMode("barcode")}
        >
          <Text style={{ color: scanMode === "barcode" ? "white" : "black" }}>
            Código de Barras
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            padding: 8,
            backgroundColor: scanMode === "qr" ? "#007AFF" : "#E5E5E5",
            borderRadius: 6,
          }}
          onPress={() => setScanMode("qr")}
        >
          <Text style={{ color: scanMode === "qr" ? "white" : "black" }}>
            QR
          </Text>
        </TouchableOpacity>
      </View>

      {/* Último código escaneado */}
      {lastScanned && (
        <View
          style={{
            backgroundColor: "#f0f0f0",
            padding: 8,
            borderRadius: 6,
            marginBottom: 8,
          }}
        >
          <Text style={{ fontSize: 12, color: "#666" }}>
            Último escaneado: {lastScanned}
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
                  if (scanLock.current) return;
                  console.log("Código escaneado:", data, "Tipo:", type);
                  onScan(String(data));
                }}
                barcodeScannerSettings={{
                  barcodeTypes:
                    scanMode === "qr"
                      ? ["qr"]
                      : [
                          "ean13",
                          "ean8",
                          "code128",
                          "code39",
                          "upc_a",
                          "upc_e",
                        ],
                }}
              />

              {/* Recuadro de enfoque */}
              <View
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: scanMode === "qr" ? 120 : 200,
                  height: scanMode === "qr" ? 120 : 80,
                  marginTop: scanMode === "qr" ? -60 : -40,
                  marginLeft: scanMode === "qr" ? -60 : -100,
                  borderWidth: 2,
                  borderColor: "#007AFF",
                  borderRadius: scanMode === "qr" ? 8 : 4,
                  backgroundColor: "transparent",
                }}
              />

              {/* Esquinas del recuadro */}
              <View
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  width: scanMode === "qr" ? 120 : 200,
                  height: scanMode === "qr" ? 120 : 80,
                  marginTop: scanMode === "qr" ? -60 : -40,
                  marginLeft: scanMode === "qr" ? -60 : -100,
                }}
              >
                {/* Esquina superior izquierda */}
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    left: -2,
                    width: 20,
                    height: 20,
                    borderTopWidth: 4,
                    borderLeftWidth: 4,
                    borderColor: "#00FF00",
                  }}
                />
                {/* Esquina superior derecha */}
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 20,
                    height: 20,
                    borderTopWidth: 4,
                    borderRightWidth: 4,
                    borderColor: "#00FF00",
                  }}
                />
                {/* Esquina inferior izquierda */}
                <View
                  style={{
                    position: "absolute",
                    bottom: -2,
                    left: -2,
                    width: 20,
                    height: 20,
                    borderBottomWidth: 4,
                    borderLeftWidth: 4,
                    borderColor: "#00FF00",
                  }}
                />
                {/* Esquina inferior derecha */}
                <View
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 20,
                    height: 20,
                    borderBottomWidth: 4,
                    borderRightWidth: 4,
                    borderColor: "#00FF00",
                  }}
                />
              </View>

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
                  {scanMode === "qr"
                    ? "Centrá el código QR en el recuadro"
                    : "Centrá el código de barras en el recuadro"}
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
          style={{ borderWidth: 1, borderRadius: 8, padding: 8, flex: 1 }}
          placeholder="Código manual"
          value={manualCode}
          onChangeText={setManualCode}
          onSubmitEditing={() => {
            const c = manualCode.trim();
            if (c) onScan(c);
          }}
        />
        <Button
          title="Agregar"
          onPress={() => {
            const c = manualCode.trim();
            if (c) onScan(c);
          }}
        />
      </View>

      <Text style={{ fontWeight: "600" }}>Lote actual: {totalQty()} items</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.code}
        renderItem={renderItem}
      />

      <Button
        title="Formar remito"
        disabled={items.length === 0}
        onPress={() => navigation.navigate("RemitoForm")}
      />

      <ProductEditModal
        visible={editVisible}
        code={pendingCode}
        initialName={pendingProductData?.name || pendingCode || ""}
        initialPrice={pendingProductData?.price || 0}
        onCancel={() => {
          setEditVisible(false);
          setPendingCode(null);
          setPendingProductData(null);
        }}
        onSave={handleSaveNewProduct}
      />
    </View>
  );
}
