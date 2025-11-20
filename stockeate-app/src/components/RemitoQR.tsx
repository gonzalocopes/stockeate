import React from 'react';
import QRCode from 'react-native-qrcode-svg';
import { View } from 'react-native';

export default function RemitoQR({ data, size = 180 }: { data: any; size?: number }) {
  // Evitar comillas: si es string, usar tal cual; si es objeto, serializar
  const payload = typeof data === 'string' ? data : JSON.stringify(data);
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <QRCode value={payload} size={size} />
    </View>
  );
}
