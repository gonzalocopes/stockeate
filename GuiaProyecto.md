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

---

## Backend: Logging y archivos de logs



### Sistema de logging backend

El backend implementa un sistema de logs centralizado usando Winston y winston-daily-rotate-file, integrado como provider global de NestJS.

- Los logs se guardan en la carpeta `logs/` del backend, con un archivo por día (rotación automática).
- Se conservan los últimos 4 días de logs (ajustable en la configuración del provider).
- Los logs pueden mostrarse en consola y/o solo en archivos, según configuración.
- El nivel de logs y la salida a consola se configuran por variables de entorno en `.env`:
  - `LOG_LEVEL` (por ejemplo: `info`, `warn`, `error`)
  - `LOG_CONSOLE` (`true` o `false`)
  - `NODE_ENV` (`development` o `production`)
- Ejemplo de configuración en `.env`:
  ```env
  LOG_LEVEL=warn
  LOG_CONSOLE=false
  NODE_ENV=production
  ```
- La lógica de configuración y el provider están en `stockeate-api/src/logger.provider.ts` y `stockeate-api/src/logger.module.ts`.
- El logger se inyecta por dependencia en servicios, interceptores y filtros usando el provider global.

#### Ejemplo de uso en servicios/interceptores/filtros

```typescript
import { Inject } from '@nestjs/common';
import { LOGGER } from './logger.provider';
import { Logger } from 'winston';

constructor(@Inject(LOGGER) private readonly logger: Logger) {}

this.logger.info('Mensaje informativo');
this.logger.error('Mensaje de error', { contexto: 'auth', userId });
```

#### Ejemplo de log generado

```
2025-11-14 20:00:16 [info]: ✅ API escuchando en 0.0.0.0:3000 (Swagger: /docs)
2025-11-14 20:01:10 [warn]: Intento de registro con email ya registrado: test@mail.com
2025-11-14 20:02:05 [error]: Excepción global atrapada: {"path":"/api/products","method":"POST","status":500,"message":"Internal server error"}
```

#### Recomendaciones y buenas prácticas

- No borres manualmente los archivos de logs: Winston los gestiona solo.
- Si necesitas auditar o depurar, revisa los archivos de la carpeta `logs/`.
- Para producción, mantené la rotación activa para evitar problemas de espacio en disco.
- Usá niveles de log adecuados (`info`, `warn`, `error`) según la criticidad del evento.
- Incluí contexto útil en los logs (por ejemplo, usuario, endpoint, parámetros relevantes).

#### Troubleshooting

- **No aparecen logs:**
  - Verifica que la carpeta `logs/` exista y tenga permisos de escritura.
  - Revisa el valor de `LOG_LEVEL` y `LOG_CONSOLE` en `.env`.
  - Asegúrate de que el provider esté correctamente importado en los módulos que usan el logger.
- **No rota o elimina archivos viejos:**
  - Revisa la opción `maxFiles` en la configuración del transport de Winston.
- **Quiero cambiar la cantidad de días de logs:**
  - Modifica el valor de `maxFiles` en `src/logger.provider.ts`.
- **Quiero desactivar la rotación:**
  - Reemplaza el transport `DailyRotateFile` por el de `File` estándar de Winston en la configuración del provider.

#### Dependencias

- Winston
- winston-daily-rotate-file
- Configuración y provider en `src/logger.provider.ts` y `src/logger.module.ts`

---