// src/screens/UploadRemitoScreen.tsx
import React, { useState } from 'react';
import { View, Button, Image, ActivityIndicator, Alert, StyleSheet, Text, SafeAreaView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { uploadRemitoFile } from '../api'; 
import { useBranch } from '../stores/branch'; 
import { useThemeStore } from '../stores/themeProviders';

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

  const selectFile = async () => {
    try {
      // En: src/screens/UploadRemitoScreen.tsx

    const result = await DocumentPicker.getDocumentAsync({
      // 👇 Limitamos solo a los formatos que Tesseract soporta
      type: ['image/png', 'image/jpeg', 'application/pdf'], 
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

    if (!branchId) {
      Alert.alert("Error", "No se ha seleccionado una sucursal.");
      return;
    }

    setIsLoading(true);

    try {
      // --- 👇 CAMBIO 1: Capturamos la respuesta ---
      // La API nos devuelve el objeto del remito que se creó (incluyendo su ID)
      const newDigitalizedRemito = await uploadRemitoFile(selectedFile, branchId); 

      // Verificación por si la API no devuelve lo esperado
      if (!newDigitalizedRemito || !newDigitalizedRemito.id) {
        throw new Error("La API no devolvió un ID para el remito procesado.");
      }

      // Limpiamos el estado
      setSelectedFile(null);

      // --- 👇 CAMBIO 2: Navegamos directo a la Validación ---
      // Reemplazamos la Alerta de "Éxito"
      navigation.navigate('Validation', { 
        remitoId: newDigitalizedRemito.id 
      });
      // --- FIN DE LOS CAMBIOS ---

    } catch (error) {
      console.error(JSON.stringify(error, null, 2));
      Alert.alert('Error', 'No se pudo subir el archivo. Revisa tu conexión y la URL de la API.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <View style={styles.container}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Digitalizar Remito Externo</Text>
        
        {selectedFile && selectedFile.mimeType?.startsWith('image/') ? (
          <Image source={{ uri: selectedFile.uri }} style={styles.image} />
        ) : selectedFile ? (
          <View style={[styles.filePreview, { backgroundColor: theme.colors.inputBackground }]}>
            <Text style={{ color: theme.colors.text }}>Archivo seleccionado:</Text>
            <Text style={[styles.fileName, { color: theme.colors.text }]}>{selectedFile.name}</Text>
          </View>
        ) : (
          <View style={[styles.image, styles.imagePlaceholder, { borderColor: theme.colors.border }]}>
            <Text style={{ color: theme.colors.textMuted }}>Selecciona un archivo para previsualizar</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Button 
            title="Seleccionar Archivo (Imagen/PDF)" 
            onPress={selectFile} 
            color={theme.colors.primary}
          />
          <View style={{ height: 16 }} />
          
          {isLoading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={styles.loader} />
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
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20, 
    gap: 20 
  },
  title: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    marginBottom: 20,
    textAlign: 'center',
  },
  image: { 
    width: '100%', 
    height: 300, 
    resizeMode: 'contain', 
    marginVertical: 20, 
    borderWidth: 1, 
    borderRadius: 8,
  },
  imagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9f9f9'
  },
  filePreview: { 
    marginVertical: 20, 
    alignItems: 'center', 
    padding: 20, 
    borderRadius: 8, 
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },
  fileName: { 
    fontWeight: 'bold', 
    marginTop: 8,
    fontSize: 16
  },
  actions: {
    width: '100%',
    paddingHorizontal: 20,
  },
  loader: { 
    marginTop: 12,
    height: 40
  }
});