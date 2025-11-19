import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBranch } from "../stores/branch";
import { useBatch } from "../stores/batch";
import { DB } from "../db";
import * as Print from "expo-print";
import { api } from "../api";
import { pushMovesBatchByCodes } from "../sync/push";
import { useThemeStore } from "../stores/themeProviders";
import { useAuth } from "../stores/auth";
import HamburgerMenu from "../components/HamburgerMenu";

type LoteItem = {
  product_id: string;
  code: string;
  name: string;
  unit_price: number;
  qty: number;
};

export default function RemitoForm({ navigation }: any) {
  const { mode, theme, toggleTheme } = useThemeStore();
  const branchId = useBranch((s) => s.id);
  const branchName = useBranch((s) => s.name);
  const logout = useAuth((s) => s.logout);
  const { items, addOrInc, dec, remove } = useBatch();
  
  // --- Estados del Formulario ---
  const [customer, setCustomer] = useState("");
  const [customerCuit, setCustomerCuit] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerTaxCondition, setCustomerTaxCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  
  // --- Estado del Menú ---
  const [menuVisible, setMenuVisible] = useState(false);
  const menuItems = React.useMemo(
    () => [
      { label: mode === "light" ? "Tema Oscuro" : "Tema Claro", onPress: toggleTheme },
      { label: "Configuración", onPress: () => navigation.navigate("Settings") },
      { label: "Cerrar sesión", onPress: logout, isDestructive: true },
    ],
    [mode, toggleTheme, logout, navigation]
  );
  
  // --- Cálculos ---
  const totalQty = useBatch((s) => s.totalQty)();
  const totalImporte = useMemo(
    () => items.reduce((a, r) => a + (r.unit_price ?? 0) * (r.qty ?? 0), 0),
    [items]
  );

  // --- Header ---
  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: theme.colors.header ?? theme.colors.background },
      headerTitleStyle: { color: theme.colors.text },
      headerTintColor: theme.colors.text,
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={styles.headerButton}
          accessibilityLabel="Abrir menú"
        >
          <Ionicons name="menu" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme, mode]);

  if (!branchId) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.text }}>Primero elegí una sucursal.</Text>
      </View>
    );
  }

  const tmpNumber = () => { /* ... tu función tmpNumber ... */ 
    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `R-${(branchName || branchId).slice(0, 4).toUpperCase()}-${ymd}-${rnd}`;
  };

  // --- Renderizado de Ítems del Lote ---
  const renderItem = ({ item }: { item: LoteItem }) => (
    <View style={[styles.itemContainer, { borderColor: theme.colors.border }]}>
      <View style={styles.itemDetails}>
        <Text style={[styles.itemName, { color: theme.colors.text }]}>{item.name}</Text>
        <Text style={[styles.itemCode, { color: theme.colors.textMuted }]}>{item.code}</Text>
        <Text style={[styles.itemPrice, { color: theme.colors.textSecondary }]}>
          ${item.unit_price ?? 0} c/u
        </Text>
      </View>
      <View style={styles.itemActions}>
        <Pressable onPress={() => dec(item.code)} style={[styles.itemButton, { borderColor: theme.colors.primary, backgroundColor: theme.colors.card }]}> 
          <Text style={[styles.itemButtonText, { color: theme.colors.primary }]}>-</Text>
        </Pressable>
        <Text style={[styles.itemQty, { color: theme.colors.text }]}>{item.qty}</Text>
        <Pressable onPress={() => addOrInc(item, 1)} style={[styles.itemButton, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary }]}> 
          <Text style={[styles.itemButtonText, { color: "white" }]}>+</Text>
        </Pressable>
        <Pressable onPress={() => remove(item.code)} style={[styles.itemButton, { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger, marginLeft: 6 }]}> 
          <Text style={[styles.itemButtonText, { color: "white" }]}>🗑️</Text>
        </Pressable>
      </View>
    </View>
  );

  // --- Lógica de Guardado (ACTUALIZADA) ---
  const confirmAndSave = async () => {
    if (items.length === 0) {
      Alert.alert("Lote vacío", "No hay items para generar el remito.");
      return;
    }
    setSaving(true);
    try {
      const tmpNum = tmpNumber();
      const remitoData = {
        tmp_number: tmpNum,
        official_number: null,
        branch_id: branchId,
        customer: customer?.trim() || null,
        customer_cuit: customerCuit?.trim() || null,
        customer_address: customerAddress?.trim() || null,
        customer_tax_condition: customerTaxCondition?.trim() || null,
        notes: notes?.trim() || null,
        pdf_path: null,
      };

      const remitoId = DB.insertRemito(remitoData);

      for (const r of items) {
        DB.insertRemitoItem({ remito_id: remitoId, product_id: r.product_id, qty: r.qty, unit_price: r.unit_price ?? 0, });
        DB.incrementStock(r.product_id, -r.qty);
        DB.insertStockMove({ product_id: r.product_id, branch_id: branchId, qty: -r.qty, type: "OUT", ref: tmpNum, });
      }

      let pdfPath: string | null = null;
      try {
        const html = buildHtml(remitoId, tmpNum, branchName || branchId, customer, customerCuit, customerAddress, customerTaxCondition, items, notes, totalImporte);
        const { uri } = await Print.printToFileAsync({ html });
        pdfPath = uri || null;
        if (pdfPath) {
          DB.setRemitoPdfPath(remitoId, pdfPath);
        }
      } catch (e) { console.log("⚠️ No pude generar PDF:", (e as Error).toString()); }

      try {
        await pushMovesBatchByCodes( branchId, items.map((r) => ({ code: r.code, qty: r.qty, reason: "Remito egreso" })), "OUT" );
        await api.post("/sync", {
          branchId,
          products: [],
          stockMoves: [],
          remitos: [{
              id: remitoId,
              tmp_number: tmpNum,
              customer: remitoData.customer,
              customerCuit: remitoData.customer_cuit,
              customerAddress: remitoData.customer_address,
              customerTaxCondition: remitoData.customer_tax_condition,
              notes: remitoData.notes,
              created_at: new Date().toISOString(),
              branch_id: branchId,
            }],
          remitoItems: items.map(r => ({
            remito_id: remitoId,
            productId: r.product_id,
            qty: r.qty,
            unit_price: r.unit_price ?? 0,
          })),
        });
      } catch (e) { console.log("⚠️ Sync remito OUT falló (local ok):", (e as Error).toString()); }

      try { (useBatch.getState() as any).clear(); } catch {}

      navigation.replace("RemitoResult", { remitoId, tmp: tmpNum, pdfPath });
      
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Hubo un problema al guardar el remito.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={[styles.pageTitle, { color: theme.colors.text }]}>Remito de salida (egreso)</Text>

        {/* --- Formulario de Datos --- */}
        <View style={[styles.card, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Datos del Destinatario</Text>
          <Text style={[styles.inputLabel, { color: theme.colors.textMuted, marginBottom: 8 }]}>
            Sucursal: <Text style={{ fontWeight: "700", color: theme.colors.text }}>{branchName || branchId}</Text>
          </Text>

          <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Cliente / Razón Social</Text>
          <TextInput
            placeholder="Ej: Juan Pérez"
            placeholderTextColor={theme.colors.textMuted}
            value={customer}
            onChangeText={setCustomer}
            style={[styles.input, { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
          />
          
          <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>CUIT / CUIL</Text>
          <TextInput
            placeholder="Ej: 20-12345678-9"
            placeholderTextColor={theme.colors.textMuted}
            value={customerCuit}
            onChangeText={setCustomerCuit}
            keyboardType="numeric"
            style={[styles.input, { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
          />

          <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Dirección</Text>
          <TextInput
            placeholder="Ej: Av. Siempre Viva 742"
            placeholderTextColor={theme.colors.textMuted}
            value={customerAddress}
            onChangeText={setCustomerAddress}
            style={[styles.input, { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
          />

          <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Condición IVA</Text>
          <TextInput
            placeholder="Ej: Consumidor Final"
            placeholderTextColor={theme.colors.textMuted}
            value={customerTaxCondition}
            onChangeText={setCustomerTaxCondition}
            style={[styles.input, { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
          />

          <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Notas</Text>
          <TextInput
            placeholder="Observaciones"
            placeholderTextColor={theme.colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            style={[styles.input, { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.text, minHeight: 80, textAlignVertical: 'top' }]}
            multiline
          />
        </View>

        {/* --- Encabezado de la Lista de Items --- */}
        {/* --- 👇 CAMBIO 1 DE 2: Encabezado de Items con botón de búsqueda --- */}
        <View style={styles.itemsHeader}>
          <Text style={[styles.itemsTitle, { color: theme.colors.text }]}>Items ({totalQty} u.)</Text>
          <Pressable 
            style={[styles.searchButton, { borderColor: theme.colors.primary }]}
            onPress={() => navigation.navigate("BranchProducts", { mode: "picker" })} // Navega en modo picker
          >
            <Ionicons name="search" size={16} color={theme.colors.primary} />
            <Text style={[styles.searchButtonText, { color: theme.colors.primary }]}>Buscar en Inventario</Text>
          </Pressable>
        </View>

        {/* --- Lista de Items --- */}
        <FlatList
          data={items}
          keyExtractor={(i) => i.code}
          renderItem={renderItem}
          scrollEnabled={false} // Deshabilitamos scroll de la lista
          ListEmptyComponent={
            <Text style={{color: theme.colors.textMuted, textAlign: 'center', padding: 20}}>
              Lote vacío. Añade productos desde el escáner o buscando en el inventario.
            </Text>
          }
        />
      </ScrollView>

      {/* --- Footer Fijo --- */}
      <View style={[styles.footer, { borderTopColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
        <Text style={[styles.totalText, { color: theme.colors.text }]}>
          Total estimado: ${totalImporte.toFixed(2)}
        </Text>
        <Pressable
          onPress={() => navigation.navigate("ScanAdd", { mode: "batch" })}
          style={[styles.footerButton, { backgroundColor: theme.colors.primary }]}
        >
          <Ionicons name="scan-outline" size={20} color="white" />
          <Text style={styles.footerButtonText}>Agregar con Escáner</Text>
        </Pressable>
        <Pressable
          onPress={confirmAndSave}
          style={[styles.footerButton, { backgroundColor: items.length > 0 ? theme.colors.success : theme.colors.neutral, opacity: saving ? 0.85 : 1 }]}
          disabled={saving || items.length === 0}
        >
          {saving ? ( <ActivityIndicator color="#fff" /> ) : (
            <Text style={styles.footerButtonText}>Guardar remito (egreso)</Text>
          )}
        </Pressable>
      </View>

      <HamburgerMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={menuItems}
        navigation={navigation}
      />
    </View>
  );
}

// --- 👇 CAMBIO 2 DE 2: Actualizamos la función buildHtml ---
function buildHtml(
  remitoId: string,
  tmpNumber: string,
  branchLabel: string,
  customer: string,
  customerCuit: string, // <-- NUEVO
  customerAddress: string, // <-- NUEVO
  customerTaxCondition: string, // <-- NUEVO
  items: LoteItem[],
  notes: string,
  totalImporte: number
) {
  const rows = items
    .map(
      (r) => `
        <tr>
          <td style="padding:6px;border:1px solid #e5e7eb;">${r.code}</td>
          <td style="padding:6px;border:1px solid #e5e7eb;">${escapeHtml(r.name)}</td>
          <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">${r.qty}</td>
          <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">$${(r.unit_price ?? 0).toFixed(2)}</td>
          <td style="padding:6px;border:1px solid #e5e7eb;text-align:right;">$${((r.unit_price ?? 0) * r.qty).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  return `
    <html>
      <head><meta charset="utf-8" /><title>Remito ${tmpNumber}</title></head>
      <body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:16px;">
        <h2 style="margin:0 0 6px 0;">Remito de salida</h2>
        <div style="color:#334155;margin-bottom:12px;">
          <div><strong>N° temporal:</strong> ${tmpNumber}</div>
          <div><strong>Sucursal:</strong> ${escapeHtml(branchLabel)}</div>
          <div><strong>Fecha:</strong> ${new Date().toLocaleString()}</div>
        </div>
        
        <div style="color:#334155;margin-bottom:12px;padding-top:10px;border-top:1px solid #e5e7eb;">
          ${customer ? `<div><strong>Cliente:</strong> ${escapeHtml(customer)}</div>` : ""}
          ${customerCuit ? `<div><strong>CUIT:</strong> ${escapeHtml(customerCuit)}</div>` : ""}
          ${customerAddress ? `<div><strong>Dirección:</strong> ${escapeHtml(customerAddress)}</div>` : ""}
          ${customerTaxCondition ? `<div><strong>Cond. IVA:</strong> ${escapeHtml(customerTaxCondition)}</div>` : ""}
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
          <tbody>${rows}</tbody>
        </table>
        <div style="text-align:right;font-size:14px;margin:8px 0;">
          <strong>Total: $${totalImporte.toFixed(2)}</strong>
        </div>
        ${notes ? `<div style="margin-top:10px;color:#475569;"><strong>Notas:</strong> ${escapeHtml(notes)}</div>` : ""}
        <div style="margin-top:24px;font-size:11px;color:#64748b;">ID interno: ${remitoId}</div>
      </body>
    </html>
  `;
}

function escapeHtml(s: string) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// --- 👇 ESTILOS (Añadidos los nuevos) ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centered: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  card: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 16,
    marginBottom: 16, // Añadido margen
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  pageTitle: { // Estilo para el título principal
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    minHeight: 50, // Altura mínima
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 8, // Espacio
  },
  itemsTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12, // Más padding
    borderRadius: 20,
    borderWidth: 1,
  },
  searchButtonText: {
    fontWeight: '600',
    marginLeft: 6,
    fontSize: 13,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontWeight: "600",
    fontSize: 16,
  },
  itemCode: {
    fontSize: 12,
  },
  itemPrice: {
    fontSize: 13,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 6,
  },
  itemButtonText: {
    fontWeight: "700",
    fontSize: 16,
  },
  itemQty: {
    width: 32,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 16,
  },
  footer: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
    backgroundColor: 'white', // Fondo para el footer
  },
  totalText: {
    fontWeight: "700",
    fontSize: 18,
    textAlign: 'right',
    marginBottom: 4,
  },
  footerButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  footerButtonText: {
    color: "white",
    fontWeight: "800",
    fontSize: 16,
  },
});