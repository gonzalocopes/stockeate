import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  TextInput,
  Button,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../api';
import { useThemeStore } from '../stores/themeProviders';
import { useBranch } from '../stores/branch';
import { pullBranchCatalog } from '../sync/index';
import { Ionicons } from '@expo/vector-icons';

// --- Tipos de Datos (Actualizados) ---
type ItemData = {
  detectedCode: string;
  detectedName: string;
  qty: number | string;
  price?: number | string;
};

type RemitoData = {
  id: string;
  originalFileUrl: string;
  status: 'PROCESSING' | 'PENDING_VALIDATION' | 'COMPLETED' | 'FAILED';
  errorMessage: string | null;
  extractedData: {
    provider: string;
    date: string;
    customerCuit?: string;
    customerAddress?: string;
    customerTaxCondition?: string;
    items: ItemData[];
  } | null;
};

export default function ValidationScreen({ route, navigation }: any) {
  const { remitoId } = route.params;
  const { theme } = useThemeStore();
  const branchId = useBranch((s) => s.id);

  const [remito, setRemito] = useState<RemitoData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario
  const [provider, setProvider] = useState('');
  const [date, setDate] = useState('');
  const [customerCuit, setCustomerCuit] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerTaxCondition, setCustomerTaxCondition] =
    useState('');

  const [items, setItems] = useState<ItemData[]>([]);
  const [loadingState, setLoadingState] = useState<
    'fetching' | 'processing' | 'failed' | 'success'
  >('fetching');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 👉 NUEVO: controla si se puede confirmar
  const [canSubmit, setCanSubmit] = useState(false);
  
  // Helper para validar un item individual
  const isItemValid = (item: ItemData) => {
    const code = (item.detectedCode || '').trim();
    const name = (item.detectedName || '').trim();
    const qtyNum = Number(item.qty);
    const priceNumRaw = item.price !== undefined && item.price !== null
      ? String(item.price).replace(',', '.')
      : '';
    const priceNum = Number(priceNumRaw);

    const codeOk = code.length > 0 && code !== 'ingresar código';
    const nameOk = name.length > 0 && name !== 'Ítem no detectado';
    const qtyOk = Number.isFinite(qtyNum) && qtyNum > 0;
    const priceOk = Number.isFinite(priceNum) && priceNum > 0;

    return { codeOk, nameOk, qtyOk, priceOk, allOk: codeOk && nameOk && qtyOk && priceOk };
  };

  // --- Carga y polling ---
  useEffect(() => {
    const fetchRemitoDetails = async () => {
      try {
        const { data } = await api.get<RemitoData>(
          `/digitalized-remito/${remitoId}`,
        );
        setRemito(data);

        if (data.status === 'PROCESSING') {
          setLoadingState('processing');
          if (!pollingIntervalRef.current) {
            pollingIntervalRef.current = setInterval(
              fetchRemitoDetails,
              3000,
            );
          }
        } else if (data.status === 'PENDING_VALIDATION') {
          setLoadingState('success');
          if (pollingIntervalRef.current)
            clearInterval(pollingIntervalRef.current);

          if (data.extractedData) {
            setProvider(data.extractedData.provider || '');
            setDate(data.extractedData.date || '');
            setCustomerCuit(data.extractedData.customerCuit || '');
            setCustomerAddress(
              data.extractedData.customerAddress || '',
            );
            setCustomerTaxCondition(
              data.extractedData.customerTaxCondition || '',
            );

            const mappedItems =
              (data.extractedData.items || []).map((it: any) => {
                // Limpiar valores por defecto que vienen del backend
                const code = it.detectedCode ?? it.code ?? '';
                const name = it.detectedName ?? it.name ?? '';
                
                return {
                  detectedCode: code === 'ingresar código' ? '' : code,
                  detectedName: name === 'Ítem no detectado (Editar)' ? '' : name,
                  qty: it.qty ?? 1,
                  price: it.price ?? it.unitPrice ?? 0,
                };
              }) || [];

            setItems(mappedItems);
          }
        } else if (data.status === 'FAILED') {
          setLoadingState('failed');
          if (pollingIntervalRef.current)
            clearInterval(pollingIntervalRef.current);
          Alert.alert(
            'Error de OCR',
            data.errorMessage || 'El servidor no pudo leer el archivo.',
          );
        } else {
          if (pollingIntervalRef.current)
            clearInterval(pollingIntervalRef.current);
          setLoadingState('success');
        }
      } catch (error) {
        console.error('Error fetching remito details:', error);
        Alert.alert('Error', 'No se pudo cargar el detalle del remito.');
        setLoadingState('failed');
        if (pollingIntervalRef.current)
          clearInterval(pollingIntervalRef.current);
      }
    };

    fetchRemitoDetails();
    return () => {
      if (pollingIntervalRef.current)
        clearInterval(pollingIntervalRef.current);
    };
  }, [remitoId]);

  // --- Items ---
  const handleItemChange = (
    index: number,
    field: 'detectedName' | 'qty' | 'detectedCode' | 'price',
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        if (field === 'qty') {
          const onlyNumbers = value.replace(/[^0-9]/g, '');
          return { ...item, qty: onlyNumbers };
        }

        if (field === 'price') {
          const cleaned = value.replace(/[^0-9.,]/g, '');
          return { ...item, price: cleaned };
        }

        if (field === 'detectedName') {
          return { ...item, detectedName: value };
        }

        if (field === 'detectedCode') {
          return { ...item, detectedCode: value };
        }

        return item;
      }),
    );
  };

  const handleAddItemManually = () => {
    const newItem: ItemData = {
      detectedCode: '',
      detectedName: '',
      qty: 1,
      price: 0,
    };
    setItems((prev) => [...prev, newItem]);
  };

  // 👉 NUEVO: validación para habilitar / deshabilitar el botón
  useEffect(() => {
    if (!items || items.length === 0) {
      setCanSubmit(false);
      return;
    }

    const allOk = items.every((it) => isItemValid(it).allOk);

    setCanSubmit(allOk);
  }, [items]);

  // --- Confirmar ---
  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const normalizedItems = items.map((it) => {
        const qtyNumber = Number(it.qty);
        const priceNumber =
          it.price !== undefined &&
          it.price !== null &&
          String(it.price) !== ''
            ? Number(String(it.price).replace(',', '.'))
            : 0;

        return {
          detectedCode: (it.detectedCode || '').trim(),
          detectedName: (it.detectedName || '').trim(),
          qty: Number.isFinite(qtyNumber) && qtyNumber >= 0 ? qtyNumber : 0,
          price:
            Number.isFinite(priceNumber) && priceNumber >= 0
              ? priceNumber
              : 0,
        };
      });

      const validationData = {
        provider,
        date,
        customerCuit,
        customerAddress,
        customerTaxCondition,
        items: normalizedItems,
      };

      console.log('[Validation] Enviando datos de validación:', validationData);
      
      await api.post(
        `/digitalized-remito/${remitoId}/validate`,
        validationData,
      );

      console.log('[Validation] Remito validado, forzando sincronización...');
      
      // Forzar sincronización después de validar con protección adicional
      if (branchId) {
        try {
          // Pequeña pausa para evitar conflictos de DB
          await new Promise(resolve => setTimeout(resolve, 500));
          await pullBranchCatalog(branchId);
          console.log('[Validation] Sincronización completada');
        } catch (syncError: any) {
          console.warn('[Validation] Error en sincronización:', syncError?.message || syncError);
          // No fallar si la sincronización falla, solo advertir
        }
      }

      Alert.alert(
        'Éxito',
        'El remito ha sido validado y el stock se actualizó.',
      );
      navigation.goBack();
    } catch (error: any) {
      console.error('Error validating remito:', error);
      
      // Mostrar error más específico
      const errorMessage = error?.response?.data?.message || 
                          error?.message || 
                          'No se pudo validar el remito.';
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Estados de carga / error ---
  if (
    loadingState === 'fetching' ||
    loadingState === 'processing' ||
    !remito
  ) {
    return (
      <View
        style={[
          styles.loaderContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text
          style={[
            styles.loaderText,
            { color: theme.colors.textSecondary },
          ]}
        >
          {loadingState === 'processing'
            ? 'Procesando OCR, por favor espera...'
            : 'Cargando datos del remito...'}
        </Text>
      </View>
    );
  }

  if (loadingState === 'failed') {
    return (
      <View
        style={[
          styles.loaderContainer,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Text style={[styles.errorText, { color: theme.colors.danger }]}>
          {remito?.errorMessage || 'No se pudieron cargar los datos.'}
        </Text>
        <Button
          title="Volver"
          onPress={() => navigation.goBack()}
          color={theme.colors.primary}
        />
      </View>
    );
  }

  const imageUrl = `${api.defaults.baseURL}/${remito.originalFileUrl.replace(
    /\\/g,
    '/',
  )}`;

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            Validar Datos Extraídos
          </Text>

          <Text
            style={[styles.imageLabel, { color: theme.colors.textSecondary }]}
          >
            Imagen Original:
          </Text>
          <Image
            source={{ uri: imageUrl }}
            style={[
              styles.image,
              { borderColor: theme.colors.border },
            ]}
            resizeMode="contain"
          />

          {/* FORMULARIO PRINCIPAL */}
          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Proveedor (Razón Social):
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.inputBorder,
                backgroundColor: theme.colors.inputBackground,
                color: theme.colors.text,
              },
            ]}
            value={provider}
            onChangeText={setProvider}
          />

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Fecha:
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.inputBorder,
                backgroundColor: theme.colors.inputBackground,
                color: theme.colors.text,
              },
            ]}
            value={date}
            onChangeText={setDate}
          />

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            CUIT:
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.inputBorder,
                backgroundColor: theme.colors.inputBackground,
                color: theme.colors.text,
              },
            ]}
            value={customerCuit}
            onChangeText={setCustomerCuit}
            placeholder="CUIT (detectado o manual)"
            placeholderTextColor={theme.colors.textMuted}
            keyboardType="numeric"
          />

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Dirección:
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.inputBorder,
                backgroundColor: theme.colors.inputBackground,
                color: theme.colors.text,
              },
            ]}
            value={customerAddress}
            onChangeText={setCustomerAddress}
            placeholder="Dirección (detectada o manual)"
            placeholderTextColor={theme.colors.textMuted}
          />

          <Text style={[styles.label, { color: theme.colors.textSecondary }]}>
            Condición IVA:
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.colors.inputBorder,
                backgroundColor: theme.colors.inputBackground,
                color: theme.colors.text,
              },
            ]}
            value={customerTaxCondition}
            onChangeText={setCustomerTaxCondition}
            placeholder="Condición de IVA (detectada o manual)"
            placeholderTextColor={theme.colors.textMuted}
          />

          {/* ÍTEMS */}
          <Text style={[styles.listLabel, { color: theme.colors.text }]}>
            Items Detectados:
          </Text>

          {items.map((item, index) => (
            <View
              key={index}
              style={[
                styles.itemContainer,
                { backgroundColor: theme.colors.card },
              ]}
            >
              <View style={styles.itemDetails}>
                <TextInput
                  style={[
                    styles.itemCode,
                    { 
                      color: String(item.detectedCode ?? '') === 'ingresar código' 
                        ? theme.colors.textMuted 
                        : theme.colors.text, 
                      marginBottom: 4,
                      borderWidth: 1,
                      borderColor: !isItemValid(item).codeOk 
                        ? theme.colors.danger 
                        : theme.colors.inputBorder,
                      backgroundColor: theme.colors.inputBackground,
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 4,
                    },
                  ]}
                  value={String(item.detectedCode ?? '')}
                  placeholder="Ingresar código del producto"
                  placeholderTextColor={theme.colors.textMuted}
                  onChangeText={(text) =>
                    handleItemChange(index, 'detectedCode', text)
                  }
                />
                <TextInput
                  style={[
                    styles.itemText, 
                    { 
                      color: String(item.detectedName ?? '') === 'Ítem no detectado' 
                        ? theme.colors.textMuted 
                        : theme.colors.text,
                      borderWidth: 1,
                      borderColor: !isItemValid(item).nameOk 
                        ? theme.colors.danger 
                        : theme.colors.inputBorder,
                      backgroundColor: theme.colors.inputBackground,
                      paddingHorizontal: 8,
                      paddingVertical: 6,
                      borderRadius: 4,
                      marginTop: 4,
                    }
                  ]}
                  value={String(item.detectedName ?? '')}
                  placeholder="Nombre producto"
                  placeholderTextColor={theme.colors.textMuted}
                  onChangeText={(text) =>
                    handleItemChange(index, 'detectedName', text)
                  }
                />

                {/* Precio */}
                <Text
                  style={[
                    styles.priceLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Precio:
                </Text>
                <TextInput
                  style={[
                    styles.priceInput,
                    {
                      borderColor: !isItemValid(item).priceOk 
                        ? theme.colors.danger 
                        : theme.colors.inputBorder,
                      backgroundColor: theme.colors.inputBackground,
                      color: theme.colors.text,
                    },
                  ]}
                  value={String(item.price ?? '')}
                  onChangeText={(text) =>
                    handleItemChange(index, 'price', text)
                  }
                  keyboardType="numeric"
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              {/* Cantidad */}
              <TextInput
                style={[
                  styles.quantityInput,
                  {
                    borderColor: !isItemValid(item).qtyOk 
                      ? theme.colors.danger 
                      : theme.colors.inputBorder,
                    backgroundColor: theme.colors.inputBackground,
                    color: theme.colors.text,
                  },
                ]}
                value={String(item.qty ?? '')}
                onChangeText={(text) => handleItemChange(index, 'qty', text)}
                keyboardType="numeric"
              />
            </View>
          ))}

          {/* Botón añadir ítem */}
          <TouchableOpacity
            style={[
              styles.addItemButton,
              { borderColor: theme.colors.primary },
            ]}
            onPress={handleAddItemManually}
          >
            <Ionicons name="add" size={20} color={theme.colors.primary} />
            <Text
              style={[
                styles.addItemButtonText,
                { color: theme.colors.primary },
              ]}
            >
              Añadir Ítem Manualmente
            </Text>
          </TouchableOpacity>

          <View style={{ marginTop: 20, marginBottom: 20 }}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: canSubmit && !isSubmitting 
                    ? theme.colors.success 
                    : theme.colors.textMuted,
                  opacity: canSubmit && !isSubmitting ? 1 : 0.6,
                },
              ]}
              onPress={handleConfirm}
              disabled={isSubmitting || !canSubmit}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting
                  ? 'Procesando...'
                  : 'Confirmar y Actualizar Stock'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- Estilos ---
const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  keyboardAvoiding: { flex: 1 },
  container: { paddingHorizontal: 16, paddingBottom: 40 },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loaderText: { marginTop: 16, fontSize: 16, fontWeight: '600' },
  errorText: { textAlign: 'center', fontSize: 16, marginBottom: 20 },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 16,
    textAlign: 'center',
  },
  imageLabel: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  image: {
    width: '100%',
    height: 250,
    backgroundColor: '#eee',
    marginBottom: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    minHeight: 50,
  },
  listLabel: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
  },
  itemDetails: { flex: 1, gap: 4 },
  itemText: { fontSize: 14, fontWeight: '600' },
  itemCode: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  quantityInput: {
    width: 60,
    height: 44,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    marginLeft: 10,
  },
  priceLabel: {
    fontSize: 12,
    marginTop: 8,
    marginBottom: 2,
  },
  priceInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 14,
    alignSelf: 'flex-start',
    minWidth: 90,
  },
  addItemButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    marginTop: 8,
    borderStyle: 'dashed',
  },
  addItemButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
