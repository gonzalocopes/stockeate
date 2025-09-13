import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Button } from "react-native";
import { BarCodeScanner } from "expo-barcode-scanner";
import { DB } from "../db";
import { useBatch } from "../stores/batch";
import { api } from "../api";
import { useBranch } from "../stores/branch";

export default function ScanAdd({ navigation }: any) {
  const [perm, setPerm] = useState<boolean | null>(null);
  const { addOrInc, asArray, inc, dec, remove } = useBatch();
  const branchId = useBranch((s) => s.branchId);

  useEffect(() => { (async () => { const { status } = await BarCodeScanner.requestPermissionsAsync(); setPerm(status === "granted"); })(); }, []);
  if (perm === null) return <Text>Pidiendo permiso</Text>;
  if (perm === false) return <Text>Sin permiso de cámara</Text>;

  const handleScan = async (code: string) => {
    let p = DB.getProductByCode(code);
    if (!p) {
      try {
        const r = await api.get(`/products/by-code/${encodeURIComponent(code)}`);
        p = DB.upsertProduct({ ...r.data, branch_id: r.data.branchId });
      } catch {
        p = DB.upsertProduct({ code, name: `Producto ${code}`, price: 0, stock: 0, branch_id: branchId });
      }
    }
    addOrInc({ id: p.id, code: p.code, name: p.name, unitPrice: p.price ?? 0 });
  };

  const items = asArray();
  return (
    <View style={{ flex:1 }}>
      <BarCodeScanner onBarCodeScanned={({ data }) => handleScan(data)} style={{ flex:1 }} />
      <View style={{ padding:12 }}>
        <Text style={{ fontWeight:"600" }}>Lote actual</Text>
        <FlatList
          data={items} keyExtractor={(i)=>i.id}
          renderItem={({item})=>(
            <View style={{ flexDirection:"row", justifyContent:"space-between", paddingVertical:6 }}>
              <Text>{item.name} x{item.qty}</Text>
              <View style={{ flexDirection:"row", gap:6 }}>
                <Button title="-" onPress={()=>dec(item.id)} />
                <Button title="+" onPress={()=>inc(item.id)} />
                <Button title="x" onPress={()=>remove(item.id)} />
              </View>
            </View>
          )}
        />
        <Button title="Formar remito" onPress={()=>navigation.navigate("RemitoForm")} />
      </View>
    </View>
  );
}
