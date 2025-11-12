// src/screens/UploadRemitoScreen.tsx
import React, { useState } from 'react';
import { View, Button, Image, ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
// 👇 1. Usamos la función centralizada y el hook del store
import { uploadRemitoFile } from '../api'; 
import { useBranch } from '../stores/branch'; 

type SelectedFile = {
  uri: string;
  name: string;
  mimeType?: string;
};

export const UploadRemitoScreen = () => {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // 👇 2. Obtenemos el ID real de la sucursal activa
  const branchId = useBranch((s) => s.id);

  const selectFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
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

    // 👇 3. Validación: no podemos subir sin sucursal
    if (!branchId) {
      Alert.alert("Error", "No se ha seleccionado una sucursal. Vuelve al menú principal.");
      return;
    }

    setIsLoading(true);

    try {
      // 👇 4. Llamada limpia a la API
      await uploadRemitoFile(selectedFile, branchId);

      Alert.alert('Éxito', 'El archivo se subió y está en procesamiento.');
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo subir el archivo. Revisa tu conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Digitalizar Remito Externo</Text>
      <Button title="Seleccionar Archivo (Imagen/PDF)" onPress={selectFile} />

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