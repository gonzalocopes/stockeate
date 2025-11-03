// src/screens/ProfileScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeStore } from "../stores/themeProviders";
import { updateProfile } from "../api";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function ProfileScreen({ navigation }: any) {
  const { theme } = useThemeStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // State para datos del usuario
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dni, setDni] = useState("");
  const [cuit, setCuit] = useState("");

  // State temporal para edición
  const [tempFirstName, setTempFirstName] = useState(firstName);
  const [tempLastName, setTempLastName] = useState(lastName);
  const [tempDni, setTempDni] = useState(dni);
  const [tempCuit, setTempCuit] = useState(cuit);

  // Cargar datos del usuario al montar
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        setFirstName(user.firstName || "");
        setLastName(user.lastName || "");
        setEmail(user.email || "");
        setDni(user.dni || "");
        setCuit(user.cuit || "");

        // Inicializar valores temporales
        setTempFirstName(user.firstName || "");
        setTempLastName(user.lastName || "");
        setTempDni(user.dni || "");
        setTempCuit(user.cuit || "");
      }
    } catch (error) {
      console.error("Error al cargar datos del usuario:", error);
    }
  };

  const handleSave = async () => {
    if (!tempFirstName.trim() || !tempLastName.trim()) {
      Alert.alert("Error", "El nombre y apellido son requeridos");
      return;
    }

    setIsLoading(true);
    try {
      const response = await updateProfile(
        tempFirstName,
        tempLastName,
        undefined,
        undefined,
        tempDni || undefined,
        tempCuit || undefined,
      );

      // Actualizar datos locales
      setFirstName(tempFirstName);
      setLastName(tempLastName);
      setDni(tempDni);
      setCuit(tempCuit);

      // Guardar en AsyncStorage
      await AsyncStorage.setItem(
        "user",
        JSON.stringify({
          ...response,
        }),
      );

      setIsEditing(false);
      Alert.alert("Éxito", "Perfil actualizado correctamente");
    } catch (error: any) {
      Alert.alert("Error", error.response?.data?.message || "Error al actualizar el perfil");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setTempFirstName(firstName);
    setTempLastName(lastName);
    setTempDni(dni);
    setTempCuit(cuit);
    setIsEditing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors?.background || "#f9f9f9" }]}>
      <ScrollView style={styles.scrollView}>
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: theme.colors?.card || "#fff" }]}>
          <View style={styles.profileImageContainer}>
            <Ionicons
              name="person-circle"
              size={80}
              color={theme.colors?.primary || "#007AFF"}
            />
          </View>
          <Text
            style={[styles.profileTitle, { color: theme.colors?.text || "#000" }]}
          >
            Hola {tempFirstName || "Usuario"}!
          </Text>
          <Text
            style={[styles.profileSubtitle, { color: theme.colors?.text + "80" || "#666" }]}
          >
            {email}
          </Text>
        </View>

        {/* Profile Fields */}
        <View style={[styles.fieldsContainer, { backgroundColor: theme.colors?.card || "#fff" }]}>
          {/* First Name Field */}
          <View style={styles.fieldItem}>
            <View style={styles.fieldHeader}>
              <Ionicons
                name="person-outline"
                size={20}
                color={theme.colors?.primary || "#007AFF"}
              />
              <Text style={[styles.fieldLabel, { color: theme.colors?.text || "#000" }]}>
                Nombre
              </Text>
            </View>
            {isEditing ? (
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors?.background || "#f5f5f5",
                    borderColor: theme.colors?.border || "#e0e0e0",
                    color: theme.colors?.text || "#000",
                  },
                ]}
                value={tempFirstName}
                onChangeText={setTempFirstName}
                placeholder="Ingresa tu nombre"
                placeholderTextColor={theme.colors?.text + "80" || "#999"}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: theme.colors?.text || "#000" }]}>
                {firstName || "-"}
              </Text>
            )}
          </View>

          {/* Last Name Field */}
          <View style={styles.fieldItem}>
            <View style={styles.fieldHeader}>
              <Ionicons
                name="person-outline"
                size={20}
                color={theme.colors?.primary || "#007AFF"}
              />
              <Text style={[styles.fieldLabel, { color: theme.colors?.text || "#000" }]}>
                Apellido
              </Text>
            </View>
            {isEditing ? (
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors?.background || "#f5f5f5",
                    borderColor: theme.colors?.border || "#e0e0e0",
                    color: theme.colors?.text || "#000",
                  },
                ]}
                value={tempLastName}
                onChangeText={setTempLastName}
                placeholder="Ingresa tu apellido"
                placeholderTextColor={theme.colors?.text + "80" || "#999"}
              />
            ) : (
              <Text style={[styles.fieldValue, { color: theme.colors?.text || "#000" }]}>
                {lastName || "-"}
              </Text>
            )}
          </View>

          {/* Email Field (Read-only) */}
          <View style={styles.fieldItem}>
            <View style={styles.fieldHeader}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={theme.colors?.primary || "#007AFF"}
              />
              <Text style={[styles.fieldLabel, { color: theme.colors?.text || "#000" }]}>
                Email
              </Text>
            </View>
            <Text style={[styles.fieldValue, { color: theme.colors?.text || "#000" }]}>
              {email}
            </Text>
          </View>

          {/* DNI Field */}
          <View style={styles.fieldItem}>
            <View style={styles.fieldHeader}>
              <Ionicons
                name="document-outline"
                size={20}
                color={theme.colors?.primary || "#007AFF"}
              />
              <Text style={[styles.fieldLabel, { color: theme.colors?.text || "#000" }]}>
                DNI
              </Text>
            </View>
            {isEditing ? (
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors?.background || "#f5f5f5",
                    borderColor: theme.colors?.border || "#e0e0e0",
                    color: theme.colors?.text || "#000",
                  },
                ]}
                value={tempDni}
                onChangeText={setTempDni}
                placeholder="Ingresa tu DNI"
                placeholderTextColor={theme.colors?.text + "80" || "#999"}
                keyboardType="numeric"
              />
            ) : (
              <Text style={[styles.fieldValue, { color: theme.colors?.text || "#000" }]}>
                {dni || "-"}
              </Text>
            )}
          </View>

          {/* CUIT Field */}
          <View style={styles.fieldItem}>
            <View style={styles.fieldHeader}>
              <Ionicons
                name="briefcase-outline"
                size={20}
                color={theme.colors?.primary || "#007AFF"}
              />
              <Text style={[styles.fieldLabel, { color: theme.colors?.text || "#000" }]}>
                CUIT
              </Text>
            </View>
            {isEditing ? (
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.colors?.background || "#f5f5f5",
                    borderColor: theme.colors?.border || "#e0e0e0",
                    color: theme.colors?.text || "#000",
                  },
                ]}
                value={tempCuit}
                onChangeText={setTempCuit}
                placeholder="Ingresa tu CUIT"
                placeholderTextColor={theme.colors?.text + "80" || "#999"}
                keyboardType="numeric"
              />
            ) : (
              <Text style={[styles.fieldValue, { color: theme.colors?.text || "#000" }]}>
                {cuit || "-"}
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
                  { borderColor: theme.colors?.border || "#ccc" },
                ]}
                onPress={handleCancel}
                disabled={isLoading}
              >
                <Text style={[styles.cancelButtonText, { color: theme.colors?.text || "#666" }]}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.button,
                  styles.saveButton,
                  { backgroundColor: theme.colors?.primary || "#007AFF" },
                  isLoading && { opacity: 0.6 },
                ]}
                onPress={handleSave}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Guardar</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[
                styles.button,
                styles.editButton,
                { backgroundColor: theme.colors?.primary || "#007AFF" },
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
  profileSubtitle: {
    fontSize: 14,
    marginTop: 8,
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