import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Button, ActivityIndicator } from 'react-native';
import { api } from '../api';
import { useBranch } from '../stores/branch';

type Branch = { id: string; name: string };

export default function BranchSelect({ navigation }: any) {
  const setBranch = useBranch((s) => s.set);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sel, setSel] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        setLoading(true);
        const { data } = await api.get<Branch[]>('/branches');
        setBranches(Array.isArray(data) ? data : []);
        setSel(null);
      } catch (e: any) {
        console.error('BRANCHES_FAIL', e?.response?.data || e?.message || e);
        const d = e?.response?.data;
        const msg = Array.isArray(d?.message) ? d.message.join(', ') : d?.message || e?.message || 'No pude cargar sucursales';
        setErr(msg);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const renderItem = ({ item }: { item: Branch }) => (
    <TouchableOpacity
      onPress={() => setSel(item)}
      style={{
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 8,
        backgroundColor: sel && sel.id === item.id ? '#e6f0ff' : '#fff',
      }}
    >
      <Text>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>Elegí sucursal</Text>

      {loading && <ActivityIndicator />}
      {err ? <Text style={{ color: 'red', marginBottom: 8 }}>{err}</Text> : null}

      {!loading && !err && branches.length === 0 ? (
        <Text>No hay sucursales. Creá una en el backend (Prisma Studio) y volvé a intentar.</Text>
      ) : (
        <FlatList
          data={branches}
          keyExtractor={(i, idx) => (i?.id ? i.id : String(idx))}
          renderItem={renderItem}
        />
      )}

      <Button
        title="Continuar"
        disabled={!sel}
        onPress={async () => {
          if (!sel) return;
          await setBranch(sel.id, sel.name); // 👈 guarda id + name persistente
          navigation.replace('Home');
        }}
      />
    </View>
  );
}
