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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// NOTA: Asegúrate de que esta ruta a tu store de temas sea correcta
import { useThemeStore } from "../stores/themeProviders";

// --- Definición de tipos (se mantiene igual) ---
type MenuItem = {
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
  icon?: string; // Nombre del icono
  isToggle?: boolean; // Para elementos tipo toggle como el tema
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
  const { theme } = useThemeStore();
  const [dimensions, setDimensions] = React.useState(Dimensions.get('window'));
  
  // Calcular ancho responsivo
  const menuWidth = React.useMemo(() => {
    const { width, height } = dimensions;
    const isLandscape = width > height;
    const basePercentage = isLandscape ? 0.35 : 0.55;
    return Math.min(width * basePercentage, isLandscape ? 350 : 300);
  }, [dimensions]);
  
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  
  // Listener para cambios de orientación
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [visible, scaleAnim, opacityAnim]);

  const { toggleTheme } = useThemeStore();

  const { mode } = useThemeStore();

  const setLightTheme = () => {
    if (mode !== 'light') {
      useThemeStore.getState().toggleTheme();
    }
  };

  const setDarkTheme = () => {
    if (mode !== 'dark') {
      useThemeStore.getState().toggleTheme();
    }
  };

  const renderThemeButtons = () => {
    return (
      <View style={styles.themeContainer}>
        <Text style={[styles.themeLabel, { color: theme.colors?.text || '#000' }]}>Tema</Text>
        <View style={styles.themeButtons}>
          <Pressable
            onPress={setLightTheme}
            style={[
              styles.themeButton,
              {
                backgroundColor: mode === 'light' ? '#007AFF' : 'transparent',
                borderColor: theme.colors?.border || '#ccc',
              }
            ]}
          >
            <Ionicons
              name="sunny-outline"
              size={20}
              color={mode === 'light' ? '#fff' : (theme.colors?.text || '#000')}
            />
          </Pressable>
          <Pressable
            onPress={setDarkTheme}
            style={[
              styles.themeButton,
              {
                backgroundColor: mode === 'dark' ? '#007AFF' : 'transparent',
                borderColor: theme.colors?.border || '#ccc',
              }
            ]}
          >
            <Ionicons
              name="moon-outline"
              size={20}
              color={mode === 'dark' ? '#fff' : (theme.colors?.text || '#000')}
            />
          </Pressable>
        </View>
      </View>
    );
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    const textStyle = {
      color: theme.colors.text,
      fontWeight: "500" as const,
    };

    // Si es un item de tema, no lo renderizamos aquí
    if (item.label === "Tema" || item.label === "Theme" || item.label === "Tema Oscuro" || item.label === "Dark Theme" || item.label === "Tema Claro" || item.label === "Light Theme") {
      return null;
    }

    const getIcon = () => {
      if (item.label === "Configuración" || item.label === "Settings") {
        return "settings-outline";
      }
      if (item.label === "Cerrar sesión" || item.label === "Log Out") {
        return "log-out-outline";
      }
      return item.icon;
    };

    const iconName = getIcon();

    return (
      <Pressable
        key={index}
        onPress={() => {
          if (item.label === "Configuración" || item.label === "Settings") {
            setTimeout(() => {
              onClose();
              navigation?.navigate('Settings');
            }, 100);
          } else {
            setTimeout(() => {
              onClose();
              item.onPress();
            }, 100);
          }
        }}
        style={({ pressed }) => [
          styles.menuItem,
          {
            backgroundColor: pressed ? theme.colors.card + "22" : "transparent",
          },
        ]}
      >
        <View style={styles.menuItemContent}>
          <Text style={[styles.menuItemText, textStyle]}>{item.label}</Text>
          {iconName && (
            <Ionicons
              name={iconName as any}
              size={20}
              color={theme.colors.text}
            />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      animationType="none" // Deshabilitar la animación del Modal, la manejamos nosotros
    >
      {/* Área de superposición para cerrar el menú al tocar fuera */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          {/* El contenedor del menú ahora se desliza desde la derecha */}
          <Animated.View
            style={[
              styles.menuContainer,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                width: menuWidth,
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Aquí puedes agregar un título o logo del menú si quieres */}
            <View
              style={[
                styles.menuHeader,
                { borderBottomColor: theme.colors.border },
              ]}
            >
              <Pressable
                style={styles.profileContainer}
                onPress={() => {
                  onClose();
                  navigation?.navigate('Profile');
                }}
              >
                <View style={styles.profileImage}>
                  {userProfileImage ? (
                    <Image
                      source={{ uri: userProfileImage }}
                      style={{
                        width: "100%",
                        height: "100%",
                        borderRadius: 20,
                      }}
                    />
                  ) : (
                    <Text style={styles.defaultProfileIcon}>👤</Text>
                  )}
                </View>
                <View style={styles.userInfo}>
                  <Text
                    style={[styles.menuTitle, { color: theme.colors.text }]}
                  >
                    {userName || "Usuario"}
                  </Text>
                  <Text
                    style={[styles.menuSubtitle, { color: theme.colors.text }]}
                  >
                    {userEmail || "example@mail.com"}
                  </Text>
                </View>
              </Pressable>
            </View>

            {/* Renderizar botones de tema */}
            {renderThemeButtons()}
            
            {/* Renderizar los items */}
            {items.map(renderMenuItem)}
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 1000,
  },
  menuContainer: {
    maxHeight: "90%",
    minHeight: 250,
    position: "absolute",
    top: '3%',
    right: '2%',
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1001,
  },
  menuHeader: {
    padding: '4%',
    borderBottomWidth: 1,
    marginBottom: 8,
    paddingTop: '8%',
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    opacity: 0.6,
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 2,
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuItemText: {
    fontSize: 14,
    flex: 1,
    fontWeight: "500",
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: "#f0f0f0",
  },
  userInfo: {
    flex: 1,
  },
  defaultProfileIcon: {
    fontSize: 24,
    color: "#757575",
    textAlign: "center",
    lineHeight: 40, // Mismo que el height del profileImage
  },
  themeContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginVertical: 2,
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  themeButtons: {
    flexDirection: "row",
    gap: 8,
  },
  themeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
