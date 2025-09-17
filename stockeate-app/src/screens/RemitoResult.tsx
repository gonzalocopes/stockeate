import React from 'react';
import { View, Text, Button, Platform } from 'react-native';
import RemitoQR from '../components/RemitoQR';
import * as Sharing from 'expo-sharing';

export default function RemitoResult({ route }: any) {
  const { remitoId, tmp, pdfPath } = route.params ?? {};

  const qrData = { type: 'remito', remitoId, tmp };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Remito generado</Text>
      <Text>ID: {remitoId}</Text>
      <Text>Número: {tmp}</Text>

      <RemitoQR data={qrData} />

      <Button
        title="Ver / Compartir PDF"
        onPress={async () => {
          if (Platform.OS === 'web') {
            if (pdfPath) window.open(pdfPath, '_blank');
          } else if (pdfPath && await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(pdfPath);
          } else {
            alert('No hay PDF disponible');
          }
        }}
      />
    </View>
  );
}
