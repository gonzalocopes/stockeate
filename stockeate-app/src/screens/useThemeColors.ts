// src/hooks/useThemeColors.ts

export const lightColors = {
  background: "#f3f4f6",
  card: "#ffffff",
  text: "#111827",
  textSecondary: "#374151",
  textMuted: "#6b7280",
  border: "#e5e7eb",
  primary: "#3b82f6",
  success: "#10b981",
  danger: "rgb(195, 12, 12)",
  neutral: "#6b7280",
  inputBackground: "#ffffff",
  inputBorder: "#cbd5e1",
  headerIcon: "#1c1c1e",
  escanear: "#10b981",

  // --- 👇 COLORES AÑADIDOS ---
  digitalizar: '#166534', // Verde oscuro
  warning: '#ffc107',     // Amarillo
  info: '#0ea5e9',         // Azul medio
  textOnPrimary: '#FFFFFF', // Texto sobre color primario (ej: blanco)
  textOnWarning: '#212529', // Texto sobre color warning (ej: negro/gris oscuro)
};

export const darkColors = {
  background: "#1c1c1e",
  card: "#2c2c2e",
  text: "#ffffff",
  textSecondary: "#e5e7eb",
  textMuted: "#9ca3af",
  border: "#374151",
  primary: "#3b82f6",
  success: "#10b981",
  danger: "rgb(220, 38, 38)",
  neutral: "#6b7280",
  inputBackground: "#373b42ff",
  inputBorder: "#4b5563",
  headerIcon: "#ffffff",
  escanear: "#10b981",

  // --- 👇 COLORES AÑADIDOS ---
  digitalizar: '#16a34a', // Verde (versión dark)
  warning: '#facc15',     // Amarillo (versión dark)
  info: '#38bdf8',         // Azul claro (versión dark)
  textOnPrimary: '#FFFFFF', // Texto sobre color primario
  textOnWarning: '#212529', // Texto sobre color warning
};

export const themes = {
    light: {
        colors: lightColors,
    },
    dark: {
        colors: darkColors,
    },
};

// Ejemplo de cómo podrías usarlo en un StyleSheet
/*
import { StyleSheet } from 'react-native';
import { ColorPalette } from './path/to/useThemeColors';

export const getStyles = (colors: ColorPalette) => {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    button: {
      backgroundColor: colors.primary,
      padding: 12,
      borderRadius: 8,
    },
    buttonText: {
      color: 'white',
      textAlign: 'center',
    }
  });
}
*/