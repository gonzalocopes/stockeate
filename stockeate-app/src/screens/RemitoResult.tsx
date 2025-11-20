import React, { useEffect, useState } from 'react';
import { View, Text, Button, Platform, Alert } from 'react-native';
import RemitoQR from '../components/RemitoQR';
import * as Sharing from 'expo-sharing';
import { DB } from '../db';

export default function RemitoResult({ route }: any) {
  const params = route?.params ?? {};

  const remitoId: string | undefined = params.remitoId;
  // Aceptamos tmp, tmpNumber o tmp_number por compatibilidad
  const tmp: string | undefined = params.tmp ?? params.tmpNumber ?? params.tmp_number;

  const [pdfPath, setPdfPath] = useState<string | null>(params.pdfPath ?? null);

  // Si no tenemos pdfPath en los params, lo buscamos en la BD
  useEffect(() => {
    if (!remitoId) return;

    if (!pdfPath) {
      try {
        const r = DB.getRemitoById(remitoId);
        if (r?.pdf_path) {
          setPdfPath(r.pdf_path);
        }
      } catch (e) {
        console.log('No se pudo leer pdf_path del remito', e);
      }
    }
  }, [remitoId, pdfPath]);

  const qrData = { type: 'remito', remitoId, tmp };

  const handleOpenPdf = async () => {
    if (!pdfPath) {
      Alert.alert('PDF no disponible', 'Este remito todavía no tiene un PDF asociado.');
      return;
    }

    try {
      if (Platform.OS === 'web') {
        // En web intentamos abrir en una nueva pestaña
        window.open(pdfPath, '_blank');
      } else if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfPath);
      } else {
        Alert.alert(
          'No disponible',
          'En este dispositivo no se puede abrir o compartir el PDF.'
        );
      }
    } catch (e) {
      console.log('Error al abrir/compartir PDF', e);
      Alert.alert('Error', 'No se pudo abrir el PDF del remito.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
        Remito generado
      </Text>
      <Text>ID: {remitoId}</Text>
      <Text>Número: {tmp}</Text>

      <View style={{ marginVertical: 24 }}>
        <RemitoQR data={qrData} />
      </View>

      <Button title="Ver / Compartir PDF" onPress={handleOpenPdf} />
    </View>
  );
}
