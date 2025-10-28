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
  StyleSheet,
  Dimensions,
} from "react-native";

import { useIsFocused } from "@react-navigation/native";
import { useBranch } from "../stores/branch";
import ProductEditModal from "../components/ProductEditModal";
import { DB } from "../db";
import { api } from "../api";
import { pullBranchCatalog } from "../sync/index";
import { pushMoveByCode, pushDeleteProduct } from "../sync/push";

import { useThemeStore } from "../stores/themeProviders";


type Prod = {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  branch_id: string;
};

export default function BranchProducts({ navigation }: any) {
  const { theme } = useThemeStore(); // 👈 Obtener el tema
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
      <View style={{ flex: 1, padding: 16, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.background }}>
        <Text style={{ color: theme.colors.text }}>Primero seleccioná una sucursal.</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: Prod }) => {
    const displayStock = pendingStock[item.id] ?? item.stock;

    return (
      <View style={[styles.itemContainer, { borderColor: theme.colors.border }]}>
        <View style={styles.itemDetails}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={[styles.itemName, { color: theme.colors.text }]}>{item.name}</Text>
            <Text style={[styles.itemCode, { color: theme.colors.textMuted }]}>{item.code}</Text>
            <Text style={[styles.itemInfo, { color: theme.colors.textSecondary }]}>
              Precio: ${item.price ?? 0} — Stock: {displayStock ?? 0}
            </Text>
          </View>

          <View style={styles.buttonContainer}>
            {/* Ajustar stock - icono de sliders */}
            <TouchableOpacity
              onPress={() => openAdjust(item)}
              style={[styles.button, styles.adjustButton]}
              activeOpacity={0.8}
              accessibilityLabel={`Ajustar stock de ${item.name}`}
            >
              {/* Custom sliders icon built with Views to avoid adding dependencies */}
              <View style={styles.slidersIcon}>
                <View style={styles.sliderRow}>
                  <View style={[styles.sliderLine, { backgroundColor: 'rgba(255,255,255,0.85)' }]} />
                  <View style={[styles.knob, { left: '10%' }]} />
                </View>
                <View style={styles.sliderRow}>
                  <View style={[styles.sliderLine, { backgroundColor: 'rgba(255,255,255,0.85)' }]} />
                  <View style={[styles.knob, { left: '50%' }]} />
                </View>
                <View style={styles.sliderRow}>
                  <View style={[styles.sliderLine, { backgroundColor: 'rgba(255,255,255,0.85)' }]} />
                  <View style={[styles.knob, { left: '85%' }]} />
                </View>
              </View>
            </TouchableOpacity>

            {/* Editar */}
            <TouchableOpacity
              onPress={() => openEdit(item)}
              style={[styles.button, styles.editButton]}
              activeOpacity={0.8}
            >
              <Text style={styles.iconText}>✏️</Text>
            </TouchableOpacity>

            {/* Eliminar */}
            <TouchableOpacity
              onPress={() => confirmDelete(item)}
              style={[styles.button, styles.deleteButton]}
              activeOpacity={0.8}
            >
              <Text style={styles.iconText}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const screenWidth = Dimensions.get('window').width;
  const isSmallScreen = screenWidth < 400;

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: theme.colors.background }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: theme.colors.text }}>Productos de la sucursal</Text>

      <View style={styles.searchContainer}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o código"
          placeholderTextColor={theme.colors.textMuted} // 👈 Placeholder color
          style={[
            styles.searchInput,
            {
              borderColor: search ? theme.colors.primary : theme.colors.inputBorder,
              backgroundColor: theme.colors.inputBackground, // 👈 Fondo del input
              color: theme.colors.text, // 👈 Color del texto del input
            }
          ]}
        />
        
        <View style={styles.buttonRow}>
          <TouchableOpacity
            onPress={pullThenLoad}
            style={[styles.actionButton, styles.refreshButton, isSmallScreen && styles.actionButtonSmall]}
            activeOpacity={0.9}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Refrescar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("BranchArchived")}
            style={[styles.actionButton, styles.archivedButton, isSmallScreen && styles.actionButtonSmall]}
            activeOpacity={0.9}
          >
            <Text style={styles.actionButtonText}>Archivados</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {rows.length} producto{rows.length === 1 ? "" : "s"} en esta sucursal
      </Text>

      <FlatList
        data={rows}
        keyExtractor={(x) => x.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      {/* Modal editar se mantiene igual, asumiendo que los componentes internos (ProductEditModal) usan el tema */}
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
              <View style={{ backgroundColor: theme.colors.card, padding: 16, borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
                <View style={{ alignItems: "center", marginBottom: 8 }}>
                  <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2 }} />
                </View>

                <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 12, color: theme.colors.text }}>
                  Ajustar stock — {adjusting?.name} ({adjusting?.code})
                </Text>

                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => applyQuickDelta(-1)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: theme.colors.danger, alignItems: "center" }} // 👈 Danger
                    activeOpacity={0.9}
                  >
                    <Text style={{ color: "white", fontWeight: "700" }}>-1</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => applyQuickDelta(+1)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: theme.colors.success, alignItems: "center" }} // 👈 Success
                    activeOpacity={0.9}
                  >
                    <Text style={{ color: "white", fontWeight: "700" }}>+1</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontWeight: "600", marginBottom: 6, color: theme.colors.text }}>Fijar stock</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                      value={targetStr}
                      onChangeText={setTargetStr}
                      placeholder="Ej: 0, 15"
                      placeholderTextColor={theme.colors.textMuted} // 👈 Placeholder
                      keyboardType="number-pad"
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: theme.colors.inputBorder, // 👈 Borde del input
                        borderRadius: 8,
                        padding: 10,
                        backgroundColor: theme.colors.inputBackground, // 👈 Fondo del input
                        color: theme.colors.text, // 👈 Color del texto
                      }}
                      returnKeyType="done"
                      onSubmitEditing={applySetExact}
                    />
                    <TouchableOpacity
                      onPress={applySetExact}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: theme.colors.primary }} // 👈 Primary
                      activeOpacity={0.9}
                    >
                      <Text style={{ color: "white", fontWeight: "700" }}>Fijar</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={archiveCurrent}
                  style={{ paddingVertical: 12, borderRadius: 10, backgroundColor: theme.colors.inputBorder, alignItems: "center", marginBottom: 8 }} // 👈 Color neutro (inputBorder)
                  activeOpacity={0.9}
                >
                  <Text style={{ color: theme.colors.text, fontWeight: "700" }}>Archivar producto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setAdjOpen(false); setAdjusting(null); }}
                  style={{ paddingVertical: 12, borderRadius: 10, backgroundColor: theme.colors.border, alignItems: "center" }} // 👈 Color neutro (border)
                  activeOpacity={0.9}
                >
                  <Text style={{ color: theme.colors.text, fontWeight: "700" }}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    gap: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },

  actionButtonText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
  // Se usa theme.colors.primary y theme.colors.primary/neutral inline en el return
  refreshButton: {
    // Usamos el color de fondo primario
    backgroundColor: '#3b82f6', // Valor por defecto, se sobrescribe inline
    flex: 1,
  },
  archivedButton: {
    // Usamos el color de fondo primario/secundario
    backgroundColor: '#0ea5e9', // Valor por defecto, se sobrescribe inline
    flex: 1,
  },
  itemContainer: {
    borderBottomWidth: 1,
    // borderColor: theme.colors.border, aplicado inline
    paddingVertical: 12,
  },
  itemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemName: {
    fontWeight: "600",
    fontSize: 16,
    // color: theme.colors.text, aplicado inline
  },
  itemCode: {
    // color: theme.colors.textMuted, aplicado inline
    fontSize: 12,
    marginVertical: 2,
  },
  itemInfo: {
    fontSize: 12,
    // color: theme.colors.textSecondary, aplicado inline
  },
  buttonContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "700",
    paddingHorizontal: 12,
  },
  iconText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
    textAlign: 'center',
  },
  adjustButton: {
    // Fondo neutro, se usa neutral
    backgroundColor: '#6b7280', // Valor por defecto, se sobrescribe inline
  },
  editButton: {
    // Fondo primario
    backgroundColor: '#3b82f6', // Valor por defecto, se sobrescribe inline
  },
  deleteButton: {
    // Fondo peligro
    backgroundColor: 'rgb(195, 12, 12)', // Valor por defecto, se sobrescribe inline
  },
  iconContainer: {
    paddingHorizontal: 8,
  },
  slidersIcon: {
    width: 24,
    height: 18,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderRow: {
    height: 5,
    justifyContent: 'center',
    width: '100%',
    position: 'relative',
  },
  sliderLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    // backgroundColor: 'rgba(255,255,255,0.85)', aplicado inline
    borderRadius: 1,
  },
  knob: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)'
  },
  actionButtonSmall: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 36,
  },
});
