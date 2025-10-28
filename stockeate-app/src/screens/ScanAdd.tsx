// src/screens/ScanAdd.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { CameraView, Camera } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";
import { DB } from "../db";
import { useBatch } from "../stores/batch";
import { useBranch } from "../stores/branch";
import ProductEditModal from "../components/ProductEditModal";
import { api } from "../api";
import { pushMovesBatchByCodes, pushMoveByCode } from "../sync/push";

import { useThemeStore } from "../stores/themeProviders";


const COOLDOWN_MS = 1000;
const SAME_CODE_BLOCK_MS = 900;

type Mode = "batch" | "catalog";

type CatalogAdded = {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  count: number;
};

export default function ScanAdd({ navigation, route }: any) {
  const { theme } = useThemeStore(); // 👈 Obtener el tema
  const initialMode: Mode = route?.params?.mode === "batch" ? "batch" : "catalog";
  const [mode] = useState<Mode>(initialMode);

  const getBranchId = () => useBranch.getState().id;

  const { items, addOrInc, dec, remove, totalQty } = useBatch();

  const [hasPerm, setHasPerm] = useState<boolean | null>(null);
  const isFocused = useIsFocused();

  const [scanEnabled, setScanEnabled] = useState(true);
  const lastDataRef = useRef<string | null>(null);
  const lastAtRef = useRef<number>(0);

  const [beep, setBeep] = useState<Audio.Sound | null>(null);
  const [manualCode, setManualCode] = useState("");

  const [editVisible, setEditVisible] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [editNameInit, setEditNameInit] = useState<string>("");
  const [editPriceInit, setEditPriceInit] = useState<number>(0);

  const [lastScanned, setLastScanned] = useState<string>("");

  const [catalogAdds, setCatalogAdds] = useState<CatalogAdded[]>([]);
  const [committing, setCommitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") setHasPerm(true);
      else {
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

  const addScannedToBatch = (p: any) => {
    addOrInc({ product_id: p.id, code: p.code, name: p.name, unit_price: p.price ?? 0 }, 1);
  };

  async function syncProductOnline(product: {
    code: string;
    name: string;
    price: number;
    stock?: number;
    branch_id: string;
  }) {
    try {
      await api.post("/sync", {
        branchId: product.branch_id,
        products: [
          {
            code: product.code,
            name: product.name,
            price: product.price ?? 0,
            stock: product.stock ?? 0,
            branch_id: product.branch_id,
          },
        ],
        stockMoves: [],
        remitos: [],
        remitoItems: [],
      });
    } catch (e: any) {
      console.log("⚠️ No se pudo sincronizar producto online:", e?.toString?.());
    }
  }

  const bumpCatalogAdded = (p: { id: string; code: string; name: string; price?: number; stock?: number }) => {
    setCatalogAdds((cur) => {
      const ix = cur.findIndex((r) => r.code === p.code);
      if (ix >= 0) {
        const copy = [...cur];
        copy[ix] = { ...copy[ix], name: p.name, price: p.price ?? 0, stock: p.stock ?? 0, count: copy[ix].count + 1 };
        return copy;
      }
      return [{ id: p.id, code: p.code, name: p.name, price: p.price ?? 0, stock: p.stock ?? 0, count: 1 }, ...cur];
    });
  };

  const setCount = (code: string, delta: number) => {
    setCatalogAdds((cur) => {
      const ix = cur.findIndex((r) => r.code === code);
      if (ix < 0) return cur;
      const copy = [...cur];
      const next = Math.max(0, copy[ix].count + delta);
      if (next === 0) copy.splice(ix, 1);
      else copy[ix] = { ...copy[ix], count: next };
      return copy;
    });
  };

  const commitCatalogAdds = async () => {
    const branchId = getBranchId();
    if (!branchId || committing || catalogAdds.length === 0) return;
    setCommitting(true);
    try {
      for (const row of catalogAdds) {
        if (row.count <= 0) continue;
        const p = DB.getProductByCode(row.code) || { id: row.id };
        DB.incrementStock(p.id, row.count);
        DB.insertStockMove({ product_id: p.id, branch_id: branchId, qty: row.count, type: "IN", ref: "Alta catálogo" });
      }

      await pushMovesBatchByCodes(
        branchId,
        catalogAdds.filter(r => r.count > 0).map(r => ({ code: r.code, qty: r.count, reason: "Alta catálogo" })),
        "IN"
      );

      setCatalogAdds([]);
    } finally {
      setCommitting(false);
    }
  };

  const onScan = async (raw: string) => {
    const code = String(raw).trim();
    if (!code || !scanEnabled) return;

    const branchId = getBranchId();
    if (!branchId) {
      alert("Seleccioná una sucursal primero");
      return;
    }

    const now = Date.now();
    if (lastDataRef.current === code && now - lastAtRef.current < SAME_CODE_BLOCK_MS) return;
    lastDataRef.current = code;
    lastAtRef.current = now;

    setScanEnabled(false);

    setLastScanned(code);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await beep?.replayAsync();
    } catch {}

    const p = DB.getProductByCode(code);

    if (mode === "batch") {
      if (p) {
        addScannedToBatch(p);
      } else {
        setPendingCode(code);
        setEditNameInit("");
        setEditPriceInit(0);
        setEditVisible(true);
        return;
      }
      setTimeout(() => setScanEnabled(true), COOLDOWN_MS);
      return;
    }

    // catálogo
    if (p) {
      bumpCatalogAdded(p);
      setLastScanned(`${code} (ya estaba en la sucursal) — sumado a tu lista`);
      await syncProductOnline({ code: p.code, name: p.name, price: p.price ?? 0, stock: p.stock ?? 0, branch_id: branchId });
      setTimeout(() => setScanEnabled(true), COOLDOWN_MS);
      return;
    } else {
      setPendingCode(code);
      setEditNameInit("");
      setEditPriceInit(0);
      setEditVisible(true);
      return;
    }
  };

  const handleSaveNewProduct = async (data: { code: string; name: string; price: number; stock?: number }) => {
    const branchId = getBranchId();
    if (!branchId || !pendingCode) {
      setEditVisible(false);
      setPendingCode(null);
      setScanEnabled(true);
      return;
    }

    const initialStock = Math.max(0, Math.floor(data.stock ?? 0));

    const created = DB.upsertProduct({
      code: data.code,
      name: data.name,
      price: data.price,
      stock: initialStock,
      branch_id: branchId,
    });

    // si hay stock inicial, lo registramos y lo pusheamos como IN
    if (initialStock > 0) {
      DB.insertStockMove({ product_id: created.id, branch_id: branchId, qty: initialStock, type: "IN", ref: "Stock inicial" });
      await pushMoveByCode(branchId, created.code, initialStock, "Stock inicial");
    }

    if (mode === "batch") {
      addScannedToBatch(created);
    } else {
      bumpCatalogAdded(created);
      setLastScanned(`${created.code} agregado a la sucursal ✅`);
      await syncProductOnline({ code: created.code, name: created.name, price: created.price ?? 0, stock: created.stock ?? 0, branch_id: branchId });
    }

    setEditVisible(false);
    setPendingCode(null);
    setManualCode("");
    setTimeout(() => setScanEnabled(true), 250);
  };

  const handleCancelModal = () => {
    setEditVisible(false);
    setPendingCode(null);
    setScanEnabled(true);
  };

  const reopenEditFromCatalog = (code: string) => {
    const p = DB.getProductByCode(code);
    setPendingCode(code);
    setEditNameInit(p?.name ?? code);
    setEditPriceInit(p?.price ?? 0);
    setEditVisible(true);
  };

  const renderBatchRow = ({ item }: any) => (
    <View style={{ 
      flexDirection: "row", 
      alignItems: "center", 
      gap: 8, 
      paddingVertical: 6, 
      borderBottomWidth: 1, 
      borderColor: theme.colors.border // 👈 Color del borde
    }}>
      <Text style={{ flex: 1, color: theme.colors.text }}>{item.code} — {item.name}</Text>
      
      {/* Botón '-' */}
      <TouchableOpacity onPress={() => dec(item.code)} style={{ 
        paddingHorizontal: 12, 
        paddingVertical: 4, 
        borderWidth: 1, 
        borderColor: theme.colors.primary, // 👈 Borde primario
        backgroundColor: theme.colors.card, // 👈 Fondo para contraste
        borderRadius: 6 
      }} activeOpacity={0.7}>
        <Text style={{ color: theme.colors.primary, fontWeight: "600" }}>-</Text>
      </TouchableOpacity>
      
      <Text style={{ width: 30, textAlign: "center", fontWeight: "600", color: theme.colors.text }}>{item.qty}</Text>
      
      {/* Botón '+' */}
      <TouchableOpacity onPress={() => addOrInc(item, 1)} style={{ 
        paddingHorizontal: 12, 
        paddingVertical: 4, 
        borderWidth: 1, 
        borderColor: theme.colors.primary, // 👈 Borde primario
        backgroundColor: theme.colors.primary, // 👈 Fondo primario
        borderRadius: 6 
      }} activeOpacity={0.8}>
        <Text style={{ color: "white", fontWeight: "600" }}>+</Text>
      </TouchableOpacity>
      
      {/* Botón '🗑️' */}
      <TouchableOpacity onPress={() => remove(item.code)} style={{ 
        paddingHorizontal: 12, 
        paddingVertical: 4, 
        backgroundColor: theme.colors.danger, // 👈 Fondo danger
        borderRadius: 6 
      }} activeOpacity={0.8}>
        <Text style={{ fontSize: 12 }}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCatalogAdded = ({ item }: { item: CatalogAdded }) => (
    <View style={{ 
      flexDirection: "row", 
      alignItems: "center", 
      gap: 8, 
      paddingVertical: 8, 
      borderBottomWidth: 1, 
      borderColor: theme.colors.border // 👈 Color del borde
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "600", color: theme.colors.text }}>{item.name}</Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{item.code}</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Precio: ${item.price} — Stock: {item.stock}</Text>
      </View>
      
      {/* Botón '-' */}
      <TouchableOpacity onPress={() => setCount(item.code, -1)} style={{ 
        paddingHorizontal: 12, 
        paddingVertical: 6, 
        borderWidth: 1, 
        borderColor: theme.colors.primary, // 👈 Borde primario
        backgroundColor: theme.colors.card, // 👈 Fondo para contraste
        borderRadius: 8 
      }} activeOpacity={0.8}>
        <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>-</Text>
      </TouchableOpacity>
      
      <Text style={{ width: 26, textAlign: "center", fontWeight: "700", color: theme.colors.text }}>{item.count}</Text>
      
      {/* Botón '+' */}
      <TouchableOpacity onPress={() => setCount(item.code, +1)} style={{ 
        paddingHorizontal: 12, 
        paddingVertical: 6, 
        backgroundColor: theme.colors.primary, // 👈 Fondo primario
        borderRadius: 8 
      }} activeOpacity={0.8}>
        <Text style={{ color: "white", fontWeight: "700" }}>+</Text>
      </TouchableOpacity>
      
      {/* Botón 'Editar' */}
      <TouchableOpacity onPress={() => reopenEditFromCatalog(item.code)} style={{ 
        paddingHorizontal: 12, 
        paddingVertical: 6, 
        borderRadius: 8, 
        backgroundColor: theme.colors.primary, // 👈 Usamos primary (azul)
        marginLeft: 6 
      }} activeOpacity={0.8}>
        <Text style={{ color: "white", fontWeight: "700" }}>Editar</Text>
      </TouchableOpacity>
    </View>
  );

  const totalAdds = catalogAdds.reduce((a, r) => a + r.count, 0);

  return (
    <View style={{ flex: 1, padding: 12, gap: 12, backgroundColor: theme.colors.background }}> {/* 👈 Fondo de la pantalla */}
      <Text style={{ fontSize: 18, fontWeight: "600", color: theme.colors.text }}>Escanear Código de Barras</Text>

      {lastScanned ? (
        <View style={{ 
          backgroundColor: theme.colors.card, // 👈 Fondo de la notificación
          padding: 8, 
          borderRadius: 6, 
          marginBottom: 8, 
          borderWidth: 1, 
          borderColor: theme.colors.border // 👈 Borde de la notificación
        }}>
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>✅ Último escaneado: {lastScanned}</Text>
        </View>
      ) : null}

      {Platform.OS !== "web" ? (
        hasPerm === null ? (
          <Text style={{ color: theme.colors.text }}>Solicitando permiso de cámara…</Text>
        ) : hasPerm ? (
          isFocused ? (
            <View style={{ 
              borderWidth: 1, 
              borderColor: theme.colors.border, // 👈 Borde del contenedor de la cámara
              borderRadius: 12, 
              overflow: "hidden", 
              height: 200, 
              position: "relative" 
            }}>
              <CameraView
                style={{ width: "100%", height: "100%" }}
                facing="back"
                onBarcodeScanned={scanEnabled ? ({ data }) => onScan(String(data)) : undefined}
                barcodeScannerSettings={{ barcodeTypes: ["ean13","ean8","code128","code39","code93","upc_a","upc_e","codabar","itf14"] }}
              />
              <View style={{ 
                position: "absolute", 
                top: "50%", 
                left: "50%", 
                width: 200, 
                height: 80, 
                marginTop: -40, 
                marginLeft: -100, 
                borderWidth: 2, 
                borderColor: theme.colors.primary, // 👈 Borde del recuadro de escaneo
                borderRadius: 4, 
                backgroundColor: "transparent" 
              }} />
              <View style={{ position: "absolute", bottom: 20, left: 0, right: 0, alignItems: "center" }}>
                <Text style={{ color: "white", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, fontSize: 12 }}>
                  Centrá el código de barras en el recuadro
                </Text>
              </View>
            </View>
          ) : (
            <Text style={{ color: theme.colors.text }}>La cámara se pausa cuando salís de esta pantalla.</Text>
          )
        ) : (
          <Text style={{ color: theme.colors.text }}>Sin permiso de cámara. Habilitalo en Ajustes o usá entrada manual.</Text>
        )
      ) : (
        <View style={{ 
          borderWidth: 1, 
          borderRadius: 12, 
          height: 200, 
          alignItems: "center", 
          justifyContent: "center", 
          borderColor: theme.colors.border 
        }}>
          <Text style={{ color: theme.colors.text }}>El escáner de códigos no está soportado en web — usá el campo manual.</Text>
        </View>
      )}

      {/* Entrada manual */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          style={{ 
            borderWidth: 1, 
            borderColor: manualCode ? theme.colors.primary : theme.colors.inputBorder, // 👈 Color del borde y foco
            borderRadius: 8, 
            padding: 8, 
            flex: 1, 
            backgroundColor: theme.colors.inputBackground, // 👈 Fondo del input
            color: theme.colors.text // 👈 Color del texto del input
          }}
          placeholder="Código manual"
          placeholderTextColor={theme.colors.textMuted} // 👈 Placeholder color
          value={manualCode}
          onChangeText={setManualCode}
          onSubmitEditing={() => { const c = manualCode.trim(); if (c) onScan(c); }}
        />
        <TouchableOpacity
          style={{ 
            backgroundColor: manualCode.trim() ? theme.colors.primary : theme.colors.neutral, // 👈 Fondo del botón
            paddingHorizontal: 16, 
            paddingVertical: 8, 
            borderRadius: 8 
          }}
          onPress={() => { const c = manualCode.trim(); if (c) onScan(c); }}
          activeOpacity={0.8}
          disabled={!manualCode.trim()}
        >
          <Text style={{ color: "white", fontWeight: "600", opacity: manualCode.trim() ? 1 : 0.7 }}>Agregar</Text>
        </TouchableOpacity>
      </View>

      {mode === "batch" ? (
        <>
          <Text style={{ fontWeight: "600", color: theme.colors.text }}>Lote actual: {totalQty()} items</Text>
          <FlatList data={items} keyExtractor={(i) => i.code} renderItem={renderBatchRow} showsVerticalScrollIndicator={false} />
          
          {/* Botón Volver al remito */}
          <TouchableOpacity
            style={{ 
              backgroundColor: items.length > 0 ? theme.colors.primary : theme.colors.neutral, // 👈 Fondo primario/neutral
              paddingVertical: 12, 
              borderRadius: 8, 
              alignItems: "center", 
              marginTop: 8 
            }}
            onPress={() => navigation.navigate("RemitoForm")}
            activeOpacity={0.8}
            disabled={items.length === 0}
          >
            <Text style={{ color: "white", fontWeight: "600", fontSize: 16, opacity: items.length > 0 ? 1 : 0.7 }}>
              Volver al remito ({totalQty()} items)
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={{ 
          padding: 10, 
          borderWidth: 1, 
          borderColor: theme.colors.border, // 👈 Borde del panel
          borderRadius: 10, 
          backgroundColor: theme.colors.card, // 👈 Fondo del panel
          gap: 10 
        }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            
            {/* Botón Ver productos */}
            <TouchableOpacity onPress={() => navigation.navigate("BranchProducts")} style={{ 
              flex: 1, 
              paddingVertical: 10, 
              borderRadius: 8, 
              backgroundColor: theme.colors.primary, // 👈 Fondo primario
              alignItems: "center" 
            }} activeOpacity={0.9}>
              <Text style={{ color: "white", fontWeight: "700" }}>Ver productos de la sucursal</Text>
            </TouchableOpacity>
            
            {/* Botón Limpiar */}
            <TouchableOpacity onPress={() => setCatalogAdds([])} style={{ 
              paddingVertical: 10, 
              paddingHorizontal: 14, 
              borderRadius: 8, 
              backgroundColor: theme.colors.inputBorder // 👈 Fondo neutral/input
            }} activeOpacity={0.9}>
              <Text style={{ color: theme.colors.text, fontWeight: "700" }}>Limpiar</Text>
            </TouchableOpacity>
          </View>

          {catalogAdds.length > 0 ? (
            <>
              <Text style={{ fontWeight: "700", marginTop: 4, marginBottom: 6, color: theme.colors.text }}>
                Agregados en esta sesión ({totalAdds} items)
              </Text>
              <FlatList data={catalogAdds} keyExtractor={(x) => x.id} renderItem={renderCatalogAdded} showsVerticalScrollIndicator={false} />
              
              {/* Botón Guardar y ver */}
              <TouchableOpacity
                onPress={commitCatalogAdds}
                style={{ 
                  marginTop: 8, 
                  paddingVertical: 12, 
                  borderRadius: 8, 
                  backgroundColor: theme.colors.primary, // 👈 Fondo primario
                  alignItems: "center", 
                  opacity: committing ? 0.85 : 1 
                }}
                activeOpacity={0.9}
                disabled={committing || catalogAdds.length === 0}
              >
                {committing ? <ActivityIndicator color="#fff" /> : (
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                    Guardar y ver en la sucursal ({totalAdds})
                  </Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              Escaneá o ingresá un código para crear productos nuevos. Se listarán aquí.
            </Text>
          )}
        </View>
      )}

      <ProductEditModal
        visible={editVisible}
        code={pendingCode}
        initialName={editNameInit}
        initialPrice={editPriceInit}
        initialStock={0}
        onCancel={handleCancelModal}
        onSave={handleSaveNewProduct}
      />
    </View>
  );
}
