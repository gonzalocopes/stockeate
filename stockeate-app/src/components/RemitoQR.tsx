import React from "react";
import { View, Text } from "react-native";
import QRCode from "react-native-qrcode-svg";

export default function RemitoQR({ data }:{ data:string }) {
  return (
    <View style={{ alignItems:"center", padding:16 }}>
      <QRCode value={data} size={240} />
      <Text style={{ marginTop:8, textAlign:"center" }}>
        Escaneá este QR con la app para ver el remito
      </Text>
    </View>
  );
}
