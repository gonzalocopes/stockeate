import React, { useEffect, useMemo, useState } from "react";
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
import { Ionicons } from "@expo/vector-icons"; // <-- Importamos Ionicons
import { useIsFocused } from "@react-navigation/native";
import { useBranch } from "../stores/branch";
import { DB } from "../db";
import { api } from "../api";
import { pullBranchCatalog } from "../sync/index";
import { pushMoveByCode, pushDeleteProduct } from "../sync/push";
import { useThemeStore } from "../stores/themeProviders";
import { useBatch } from "../stores/batch"; // <-- 1. IMPORTAMOS EL STORE DEL LOTE

type Prod = {
  id: string;
  code: string;
  name: string;
  price: number;
  stock: number;
  branch_id: string;
};

// Tipo para el item del lote (copiado de RemitoForm)
type LoteItem = {
  product_id: string;
  code: string;
  name: string;
  unit_price: number;
  qty: number;
};

const LOW_THRESHOLD = 20; // umbral local para "bajo stock"

export default function BranchProducts({ navigation, route }: any) { // <-- 2. AÑADIMOS 'route'
  const { theme } = useThemeStore();
  const branchId = useBranch((s) => s.id);
  const isFocused = useIsFocused();

  // 👇 3. DETECTAMOS EL MODO "SELECTOR"
  const isPickerMode = route?.params?.mode === "picker";
  
  // 👇 4. OBTENEMOS LA FUNCIÓN PARA AÑADIR AL LOTE
  const { addOrInc: addOrIncToBatch } = useBatch();

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Prod[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingStock, setPendingStock] = useState<Record<string, number>>({});
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Prod | null>(null);
  const [editCode, setEditCode] = useState<string>("");
  const [editName, setEditName] = useState<string>("");
  const [editPrice, setEditPrice] = useState<string>("");
  const [editStock, setEditStock] = useState<string>("");
  const [filter, setFilter] = useState<"ALL" | "LOW" | "ZERO">("ALL");

  const loadLocal = () => {
    if (!branchId) return;
    const data = DB.listProductsByBranch(branchId, search, 500, 0);
    setRows(data);
  };

  const pullThenLoad = async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      await pullBranchCatalog(branchId);
    } catch (e: any) {
      console.log("SYNC_ERR", e?.message || e);
    } finally {
      loadLocal();
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
    setEditCode(String(p.code ?? ""));
    setEditName(p.name ?? "");
    setEditPrice(String(p.price ?? 0));
    setEditStock(String(p.stock ?? 0));
    setEditOpen(true);
  };

  const onSaveEdit = async () => {
    if (!editing || !branchId) return;

    const name = editName.trim();
    const price = Number(String(editPrice).replace(",", "."));
    const target = Math.max(0, Math.floor(Number(String(editStock).replace(",", "."))));

    if (!name || isNaN(price)) {
      return Alert.alert("Editar producto", "Revisá nombre y precio.");
    }

    setRows((cur) =>
      cur.map((r) =>
        r.id === editing.id ? { ...r, name, price, stock: target } : r
      )
    );
    setPendingStock((m) => ({ ...m, [editing.id]: target }));
    setEditOpen(false);
    setEditing(null);

    try {
      const updatedBase = DB.updateProductNamePrice(editCode ? DB.getProductByCode(editCode)?.id ?? editing.id : editing.id, name, price);
      await syncProductOnline({
        code: updatedBase.code,
        name: updatedBase.name,
        price: updatedBase.price ?? 0,
        branch_id: updatedBase.branch_id,
      });

      const latest = DB.getProductByCode(updatedBase.code);
      const before = Number(latest?.stock ?? 0);
      const delta = target - before;

      if (delta !== 0) {
        try {
          await pushMoveByCode(branchId, updatedBase.code, delta, "Editar producto");
        } catch (e) {
          console.log("pushMoveByCode fail", e);
        }
      }

      await pullBranchCatalog(branchId);
      loadLocal();
    } finally {
      setPendingStock((m) => {
        const { [editing?.id ?? ""]: _skip, ...rest } = m;
        return rest;
      });
    }
  };

  const archiveFromEdit = () => {
    if (!editing) return;
    Alert.alert(
      "Archivar producto",
      `¿Archivar “${editing.name}” (${editing.code})?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Archivar",
          style: "destructive",
          onPress: () => {
            DB.archiveProduct(editing.id);
            setRows((cur) => cur.filter((r) => r.id !== editing.id));
            setEditOpen(false);
            setEditing(null);
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
              try {
                await pushDeleteProduct(branchId, p.code);
              } catch {}
            }
          },
        },
      ]
    );
  };

  const screenWidth = Dimensions.get("window").width;
  const isSmallScreen = screenWidth < 400;

  const filtered = useMemo(() => {
    return rows.filter((p) => {
      const stock = pendingStock[p.id] ?? p.stock ?? 0;
      if (filter === "LOW") return stock > 0 && stock < LOW_THRESHOLD;
      if (filter === "ZERO") return stock === 0;
      return true;
    });
  }, [rows, filter, pendingStock]);

  if (!branchId) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.text }}>Primero seleccioná una sucursal.</Text>
      </View>
    );
  }

  const getStockBadge = (stock: number | undefined) => {
    const s = Math.max(0, Number(stock ?? 0));
    if (s === 0) return { bg: theme.colors.danger, label: "Sin stock" };
    if (s < LOW_THRESHOLD) return { bg: "#f59e0b", label: `Bajo (${s})` };
    return { bg: theme.colors.success, label: `${s}` };
  };

  // --- 👇 5. NUEVA FUNCIÓN PARA SELECCIONAR PRODUCTO ---
  const handleSelectProduct = (item: Prod) => {
    // 1. Convertimos el producto al formato LoteItem
    const itemToAdd: LoteItem = {
      product_id: item.id,
      code: item.code,
      name: item.name,
      unit_price: item.price,
      qty: 1, // Añadimos 1 por defecto
    };
    
    // 2. Usamos la función del store 'useBatch' para añadirlo
    addOrIncToBatch(itemToAdd, 1);
    
    // 3. Volvemos a la pantalla anterior (RemitoForm)
    navigation.goBack();
  };

  const renderItem = ({ item }: { item: Prod }) => {
    const displayStock = pendingStock[item.id] ?? item.stock;
    const badge = getStockBadge(displayStock);

    return (
      <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, shadowColor: "#000" }]}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            <View style={[styles.pricePill, { backgroundColor: theme.colors.inputBackground, borderColor: theme.colors.border }]}>
              <Text style={[styles.priceText, { color: theme.colors.text }]}>${item.price ?? 0}</Text>
            </View>
          </View>
          <Text style={[styles.code, { color: theme.colors.textMuted }]} numberOfLines={1}>
            {item.code}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
            <View style={[styles.stockBadge, { backgroundColor: badge.bg }]}>
              <Text style={styles.stockBadgeText}>{badge.label}</Text>
            </View>
          </View>
        </View>

        {/* --- 👇 6. LÓGICA DE BOTONES CONDICIONAL --- */}
        <View style={styles.actions}>
          {isPickerMode ? (
            // MODO SELECTOR: Mostrar botón de AÑADIR
            <TouchableOpacity
              onPress={() => handleSelectProduct(item)}
              style={[styles.iconBtn, { backgroundColor: theme.colors.success }]} // Botón verde
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
          ) : (
            // MODO NORMAL: Mostrar botones de Editar y Borrar
            <>
              <TouchableOpacity
                onPress={() => openEdit(item)}
                style={[styles.iconBtn, { backgroundColor: theme.colors.primary }]}
                activeOpacity={0.85}
              >
                <Text style={styles.iconEmoji}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => confirmDelete(item)}
                style={[styles.iconBtn, { backgroundColor: theme.colors.danger }]}
                activeOpacity={0.85}
              >
                <Text style={styles.iconEmoji}>🗑️</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12, backgroundColor: theme.colors.background }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: theme.colors.text }}>
        {/* 👇 7. TÍTULO CONDICIONAL */}
        {isPickerMode ? "Seleccionar Producto" : "Productos de la sucursal"}
      </Text>

      <View style={styles.searchContainer}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o código"
          placeholderTextColor={theme.colors.textMuted}
          style={[
            styles.searchInput,
            {
              borderColor: search ? theme.colors.primary : theme.colors.inputBorder,
              backgroundColor: theme.colors.inputBackground,
              color: theme.colors.text,
            },
          ]}
        />

        {/* --- 👇 8. BOTONES CONDICIONALES (se ocultan en modo picker) --- */}
        {!isPickerMode && (
          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={pullThenLoad}
              style={[styles.actionButton, { backgroundColor: theme.colors.primary, flex: 1 }, isSmallScreen && styles.actionButtonSmall]}
              activeOpacity={0.9}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Refrescar</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("BranchArchived")}
              style={[styles.actionButton, { backgroundColor: theme.colors.neutral, flex: 1 }, isSmallScreen && styles.actionButtonSmall]}
              activeOpacity={0.9}
            >
              <Text style={styles.actionButtonText}>Archivados</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Chips de filtro */}
      <View style={styles.chipsRow}>
        <Chip label="Todos" active={filter === "ALL"} onPress={() => setFilter("ALL")} theme={theme} />
        <Chip label="Bajo Stock" active={filter === "LOW"} onPress={() => setFilter("LOW")} theme={theme} />
        <Chip label="Sin stock" active={filter === "ZERO"} onPress={() => setFilter("ZERO")} theme={theme} />
      </View>

      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {/* 👇 9. Texto de ayuda condicional */}
        {isPickerMode 
          ? "Toca el '+' para añadir un producto al remito" 
          : `${filtered.length} producto${filtered.length === 1 ? "" : "s"} mostrados`
        }
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(x) => x.id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      {/* --- 👇 10. MODAL CONDICIONAL (no se abre en modo picker) --- */}
      {!isPickerMode && (
        <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : undefined}
                keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
              >
                <View
                  style={{
                    backgroundColor: theme.colors.card,
                    padding: 16,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                  }}
                >
                  <View style={{ alignItems: "center", marginBottom: 8 }}>
                    <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2 }} />
                  </View>

                  <Text style={{ fontSize: 16, fontWeight: "800", marginBottom: 12, color: theme.colors.text }}>
                    Editar producto
                  </Text>

                  {/* Código (solo lectura) */}
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ fontWeight: "600", marginBottom: 6, color: theme.colors.text }}>Código</Text>
                    <TextInput
                      value={editCode}
                      editable={false}
                      style={{
                        borderWidth: 1,
                        borderColor: theme.colors.inputBorder,
                        borderRadius: 8,
                        padding: 10,
                        backgroundColor: theme.colors.inputBackground,
                        color: theme.colors.textMuted,
                      }}
                    />
                  </View>

                  {/* Nombre */}
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ fontWeight: "600", marginBottom: 6, color: theme.colors.text }}>Nombre</Text>
                    <TextInput
                      value={editName}
                      onChangeText={setEditName}
                      placeholder="Nombre"
                      placeholderTextColor={theme.colors.textMuted}
                      style={{
                        borderWidth: 1,
                        borderColor: theme.colors.inputBorder,
                        borderRadius: 8,
                        padding: 10,
                        backgroundColor: theme.colors.inputBackground,
                        color: theme.colors.text,
                      }}
                    />
                  </View>

                  {/* Precio */}
                  <View style={{ marginBottom: 10 }}>
                    <Text style={{ fontWeight: "600", marginBottom: 6, color: theme.colors.text }}>Precio</Text>
                    <TextInput
                      value={editPrice}
                      onChangeText={setEditPrice}
                      keyboardType="decimal-pad"
                      placeholder="$ 0"
                      placeholderTextColor={theme.colors.textMuted}
                      style={{
                        borderWidth: 1,
                        borderColor: theme.colors.inputBorder,
                        borderRadius: 8,
                        padding: 10,
                        backgroundColor: theme.colors.inputBackground,
                        color: theme.colors.text,
                      }}
                    />
                  </View>

                  {/* Stock */}
                  <View style={{ marginBottom: 14 }}>
                    <Text style={{ fontWeight: "600", marginBottom: 6, color: theme.colors.text }}>Stock (entero)</Text>
                    <TextInput
                      value={editStock}
                      onChangeText={setEditStock}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={theme.colors.textMuted}
                      style={{
                        borderWidth: 1,
                        borderColor: theme.colors.inputBorder,
                        borderRadius: 8,
                        padding: 10,
                        backgroundColor: theme.colors.inputBackground,
                        color: theme.colors.text,
                      }}
                    />
                  </View>

                  {/* Botones: Cancelar / Guardar */}
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setEditOpen(false);
                        setEditing(null);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 10,
                        backgroundColor: theme.colors.inputBorder,
                        alignItems: "center",
                      }}
                      activeOpacity={0.9}
                    >
                      <Text style={{ color: theme.colors.text, fontWeight: "800" }}>Cancelar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={onSaveEdit}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        borderRadius: 10,
                        backgroundColor: theme.colors.primary,
                        alignItems: "center",
                      }}
                      activeOpacity={0.9}
                    >
                      <Text style={{ color: "#fff", fontWeight: "800" }}>Guardar</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Archivar */}
                  <TouchableOpacity
                    onPress={archiveFromEdit}
                    style={{
                      marginTop: 10,
                      paddingVertical: 12,
                      borderRadius: 10,
                      backgroundColor: theme.colors.neutral,
                      alignItems: "center",
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={{ color: "#fff", fontWeight: "800" }}>Archivar producto</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}

/* ---- Chips ---- */
function Chip({
  label,
  active,
  onPress,
  theme,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: any;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.colors.primary : theme.colors.inputBackground,
          borderColor: active ? theme.colors.primary : theme.colors.inputBorder,
        },
      ]}
    >
      <Text
        style={{
          color: active ? "#fff" : theme.colors.text,
          fontWeight: active ? "800" : "600",
          fontSize: 12.5,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, padding: 16, alignItems: "center", justifyContent: "center" },
  searchContainer: { gap: 8 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  buttonRow: { flexDirection: "row", gap: 8 },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  actionButtonText: { color: "white", fontWeight: "800", fontSize: 14 },
  actionButtonSmall: { paddingHorizontal: 8, paddingVertical: 8, minHeight: 36 },
  chipsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 }, // Margen añadido
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    gap: 10,
  },
  name: { fontSize: 15.5, fontWeight: "800", flexShrink: 1 },
  code: { fontSize: 12, marginTop: 2 },
  pricePill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, alignSelf: 'flex-start' },
  priceText: { fontSize: 12, fontWeight: "800" },
  stockBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  stockBadgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  iconEmoji: { color: "#fff", fontWeight: "700", fontSize: 16, textAlign: "center" },
});