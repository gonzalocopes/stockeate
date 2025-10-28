const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configurar resolución de plataformas
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Configurar extensiones de archivos
config.resolver.sourceExts = [...config.resolver.sourceExts, 'ts', 'tsx'];

module.exports = config;