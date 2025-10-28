// src/screens/SettingsScreen.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../stores/themeProviders";

export default function SettingsScreen({ navigation }: any) {
  const { theme } = useThemeStore();

  const settingsOptions = [
    {
      id: 1,
      title: "Cambiar Contraseña",
      subtitle: "Actualizar credenciales",
      icon: "key-outline",
      onPress: () => Alert.alert("Contraseña", "Función en desarrollo"),
    },
    {
      id: 2,
      title: "Limpiar Caché",
      subtitle: "Borrar datos temporales",
      icon: "trash-outline",
      onPress: () => Alert.alert("Caché", "¿Limpiar datos temporales?", [
        { text: "Cancelar", style: "cancel" },
        { text: "Limpiar", onPress: () => Alert.alert("Éxito", "Caché limpiado") }
      ]),
    },
    {
      id: 3,
      title: "Acerca de",
      subtitle: "Versión 1.0.1",
      icon: "information-circle-outline",
      onPress: () => Alert.alert("Stockeate", "Versión 1.0.1\nControl de Stock y Remitos"),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors?.background || '#f9f9f9' }]}>
      <ScrollView style={styles.scrollView}>
        {settingsOptions.map((option) => (
          <Pressable
            key={option.id}
            style={({ pressed }) => [
              styles.optionItem,
              {
                backgroundColor: pressed 
                  ? (theme.colors?.card || '#fff') + '88' 
                  : (theme.colors?.card || '#fff'),
                borderBottomColor: theme.colors?.border || '#e0e0e0',
              }
            ]}
            onPress={option.onPress}
          >
            <View style={styles.optionContent}>
              <Ionicons
                name={option.icon as any}
                size={24}
                color={theme.colors?.primary || '#007AFF'}
                style={styles.optionIcon}
              />
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, { color: theme.colors?.text || '#000' }]}>
                  {option.title}
                </Text>
                <Text style={[styles.optionSubtitle, { color: theme.colors?.text || '#666' }]}>
                  {option.subtitle}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward-outline"
                size={20}
                color={theme.colors?.text || '#999'}
              />
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingTop: 20,
  },
  optionItem: {
    paddingVertical: '4%',
    paddingHorizontal: '5%',
    borderBottomWidth: 1,
    marginHorizontal: '4%',
    marginVertical: '1%',
    borderRadius: 12,
  },
  optionContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  optionIcon: {
    marginRight: '4%',
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  optionSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
});