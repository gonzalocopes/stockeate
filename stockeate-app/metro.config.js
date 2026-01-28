const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configurar resolución de plataformas
// No es necesario sobrescribir 'platforms' a menos que quieras quitar alguna.
// config.resolver.platforms = ['ios', 'android', 'native', 'web']; 

// Configurar extensiones de archivos
// NOTA: 'ts' y 'tsx' ya vienen por defecto en Expo, no hace falta agregarlas manual.
// config.resolver.sourceExts = [...config.resolver.sourceExts, 'ts', 'tsx'];

// AGREGADO: Permitir que Metro empaquete archivos .wasm y .db
config.resolver.assetExts.push('wasm', 'db');

module.exports = config;