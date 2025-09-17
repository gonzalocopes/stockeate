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
//import { DB } from '../db';
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
    // evitar doble evento
    if (scanLock.current) return;
    scanLock.current = true;
    setTimeout(() => (scanLock.current = false), 700);

    try {
      await Haptics.selectionAsync();
    } catch {}

    let p = DB.getProductByCode(code);
    if (p) {
      addScannedToBatch(p);
      setManualCode("");
      return;
    }
    // Producto inexistente -> abrir modal para completar nombre y precio
    setPendingCode(code);
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
              }}
            >
              <CameraView
                onBarcodeScanned={({ data }) => onScan(String(data))}
                barcodeScannerSettings={{
                  barcodeTypes: ["ean13", "ean8", "code128", "code39", "qr"],
                }}
                style={{ width: "100%", height: "100%" }}
              />
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
        initialName={pendingCode ?? ""}
        initialPrice={0}
        onCancel={() => {
          setEditVisible(false);
          setPendingCode(null);
        }}
        onSave={handleSaveNewProduct}
      />
    </View>
  );
}
