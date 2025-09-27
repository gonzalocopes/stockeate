// src/screens/BranchProducts.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Modal,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useBranch } from "../stores/branch";
import ProductEditModal from "../components/ProductEditModal";
import { DB } from "../db.native";
import { api } from "../api";
import { pullBranchCatalog } from "../sync/index";
import { pushMoveByCode, pushDeleteProduct } from "../sync/push";

type Prod = {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  branch_id: string;
};

export default function BranchProducts({ navigation }: any) {
  const branchId = useBranch((s) => s.id);
  const isFocused = useIsFocused();

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(false);

  // overlay optimista de stock para evitar flicker en "Refrescar"
  const [pendingStock, setPendingStock] = useState<Record<string, number>>({});

  // modal editar
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Prod | null>(null);

  // modal ajustar
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<Prod | null>(null);
  const [targetStr, setTargetStr] = useState<string>("0");

  const loadLocal = () => {
    if (!branchId) return;
    const data = DB.listProductsByBranch(branchId, search, 500, 0);
    setRows(data);
  };

  const pullThenLoad = async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      // mientras está cargando, mantenemos pendingStock para evitar ver el valor viejo
      await pullBranchCatalog(branchId);
    } catch (e: any) {
      console.log("SYNC_ERR", e?.message || e);
    } finally {
      loadLocal();
      // ya sincronizado: limpiamos overlay para volver a leer del DB
      setPendingStock({});
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) pullThenLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  useEffect(() => {
    const id = setTimeout(loadLocal, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, branchId]);

  async function syncProductOnline(product: { code: string; name: string; price: number; stock?: number; branch_id: string }) {
    try {
      await api.post("/sync", {
        branchId: product.branch_id,
        products: [product],
        stockMoves: [],
        remitos: [],
        remitoItems: [],
      });
    } catch (e) {
      console.log("⚠️ Sync producto falló (local ok):", e?.toString?.());
    }
  }

  const openEdit = (p: Prod) => {
    setEditing(p);
    setEditOpen(true);
  };

  // === EDITAR ===
  const onSaveEdit = async (data: { name: string; price: number; stock?: number }) => {
    if (!editing || !branchId) return;

    // nombre y precio (DB)
    const updatedBase = DB.updateProductNamePrice(editing.id, data.name, data.price);
    setRows((cur) => cur.map((r) => (r.id === editing.id ? { ...updatedBase, stock: r.stock } : r)));

    setEditOpen(false);
    setEditing(null);

    // sync nombre+precio
    await syncProductOnline({
      code: updatedBase.code,
      name: updatedBase.name,
      price: updatedBase.price ?? 0,
      branch_id: updatedBase.branch_id,
    });

    // si viene stock, mostramos optimista y mandamos delta
    if (typeof data.stock === "number") {
      const before = Number(updatedBase.stock ?? 0);
      const target = Math.max(0, Math.floor(data.stock));
      const delta = target - before;

      // overlay optimista (no toca DB): evita parpadeo en "Refrescar"
      setPendingStock((m) => ({ ...m, [updatedBase.id]: target }));
      setRows((cur) => cur.map((r) => (r.id === updatedBase.id ? { ...r, stock: target } : r)));

      if (delta !== 0) {
        try {
          await pushMoveByCode(branchId, updatedBase.code, delta, "Editar producto");
        } catch (e) {
          console.log("pushMoveByCode fail", e);
        }
      }

      // confirmamos con el servidor y actualizamos lista
      await pullBranchCatalog(branchId);
      loadLocal();
      // y limpiamos el overlay de ese producto (ya quedó persistido)
      setPendingStock((m) => {
        const { [updatedBase.id]: _, ...rest } = m;
        return rest;
      });
    }
  };

  // ===== Ajustar =====
  const openAdjust = (p: Prod) => {
    setAdjusting(p);
    setTargetStr(String(p.stock ?? 0));
    setAdjOpen(true);
  };

  const applyQuickDelta = async (delta: number) => {
    if (!adjusting || !branchId) return;
    const updated = DB.adjustStock(adjusting.id, branchId, delta, delta > 0 ? "Ajuste +1" : "Ajuste -1");
    setRows((cur) => cur.map((r) => (r.id === adjusting.id ? updated : r)));
    await pushMoveByCode(branchId, adjusting.code, delta, delta > 0 ? "+1" : "-1");
  };

  const applySetExact = async () => {
    if (!adjusting || !branchId) return;
    let t = Number(targetStr.replace(",", "."));
    if (isNaN(t)) return Alert.alert("Fijar stock", "Ingresá un número válido.");
    if (t < 0) t = 0;
    const before = adjusting.stock ?? 0;
    const target = Math.floor(t);
    const updated = DB.setStockExact(adjusting.id, branchId, target, "Fijar stock");
    setRows((cur) => cur.map((r) => (r.id === adjusting.id ? updated : r)));
    const delta = target - before;
    if (delta !== 0) await pushMoveByCode(branchId, adjusting.code, delta, "Fijar stock");
  };

  // ===== Eliminar =====
  const archiveCurrent = () => {
    if (!adjusting) return;
    Alert.alert(
      "Archivar producto",
      `¿Archivar “${adjusting.name}” (${adjusting.code})?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Archivar",
          style: "destructive",
          onPress: () => {
            DB.archiveProduct(adjusting.id);
            setRows((cur) => cur.filter((r) => r.id !== adjusting.id));
            setAdjOpen(false);
            setAdjusting(null);
          },
        },
      ]
    );
  };

  const confirmDelete = (p: Prod) => {
    Alert.alert(
      "Eliminar producto",
      `¿Eliminar “${p.name}” (${p.code}) de esta sucursal?\nEsta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            DB.deleteProduct(p.id);
            setRows((cur) => cur.filter((r) => r.id !== p.id));
            if (branchId) {
              try { await pushDeleteProduct(branchId, p.code); } catch {}
            }
          },
        },
      ]
    );
  };

  if (!branchId) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: "center", alignItems: "center" }}>
        <Text>Primero seleccioná una sucursal.</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Prod }) => {
    // usar overlay si existe
    const displayStock = pendingStock[item.id] ?? item.stock;
    return (
      <View style={{ borderBottomWidth: 1, borderColor: "#eee", paddingVertical: 8, gap: 6 }}>
        <Text style={{ fontWeight: "600" }}>{item.name}</Text>
        <Text style={{ color: "#475569", fontSize: 12 }}>{item.code}</Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 12, color: "#334155" }}>
            Precio: ${item.price ?? 0} — Stock: {displayStock ?? 0}
          </Text>

          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <TouchableOpacity
              onPress={() => openAdjust(item)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#1e293b" }}
              activeOpacity={0.8}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>Ajustar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openEdit(item)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#007AFF" }}
              activeOpacity={0.8}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => confirmDelete(item)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#b91c1c" }}
              activeOpacity={0.8}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Productos de la sucursal</Text>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o código"
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: search ? "#007AFF" : "#cbd5e1",
            borderRadius: 8,
            padding: 10,
            backgroundColor: search ? "#f8f9ff" : "white",
          }}
        />

        <TouchableOpacity
          onPress={pullThenLoad}
          style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: "#007AFF" }}
          activeOpacity={0.9}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "white", fontWeight: "700" }}>Refrescar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate("BranchArchived")}
          style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: "#0ea5e9" }}
          activeOpacity={0.9}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Archivados</Text>
        </TouchableOpacity>
      </View>

      <Text style={{ color: "#64748b", fontSize: 12 }}>
        {rows.length} producto{rows.length === 1 ? "" : "s"} en esta sucursal
      </Text>

      <FlatList
        data={rows}
        keyExtractor={(x) => x.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
      />

      {/* Modal editar */}
      <ProductEditModal
        visible={editOpen}
        code={editing?.code ?? null}
        initialName={editing?.name ?? ""}
        initialPrice={editing?.price ?? 0}
        initialStock={editing?.stock ?? 0}
        onCancel={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        onSave={onSaveEdit}
      />

      {/* Modal AJUSTAR */}
      <Modal visible={adjOpen} transparent animationType="slide" onRequestClose={() => setAdjOpen(false)}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}>
              <View style={{ backgroundColor: "white", padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                <View style={{ alignItems: "center", marginBottom: 8 }}>
                  <View style={{ width: 40, height: 4, backgroundColor: "#e2e8f0", borderRadius: 2 }} />
                </View>

                <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 12 }}>
                  Ajustar stock — {adjusting?.name} ({adjusting?.code})
                </Text>

                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => applyQuickDelta(-1)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "#ef4444", alignItems: "center" }}
                    activeOpacity={0.9}
                  >
                    <Text style={{ color: "white", fontWeight: "700" }}>-1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => applyQuickDelta(+1)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "#22c55e", alignItems: "center" }}
                    activeOpacity={0.9}
                  >
                    <Text style={{ color: "white", fontWeight: "700" }}>+1</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 6 }}>Fijar stock</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={targetStr}
                      onChangeText={setTargetStr}
                      placeholder="Ej: 0, 15"
                      keyboardType="number-pad"
                      style={{ flex: 1, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, padding: 10, backgroundColor: "#fff" }}
                      returnKeyType="done"
                      onSubmitEditing={applySetExact}
                    />
                    <TouchableOpacity
                      onPress={applySetExact}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: "#007AFF" }}
                      activeOpacity={0.9}
                    >
                      <Text style={{ color: "white", fontWeight: "700" }}>Fijar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={archiveCurrent}
                  style={{ paddingVertical: 12, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", marginBottom: 8 }}
                  activeOpacity={0.9}
                >
                  <Text style={{ color: "#0f172a", fontWeight: "700" }}>Archivar producto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setAdjOpen(false); setAdjusting(null); }}
                  style={{ paddingVertical: 12, borderRadius: 10, backgroundColor: "#e5e7eb", alignItems: "center" }}
                  activeOpacity={0.9}
                >
                  <Text style={{ color: "#111827", fontWeight: "700" }}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
