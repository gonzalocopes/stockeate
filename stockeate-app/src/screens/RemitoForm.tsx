import React, { useState } from "react";
import { View, TextInput, Button, Text, Alert } from "react-native";
import { useBatch } from "../stores/batch";
import { useBranch } from "../stores/branch";
import { DB } from "../db";
import { makeRemitoPDF } from "../utils/remito";

export default function RemitoForm({ navigation }: any) {
  const { asArray, clear } = useBatch();
  const branchId = useBranch((s) => s.branchId);
  const [customer, setCustomer] = useState("");
  const [notes, setNotes] = useState("");

  const items = asArray();
  const unidades = items.reduce((a,b)=>a+b.qty,0);

  const confirm = async () => {
    if (!items.length) return Alert.alert("Vacío", "No hay ítems en el lote.");
    const tmp = `TMP-REM-\${Math.random().toString(36).slice(2,10)}`;

    const remitoId = DB.insertRemito({ tmp_number: tmp, branch_id: branchId, customer, notes });
    for (const it of items) {
      DB.insertRemitoItem({ remito_id: remitoId, product_id: it.id, qty: it.qty, unit_price: it.unitPrice ?? 0 });
      DB.insertStockMove({ product_id: it.id, branch_id: branchId, qty: it.qty, type: "IN", ref: tmp });
      DB.incrementStock(it.id, it.qty);
    }

    const pdfPath = await makeRemitoPDF({
      numero: tmp,
      items: items.map(i=>({ code: i.code, name: i.name, qty: i.qty }))
    });
    const qrData = JSON.stringify({
      type: "remito", ver: 1, tmpNumber: tmp,
      items: items.map(i=>({ code: i.code, qty: i.qty, name: i.name })),
      totales: { unidades }
    });

    clear();
    navigation.replace("RemitoResult", { number: tmp, pdfPath, qrData });
  };

  return (
    <View style={{ padding:16, gap:8 }}>
      <Text>Cliente (opcional)</Text>
      <TextInput style={{ borderWidth:1, borderRadius:8, padding:8 }} value={customer} onChangeText={setCustomer} />
      <Text>Observaciones</Text>
      <TextInput style={{ borderWidth:1, borderRadius:8, padding:8 }} value={notes} onChangeText={setNotes} />
      <Text style={{ marginTop:8 }}>Ítems: {items.length} | Unidades: {unidades}</Text>
      <Button title="Confirmar y generar remito (PDF + QR)" onPress={confirm} />
    </View>
  );
}
