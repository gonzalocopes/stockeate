// src/screens/Home.tsx
import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { useAuth } from "../stores/auth";
import DropdownMenu from "../components/DropdownMenu";
import { useThemeStore } from "../stores/themeProviders";

import HamburgerMenu from "../components/HamburgerMenu"; // 👈 Importar el nuevo componente

export default function Home({ navigation }: any) {
  const { theme, toggleTheme } = useThemeStore();
  const logout = useAuth((s) => s.logout);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate("BranchSelect")}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 8,
            marginLeft: 0,
          }}
          activeOpacity={0.8}
        >
          <Image
            source={require("../../node_modules/@react-navigation/elements/lib/module/assets/back-icon.png")}
            // Se usa theme.colors.headerIcon para el color de la flecha
            style={{ width: 24, height: 24, tintColor: theme.colors.headerIcon }}
          />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setMenuVisible(true)}
          style={styles.menuButton}
          activeOpacity={0.8}
        >
          {/* El color del texto en el header se define en el StyleSheet, que también se actualizará */}
          <Text style={[styles.menuButtonText, { color: theme.colors.headerIcon }]}>≡</Text>
        </TouchableOpacity>
      ),
      title: "Menú",
    });
  }, [navigation, theme.colors.headerIcon]); // Asegurar que useEffect se re-ejecute si el color del ícono del header cambia por el tema.

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, padding: 16, paddingBottom: 90 }}>
        {/* Card de productos con stock bajo */}
        <View
          style={{
            backgroundColor: theme.colors.card, // Color de fondo de la card
            borderRadius: 12,
            paddingVertical: 16,
            paddingHorizontal: 16,
            marginBottom: 20,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 5,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                // Color de fondo para el ícono de advertencia (se mantiene hardcodeado si no hay un color específico en el tema)
                backgroundColor: "#fef3c7",
                borderRadius: 8,
                padding: 8,
                marginRight: 12,
              }}
            >
              <Text style={{ fontSize: 20, padding: 6 }}>⚠️</Text>
            </View>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: "500" }}>
              Productos con stock bajo:
            </Text>
          </View>
          <Text style={{ color: theme.colors.text, fontSize: 32, fontWeight: "700" }}>
            2
          </Text>
        </View>

        {/* Grilla 2x2 */}
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: "row", gap: 16 }}>
            {/* Escanear */}
            <TouchableOpacity
              style={{
                flex: 1,
                height: 140,
                backgroundColor: theme.colors.escanear, // Usando theme.colors.escanear
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
                transform: [{ scale: 1 }],
              }}
              onPress={() => navigation.navigate("ScanAdd")}
              activeOpacity={0.7}
              pressRetentionOffset={{
                top: 10,
                left: 10,
                right: 10,
                bottom: 10,
              }}
            >
              <View
                style={{
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                {/* El color del texto del ícono se mantiene blanco para contrastar con el fondo. */}
                <Text style={{ color: "#ffffff", fontSize: 32 }}>📷</Text>
              </View>
              <Text
                style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}
              >
                Escanear
              </Text>
            </TouchableOpacity>

            {/* Crear Remito */}
            <TouchableOpacity
              style={{
                flex: 1,
                height: 140,
                backgroundColor: theme.colors.primary, // Usando theme.colors.primary
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOpacity: 0.15,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 4,
                transform: [{ scale: 1 }],
              }}
              onPress={() => navigation.navigate("RemitosHub")}
              activeOpacity={0.7}
              pressRetentionOffset={{
                top: 10,
                left: 10,
                right: 10,
                bottom: 10,
              }}
            >
              <View
                style={{
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                }}
              >
                {/* El color del texto del ícono se mantiene blanco para contrastar con el fondo. */}
                <Text style={{ color: "#ffffff", fontSize: 32 }}>📄</Text>
              </View>
              <Text
                style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}
              >
                Crear Remito
              </Text>
            </TouchableOpacity>
          </View>

          {/* Ver Inventario (ancho completo) */}
          <TouchableOpacity
            style={{
              width: "100%",
              height: 140,
              backgroundColor: theme.colors.neutral, // Usando theme.colors.neutral
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              transform: [{ scale: 1 }],
            }}
            onPress={() => navigation.navigate("BranchProducts")}
            activeOpacity={0.7}
            pressRetentionOffset={{ top: 10, left: 10, right: 10, bottom: 10 }}
          >
            <View
              style={{
                borderRadius: 12,
                padding: 12,
                marginBottom: 8,
              }}
            >
              {/* El color del texto del ícono se mantiene blanco para contrastar con el fondo. */}
              <Text style={{ color: "#ffffff", fontSize: 32 }}>🔍</Text>
            </View>
            <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "600" }}>
              Ver Inventario
            </Text>
          </TouchableOpacity>

          {/* Transferir Stock (comentado) - Mantenido como estaba */}
          {/* ... */}
        </View>
      </View>

      {/* Footer hardcodeado */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 70,
          backgroundColor: theme.colors.inputBackground, // Fondo del footer
          borderTopWidth: 1,
          borderTopColor: theme.colors.border, // Borde superior del footer
          flexDirection: "row",
          justifyContent: "space-evenly",
          alignItems: "center",
          shadowColor: "#000",
          shadowOpacity: 0.1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
          elevation: 8,
        }}
      >
        {/* Botón Menú (Activo) */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Home")}
          style={{ alignItems: "center", gap: 4 }}
          activeOpacity={0.6}
        >
          <View
            style={{
              backgroundColor: theme.colors.inputBorder, // Fondo del ícono activo
              borderRadius: 8,
              padding: 6,
            }}
          >
            <Text style={{ fontSize: 18, color: theme.colors.headerIcon }}>🏠</Text>
          </View>
          <Text style={{ color: theme.colors.text, fontWeight: "600", fontSize: 12 }}>
            Menú
          </Text>
        </TouchableOpacity>

        {/* Ícono Perfil (Inactivo/Neutral) */}
        <View style={{ alignItems: "center", gap: 4 }}>
          <View
            style={{
              backgroundColor: theme.colors.inputBorder, // Fondo del ícono
              borderRadius: 8,
              padding: 6,
            }}
          >
            {/* Color para ícono inactivo, se usa textMuted como referencia. El emoji color se mantiene por defecto. */}
            <Text style={{ fontSize: 18, color: theme.colors.textMuted }}>👤</Text>
          </View>
          <Text style={{ color: theme.colors.text, fontWeight: "600", fontSize: 12 }}>
            Perfil
          </Text>
        </View>
      </View>
{/* -------------------- Uso del componente HamburgerMenu -------------------- */}
      <HamburgerMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)} // Cierra el menú
        items={[
          {
            label: 'Tema Oscuro',
            onPress: toggleTheme,
          },
          {
            label: 'Configuración',
            onPress: () => alert('Navegar a Configuración'),
          },
          {
            label: 'Cerrar sesión',
            onPress: logout,
            isDestructive: true, // Esto le dará un fondo rojo
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    marginRight: 10,
    padding: 10,
  },
  // Se remueve el color hardcodeado para que se aplique el estilo dinámico en el componente
  menuButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});