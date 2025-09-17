import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useBatch } from '../stores/batch';
import { useBranch } from '../stores/branch';
import { DB } from '../db';
import { remitoHtml, tmpNumber } from '../utils/remito';

export default function RemitoForm({ navigation }: any) {
  const { items, clear } = useBatch();
  const branchId = useBranch(s => s.id);
  const [customer, setCustomer] = useState('');
  const [notes, setNotes] = useState('');

  const onCreate = async () => {
    if (!branchId) { Alert.alert('Elegí una sucursal primero'); return; }
    if (items.length === 0) { Alert.alert('No hay ítems en el lote'); return; }

    try {
      const tmp = tmpNumber();
      // 1) Crear remito
      const remitoId = DB.insertRemito({
        tmp_number: tmp,
        branch_id: branchId,
        customer,
        notes,
      });

      // 2) Guardar items + stock moves + actualizar stock
      for (const it of items) {
        DB.insertRemitoItem({
          remito_id: remitoId,
          product_id: it.product_id,
          qty: it.qty,
          unit_price: it.unit_price ?? 0,
        });
        DB.insertStockMove({
          product_id: it.product_id,
          branch_id: branchId,
          qty: it.qty,
          type: 'IN',
          ref: tmp,
        });
        DB.incrementStock(it.product_id, it.qty);
      }

      // 3) Generar PDF del remito
      const html = remitoHtml({
        remitoId,
        tmp,
        branchName: 'Sucursal seleccionada', // opcional: traer nombre si lo guardás
        customer,
        notes,
        items,
      });

      const file = await Print.printToFileAsync({ html });
      // (opcional) compartirlo
      if (Platform.OS !== 'web' && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri);
      }

      // 4) Guardar path del PDF (para verlo luego)
      if ((DB as any).setRemitoPdfPath) {
        (DB as any).setRemitoPdfPath(remitoId, file.uri);
      }

      // 5) Limpiar lote y mostrar resultado
      clear();
      navigation.replace('RemitoResult', { remitoId, tmp, pdfPath: file.uri });

    } catch (e: any) {
      console.error('REMITO_CREATE_FAIL', e?.message || e);
      Alert.alert('No pude generar el remito');
    }
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 18, fontWeight: '600' }}>Formar remito</Text>

      <Text>Cliente (opcional)</Text>
      <TextInput
        style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
        value={customer} onChangeText={setCustomer} placeholder="Nombre cliente"
      />

      <Text>Notas (opcional)</Text>
      <TextInput
        style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
        value={notes} onChangeText={setNotes} placeholder="Observaciones"
      />

      <Button title="Crear remito" onPress={onCreate} />
    </View>
  );
}
