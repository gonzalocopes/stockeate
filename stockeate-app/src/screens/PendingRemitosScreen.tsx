// src/screens/PendingRemitosScreen.tsx
import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
// 👇 Importamos applyPull y los tipos necesarios
import { api, pullFromServer, PullPayload } from '../api';
import { applyPull } from "../sync/apply";
import { useBranch } from '../stores/branch';

type PendingItem = {
  id: string;
  createdAt: string;
};

export const PendingRemitosScreen = ({ navigation }: any) => {
  const [pendingRemitos, setPendingRemitos] = useState<PendingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const branchId = useBranch((s) => s.id);
  const isHydrated = useBranch((s) => s.isHydrated);

  const loadPendingRemitos = useCallback(async () => {
    if (!isHydrated) return;
    if (!branchId) {
      setIsLoading(false);
      setPendingRemitos([]);
      return;
    }

    setIsLoading(true);
    try {
      // --- 👇 INICIO SINCRONIZACIÓN ---
      console.log("[Pending] Iniciando sincronización...");
      const payload: PullPayload = await pullFromServer(branchId);
      await applyPull(branchId, payload);
      console.log("[Pending] Sincronización completada.");
      // --- 👆 FIN SINCRONIZACIÓN ---

      const url = `/digitalized-remito/pending/${branchId}`.trim();
      console.log("[Pending] Buscando en URL:", url);
      const { data } = await api.get<PendingItem[]>(url);
      console.log("[Pending] Datos recibidos:", data);
      setPendingRemitos(data);

    } catch (error) {
      console.error("Error fetching pending remitos:", error);
      setPendingRemitos([]);
    } finally {
      setIsLoading(false);
    }
  }, [isHydrated, branchId]);

  useFocusEffect(
    useCallback(() => {
      loadPendingRemitos();
    }, [loadPendingRemitos])
  );

  // ... (resto del componente igual: renderItem, return, styles) ...
   if (isLoading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  if (!branchId) {
    return <Text style={styles.emptyText}>Por favor, selecciona una sucursal.</Text>;
  }

  const renderItem = ({ item }: { item: PendingItem }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => navigation.navigate('Validation', { remitoId: item.id })}
    >
      <Text style={styles.itemText}>ID: {item.id}</Text>
      <Text style={styles.itemDate}>
        Subido el: {new Date(item.createdAt).toLocaleString()}
      </Text>
      <Text style={styles.tapToValidate}>Toca para validar ›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={pendingRemitos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No hay remitos pendientes por validar.</Text>
        }
        onRefresh={loadPendingRemitos}
        refreshing={isLoading}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  itemContainer: {
    backgroundColor: 'white',
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  itemText: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  itemDate: { fontSize: 14, color: '#666', marginTop: 4 },
  tapToValidate: {
    marginTop: 12,
    textAlign: 'right',
    color: '#3b82f6', // Color primario (azul)
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 18,
    color: '#999',
    paddingHorizontal: 40,
  },
});