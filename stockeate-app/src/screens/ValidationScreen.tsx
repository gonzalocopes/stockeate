import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, ActivityIndicator, Image, 
  TextInput, Button, Alert, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { useThemeStore } from '../stores/themeProviders';
import { Ionicons } from '@expo/vector-icons'; // Importar Ionicons

// --- Tipos de Datos (Actualizados) ---
type NavigationProps = {
  navigation: any;
  route: { params: { remitoId: string; }; };
};

type ItemData = {
  detectedCode: string;
  detectedName: string;
  qty: number;
};

type RemitoData = {
  id: string;
  originalFileUrl: string;
  status: 'PROCESSING' | 'PENDING_VALIDATION' | 'COMPLETED' | 'FAILED';
  errorMessage: string | null;
  extractedData: {
    provider: string;
    date: string;
    // 👇 Campos nuevos
    customerCuit?: string;
    customerAddress?: string;
    customerTaxCondition?: string;
    items: ItemData[];
  } | null;
};
// --- Fin Tipos ---


export default function ValidationScreen({ route, navigation }: NavigationProps) {
  const { remitoId } = route.params;
  const { theme } = useThemeStore();

  // --- Estados de la Pantalla ---
  const [remito, setRemito] = useState<RemitoData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // --- Estados del Formulario (Actualizados) ---
  const [provider, setProvider] = useState('');
  const [date, setDate] = useState('');
  // 👇 Nuevos estados
  const [customerCuit, setCustomerCuit] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerTaxCondition, setCustomerTaxCondition] = useState('');
  
  const [items, setItems] = useState<ItemData[]>([]);
  const [loadingState, setLoadingState] = useState<'fetching' | 'processing' | 'failed' | 'success'>('fetching');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Lógica de Carga y Sondeo (Polling) (Actualizada) ---
  useEffect(() => {
    const fetchRemitoDetails = async () => {
      try {
        const { data } = await api.get<RemitoData>(`/digitalized-remito/${remitoId}`);
        setRemito(data);

        if (data.status === 'PROCESSING') {
          setLoadingState('processing');
          if (!pollingIntervalRef.current) {
            pollingIntervalRef.current = setInterval(fetchRemitoDetails, 3000);
          }
        } 
        else if (data.status === 'PENDING_VALIDATION') {
          setLoadingState('success');
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          
          // 👇 Rellenamos el formulario con los nuevos campos
          if (data.extractedData) {
            setProvider(data.extractedData.provider || '');
            setDate(data.extractedData.date || '');
            setCustomerCuit(data.extractedData.customerCuit || '');
            setCustomerAddress(data.extractedData.customerAddress || '');
            setCustomerTaxCondition(data.extractedData.customerTaxCondition || '');
            setItems(data.extractedData.items || []);
          }
        }
        else if (data.status === 'FAILED') {
          setLoadingState('failed');
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          Alert.alert("Error de OCR", data.errorMessage || "El servidor no pudo leer el archivo.");
        }
        else {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setLoadingState('success'); 
        }

      } catch (error) {
        console.error("Error fetching remito details:", error);
        Alert.alert("Error", "No se pudo cargar el detalle del remito.");
        setLoadingState('failed');
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      }
    };
    fetchRemitoDetails();
    return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current); };
  }, [remitoId]);

  // --- 👇 Lógica de Items (Actualizada) ---
  const handleItemChange = (index: number, field: 'detectedName' | 'qty' | 'detectedCode', value: string) => {
    const updatedItems = items.map((item, i) => {
      if (i === index) {
        if (field === 'qty') return { ...item, qty: parseInt(value, 10) || 0 };
        if (field === 'detectedName') return { ...item, detectedName: value };
        if (field === 'detectedCode') return { ...item, detectedCode: value }; // <-- Permite editar código
      }
      return item;
    });
    setItems(updatedItems);
  };

  // --- 👇 NUEVA FUNCIÓN: Añadir Ítem Manualmente ---
  const handleAddItemManually = () => {
    const newItem: ItemData = {
      detectedCode: '', // Vacío para que el usuario lo llene
      detectedName: '',
      qty: 1,
    };
    setItems([...items, newItem]);
  };
  
  // --- Lógica de Confirmar (Actualizada) ---
  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      // 👇 Enviamos todos los datos del formulario
      const validationData = { 
        provider, 
        date, 
        customerCuit, 
        customerAddress, 
        customerTaxCondition, 
        items 
      };
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

  // ... (Renderizado de 'loading' y 'failed' se mantiene igual) ...
  if (loadingState === 'fetching' || loadingState === 'processing' || !remito) {
     return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loaderText, { color: theme.colors.textSecondary }]}>
          {loadingState === 'processing' 
            ? "Procesando OCR, por favor espera..." 
            : "Cargando datos del remito..."}
        </Text>
      </View>
    );
  }
  if (loadingState === 'failed') {
     return (
      <View style={[styles.loaderContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.danger }]}>
          {remito?.errorMessage || "No se pudieron cargar los datos."}
        </Text>
        <Button title="Volver" onPress={() => navigation.goBack()} color={theme.colors.primary} />
      </View>
    );
  }

  const imageUrl = `${api.defaults.baseURL}/${remito.originalFileUrl.replace(/\\/g, '/')}`;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView 
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={[styles.title, { color: theme.colors.text }]}>Validar Datos Extraídos</Text>
          
          <Text style={[styles.imageLabel, { color: theme.colors.textSecondary }]}>Imagen Original:</Text>
          <Image source={{ uri: imageUrl }} style={[styles.image, { borderColor: theme.colors.border }]} resizeMode="contain" />

          {/* --- 👇 FORMULARIO ACTUALIZADO --- */}
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Proveedor (Razón Social):</Text>
          <TextInput 
            style={[styles.input, { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]} 
            value={provider} 
            onChangeText={setProvider} 
          />

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Fecha:</Text>
          <TextInput 
            style={[styles.input, { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]} 
            value={date} 
            onChangeText={setDate} 
          />

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>CUIT:</Text>
          <TextInput 
            style={[styles.input, { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]} 
            value={customerCuit} 
            onChangeText={setCustomerCuit}
            placeholder="CUIT (detectado o manual)"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Dirección:</Text>
          <TextInput 
            style={[styles.input, { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]} 
            value={customerAddress} 
            onChangeText={setCustomerAddress}
            placeholder="Dirección (detectada o manual)"
            placeholderTextColor={theme.colors.textMuted}
          />
          
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Condición IVA:</Text>
          <TextInput 
            style={[styles.input, { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]} 
            value={customerTaxCondition} 
            onChangeText={setCustomerTaxCondition}
            placeholder="Condición de IVA (detectada o manual)"
            placeholderTextColor={theme.colors.textMuted}
          />
          {/* --- FIN FORMULARIO ACTUALIZADO --- */}


          <Text style={[styles.listLabel, { color: theme.colors.text }]}>Items Detectados:</Text>
          
          {items.map((item, index) => (
            <View key={index} style={[styles.itemContainer, { backgroundColor: theme.colors.card }]}>
              <View style={styles.itemDetails}>
                {/* 👇 Hacemos el Código editable */}
                <TextInput
                  style={[styles.itemCode, { color: theme.colors.textMuted, marginBottom: 4 }]}
                  value={item.detectedCode}
                  placeholder="Código"
                  placeholderTextColor={theme.colors.textMuted}
                  onChangeText={(text) => handleItemChange(index, 'detectedCode', text)}
                />
                <TextInput
                  style={[styles.itemText, { color: theme.colors.text }]}
                  value={item.detectedName}
                  placeholder="Nombre del producto"
                  placeholderTextColor={theme.colors.textMuted}
                  onChangeText={(text) => handleItemChange(index, 'detectedName', text)}
                />
              </View>
              <TextInput
                style={[styles.quantityInput, { borderColor: theme.colors.inputBorder, backgroundColor: theme.colors.inputBackground, color: theme.colors.text }]}
                value={String(item.qty)}
                onChangeText={(text) => handleItemChange(index, 'qty', text)}
                keyboardType="numeric"
              />
            </View>
          ))}

          {/* --- 👇 NUEVO BOTÓN PARA AÑADIR ÍTEMS --- */}
          <TouchableOpacity 
            style={[styles.addItemButton, { borderColor: theme.colors.primary }]}
            onPress={handleAddItemManually}
          >
            <Ionicons name="add" size={20} color={theme.colors.primary} />
            <Text style={[styles.addItemButtonText, { color: theme.colors.primary }]}>Añadir Ítem Manualmente</Text>
          </TouchableOpacity>

          <View style={{ marginTop: 20, marginBottom: 20 }}>
            <Button 
              title={isSubmitting ? "Procesando..." : "Confirmar y Actualizar Stock"}
              onPress={handleConfirm}
              disabled={isSubmitting}
              color={theme.colors.success}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// --- 👇 ESTILOS ACTUALIZADOS ---
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardAvoiding: { flex: 1 },
  container: { paddingHorizontal: 16, paddingBottom: 40 }, 
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loaderText: { marginTop: 16, fontSize: 16, fontWeight: '600' },
  errorText: { textAlign: 'center', fontSize: 16, marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 'bold', marginVertical: 16, textAlign: 'center' },
  imageLabel: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  image: { width: '100%', height: 250, backgroundColor: '#eee', marginBottom: 16, borderWidth: 1, borderRadius: 8 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16, 
    marginBottom: 16, minHeight: 50
  },
  listLabel: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  itemContainer: {
    flexDirection: 'row', alignItems: 'center', padding: 12, 
    marginBottom: 10, borderRadius: 8, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 1.5,
  },
  itemDetails: { flex: 1, gap: 4 }, // Añadido 'gap'
  itemText: { fontSize: 16, fontWeight: '600' },
  itemCode: { fontSize: 12, fontStyle: 'italic', paddingHorizontal: 0, paddingVertical: 0 }, // Inputs editables
  quantityInput: {
    width: 60, height: 44, borderWidth: 1, borderRadius: 8,
    textAlign: 'center', fontSize: 16, marginLeft: 10,
  },
  // Estilos para el nuevo botón de añadir ítem
  addItemButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 8,
    borderStyle: 'dashed', // Estilo punteado
  },
  addItemButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  }
});