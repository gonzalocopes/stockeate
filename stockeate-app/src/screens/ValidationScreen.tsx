// src/screens/ValidationScreen.tsx
import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ActivityIndicator, Image, 
  TextInput, Button, Alert, ScrollView, KeyboardAvoidingView, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api'; // Asegúrate que la ruta sea correcta

// --- 👇 1. Definimos los tipos para nuestros datos ---

// Tipo para los props de navegación (soluciona error de 'route' y 'navigation' any)
type NavigationProps = {
  navigation: any; // Puedes mejorar esto si tienes tus tipos de navegación definidos
  route: {
    params: {
      remitoId: string;
    };
  };
};

// Tipo para un ítem del remito
type ItemData = {
  detectedCode: string;
  detectedName: string;
  qty: number;
};

// Tipo para los datos del remito que cargamos de la API
type RemitoData = {
  id: string;
  originalFileUrl: string;
  extractedData: {
    provider: string;
    date: string;
    items: ItemData[];
  };
  // ...otros campos si los hay (status, etc.)
};

// --- Fin de la definición de tipos ---


export const ValidationScreen = ({ route, navigation }: NavigationProps) => { // <-- 2. Usamos el tipo
  const { remitoId } = route.params;

  // --- 👇 3. Tipamos nuestros 'useState' ---
  const [remito, setRemito] = useState<RemitoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [provider, setProvider] = useState('');
  const [date, setDate] = useState('');
  const [items, setItems] = useState<ItemData[]>([]); // <-- Tipo para el array
  // --- Fin del tipado de 'useState' ---

  useEffect(() => {
    const fetchRemitoDetails = async () => {
      try {
        // Le decimos a axios que esperamos recibir datos de tipo 'RemitoData'
        const { data } = await api.get<RemitoData>(`/digitalized-remito/${remitoId}`);
        setRemito(data);
        // Comprobamos que extractedData exista antes de acceder a sus propiedades
        if (data.extractedData) {
          setProvider(data.extractedData.provider || '');
          setDate(data.extractedData.date || '');
          setItems(data.extractedData.items || []);
        }
      } catch (error) {
        console.error("Error fetching remito details:", error);
        Alert.alert("Error", "No se pudo cargar el detalle del remito.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRemitoDetails();
  }, [remitoId]);

  // --- 👇 4. Tipamos los parámetros de la función ---
  const handleItemChange = (index: number, field: 'detectedName' | 'qty', value: string) => {
    // Copiamos el array de forma segura
    const updatedItems = items.map((item, i) => {
      if (i === index) {
        if (field === 'qty') {
          return { ...item, qty: parseInt(value, 10) || 0 };
        }
        if (field === 'detectedName') {
          return { ...item, detectedName: value };
        }
      }
      return item;
    });
    setItems(updatedItems);
  };
  
  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const validationData = { provider, date, items };
      await api.post(`/digitalized-remito/${remitoId}/validate`, validationData);
      
      Alert.alert("Éxito", "El remito ha sido validado y procesado.");
      navigation.goBack();
    } catch (error) {
      console.error("Error validating remito:", error);
      Alert.alert("Error", "No se pudo validar el remito.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <ActivityIndicator size="large" style={styles.loader} />;
  }

  if (!remito) {
    return <Text style={styles.errorText}>No se encontraron datos para este remito.</Text>;
  }

  const imageUrl = `${api.defaults.baseURL}/${remito.originalFileUrl.replace(/\\/g, '/')}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Validar Datos Extraídos</Text>
          
          <Text style={styles.imageLabel}>Imagen Original:</Text>
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />

          <Text style={styles.label}>Proveedor:</Text>
          <TextInput style={styles.input} value={provider} onChangeText={setProvider} />

          <Text style={styles.label}>Fecha:</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} />

          <Text style={styles.listLabel}>Items Detectados:</Text>
          
          {items.map((item, index) => (
            <View key={`${item.detectedCode}-${index}`} style={styles.itemContainer}>
              <View style={styles.itemDetails}>
                <TextInput
                  style={styles.itemText}
                  value={item.detectedName}
                  onChangeText={(text) => handleItemChange(index, 'detectedName', text)}
                />
                <Text style={styles.itemCode}>Código: {item.detectedCode}</Text>
              </View>
              <TextInput
                style={styles.quantityInput}
                value={String(item.qty)}
                onChangeText={(text) => handleItemChange(index, 'qty', text)}
                keyboardType="numeric"
              />
            </View>
          ))}

          <View style={{ marginTop: 20 }}>
            <Button 
              title={isSubmitting ? "Procesando..." : "Confirmar y Actualizar Stock"}
              onPress={handleConfirm}
              disabled={isSubmitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ... (Los estilos se mantienen igual que antes)
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f5' },
  keyboardAvoiding: { flex: 1 },
  container: { paddingHorizontal: 16, paddingBottom: 40 }, 
  loader: { flex: 1, justifyContent: 'center' },
  errorText: { textAlign: 'center', marginTop: 50, fontSize: 16, color: 'red' },
  title: { fontSize: 22, fontWeight: 'bold', marginVertical: 16, textAlign: 'center' },
  imageLabel: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  image: { width: '100%', height: 250, backgroundColor: '#eee', marginBottom: 16, borderWidth: 1, borderColor: '#ccc' },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  input: {
    backgroundColor: 'white', borderColor: '#ccc', borderWidth: 1,
    borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 16,
  },
  listLabel: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  itemContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    padding: 12, marginBottom: 10, borderRadius: 8, elevation: 2,
  },
  itemDetails: { flex: 1 },
  itemText: { fontSize: 16 },
  itemCode: { fontSize: 12, color: 'gray', fontStyle: 'italic' },
  quantityInput: {
    width: 60, height: 40, borderColor: 'gray', borderWidth: 1,
    borderRadius: 5, textAlign: 'center', fontSize: 16, marginLeft: 10, backgroundColor: 'white',
  },
});