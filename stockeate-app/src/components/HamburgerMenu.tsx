// src/components/HamburgerMenu.tsx

import React, { useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  Dimensions,
  Platform,
  Animated,
  Pressable,
  Image,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../stores/themeProviders";

type MenuItem = {
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  icon?: string;
  isToggle?: boolean;
};

type HamburgerMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
  userProfileImage?: string;
  userName?: string;
  userEmail?: string;
  navigation?: any;
};

export default function HamburgerMenu({
  visible,
  onClose,
  items,
  userProfileImage,
  userName,
  userEmail,
  navigation,
}: HamburgerMenuProps) {
  const { theme, mode } = useThemeStore();
  const [dimensions, setDimensions] = React.useState(Dimensions.get("window"));

  // ---- Layout & positioning
  const isDark = mode === "dark";
  const statusBarH = StatusBar.currentHeight ?? 0;
  // Offset del menú para que NO quede arriba: iOS un poco más bajo por notch
  const TOP_OFFSET = Platform.OS === "ios" ? 88 : 64 + statusBarH;

  const menuWidth = React.useMemo(() => {
    const { width, height } = dimensions;
    const isLandscape = width > height;
    const basePercentage = isLandscape ? 0.35 : 0.55;
    return Math.min(width * basePercentage, isLandscape ? 360 : 320);
  }, [dimensions]);

  // ---- Animaciones
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
    });
    return () => sub?.remove();
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 120,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.96,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -10,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, opacityAnim, scaleAnim, translateY]);

  // ---- Tema
  const setLightTheme = () => {
    if (mode !== "light") useThemeStore.getState().toggleTheme();
  };
  const setDarkTheme = () => {
    if (mode !== "dark") useThemeStore.getState().toggleTheme();
  };

  const renderThemeSegment = () => (
    <View style={styles.themeContainer}>
      <Text style={[styles.themeLabel, { color: theme.colors?.text || "#111827" }]}>
        Tema
      </Text>
      <View
        style={[
          styles.segment,
          {
            borderColor: theme.colors?.border || "rgba(0,0,0,0.1)",
            backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
          },
        ]}
      >
        <Pressable
          onPress={setLightTheme}
          style={[
            styles.segmentBtn,
            {
              backgroundColor: mode === "light" ? "#3B82F6" : "transparent",
              borderColor: "transparent",
            },
          ]}
        >
          <Ionicons
            name="sunny-outline"
            size={18}
            color={mode === "light" ? "#fff" : theme.colors?.text || "#111827"}
          />
        </Pressable>
        <Pressable
          onPress={setDarkTheme}
          style={[
            styles.segmentBtn,
            {
              backgroundColor: mode === "dark" ? "#3B82F6" : "transparent",
              borderColor: "transparent",
            },
          ]}
        >
          <Ionicons
            name="moon-outline"
            size={18}
            color={mode === "dark" ? "#fff" : theme.colors?.text || "#111827"}
          />
        </Pressable>
      </View>
    </View>
  );

  const renderMenuItem = (item: MenuItem, index: number) => {
    // Saltar "Tema" si viene en items
    if (
      ["Tema", "Theme", "Tema Oscuro", "Dark Theme", "Tema Claro", "Light Theme"].includes(
        item.label
      )
    ) {
      return null;
    }

    const iconName =
      item.icon ||
      (item.label === "Configuración" || item.label === "Settings"
        ? "settings-outline"
        : item.label === "Cerrar sesión" || item.label === "Log Out"
        ? "log-out-outline"
        : undefined);

    return (
      <Pressable
        key={index}
        onPress={() => {
          if (item.label === "Configuración" || item.label === "Settings") {
            setTimeout(() => {
              onClose();
              navigation?.navigate("Settings");
            }, 80);
          } else {
            setTimeout(() => {
              onClose();
              item.onPress();
            }, 80);
          }
        }}
        style={({ pressed }) => [
          styles.menuItem,
          {
            backgroundColor: pressed
              ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)")
              : "transparent",
          },
        ]}
      >
        <View style={styles.menuItemContent}>
          <Text
            style={[
              styles.menuItemText,
              {
                color: item.isDestructive ? "#EF4444" : theme.colors.text,
                fontWeight: item.isDestructive ? "700" as const : "500" as const,
              },
            ]}
          >
            {item.label}
          </Text>
          {iconName && (
            <Ionicons
              name={iconName as any}
              size={20}
              color={item.isDestructive ? "#EF4444" : theme.colors.text}
            />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      {/* Backdrop (toca afuera para cerrar) */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      {/* Card flotante */}
      <Animated.View
        style={[
          styles.menuContainer,
          {
            top: TOP_OFFSET,
            right: 12,
            width: menuWidth,
            // “Glass” sin deps: fondo translúcido + borde sutil
            backgroundColor: isDark ? "rgba(17,24,39,0.96)" : "rgba(255,255,255,0.98)",
            borderColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
            shadowColor: "#000",
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }, { translateY }],
          },
        ]}
      >
        {/* Header usuario */}
        <Pressable
          style={[styles.menuHeader, { borderBottomColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}
          onPress={() => {
            onClose();
            navigation?.navigate("Profile");
          }}
        >
          <View style={styles.profileImage}>
            {userProfileImage ? (
              <Image
                source={{ uri: userProfileImage }}
                style={{ width: "100%", height: "100%", borderRadius: 12 }}
              />
            ) : (
              <Ionicons
                name="person-circle-outline"
                size={32}
                color={isDark ? "#E5E7EB" : "#111827"}
              />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.menuTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {userName || "Usuario"}
            </Text>
            <Text
              style={[styles.menuSubtitle, { color: isDark ? "#9CA3AF" : "#6B7280" }]}
              numberOfLines={1}
            >
              {userEmail || "example@mail.com"}
            </Text>
          </View>
        </Pressable>

        {/* Segmento de Tema */}
        {renderThemeSegment()}

        {/* Items */}
        <View style={{ paddingVertical: 4 }}>{items.map(renderMenuItem)}</View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  menuContainer: {
    position: "absolute",
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    // sombras suaves
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.20,
    shadowRadius: 20,
    elevation: 12,
  },
  menuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  profileImage: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 12,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 2,
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  menuItemText: {
    fontSize: 14,
    flex: 1,
  },
  themeContainer: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  themeLabel: {
    fontSize: 12,
    fontWeight: "600",
    opacity: 0.8,
  },
  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    gap: 6,
  },
  segmentBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
