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
  Platform,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { uploadRemitoFile } from "../api";
import { useBranch } from "../stores/branch";
import { useThemeStore } from "../stores/themeProviders";

type SelectedFile = {
  uri: string;
  name: string;
  mimeType?: string;
};

export default function UploadRemitoScreen({ navigation }: any) {
  const { theme } = useThemeStore();
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const branchId = useBranch((s) => s.id);

  // ------------ Seleccionar archivo (imagen o PDF) ------------
  const selectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/png", "image/jpeg", "application/pdf"],
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType,
        });
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo seleccionar el archivo.");
      console.error(error);
    }
  };

  // ------------ Sacar foto con la cámara ------------
  const takePhoto = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Cámara no disponible", "En la versión web no se puede usar la cámara.");
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso denegado",
          "Necesitamos acceso a la cámara para tomar una foto del remito."
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        setSelectedFile({
          uri: asset.uri,
          name: asset.fileName ?? "foto-remito.jpg",
          mimeType: asset.type === "image" ? "image/jpeg" : undefined,
        });
      }
    } catch (error) {
      Alert.alert("Error", "No se pudo usar la cámara.");
      console.error(error);
    }
  };

  // ------------ Subir y procesar ------------
  const handleUpload = async () => {
    if (!selectedFile) return;

    if (!branchId) {
      Alert.alert("Error", "No se ha seleccionado una sucursal.");
      return;
    }

    setIsLoading(true);

    try {
      const newDigitalizedRemito = await uploadRemitoFile(selectedFile, branchId);

      if (!newDigitalizedRemito || !newDigitalizedRemito.id) {
        throw new Error("La API no devolvió un ID para el remito procesado.");
      }

      setSelectedFile(null);

      navigation.navigate("Validation", {
        remitoId: newDigitalizedRemito.id,
      });
    } catch (error) {
      console.error(JSON.stringify(error, null, 2));
      Alert.alert(
        "Error",
        "No se pudo subir el archivo. Revisa tu conexión y la URL de la API."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ------------ Render ------------
  const isImage = selectedFile?.mimeType?.startsWith("image/");

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
            <Text style={{ color: theme.colors.text }}>Archivo seleccionado:</Text>
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
              Selecciona un archivo o toma una foto para previsualizar
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Button
            title="Seleccionar Archivo (Imagen/PDF)"
            onPress={selectFile}
            color={theme.colors.primary}
          />

          {Platform.OS !== "web" && (
            <>
              <View style={{ height: 8 }} />
              <Button
                title="Sacar foto del remito"
                onPress={takePhoto}
                color={theme.colors.primary}
              />
            </>
          )}

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
