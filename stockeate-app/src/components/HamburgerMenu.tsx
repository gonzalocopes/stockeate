// src/components/HamburgerMenu.tsx

import React from 'react';
import { 
    Modal, 
    View, 
    Text, 
    TouchableOpacity, 
    StyleSheet, 
    TouchableWithoutFeedback,
    Dimensions, // Para obtener el ancho de la pantalla
    Platform // Mantener por si necesitas ajustes futuros específicos de plataforma
} from 'react-native';

// NOTA: Asegúrate de que esta ruta a tu store de temas sea correcta
import { useThemeStore } from '../stores/themeProviders'; 

// --- Definición de tipos (se mantiene igual) ---
type MenuItem = {
  label: string; 
  onPress: () => void; 
  isDestructive?: boolean; 
};

type HamburgerMenuProps = {
  visible: boolean;
  onClose: () => void;
  items: MenuItem[];
};

// Obtenemos el ancho de la pantalla una vez
const screenWidth = Dimensions.get('window').width;
// Define cuánto quieres que el menú cubra, por ejemplo, el 70% del ancho
const menuWidth = screenWidth * 0.70; 

export default function HamburgerMenu({ visible, onClose, items }: HamburgerMenuProps) {
  const { theme } = useThemeStore();

  const renderMenuItem = (item: MenuItem, index: number) => {
    
    const buttonStyle = {
      backgroundColor: item.isDestructive ? theme.colors.danger : theme.colors.card,
    };

    const textStyle = {
      color: item.isDestructive ? 'white' : theme.colors.text,
      fontWeight: item.isDestructive ? '700' as const : '500' as const,
    };

    return (
      <TouchableOpacity
        key={index}
        style={[styles.menuItem, buttonStyle]}
        onPress={() => {
          // Usamos setTimeout para que el modal tenga tiempo de cerrarse antes de la navegación
          setTimeout(() => {
            onClose();      // 1. Cierra el menú
            item.onPress(); // 2. Ejecuta la acción del botón
          }, 100); // Pequeño retraso para que la animación de cierre sea visible
        }}
        activeOpacity={0.8}
      >
        <Text style={[styles.menuItemText, textStyle]}>
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      animationType="fade" // O "slide" para un efecto de deslizamiento
    >
      {/* Área de superposición para cerrar el menú al tocar fuera */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          {/* El contenedor del menú ahora se desliza desde la derecha */}
          <View style={[
              styles.menuContainer, 
              { 
                backgroundColor: theme.colors.card, 
                borderColor: theme.colors.border,
                width: menuWidth, // Usamos el ancho calculado
              }
          ]}>
            {/* Aquí puedes agregar un título o logo del menú si quieres */}
            <View style={[styles.menuHeader, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.menuTitle, { color: theme.colors.text }]}>Menú Principal</Text>
            </View>

            {/* Renderizar los items */}
            {items.map(renderMenuItem)}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // Fondo semi-transparente
    justifyContent: 'flex-end', // Alinea el menú al final del contenedor (derecha)
    flexDirection: 'row', // Permite que el menú se posicione a la derecha
  },
  menuContainer: {
    // CLAVE PARA EL POSICIONAMIENTO DE CAJÓN LATERAL
    // No usamos 'absolute' aquí, el 'flexDirection: row' en overlay y 'width' en menuContainer lo logran
    height: '100%', // Cubre toda la altura
    // El 'width' se establecerá dinámicamente
    // backgroundColor y borderColor se pasan como estilo inline
    borderRadius: 0, // Eliminar bordes redondeados si quieres que cubra la esquina
    borderLeftWidth: 1, // Un borde a la izquierda del menú
    overflow: 'hidden',
    // Mantener sombra para un efecto de elevación
    shadowColor: '#000', 
    shadowOffset: { width: -2, height: 0 }, // Sombra a la izquierda del menú
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuHeader: {
    padding: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  menuItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, 
    borderBottomColor: 'transparent', // Ya no queremos un borde entre items si el fondo es sólido
  },
  menuItemText: {
    fontSize: 16, 
  },
});