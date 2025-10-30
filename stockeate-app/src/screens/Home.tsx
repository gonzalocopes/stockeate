// src/screens/Home.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";

import { useAuth } from "../stores/auth";
import { useThemeStore } from "../stores/themeProviders";
import { useBranch } from "../stores/branch";
import { DB } from "../db";
import { pullBranchCatalog } from "../sync";
import HamburgerMenu from "../components/HamburgerMenu";

const LOW_THRESHOLD = 20;           // <—— umbral “stock bajo”
const INCLUDE_ZERO_IN_LOW = false;  // <—— si querés contar también 0, poné true

export default function Home({ navigation }: any) {
  const { mode, theme, toggleTheme } = useThemeStore();
  const logout = useAuth((s) => s.logout);
  const [menuVisible, setMenuVisible] = useState(false);

  const branchId = useBranch((s) => s.id);
  const isFocused = useIsFocused();

  // -------- contador real de stock bajo ----------
  const [lowCount, setLowCount] = useState<number>(0);
  const [loadingLow, setLoadingLow] = useState<boolean>(false);

  const recomputeLowCountFromDB = () => {
    if (!branchId) {
      setLowCount(0);
      return;
    }
    const list = DB.listProductsByBranch(branchId, "", 10_000, 0) as Array<{
      stock?: number;
    }>;
    let count = 0;
    for (const p of list) {
      const s = Number(p.stock ?? 0);
      if (INCLUDE_ZERO_IN_LOW ? s < LOW_THRESHOLD : s > 0 && s < LOW_THRESHOLD) {
        count++;
      }
    }
    setLowCount(count);
  };

  const syncAndRecompute = async () => {
    if (!branchId) return recomputeLowCountFromDB();
    setLoadingLow(true);
    try {
      await pullBranchCatalog(branchId);
    } finally {
      recomputeLowCountFromDB();
      setLoadingLow(false);
    }
  };

  useEffect(() => {
    if (isFocused) syncAndRecompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, branchId]);

  // -------- Header ----------
  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("BranchSelect")}
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Volver a sucursales"
          accessibilityRole="button"
        >
          <Ionicons
            name="chevron-back"
            size={26}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Abrir menú"
          accessibilityRole="button"
        >
          <Ionicons
            name="menu"
            size={22}
            color={theme.colors.text}
          />
        </TouchableOpacity>
      ),
      title: "Menú",
      headerTitleAlign: "center",
      headerStyle: {
        backgroundColor: theme.colors.header ?? theme.colors.background,
      },
      headerTitleStyle: { color: theme.colors.text },
    });
  }, [navigation, theme, mode]);

  // -------- Menú hamburguesa ----------
  const menuItems = useMemo(
    () => [
      { label: mode === "light" ? "Tema Oscuro" : "Tema Claro", onPress: toggleTheme },
      { label: "Configuración", onPress: () => navigation.navigate("Settings") },
      { label: "Cerrar sesión", onPress: logout, isDestructive: true },
    ],
    [mode, toggleTheme, logout]
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, padding: 16, paddingBottom: 90 }}>
        {/* --- Alerta stock bajo (contador real) --- */}
        <LinearGradient
          colors={["#fde68a", "#facc15", "#eab308"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.alertCard}
        >
          <View style={styles.alertLeft}>
            <View style={styles.alertIcon}>
              <Ionicons name="warning-outline" size={22} color="#78350f" />
            </View>
            <View>
              <Text style={styles.alertTitle}>Atención</Text>
              <Text style={styles.alertSubtitle}>
                Productos con stock bajo {INCLUDE_ZERO_IN_LOW ? "(incluye 0)" : ""}
              </Text>
            </View>
          </View>

          <Text style={styles.alertCountOnly}>
            {loadingLow ? "…" : lowCount}
          </Text>
        </LinearGradient>

        {/* --- Botones apilados --- */}
        <View style={{ gap: 16, marginTop: 8 }}>
          <FullButton
            title="Escanear"
            subtitle="Agregar productos por código de barras / QR"
            icon="scan-outline"
            gradient={["#10b981", "#059669"]}
            onPress={() => navigation.navigate("ScanAdd")}
          />
         <FullButton
            title="Remitos"
            subtitle="Salida, entrada e historial"
            icon="document-text-outline"
            gradient={["#6366f1", "#4338ca"]}
            onPress={() => navigation.navigate("RemitosHub")}
          />
          <FullButton
            title="Ver Inventario"
            subtitle="Consultar stock y buscar productos"
            icon="search-outline"
            gradient={["#64748b", "#475569"]}
            onPress={() => navigation.navigate("BranchProducts")}
          />
        </View>
      </View>

{/* Footer */}
{/*     <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 70, // Altura de la barra
        backgroundColor: theme.colors.inputBackground, // Color de fondo
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      }}
    />
*/}

      <HamburgerMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={menuItems}
        navigation={navigation}
      />
    </View>
  );
}

/* ───────────── FULL BUTTON ───────────── */
type FullButtonProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  onPress: () => void;
};

function FullButton({ title, subtitle, icon, gradient, onPress }: FullButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  // shimmer responsivo
  const [size, setSize] = useState({ w: 0, h: 0 });
  const tx = useRef(new Animated.Value(0)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  // loop del shimmer, en píxeles y según el ancho real
  useEffect(() => {
    if (size.w === 0) return;
    const stripeW = Math.max(60, size.w * 0.55);
    tx.setValue(-stripeW);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(tx, { toValue: size.w, duration: 1800, useNativeDriver: true }),
        Animated.delay(600),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [size.w]);

  const stripeW = Math.max(60, size.w * 0.55);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.fullButtonWrapper}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fullButtonBg}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setSize({ w: width, h: height });
          }}
        >
          {/* shimmer responsive */}
          {size.w > 0 && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: -12,
                height: size.h + 24,
                width: stripeW,
                transform: [{ translateX: tx }, { rotate: "18deg" }],
              }}
            >
              <LinearGradient
                colors={["#ffffff00", "#ffffff40", "#ffffff00"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          )}

          <View style={styles.fullButtonContent}>
            <View style={styles.fullButtonIcon}>
              <Ionicons name={icon} size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullButtonTitle}>{title}</Text>
              <Text style={styles.fullButtonSubtitle}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/* ───────────── ESTILOS ───────────── */
const styles = StyleSheet.create({
  // --- Alerta superior ---
  alertCard: {
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  alertLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alertIcon: {
    backgroundColor: "rgba(255,255,255,0.6)",
    borderRadius: 10,
    padding: 6,
  },
  alertTitle: {
    color: "#78350f",
    fontSize: 14,
    fontWeight: "800",
  },
  alertSubtitle: {
    color: "#854d0e",
    fontSize: 13,
    fontWeight: "500",
  },
  // Solo número (sin círculo)
  alertCountOnly: {
    color: "#111827",
    fontWeight: "900",
    fontSize: 20,
  },

  // --- Full Button ---
  fullButtonWrapper: {
    borderRadius: 16,
    overflow: "hidden",
  },
  fullButtonBg: {
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    position: "relative",
  },
  fullButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fullButtonIcon: {
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  fullButtonTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  fullButtonSubtitle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
  },
});
