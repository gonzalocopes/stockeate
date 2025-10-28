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

  const handleSave = () => {
    setName(tempName);
    setEmail(tempEmail);
    setIsEditing(false);
    Alert.alert("Éxito", "Perfil actualizado correctamente");
  };

  const handleCancel = () => {
    setTempName(name);
    setTempEmail(email);
    setIsEditing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors?.background || '#f9f9f9' }]}>
      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: theme.colors?.card || '#fff' }]}>
          <View style={styles.profileImageContainer}>
            <Text style={styles.profileIcon}>👤</Text>
          </View>
          <Text style={[styles.profileTitle, { color: theme.colors?.text || '#000' }]}>
            Mi Perfil
          </Text>
        </View>

        {/* Profile Fields */}
        <View style={[styles.fieldsContainer, { backgroundColor: theme.colors?.card || '#fff' }]}>
          {/* Name Field */}
          <View style={styles.fieldItem}>
            <View style={styles.fieldHeader}>
              <Ionicons
                name="person-outline"
                size={20}
                color={theme.colors?.primary || '#007AFF'}
              />
              <Text style={[styles.fieldLabel, { color: theme.colors?.text || '#000' }]}>
                Nombre
              </Text>
            </View>
            {isEditing ? (
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors?.background || '#f5f5f5',
                    borderColor: theme.colors?.border || '#e0e0e0',
                    color: theme.colors?.text || '#000',
                  }
                ]}
                value={tempName}
                onChangeText={setTempName}
                placeholder="Ingresa tu nombre"
                placeholderTextColor={theme.colors?.text + '80' || '#999'}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: theme.colors?.text || '#000' }]}>
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
                color={theme.colors?.primary || '#007AFF'}
              />
              <Text style={[styles.fieldLabel, { color: theme.colors?.text || '#000' }]}>
                Email
              </Text>
            </View>
            {isEditing ? (
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors?.background || '#f5f5f5',
                    borderColor: theme.colors?.border || '#e0e0e0',
                    color: theme.colors?.text || '#000',
                  }
                ]}
                value={tempEmail}
                onChangeText={setTempEmail}
                placeholder="Ingresa tu email"
                placeholderTextColor={theme.colors?.text + '80' || '#999'}
                keyboardType="email-address"
              />
            ) : (
              <Text style={[styles.fieldValue, { color: theme.colors?.text || '#000' }]}>
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
                style={[styles.button, styles.cancelButton, { borderColor: theme.colors?.border || '#ccc' }]}
                onPress={handleCancel}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors?.text || '#666' }]}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.saveButton, { backgroundColor: theme.colors?.primary || '#007AFF' }]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Guardar</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.button, styles.editButton, { backgroundColor: theme.colors?.primary || '#007AFF' }]}
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
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  profileIcon: {
    fontSize: 40,
    color: "#757575",
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
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
  },
  textInput: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
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