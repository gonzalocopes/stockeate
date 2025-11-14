// G:\proyectos\stockeate\stockeate-app\src\screens\RegisterScreen.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useAuth } from '../stores/auth';

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '', // 👈 AÑADIDO: Campo DNI al estado
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validateForm = () => {
    if (!formData.nombre.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return false;
    }
    if (!formData.apellido.trim()) {
      Alert.alert('Error', 'El apellido es requerido');
      return false;
    }
    
    // 👇 AÑADIDO: Validación de DNI
    if (!formData.dni.trim()) {
      Alert.alert('Error', 'El DNI es requerido');
      return false;
    }
    if (formData.dni.length < 7 || formData.dni.length > 8) {
      Alert.alert('Error', 'El DNI debe tener entre 7 y 8 números');
      return false;
    }
    // ---

    if (!formData.email.trim()) {
      Alert.alert('Error', 'El email es requerido');
      return false;
    }
    if (formData.password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Error', 'Las contraseñas no coinciden');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // 👇 MODIFICADO: Enviamos todos los campos al store
      await register(
        formData.email,
        formData.password,
        formData.nombre,
        formData.apellido,
        formData.dni
      );
      
      Alert.alert(
        'Registro exitoso',
        'Tu cuenta ha sido creada. Ahora puedes iniciar sesión.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      Alert.alert('Error en el registro', error.message || 'No se pudo completar el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Crear Cuenta</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={formData.nombre}
            onChangeText={(val) => handleInputChange('nombre', val)}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Apellido</Text>
          <TextInput
            style={styles.input}
            value={formData.apellido}
            onChangeText={(val) => handleInputChange('apellido', val)}
            autoCapitalize="words"
          />
        </View>

        {/* 👇 AÑADIDO: Input de DNI */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>DNI</Text>
          <TextInput
            style={styles.input}
            value={formData.dni}
            onChangeText={(val) => handleInputChange('dni', val)}
            keyboardType="number-pad"
            maxLength={8}
          />
        </View>
        {/* --- */}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(val) => handleInputChange('email', val)}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contraseña (mín. 6 caracteres)</Text>
          <TextInput
            style={styles.input}
            value={formData.password}
            onChangeText={(val) => handleInputChange('password', val)}
            secureTextEntry
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirmar Contraseña</Text>
          <TextInput
            style={styles.input}
            value={formData.confirmPassword}
            onChangeText={(val) => handleInputChange('confirmPassword', val)}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          style={[styles.registerButton, loading && styles.buttonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Registrarme</Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginLinkContainer}>
          <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.loginLink}>Inicia sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  form: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  registerButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#a0c8ff',
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  loginText: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  loginLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});