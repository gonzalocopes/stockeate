import React from "react";
import { View, Text, Button, Alert } from "react-native";
import * as Sharing from "expo-sharing";
import RemitoQR from "../components/RemitoQR";

export default function RemitoResult({ route }: any) {
  const { number, pdfPath, qrData } = route.params;
  return (
    <View style={{ flex:1, padding:16, gap:12 }}>
      <Text style={{ fontSize:18, fontWeight:"600" }}>Remito {number}</Text>
      <Button title="Ver / Compartir PDF" onPress={async ()=>{
        try { await Sharing.shareAsync(pdfPath); } catch (e:any) { Alert.alert("Error", String(e)); }
      }} />
      <RemitoQR data={qrData} />
    </View>
  );
}
