// src/screens/RemitoHub.tsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView, // <-- Importamos ScrollView por si la lista crece
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeStore } from "../stores/themeProviders";
import { useIsFocused } from "@react-navigation/native"; // <-- 1. Importamos useIsFocused

// imports para el menú
import { useAuth } from "../stores/auth";
import HamburgerMenu from "../components/HamburgerMenu";

export default function RemitoHub({ navigation }: any) {
  const { mode, theme, toggleTheme } = useThemeStore();
  const isFocused = useIsFocused(); // <-- 2. Obtenemos el estado de foco

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

  // Paletas de gradientes (Añadidos los nuevos)
  const gradSalida: [string, string] =
    mode === "dark" ? ["#1FBF7A", "#14A36D"] : ["#2ECF8D", "#1FBF7A"]; // Verde claro
  const gradEntrada: [string, string] =
    mode === "dark" ? ["#3b82f6", "#2563eb"] : ["#60a5fa", "#3b82f6"]; // Azul (cambiado para diferenciar)
  const gradDigitalizar: [string, string] =
    mode === "dark" ? ["#16a34a", "#15803d"] : ["#22c55e", "#16a34a"]; // Verde más oscuro
  const gradValidar: [string, string] =
    mode === "dark" ? ["#eab308", "#ca8a04"] : ["#facc15", "#eab308"]; // Amarillo/Dorado
  const gradHistorial: [string, string] =
    mode === "dark" ? ["#6366f1", "#4f46e5"] : ["#818cf8", "#6366f1"]; // Violeta/Indigo
  const gradTransfer: [string, string] =
    mode === "dark" ? ["#4B5563", "#374151"] : ["#9CA3AF", "#6B7280"]; // Gris

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
      {/* Usamos ScrollView para permitir desplazamiento si hay muchos botones */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 90 }}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Gestión de Remitos
        </Text>

        <FullButton
          title="Remito de Salida (Egreso)"
          subtitle="Usa el lote actual o armá uno nuevo. Descuenta stock."
          icon="arrow-up-circle-outline" // Icono más específico
          gradient={gradSalida}
          onPress={() => navigation.navigate("RemitoForm")}
          isFocused={isFocused} // <-- 3. Pasamos isFocused
        />

  
        {/* --- 👇 BOTONES NUEVOS INTEGRADOS --- */}
        <FullButton
          title="Digitalizar Remito Externo"
          subtitle="Sube una foto o PDF de un proveedor."
          icon="camera-outline"
          gradient={gradDigitalizar}
          onPress={() => navigation.navigate("UploadRemito")}
          isFocused={isFocused}
        />
{/* 
         <FullButton
          title="Validar Remitos Digitalizados"
          subtitle="Revisa y aprueba los datos extraídos."
          icon="checkmark-done-circle-outline"
          gradient={gradValidar}
          onPress={() => navigation.navigate("PendingRemitos")}
          isFocused={isFocused}
        />
        {/* --- FIN BOTONES NUEVOS --- */}

        <FullButton
          title="Historial de Remitos"
          subtitle="Buscá por número, cliente/proveedor o producto."
          icon="time-outline"
          gradient={gradHistorial}
          onPress={() => navigation.navigate("RemitosHistory")}
          isFocused={isFocused} // <-- 3. Pasamos isFocused
        />

        {/* <FullButton
          title="Transferencia entre Sucursales"
          subtitle="Enviar/recibir entre depósitos. (Próximo)"
          icon="swap-horizontal-outline"
          gradient={gradTransfer}
          disabled
          onPress={() => {}}
          isFocused={isFocused} // <-- 3. Pasamos isFocused
        /> */}
      </ScrollView>

      {/* Modal del menú */}
      <HamburgerMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={menuItems}
        navigation={navigation}
      />
    </View>
  );
}

/* ───────────── FULL BUTTON (CON ANIMACIÓN CORREGIDA) ───────────── */
type FullButtonProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: [string, string];
  onPress: () => void;
  disabled?: boolean;
  isFocused: boolean; // <-- 4. Recibimos el prop
};

function FullButton({
  title,
  subtitle,
  icon,
  gradient,
  onPress,
  disabled,
  isFocused, // <-- Recibido
}: FullButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const [size, setSize] = useState({ w: 0, h: 0 });
  const tx = useRef(new Animated.Value(0)).current;

  const pressIn = () => !disabled && Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start();
  const pressOut = () => !disabled && Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  // --- 👇 5. LÓGICA DE ANIMACIÓN MODIFICADA (IGUAL QUE EN HOME) ---
  useEffect(() => {
    if (size.w === 0) return;
    const stripeW = Math.max(60, size.w * 0.55);

    if (isFocused && !disabled) { // Solo animar si está enfocado Y NO está deshabilitado
      tx.setValue(-stripeW);
      Animated.sequence([
        Animated.delay(300), // Pequeña pausa inicial
        Animated.timing(tx, {
          toValue: size.w + stripeW,
          duration: 1200, // Duración del brillo
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      tx.setValue(-stripeW); // Resetear posición
    }
    // No hay loop.
  }, [size.w, isFocused, disabled]); // Dependencias actualizadas
  // --- FIN DE LA MODIFICACIÓN ---

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
          {size.w > 0 && !disabled && ( // No mostrar shimmer si está deshabilitado
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
            {!disabled && (
              <Ionicons name="chevron-forward" size={20} color="#fff" style={{ opacity: 0.8 }} />
            )}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

/* ───────────── ESTILOS ───────────── */
// ... (Tus estilos se mantienen igual, solo asegúrate de que estén al final del archivo)
const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 20, // Un poco más grande
    fontWeight: "800",
    marginBottom: 16,
  },
  fullButtonWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3, // Sombra sutil en Android
    shadowColor: "#000", // Sombra en iOS
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fullButtonBg: {
    paddingVertical: 18, // Un poco más alto
    paddingHorizontal: 20,
    borderRadius: 16,
    position: "relative",
  },
  fullButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  fullButtonIcon: {
    backgroundColor: "rgba(255,255,255,0.2)",
    width: 46, // Un poco más grande
    height: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fullButtonTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.3,
    marginBottom: 2, // Espacio entre título y subtítulo
  },
  fullButtonSubtitle: {
    color: "rgba(255,255,255,0.9)", // Un poco más visible
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18, // Mejor lectura
  },
});
