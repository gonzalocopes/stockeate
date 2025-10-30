// src/screens/RemitoHub.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
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
import { useThemeStore } from "../stores/themeProviders";

// 👇 imports para el menú
import { useAuth } from "../stores/auth";
import HamburgerMenu from "../components/HamburgerMenu";

export default function RemitoHub({ navigation }: any) {
  const { mode, theme, toggleTheme } = useThemeStore();

  // ── estado menú
  const [menuVisible, setMenuVisible] = useState(false);
  const menuItems = useMemo(
    () => [
      { label: mode === "light" ? "Tema Oscuro" : "Tema Claro", onPress: toggleTheme },
      { label: "Configuración", onPress: () => navigation.navigate("Settings") },
      { label: "Cerrar sesión", onPress: useAuth.getState().logout, isDestructive: true },
    ],
    [mode, toggleTheme]
  );

  // Paleta consistente con Home
  const gradSalida: [string, string] =
    mode === "dark" ? ["#1FBF7A", "#14A36D"] : ["#2ECF8D", "#1FBF7A"];
  const gradEntrada: [string, string] =
    mode === "dark" ? ["#7C6BFF", "#5B5FEA"] : ["#7F6CFF", "#5C6BFA"];
  const gradHistorial: [string, string] =
    mode === "dark" ? ["#6B7280", "#4B5563"] : ["#6B7280", "#4B5563"];
  const gradTransfer: [string, string] =
    mode === "dark" ? ["#4B5563", "#374151"] : ["#9CA3AF", "#6B7280"];

  useEffect(() => {
    navigation.setOptions({
      title: "Remitos",
      headerTitleAlign: "center",
      headerStyle: {
        backgroundColor: theme.colors.header ?? theme.colors.background,
      },
      headerTitleStyle: { color: theme.colors.text },
      headerTintColor: theme.colors.text,
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={theme.colors.text} />
        </TouchableOpacity>
      ),
      // 👇 botón hamburguesa
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={{ paddingHorizontal: 8, paddingVertical: 6 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Abrir menú"
        >
          <Ionicons name="menu" size={22} color={theme.colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme, mode]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, padding: 16, paddingBottom: 90 }}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Remitos
        </Text>

        <FullButton
          title="Remito de salida (egreso)"
          subtitle="Usa el lote actual o armá uno nuevo. Descuenta stock."
          icon="exit-outline"
          gradient={gradSalida}
          onPress={() => navigation.navigate("RemitoForm")}
        />

        <FullButton
          title="Remito de entrada (ingreso)"
          subtitle="Escaneá lo recibido y suma stock."
          icon="enter-outline"
          gradient={gradEntrada}
          onPress={() => navigation.navigate("RemitoIngreso")}
        />

        <FullButton
          title="Historial de remitos"
          subtitle="Buscá por número, cliente/proveedor o producto."
          icon="time-outline"
          gradient={gradHistorial}
          onPress={() => navigation.navigate("RemitosHistory")}
        />

        <FullButton
          title="Transferencia entre sucursales"
          subtitle="Enviar/recibir entre depósitos. (Próximo)"
          icon="swap-horizontal-outline"
          gradient={gradTransfer}
          disabled
          onPress={() => {}}
        />
      </View>

      {/* 👇 Modal del menú */}
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
  disabled?: boolean;
};

function FullButton({
  title,
  subtitle,
  icon,
  gradient,
  onPress,
  disabled,
}: FullButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;

  // shimmer responsivo
  const [size, setSize] = useState({ w: 0, h: 0 });
  const tx = useRef(new Animated.Value(0)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

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
    <Animated.View
      style={{
        transform: [{ scale }],
        marginBottom: 16,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={disabled ? undefined : pressIn}
        onPressOut={disabled ? undefined : pressOut}
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
            {!disabled && <Ionicons name="chevron-forward" size={20} color="#fff" />}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/* ───────────── ESTILOS ───────────── */
const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
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
