// src/db.ts
import { Platform } from 'react-native';

// Exportar la implementación correcta según la plataforma
if (Platform.OS === 'web') {
  // Para web, usar una implementación mock o localStorage
  export * from './db.web';
} else {
  // Para móvil, usar SQLite nativo
  export * from './db.native';
}