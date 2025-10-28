// src/components/HamburgerMenu.tsx

import React, { useRef, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  Dimensions, // Para obtener el ancho de la pantalla
  Platform, // Mantener por si necesitas ajustes futuros específicos de plataforma
  Animated, // Importar Animated
  Pressable, // Importar Pressable
} from "react-native";

// NOTA: Asegúrate de que esta ruta a tu store de temas sea correcta
import { useThemeStore } from "../stores/themeProviders";

// --- Definición de tipos (se mantiene igual) ---
type MenuItem = {
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
};

type HamburgerMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
};

// Obtenemos el ancho de la pantalla una vez
const screenWidth = Dimensions.get("window").width;
// Define cuánto quieres que el menú cubra, por ejemplo, el 70% del ancho
const menuWidth = screenWidth * 0.7;

export default function HamburgerMenu({
  visible,
  onClose,
  items,
}: HamburgerMenuProps) {
  const { theme } = useThemeStore();
  const slideAnim = useRef(new Animated.Value(menuWidth)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0, // Desliza a la posición original (0)
        duration: 500, // Duración de la animación
        useNativeDriver: true, // Usa el driver nativo para mejor rendimiento
      }).start();
    } else {
      slideAnim.setValue(menuWidth)
      Animated.timing(slideAnim, {
        toValue: menuWidth, // Desliza fuera de la pantalla
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim, menuWidth]);

  const renderMenuItem = (item: MenuItem, index: number) => {
    const textStyle = {
      color: theme.colors.text,
      fontWeight: "500" as const,
    };

    return (
      <Pressable
        key={index}
        onPress={() => {
          setTimeout(() => {
            onClose();
            item.onPress();
          }, 100);
        }}
        style={({ pressed }) => [
          styles.menuItem,
          {
            backgroundColor: pressed
              ? item.isDestructive
                ? "transparent"
                : theme.colors.card + "aa" // Un poco más oscuro o transparente
              : item.isDestructive
              ? "transparent"
              : theme.colors.card,
          },
        ]}
      >
        <Text style={[styles.menuItemText, textStyle]}>{item.label}</Text>
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
              // Usar Animated.View
              styles.menuContainer,
              {
                backgroundColor: theme.colors.card,
                borderColor: theme.colors.border,
                width: menuWidth, // Usamos el ancho calculado
                transform: [{ translateX: slideAnim }], // Aplicar la animación
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
              <Text style={[styles.menuTitle, { color: theme.colors.text }]}>
                Menú Principal
              </Text>
            </View>

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
    backgroundColor: "rgba(0, 0, 0, 0.5)", // Fondo semi-transparente
    justifyContent: "flex-end", // Alinea el menú al final del contenedor (derecha)
    flexDirection: "row", // Permite que el menú se posicione a la derecha
    zIndex: 1000, // Asegura que el overlay esté encima de otros componentes
  },
  menuContainer: {
    // CLAVE PARA EL POSICIONAMIENTO DE CAJÓN LATERAL
    // No usamos 'absolute' aquí, el 'flexDirection: row' en overlay y 'width' en menuContainer lo logran
    height: "100%", // Cubre toda la altura
    // El 'width' se establecerá dinámicamente
    // backgroundColor y borderColor se pasan como estilo inline
    borderRadius: 0, // Eliminar bordes redondeados si quieres que cubra la esquina
    borderLeftWidth: 1, // Un borde a la izquierda del menú
    overflow: "hidden",
    // Mantener sombra para un efecto de elevación
    shadowColor: "#000",
    shadowOffset: { width: -2, height: 0 }, // Sombra a la izquierda del menú
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1001, // Asegura que el menú esté encima del overlay
  },
  menuHeader: {
    padding: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent", // Ya no queremos un borde entre items si el fondo es sólido
  },
  menuItemText: {
    fontSize: 16,
  },
});
