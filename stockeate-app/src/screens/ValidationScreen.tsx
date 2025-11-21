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

  const [remito, setRemito] = useState<RemitoData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Formulario
  const [provider, setProvider] = useState('');
  const [date, setDate] = useState('');
  const [customerCuit, setCustomerCuit] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerTaxCondition, setCustomerTaxCondition] = useState('');

  const [items, setItems] = useState<ItemData[]>([]);
  const [loadingState, setLoadingState] = useState<
    'fetching' | 'processing' | 'failed' | 'success'
  >('fetching');
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- helper de validación de ítem ---
  const isItemValid = (item: ItemData): boolean => {
    const code = String(item.detectedCode || '').trim();
    const name = String(item.detectedName || '').trim();
    const qtyNum = Number(item.qty);
    const priceNum = Number(
      String(item.price ?? '').replace(',', '.'),
    );

    const codeOk =
      code.length > 0 &&
      code !== '???' &&
      code.toLowerCase() !== 'ingresar código';
    const nameOk =
      name.length > 0 && name !== 'Ítem no detectado (Editar)';
    const qtyOk = Number.isFinite(qtyNum) && qtyNum > 0;
    const priceOk = Number.isFinite(priceNum) && priceNum > 0;

    return codeOk && nameOk && qtyOk && priceOk;
  };

  const allItemsValid =
    items.length > 0 && items.every((it) => isItemValid(it));

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
            setCustomerAddress(data.extractedData.customerAddress || '');
            setCustomerTaxCondition(
              data.extractedData.customerTaxCondition || '',
            );

            const mappedItems =
              (data.extractedData.items || []).map((it: any) => {
                const name =
                  it.detectedName ?? it.name ?? '';
                const isDummy =
                  name === 'Ítem no detectado (Editar)';

                return {
                  detectedCode:
                    it.detectedCode ?? it.code ?? '',
                  detectedName: name,
                  // Para el dummy dejamos qty y price vacíos para usar placeholder
                  qty: isDummy ? '' : it.qty ?? 1,
                  price: isDummy
                    ? ''
                    : it.price ?? it.unitPrice ?? '',
                } as ItemData;
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
      qty: '',
      price: '',
    };
    setItems((prev) => [...prev, newItem]);
  };

  // --- Confirmar ---
  const handleConfirm = async () => {
    if (!allItemsValid) {
      Alert.alert(
        'Datos incompletos',
        'Completá código, nombre, cantidad y precio de todos los ítems antes de confirmar.',
      );
      return;
    }

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
          qty:
            Number.isFinite(qtyNumber) && qtyNumber >= 0
              ? qtyNumber
              : 0,
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

      await api.post(
        `/digitalized-remito/${remitoId}/validate`,
        validationData,
      );

      Alert.alert(
        'Éxito',
        'El remito ha sido validado y el stock se actualizó.',
      );
      navigation.goBack();
    } catch (error) {
      console.error('Error validating remito:', error);
      Alert.alert('Error', 'No se pudo validar el remito.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Estados de carga / error ---
  if (loadingState === 'fetching' || loadingState === 'processing' || !remito) {
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
                    { color: theme.colors.textMuted, marginBottom: 4 },
                  ]}
                  value={String(item.detectedCode ?? '')}
                  placeholder="Ingresar código"
                  placeholderTextColor={theme.colors.textMuted}
                  onChangeText={(text) =>
                    handleItemChange(index, 'detectedCode', text)
                  }
                />
                <TextInput
                  style={[styles.itemText, { color: theme.colors.text }]}
                  value={String(item.detectedName ?? '')}
                  placeholder="Nombre del producto"
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
                      borderColor: theme.colors.inputBorder,
                      backgroundColor: theme.colors.inputBackground,
                      color: theme.colors.text,
                    },
                  ]}
                  value={String(item.price ?? '')}
                  onChangeText={(text) =>
                    handleItemChange(index, 'price', text)
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>

              {/* Cantidad */}
              <TextInput
                style={[
                  styles.quantityInput,
                  {
                    borderColor: theme.colors.inputBorder,
                    backgroundColor: theme.colors.inputBackground,
                    color: theme.colors.text,
                  },
                ]}
                value={String(item.qty ?? '')}
                onChangeText={(text) => handleItemChange(index, 'qty', text)}
                keyboardType="numeric"
                placeholder="Cant."
                placeholderTextColor={theme.colors.textMuted}
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
            <Button
              title={
                isSubmitting
                  ? 'Procesando...'
                  : 'Confirmar y Actualizar Stock'
              }
              onPress={handleConfirm}
              disabled={isSubmitting || !allItemsValid}
              color={theme.colors.success}
            />
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
  itemText: { fontSize: 16, fontWeight: '600' },
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
});
