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
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useBranch } from "../stores/branch";
import ProductEditModal from "../components/ProductEditModal";
import { DB } from "../db.native";
import { api } from "../api";

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

  // modal editar
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Prod | null>(null);

  // modal ajustar
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjusting, setAdjusting] = useState<Prod | null>(null);
  const [targetStr, setTargetStr] = useState<string>("0"); // fijar stock exacto

  const load = () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const data = DB.listProductsByBranch(branchId, search, 500, 0);
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isFocused) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  useEffect(() => {
    const id = setTimeout(load, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, branchId]);

  async function syncProductOnline(product: { code: string; name: string; price: number; branch_id: string }) {
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

  async function syncMoveOnline(move: { productCode: string; branchId: string; delta: number; reason?: string }) {
    try {
      await api.post("/sync", {
        branchId: move.branchId,
        products: [],
        stockMoves: [{ productCode: move.productCode, branchId: move.branchId, delta: move.delta, reason: move.reason ?? "Ajuste" }],
        remitos: [],
        remitoItems: [],
      });
    } catch (e) {
      console.log("⚠️ Sync movimiento falló (local ok):", e?.toString?.());
    }
  }

  const openEdit = (p: Prod) => {
    setEditing(p);
    setEditOpen(true);
  };

  const onSaveEdit = async (data: { name: string; price: number }) => {
    if (!editing) return;
    const updated = DB.updateProductNamePrice(editing.id, data.name, data.price);
    setRows((cur) => cur.map((r) => (r.id === editing.id ? updated : r)));
    setEditOpen(false);
    setEditing(null);
    await syncProductOnline({ code: updated.code, name: updated.name, price: updated.price ?? 0, branch_id: updated.branch_id });
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
    await syncMoveOnline({ productCode: adjusting.code, branchId, delta, reason: delta > 0 ? "+1" : "-1" });
  };

  const applySetExact = async () => {
    if (!adjusting || !branchId) return;
    let t = Number(targetStr.replace(",", "."));
    if (isNaN(t)) return Alert.alert("Fijar stock", "Ingresá un número válido.");
    if (t < 0) t = 0; // estado final no negativo
    const before = adjusting.stock ?? 0;
    const updated = DB.setStockExact(adjusting.id, branchId, Math.floor(t), "Fijar stock");
    setRows((cur) => cur.map((r) => (r.id === adjusting.id ? updated : r)));
    const delta = Math.floor(t) - before;
    await syncMoveOnline({ productCode: adjusting.code, branchId, delta, reason: "Fijar stock" });
  };

  // ===== Archivar / Eliminar =====
  const archiveCurrent = () => {
    if (!adjusting) return;
    Alert.alert(
      "Archivar producto",
      `¿Archivar “${adjusting.name}” (${adjusting.code})? No aparecerá más en listados.`,
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
    if (!DB.canDeleteProduct(p.id)) {
      return Alert.alert(
        "No se puede eliminar",
        "Este producto tiene remitos asociados. Para no perder historial, no se permite eliminar.\nSugerencia: fijá el stock en 0 o archivá el producto."
      );
    }
    Alert.alert(
      "Eliminar producto",
      `¿Eliminar “${p.name}” (${p.code}) de esta sucursal?\nEsta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            DB.deleteProduct(p.id);
            setRows((cur) => cur.filter((r) => r.id !== p.id));
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

  const renderItem = ({ item }: { item: Prod }) => (
    <View
      style={{
        borderBottomWidth: 1,
        borderColor: "#eee",
        paddingVertical: 8,
        gap: 6,
      }}
    >
      <Text style={{ fontWeight: "600" }}>{item.name}</Text>
      <Text style={{ color: "#475569", fontSize: 12 }}>{item.code}</Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 12, color: "#334155" }}>
          Precio: ${item.price ?? 0} — Stock: {item.stock ?? 0}
        </Text>

        {/* acciones: Ajustar / Editar / Eliminar */}
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
          onPress={load}
          style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: "#007AFF" }}
          activeOpacity={0.9}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>{loading ? "..." : "Refrescar"}</Text>
        </TouchableOpacity>

        {/* NUEVO: link a Archivados */}
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

      {/* Modal editar (nombre/precio) */}
      <ProductEditModal
        visible={editOpen}
        code={editing?.code ?? null}
        initialName={editing?.name ?? ""}
        initialPrice={editing?.price ?? 0}
        onCancel={() => {
          setEditOpen(false);
          setEditing(null);
        }}
        onSave={onSaveEdit}
      />

      {/* Modal AJUSTAR (sin delta personalizado) */}
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

                {/* Quick -1 / +1 */}
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

                {/* Fijar stock exacto */}
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

                {/* Archivar */}
                <TouchableOpacity
                  onPress={archiveCurrent}
                  style={{ paddingVertical: 12, borderRadius: 10, backgroundColor: "#f1f5f9", alignItems: "center", marginBottom: 8 }}
                  activeOpacity={0.9}
                >
                  <Text style={{ color: "#0f172a", fontWeight: "700" }}>Archivar producto</Text>
                </TouchableOpacity>

                {/* Cerrar */}
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
