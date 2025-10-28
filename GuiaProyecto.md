# Guía del Proyecto - Stockeate App

## Tecnologías Base
- **React Native**: v0.81.5
- **Expo**: v54.0.17
- **React**: v19.1.0
- **TypeScript**: v5.9.2

## Estructura del Proyecto

El proyecto `stockeate-app` sigue una estructura modular y organizada para facilitar el desarrollo y mantenimiento. A continuación, se detalla la disposición de los directorios y sus contenidos principales:

```
stockeate-app/
├── src/
│   ├── screens/         # Contiene las pantallas principales de la aplicación.
│   ├── components/      # Componentes de UI reutilizables a nivel de aplicación.
│   ├── stores/         # Módulos de gestión de estado global utilizando Zustand.
│   ├── sync/           # Lógica y servicios relacionados con la sincronización de datos.
│   ├── utils/          # Funciones de utilidad y helpers generales.
│   └── db/             # Configuración y operaciones relacionadas con la base de datos SQLite.
├── assets/             # Recursos estáticos como imágenes, fuentes y sonidos.
└── components/         # Componentes de UI base o de terceros.
```


## Dependencias Principales

### Navegación
- **@react-navigation/native**: v7.1.17
- **@react-navigation/native-stack**: v7.3.26
- **@react-navigation/bottom-tabs**: v7.4.0

### Almacenamiento
- **@react-native-async-storage/async-storage**: v2.2.0
- **expo-sqlite**: v16.0.8

### UI/UX
- **expo-camera**: v17.0.8
- **react-native-qrcode-svg**: v6.3.15
- **expo-haptics**: v15.0.7
- **react-native-reanimated**: v4.1.1

## Funcionalidades Principales

### Gestión de Sucursales
- Selección de sucursal
- Estado online/offline
- Horarios: 8:00 - 20:00 (GMT-3)
- Sincronización de catálogo

### Inventario
- Escaneo de productos
- Control de stock
- Generación de remitos
- Vista de productos archivados

### Sincronización
- Sistema offline-first
- Sincronización local-remota
- Cola de operaciones pendientes

## Convenciones de Código

### Nombrado
- **Componentes**: PascalCase (ej: `BranchSelect.tsx`)
- **Utilidades**: camelCase (ej: `remito.ts`)
- **Stores**: camelCase (ej: `branch.ts`)

### Estilos
- StyleSheet de React Native
- Constantes en `constants/theme.ts`
- Componentes adaptables a tema claro/oscuro

### Estado
- **Global**: Zustand stores en `src/stores`
- **Local**: useState en componentes
- **Persistencia**: AsyncStorage + SQLite

## Scripts Disponibles
```bash
npm start          # Inicia desarrollo
npm run android    # Ejecuta en Android
npm run ios        # Ejecuta en iOS
npm run web        # Ejecuta en navegador
npm run lint       # Ejecuta linter
```

## Guías de Desarrollo

### Nuevas Funcionalidades
1. Crear componentes en carpeta correspondiente
2. Seguir patrón de diseño existente
3. Mantener consistencia en manejo de errores
4. Documentar cambios importantes

### Testing
- Probar funcionalidad offline
- Verificar sincronización
- Validar en diferentes dispositivos
- Comprobar manejo de errores

### Optimización
- Minimizar re-renders
- Optimizar consultas SQLite
- Comprimir assets
- Manejar memoria eficientemente

## Mantenimiento

### Actualizaciones
- Mantener Expo SDK actualizado
- Revisar dependencias periódicamente
- Documentar cambios de versiones

### Backups
- Respaldar base SQLite
- Mantener copias de configuración
- Documentar cambios críticos

## Recursos Adicionales
- [Expo Docs](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [SQLite Docs](https://www.sqlite.org/docs.html)
- [Zustand Docs](https://docs.pmnd.rs/zustand/getting-started/introduction)