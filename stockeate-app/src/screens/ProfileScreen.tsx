// src/screens/ProfileScreen.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../stores/themeProviders";

export default function ProfileScreen({ navigation }: any) {
  const { theme } = useThemeStore();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("Usuario");
  const [email, setEmail] = useState("example@mail.com");
  const [tempName, setTempName] = useState(name);
  const [tempEmail, setTempEmail] = useState(email);

  // Helper para manejar placeholderTextColor cuando la variable de color no es una string simple
  const placeholderColor = theme.colors?.textMuted || '#999';

  const handleSave = () => {
    setName(tempName);
    setEmail(tempEmail);
    setIsEditing(false);
    Alert.alert("Éxito", "Perfil actualizado correctamente");
  };

  const handleCancel = () => {
    setTempName(name);
    setTempEmail(tempEmail);
    setIsEditing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: theme.colors.card }]}>
          <View style={[styles.profileImageContainer, { backgroundColor: theme.colors.inputBorder }]}>
            <Text style={[styles.profileIcon, { color: theme.colors.textMuted }]}>👤</Text>
          </View>
          <Text style={[styles.profileTitle, { color: theme.colors.text }]}>
            Mi Perfil
          </Text>
        </View>

        {/* Profile Fields */}
        <View style={[styles.fieldsContainer, { backgroundColor: theme.colors.card }]}>
          {/* Name Field */}
          <View style={styles.fieldItem}>
            <View style={styles.fieldHeader}>
              <Ionicons
                name="person-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
                Nombre
              </Text>
            </View>
            {isEditing ? (
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.text,
                  }
                ]}
                value={tempName}
                onChangeText={setTempName}
                placeholder="Ingresa tu nombre"
                placeholderTextColor={placeholderColor}
              />
            ) : (
              <Text 
                style={[
                  styles.fieldValue, 
                  { 
                    color: theme.colors.text,
                    backgroundColor: theme.colors.inputBackground, // Fondo para el campo de valor
                  }
                ]}
              >
                {name}
              </Text>
            )}
          </View>

          {/* Email Field */}
          <View style={styles.fieldItem}>
            <View style={styles.fieldHeader}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={theme.colors.primary}
              />
              <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
                Email
              </Text>
            </View>
            {isEditing ? (
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.text,
                  }
                ]}
                value={tempEmail}
                onChangeText={setTempEmail}
                placeholder="Ingresa tu email"
                placeholderTextColor={placeholderColor}
                keyboardType="email-address"
              />
            ) : (
              <Text 
                style={[
                  styles.fieldValue, 
                  { 
                    color: theme.colors.text,
                    backgroundColor: theme.colors.inputBackground, // Fondo para el campo de valor
                  }
                ]}
              >
                {email}
              </Text>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonsContainer}>
          {isEditing ? (
            <View style={styles.editButtons}>
              <Pressable
                style={[
                  styles.button, 
                  styles.cancelButton, 
                  { borderColor: theme.colors.border }
                ]}
                onPress={handleCancel}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.button, 
                  styles.saveButton, 
                  { backgroundColor: theme.colors.primary }
                ]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[
                styles.button, 
                styles.editButton, 
                { backgroundColor: theme.colors.primary }
              ]}
              onPress={() => setIsEditing(true)}
            >
              <Ionicons name="pencil-outline" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Editar Perfil</Text>
            </Pressable>
          )}
        </View>
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
    paddingTop: '3%',
  },
  profileHeader: {
    alignItems: "center",
    paddingVertical: '8%',
    marginHorizontal: '4%',
    marginBottom: '5%',
    borderRadius: 12,
  },
  profileImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    // backgroundColor: theme.colors.inputBorder, aplicado inline
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  profileIcon: {
    fontSize: 40,
    // color: theme.colors.textMuted, aplicado inline
  },
  profileTitle: {
    fontSize: 24,
    fontWeight: "600",
  },
  fieldsContainer: {
    marginHorizontal: '4%',
    borderRadius: 12,
    padding: '5%',
  },
  fieldItem: {
    marginBottom: 24,
  },
  fieldHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  fieldValue: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    // backgroundColor: theme.colors.inputBackground, aplicado inline
    borderRadius: 8,
  },
  textInput: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    // colores de fondo, borde y texto aplicados inline
  },
  buttonsContainer: {
    paddingHorizontal: '4%',
    paddingTop: '5%',
  },
  button: {
    paddingVertical: '4%',
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  editButton: {
    flexDirection: "row",
  },
  editButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  editButtons: {
    flexDirection: "row",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  saveButton: {
    flex: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});