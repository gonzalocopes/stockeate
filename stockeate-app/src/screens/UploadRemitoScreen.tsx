// src/screens/UploadRemitoScreen.tsx
import React, { useState } from 'react';
import { View, Button, Image, ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';
// CAMBIO 1: Importamos DocumentPicker en lugar de ImagePicker
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';

// CAMBIO 2: Creamos un tipo para el archivo seleccionado para más claridad
type SelectedFile = {
  uri: string;
  name: string;
  mimeType?: string;
};

export const UploadRemitoScreen = () => {
  // CAMBIO 3: Cambiamos el estado para guardar un objeto de archivo, no solo la URI
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const selectFile = async () => {
    try {
      // CAMBIO 4: Usamos getDocumentAsync para abrir el selector de archivos del sistema
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'], // Permite seleccionar imágenes o PDFs
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

  const handleUpload = async () => {
        if (!selectedFile) return;
        setIsLoading(true);

        const formData = new FormData();
        formData.append('file', {
          uri: selectedFile.uri,
          name: selectedFile.name,
          type: selectedFile.mimeType || 'application/octet-stream',
        } as any);

        const currentBranchId = 'e33d3459-7254-4944-abfc-c8c7b328a312'; // <-- Reemplaza esto
        formData.append('branchId', currentBranchId);

        try {
          // --- ESTA ES LA PARTE IMPORTANTE ---
          // 1. Ponemos la URL completa de ngrok aquí. ¡USA LA MÁS RECIENTE!
          const ngrokUrl = 'https://bedec05d1690.ngrok-free.app';
          
          // 2. Creamos la URL final a mano
          const fullApiUrl = `${ngrokUrl}/digitalized-remito/upload`;

          console.log('HACIENDO PETICIÓN DIRECTA A:', fullApiUrl);

          // 3. Usamos axios.post directamente, NO la función de api.ts
          await axios.post(fullApiUrl, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
              'ngrok-skip-browser-warning': 'true',
            },
          });
          // --- FIN DE LA PARTE IMPORTANTE ---

          Alert.alert('Éxito', '¡El archivo se subió!');
          setSelectedFile(null);
        } catch (error) {
          console.error(JSON.stringify(error, null, 2));
          Alert.alert('Error', 'Falló la petición directa. Revisa la consola.');
        } finally {
          setIsLoading(false);
        }
      };

  return (
    <View style={styles.container}>
      {/* CAMBIO 5: Actualizamos los textos */}
      <Text style={styles.title}>Digitalizar Archivo Externo</Text>
      <Button title="Seleccionar Archivo (Imagen/PDF)" onPress={selectFile} />

      {/* Mostramos una vista previa si es una imagen, o el nombre del archivo si no lo es */}
      {selectedFile && selectedFile.mimeType?.startsWith('image/') ? (
        <Image source={{ uri: selectedFile.uri }} style={styles.image} />
      ) : selectedFile ? (
        <View style={styles.filePreview}>
          <Text>Archivo seleccionado:</Text>
          <Text style={styles.fileName}>{selectedFile.name}</Text>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" style={styles.loader} />
      ) : (
        <Button title="Subir y Procesar" onPress={handleUpload} disabled={!selectedFile || isLoading} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  image: { width: 300, height: 300, resizeMode: 'contain', marginVertical: 20, borderWidth: 1, borderColor: '#ccc' },
  filePreview: { marginVertical: 20, alignItems: 'center', backgroundColor: '#f0f0f0', padding: 15, borderRadius: 8 },
  fileName: { fontWeight: 'bold', marginTop: 5 },
  loader: { marginTop: 20 }
});