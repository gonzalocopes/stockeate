// src/screens/ExternalRemitoResult.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import RemitoQR from '../components/RemitoQR';
import * as Sharing from 'expo-sharing';

export default function ExternalRemitoResult({ route, navigation }: any) {
  const { remitoData } = route.params ?? {};
  const [showQR, setShowQR] = useState(false);

  if (!remitoData) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 16, color: '#dc3545' }}>Error: No se encontraron datos del remito</Text>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16, padding: 12, backgroundColor: '#007AFF', borderRadius: 8 }}
        >
          <Text style={{ color: 'white', fontWeight: '600' }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // QR HIPER CLARO para humanos
  const fecha = new Date(remitoData.created_at).toLocaleDateString('es-AR');
  const total = Number(remitoData.total || 0).toLocaleString('es-AR');
  
  const qrData = [
    '=== STOCKEATE REMITO ===',
    '',
    `Numero: ${remitoData.tmp_number || 'EXTERNO'}`,
    `Cliente: ${remitoData.customer || 'Sin especificar'}`,
    `Total: $${total}`,
    `Items: ${remitoData.items?.length || 0} productos`,
    `Fecha: ${fecha}`,
    '',
    'ESCANEAR = RECIBIDO',
    '',
    `ID: ${remitoData.id}`
  ].join('\n');

  const shareQR = async () => {
    try {
      await Sharing.shareAsync(qrData, {
        dialogTitle: 'Compartir Remito Externo'
      });
    } catch (error) {
      Alert.alert('Error', 'No se pudo compartir el remito');
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <View style={{ gap: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#22c55e', textAlign: 'center' }}>
          ✅ Remito Externo Procesado
        </Text>

        {/* Header del remito */}
        <View style={{ 
          backgroundColor: '#1e40af', 
          borderRadius: 12, 
          padding: 20, 
          marginBottom: 16
        }}>
          <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', textAlign: 'center' }}>
            📄 Remito Externo Procesado
          </Text>
          <Text style={{ color: '#bfdbfe', fontSize: 14, textAlign: 'center', marginTop: 4 }}>
            {remitoData.tmp_number || remitoData.official_number || 'N/A'}
          </Text>
        </View>

        {/* Información principal */}
        <View style={{ 
          backgroundColor: 'white', 
          borderRadius: 12, 
          padding: 16, 
          borderWidth: 1, 
          borderColor: '#e5e7eb',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3
        }}>
          <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 16, color: '#1f2937' }}>📋 Información del Remito</Text>
          
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <Text style={{ color: '#6b7280', fontSize: 14 }}>Cliente:</Text>
              <Text style={{ fontWeight: '600', color: '#1f2937', fontSize: 14, flex: 1, textAlign: 'right' }}>
                {remitoData.customer || 'No especificado'}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <Text style={{ color: '#6b7280', fontSize: 14 }}>Total:</Text>
              <Text style={{ fontWeight: '700', color: '#059669', fontSize: 16 }}>
                ${remitoData.total?.toLocaleString() || '0.00'}
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' }}>
              <Text style={{ color: '#6b7280', fontSize: 14 }}>Productos:</Text>
              <Text style={{ fontWeight: '600', color: '#1f2937', fontSize: 14 }}>
                {remitoData.items?.length || 0} items
              </Text>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ color: '#6b7280', fontSize: 14 }}>Fecha:</Text>
              <Text style={{ fontWeight: '600', color: '#1f2937', fontSize: 14 }}>
                {new Date(remitoData.created_at).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: '2-digit', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
          </View>
        </View>

        {/* Lista de productos */}
        {remitoData.items && remitoData.items.length > 0 && (
          <View style={{ 
            backgroundColor: 'white', 
            borderRadius: 12, 
            padding: 16, 
            borderWidth: 1, 
            borderColor: '#e5e7eb',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3
          }}>
            <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 16, color: '#1f2937' }}>📦 Productos Detectados</Text>
            
            {remitoData.items.map((item, index) => (
              <View key={index} style={{ 
                flexDirection: 'row', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 12,
                backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                borderRadius: 8,
                marginBottom: 8
              }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '600', color: '#1f2937', fontSize: 14 }}>
                    {item.name}
                  </Text>
                </View>
                <View style={{ 
                  backgroundColor: '#dbeafe', 
                  paddingHorizontal: 8, 
                  paddingVertical: 4, 
                  borderRadius: 12 
                }}>
                  <Text style={{ color: '#1e40af', fontWeight: '600', fontSize: 12 }}>
                    {item.qty} unid.
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Botones de acción */}
        <View style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={() => setShowQR(!showQR)}
            style={{
              backgroundColor: showQR ? '#ef4444' : '#3b82f6',
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
              {showQR ? '❌ Ocultar Código QR' : '📱 Generar Código QR'}
            </Text>
          </TouchableOpacity>

          {showQR && (
            <View style={{ 
              backgroundColor: 'white', 
              borderRadius: 16, 
              padding: 24, 
              alignItems: 'center',
              borderWidth: 2,
              borderColor: '#3b82f6',
              shadowColor: '#3b82f6',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 5
            }}>
              <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center', color: '#1f2937' }}>
                📱 Código QR Generado
              </Text>
              <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 20, textAlign: 'center' }}>
                Escanea este código para acceder a los datos del remito
              </Text>
              
              <View style={{
                backgroundColor: '#f8fafc',
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#e5e7eb'
              }}>
                <RemitoQR data={qrData} size={180} />
              </View>
              
              <TouchableOpacity
                onPress={shareQR}
                style={{
                  marginTop: 20,
                  backgroundColor: '#10b981',
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 10,
                  shadowColor: '#10b981',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 3
                }}
                activeOpacity={0.8}
              >
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>🔗 Compartir QR</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            style={{
              backgroundColor: '#10b981',
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
              🏠 Volver al Menú Principal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('RemitosHistory')}
            style={{
              backgroundColor: '#6366f1',
              paddingVertical: 14,
              borderRadius: 12,
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3
            }}
            activeOpacity={0.8}
          >
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 14 }}>
              📋 Ver Historial de Remitos
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}