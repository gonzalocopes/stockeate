// src/components/DropdownMenu.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';

interface DropdownMenuItem {
  label: string;
  onPress: () => void;
  isDestructive?: boolean;
}

interface DropdownMenuProps {
  visible: boolean;
  onClose: () => void;
  items: DropdownMenuItem[];
}

export default function DropdownMenu({ visible, onClose, items }: DropdownMenuProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.dropdownMenu}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => {
                  onClose();
                  item.onPress();
                }}
                style={styles.dropdownMenuItem}
              >
                <Text
                  style={[
                    styles.dropdownMenuItemText,
                    item.isDestructive && styles.destructiveText,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
  },
  dropdownMenu: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 50 : 90,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 150,
  },
  dropdownMenuItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  dropdownMenuItemText: {
    fontSize: 16,
    color: '#1c1c1e',
  },
  destructiveText: {
    color: 'rgb(195, 12, 12)',
  },
});