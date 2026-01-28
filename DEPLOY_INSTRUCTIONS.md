# Guía de Despliegue - Stockeate

Dado que tu proyecto tiene un **Frontend (Expo/React Native Web)** y un **Backend (NestJS)**, la mejor estrategia gratuita y profesional es usar:
- **Vercel** para el Frontend (Stockeate App).
- **Render** para el Backend (Stockeate API) y la Base de Datos.

El backend en NestJS requiere un servidor activo, por lo que Render es mucho más fácil de configurar que Vercel (que requeriría modificar el código para serverless).

## Paso 1: Backend en Render (Gratis)

1.  Crea una cuenta en [render.com](https://render.com/).
2.  **Base de Datos**:
    -   En el dashboard de Render, click en **New +** -> **PostgreSQL**.
    -   Name: `stockeate-db`.
    -   Copia la `Internal DB URL` (para usarla dentro de Render) y la `External DB URL` (para acceder desde tu PC si hace falta).
3.  **Backend Web Service**:
    -   Click **New +** -> **Web Service**.
    -   Conecta tu repositorio de GitHub.
    -   **Root Directory**: `stockeate-api` (¡Muy importante!).
    -   **Building Command**: `npm install && npm run build`.
    -   **Start Command**: `npm run start:prod`.
    -   **Environment Variables** (Avanzado):
        -   Key: `DATABASE_URL`
        -   Value: (Pega la `Internal DB URL` que copiaste en el paso anterior).
        -   Key: `JWT_SECRET` (o las claves que uses en tu .env local).
4.  Dale a **Create Web Service**. Espera a que diga "Live".
5.  Copia la URL de tu backend (ej: `https://stockeate-api.onrender.com`).

## Paso 2: Frontend en Vercel (Gratis)

1.  Crea una cuenta en [vercel.com](https://vercel.com/).
2.  Click **Add New...** -> **Project**.
3.  Importa tu repositorio git.
4.  **Configuración del Proyecto**:
    -   **Root Directory**: Click en Edit y selecciona la carpeta `stockeate-app`.
    -   **Framework Preset**: Vercel debería detectar "Create React App" o similar. Si no, elige "Other".
    -   **Build Command**: `npx expo export -p web` (Escribe esto manualmente si no aparece).
    -   **Output Directory**: `dist` (Esto es lo que genera Expo por defecto).
5.  **Environment Variables**:
    -   Key: `EXPO_PUBLIC_API_URL`
    -   Value: (La URL de tu backend en Render sin la barra final, ej: `https://stockeate-api.onrender.com`).
6.  Click **Deploy**.

## Notas Importantes

-   **Base de Datos**: Como usas Prisma, asegurate de que en el comando de Build del backend en Render se ejecuten las migraciones si es necesario.
    -   Puedes cambiar el Build Command a: `npm install && npx prisma generate && npm run build` (Recomendado).
-   **CORS**: Si tu backend da error de CORS, asegúrate de que en `main.ts` tengas `app.enableCors()` configurado (ya lo tienes en tu código).
