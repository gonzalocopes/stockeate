// src/screens/UploadRemitoScreen.tsx
import React, { useState } from "react";
import {
  View,
  Button,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  SafeAreaView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { uploadRemitoFile } from "../api";
import { useBranch } from "../stores/branch";
import { useThemeStore } from "../stores/themeProviders";

type SelectedFile = {
  uri: string;
  name: string;
  type?: string; // 👈 importante para el FormData
};

export default function UploadRemitoScreen({ navigation }: any) {
  const { theme } = useThemeStore();
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const branchId = useBranch((s) => s.id);

  // -------- Seleccionar PDF / Imagen desde archivos --------
  const selectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/png", "image/jpeg", "application/pdf"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name ?? "remito",
          type: asset.mimeType ?? "application/octet-stream",
        });
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo seleccionar el archivo.");
      console.error("Error en selectFile:", error);
    }
  };

  // -------- Sacar foto con la cámara --------
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso denegado",
          "Necesitamos acceso a la cámara para sacar la foto del remito."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: "foto-remito.jpg",
          type: "image/jpeg",
        });
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo usar la cámara.");
      console.error("Error en takePhoto:", error);
    }
  };

  // -------- Subir y procesar --------
  const handleUpload = async () => {
    if (!selectedFile) return;

    if (!branchId) {
      Alert.alert("Error", "No se ha seleccionado una sucursal.");
      return;
    }

    setIsLoading(true);

    try {
      console.log(
        "[Upload] Enviando archivo:",
        selectedFile,
        "branch:",
        branchId
      );

      const newDigitalizedRemito = await uploadRemitoFile(
        {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.type,
        },
        branchId
      );

      if (!newDigitalizedRemito || !newDigitalizedRemito.id) {
        throw new Error("La API no devolvió un ID para el remito procesado.");
      }

      setSelectedFile(null);

      // Navegar directo a la pantalla de validación
      navigation.navigate("Validation", {
        remitoId: newDigitalizedRemito.id,
      });
    } catch (error: any) {
      console.error("Error en handleUpload:", error);
      Alert.alert(
        "Error",
        "No se pudo subir el archivo. Revisa tu conexión y la URL de la API."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // -------- UI --------
  const isImage = selectedFile?.type?.startsWith("image/");

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Digitalizar Remito Externo
        </Text>

        {selectedFile && isImage ? (
          <Image source={{ uri: selectedFile.uri }} style={styles.image} />
        ) : selectedFile ? (
          <View
            style={[
              styles.filePreview,
              { backgroundColor: theme.colors.inputBackground },
            ]}
          >
            <Text style={{ color: theme.colors.text }}>
              Archivo seleccionado:
            </Text>
            <Text style={[styles.fileName, { color: theme.colors.text }]}>
              {selectedFile.name}
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.image,
              styles.imagePlaceholder,
              { borderColor: theme.colors.border },
            ]}
          >
            <Text style={{ color: theme.colors.textMuted }}>
              Selecciona un archivo o saca una foto para previsualizar
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Button
            title="Seleccionar Imagen"
            onPress={selectFile}
            color={theme.colors.primary}
          />
          <View style={{ height: 8 }} />
          <Button
            title="Sacar foto del remito"
            onPress={takePhoto}
            color={theme.colors.primary}
          />
          <View style={{ height: 16 }} />

          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={theme.colors.primary}
              style={styles.loader}
            />
          ) : (
            <Button
              title="Subir y Procesar"
              onPress={handleUpload}
              disabled={!selectedFile || isLoading}
              color={theme.colors.success}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  image: {
    width: "100%",
    height: 300,
    resizeMode: "contain",
    marginVertical: 20,
    borderWidth: 1,
    borderRadius: 8,
  },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  filePreview: {
    marginVertical: 20,
    alignItems: "center",
    padding: 20,
    borderRadius: 8,
    width: "100%",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  fileName: {
    fontWeight: "bold",
    marginTop: 8,
    fontSize: 16,
  },
  actions: {
    width: "100%",
    paddingHorizontal: 20,
  },
  loader: {
    marginTop: 12,
    height: 40,
  },
});
