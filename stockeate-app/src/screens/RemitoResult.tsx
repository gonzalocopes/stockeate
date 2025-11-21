import React, { useEffect, useState } from 'react';
import { View, Text, Button, Platform, Alert, Linking } from 'react-native'; // Añadido 'Linking' para abrir URLs en móvil
import RemitoQR from '../components/RemitoQR';
import * as Sharing from 'expo-sharing';
import { DB } from '../db';

// 🛑 IMPORTANTE: REEMPLAZA ESTA URL CON TU BACKEND REAL
const API_BASE_URL = 'TU_URL_BASE_DEL_BACKEND_AQUI'; // Ej: 'https://5d46d68b4dea.ngrok-free.app'

// Definición simple del tipo de dato que esperamos de la BD local
type LocalRemito = {
    pdf_path: string | null;
} | null;

export default function RemitoResult({ route }: any) {
  const params = route?.params ?? {};

  const remitoId: string | undefined = params.remitoId;
  const tmp: string | undefined = params.tmp ?? params.tmpNumber ?? params.tmp_number;

  // Guarda la ruta local del PDF
  const [pdfPath, setPdfPath] = useState<string | null>(params.pdfPath ?? null);

  // --- 1. Lógica de Recuperación del PDF (Local) ---
  useEffect(() => {
    if (!remitoId) return;

    // Buscamos en la BD local si la ruta PDF no vino en los parámetros
    if (!pdfPath) {
      try {
        // Asumimos que DB.getRemitoById existe y devuelve un objeto que puede tener pdf_path
        const r = DB.getRemitoById(remitoId) as LocalRemito;
        if (r?.pdf_path) {
          setPdfPath(r.pdf_path);
        }
      } catch (e) {
        console.log('No se pudo leer pdf_path del remito', e);
      }
    }
  }, [remitoId, pdfPath]);

  // 🔴 AHORA EL QR APUNTA AL DASHBOARD
  const qrUrl = "https://stockeate-dashboard.vercel.app/";

  // --- 2. Lógica de Apertura del PDF (con Fallback Web) ---
  const handleOpenPdf = async () => {
    
    const webUrl = `${API_BASE_URL}/remito/download/${remitoId}`;

    if (pdfPath) {
        // A) Intentar con el archivo guardado localmente
        try {
          if (Platform.OS === 'web') {
            // En web, el pdfPath suele ser una ruta blob o temporal, pero probamos abrirla.
            window.open(pdfPath, '_blank');
            return;
          } 
            
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(pdfPath);
                return;
            }
        } catch (e) {
          console.warn('Fallo al abrir archivo local, usando fallback web:', e);
        }
    } 

    // B) Fallback si pdfPath es nulo o el archivo local falló
    if (!API_BASE_URL || !remitoId) {
        Alert.alert('PDF no disponible', 'Este remito todavía no tiene un PDF asociado y no se pudo acceder a la URL de respaldo.');
        return;
    }
    
    // 🛑 FALLBACK WEB PARA MÓVIL Y WEB
    try {
        if (Platform.OS === 'web') {
            window.open(webUrl, '_blank');
        } else {
            // Usa Linking para abrir el navegador en iOS/Android
            await Linking.openURL(webUrl);
        }
    } catch (e) {
        Alert.alert('Error', 'No se pudo abrir el documento de respaldo en el navegador.');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
        Remito generado
      </Text>
      <Text>ID: {remitoId}</Text>
      <Text>Número: {tmp}</Text>

      <View style={{ marginVertical: 24 }}>
        {/* QR ahora usa el link */}
        <RemitoQR data={qrUrl} />
      </View>

      <Button title="Ver / Compartir PDF" onPress={handleOpenPdf} />
    </View>
  );
}