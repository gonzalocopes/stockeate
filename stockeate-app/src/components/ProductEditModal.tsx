import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Button, TouchableOpacity, Platform } from 'react-native';

type Props = {
  visible: boolean;
  code: string | null;
  initialName?: string;
  initialPrice?: number;
  onCancel: () => void;
  onSave: (data: { name: string; price: number }) => void;
};

export default function ProductEditModal({
  visible,
  code,
  initialName = '',
  initialPrice = 0,
  onCancel,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName);
  const [priceStr, setPriceStr] = useState(String(initialPrice ?? 0));

  useEffect(() => {
    if (visible) {
      setName(initialName || (code ?? ''));
      setPriceStr(String(initialPrice ?? 0));
    }
  }, [visible, code, initialName, initialPrice]);

  const handleSave = () => {
    const p = parseFloat((priceStr || '0').replace(',', '.'));
    if (!name.trim()) {
      alert('Ingresá un nombre');
      return;
    }
    if (isNaN(p) || p < 0) {
      alert('Precio inválido');
      return;
    }
    onSave({ name: name.trim(), price: p });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: '#0006', justifyContent: 'flex-end' }}>
        <View
          style={{
            backgroundColor: 'white',
            padding: 16,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700' }}>
            Nuevo producto {code ? `(${code})` : ''}
          </Text>

          <Text>Nombre</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nombre del producto"
            style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
          />

          <Text>Precio</Text>
          <TextInput
            value={priceStr}
            onChangeText={setPriceStr}
            keyboardType={Platform.OS === 'web' ? 'decimal' : 'numeric'}
            placeholder="0"
            style={{ borderWidth: 1, borderRadius: 8, padding: 8 }}
          />

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancelar" color="#999" onPress={onCancel} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Guardar" onPress={handleSave} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
