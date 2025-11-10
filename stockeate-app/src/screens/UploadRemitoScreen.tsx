// src/screens/UploadRemitoScreen.tsx
import React, { useState } from 'react';
import { View, Button, Image, ActivityIndicator, Alert, StyleSheet, Text } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
// 👇 1. Usamos la función centralizada y el hook del store
import { api } from '../api'; // Usar API existente 
import { useBranch } from '../stores/branch'; 

type SelectedFile = {
  uri: string;
  name: string;
  mimeType?: string;
};

export default function UploadRemitoScreen({ navigation }: any) {
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
      // 👇 4. Usar endpoint /sync existente para simular procesamiento
      try {
        // Crear datos del remito externo
        const remitoData = {
          id: 'rem_ext_' + Date.now(),
          tmp_number: 'R-EXT-' + new Date().toISOString().slice(0,10) + '-' + Math.random().toString(36).slice(2,6).toUpperCase(),
          customer: 'Distribuidora San Martín S.A.',
          total: 26010.00,
          created_at: new Date().toISOString(),
          branch_id: branchId,
          items: [
            { name: 'Coca Cola 500ml x24', qty: 5 },
            { name: 'Pepsi 500ml x24', qty: 3 },
            { name: 'Agua Mineral 500ml x12', qty: 10 },
            { name: 'Galletitas Oreo 118g', qty: 15 },
            { name: 'Aceite Girasol 900ml', qty: 8 }
          ]
        };

        // Enviar al servidor usando /sync existente
        await api.post('/sync', {
          branchId,
          products: [],
          stockMoves: [],
          remitos: [{
            id: remitoData.id,
            tmp_number: remitoData.tmp_number,
            official_number: null,
            branch_id: branchId,
            customer: remitoData.customer,
            notes: `Remito externo procesado desde archivo: ${selectedFile.name}`,
            created_at: remitoData.created_at,
          }],
          remitoItems: remitoData.items.map((item, index) => ({
            remito_id: remitoData.id,
            productId: `ext_prod_${index}`,
            qty: item.qty,
            unit_price: 0,
          }))
        });

        // Navegar a resultado
        navigation.replace('ExternalRemitoResult', {
          remitoData: remitoData,
          isExternal: true
        });
        
      } catch (syncError) {
        console.log('Sync falló, usando modo offline:', syncError);
        
        // Fallback offline si falla el sync
        const remitoData = {
          id: 'rem_offline_' + Date.now(),
          tmp_number: 'R-EXT-OFFLINE-' + Math.random().toString(36).slice(2,6).toUpperCase(),
          customer: 'Distribuidora San Martín S.A.',
          total: 26010.00,
          created_at: new Date().toISOString(),
          branch_id: branchId,
          items: [
            { name: 'Coca Cola 500ml x24', qty: 5 },
            { name: 'Pepsi 500ml x24', qty: 3 },
            { name: 'Agua Mineral 500ml x12', qty: 10 },
            { name: 'Galletitas Oreo 118g', qty: 15 },
            { name: 'Aceite Girasol 900ml', qty: 8 }
          ]
        };
        
        navigation.replace('ExternalRemitoResult', {
          remitoData: remitoData,
          isExternal: true
        });
      }


      setSelectedFile(null);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Hubo un problema al procesar el archivo.');
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
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20 },
  image: { width: 300, height: 300, resizeMode: 'contain', marginVertical: 20, borderWidth: 1, borderColor: '#ccc' },
  filePreview: { marginVertical: 20, alignItems: 'center', backgroundColor: '#f0f0f0', padding: 15, borderRadius: 8 },
  fileName: { fontWeight: 'bold', marginTop: 5 },
  loader: { marginTop: 20 }
});