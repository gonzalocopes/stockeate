// src/screens/PendingRemitosScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { api, pullFromServer } from '../api'; // Importamos pullFromServer
import { useBranch } from '../stores/branch';

export const PendingRemitosScreen = ({ navigation }) => {
  const [pendingRemitos, setPendingRemitos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- LA SOLUCIÓN DEFINITIVA ESTÁ AQUÍ ---
  // 1. Leemos cada valor del store por separado.
  //    Esto nos da valores primitivos (string, boolean) que son estables
  //    y no causan re-renders innecesarios.
  const branchId = useBranch((s) => s.id);
  const isHydrated = useBranch((s) => s.isHydrated);
  // --- FIN DE LA SOLUCIÓN ---

  // 2. Usamos useEffect. Este es el hook correcto para reaccionar a cambios de datos.
  useEffect(() => {
    const syncAndRefresh = async () => {
      // Si la hidratación no ha terminado, no hacemos NADA.
      // El componente seguirá mostrando el spinner.
      if (!isHydrated) {
        return;
      }

      // Si la hidratación terminó pero no hay sucursal,
      // quitamos el spinner. El render mostrará el mensaje correcto.
      if (!branchId) {
        setIsLoading(false);
        setPendingRemitos([]);
        return;
      }

      // Si tenemos todo, empezamos el proceso.
      setIsLoading(true);
      try {
        // Primero, sincronizamos los datos del servidor a la BD local.
        await pullFromServer(branchId);
        
        // Segundo, actualizamos la lista de pendientes desde la API.
        const { data } = await api.get(`/digitalized-remito/pending/${branchId}`);
        setPendingRemitos(data);
      } catch (error) {
        console.error("Error during sync and refresh:", error);
        setPendingRemitos([]);
      } finally {
        setIsLoading(false);
      }
    };

    syncAndRefresh();

  }, [isHydrated, branchId]); // <-- 3. El efecto SÓLO se ejecuta si estos valores estables cambian.

  // --- Lógica de Renderizado ---

  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  if (!branchId) {
    return <Text style={styles.emptyText}>Por favor, selecciona una sucursal.</Text>;
  }

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={() => navigation.navigate('Validation', { remitoId: item.id })}
    >
      <Text style={styles.itemText}>ID: {item.id}</Text>
      <Text style={styles.itemDate}>
        Creado el: {new Date(item.createdAt).toLocaleString()}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={pendingRemitos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={styles.emptyText}>No hay remitos pendientes por validar.</Text>}
        onRefresh={() => { // Lógica para "Pull to refresh"
          if (branchId) {
            setIsLoading(true);
            pullFromServer(branchId)
              .then(() => api.get(`/digitalized-remito/pending/${branchId}`))
              .then(res => setPendingRemitos(res.data))
              .catch(() => setPendingRemitos([]))
              .finally(() => setIsLoading(false));
          }
        }}
        refreshing={isLoading}
      />
    </View>
  );
};

// ... (los estilos son los mismos)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5ff' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  itemContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
    borderRadius: 8,
    elevation: 2,
  },
  itemText: { fontSize: 16, fontWeight: 'bold' },
  itemDate: { fontSize: 12, color: 'gray', marginTop: 4 },
  emptyText: { textAlign: 'center', marginTop: 50, fontSize: 16 },
});