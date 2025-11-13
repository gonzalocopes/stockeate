import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../stores/auth';

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  
  // Tema de colores igual al LoginScreen
  const c = {
    bg1: "#0F1020",
    bg2: "#0A0B14",
    accent: "#4C6FFF",
    accent2: "#8B5CF6",
    text: "#E6E8F2",
    sub: "rgba(230,232,242,0.7)",
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(255,255,255,0.12)",
    danger: "#FF6B6B",
  };
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
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
    if (!formData.dni.trim()) {
      Alert.alert('Error', 'El DNI es requerido');
      return false;
    }

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
      // Enviar todos los campos - backend actual ignora los extras
      await register(
        formData.email,
        formData.password,
        formData.nombre,
        formData.apellido,
        formData.dni
      );
      
      Alert.alert(
        'Registro exitoso',
        'Tu cuenta ha sido creada correctamente',
        [
          {
            text: 'Iniciar sesión',
            onPress: () => navigation.navigate('Login')
          }
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al registrar usuario');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Crear cuenta</Text>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={styles.input}
            value={formData.nombre}
            onChangeText={(value) => handleInputChange('nombre', value)}
            placeholder="Ingresa tu nombre"
            placeholderTextColor="rgba(230,232,242,0.35)"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Apellido *</Text>
          <TextInput
            style={styles.input}
            value={formData.apellido}
            onChangeText={(value) => handleInputChange('apellido', value)}
            placeholder="Ingresa tu apellido"
            placeholderTextColor="rgba(230,232,242,0.35)"
            autoCapitalize="words"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>DNI *</Text>
          <TextInput
            style={styles.input}
            value={formData.dni}
            onChangeText={(value) => handleInputChange('dni', value)}
            placeholder="Ingresa tu DNI"
            placeholderTextColor="rgba(230,232,242,0.35)"
            keyboardType="numeric"
            maxLength={8}
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Email *</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={(value) => handleInputChange('email', value)}
            placeholder="ejemplo@correo.com"
            placeholderTextColor="rgba(230,232,242,0.35)"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contraseña *</Text>
          <TextInput
            style={styles.input}
            value={formData.password}
            onChangeText={(value) => handleInputChange('password', value)}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="rgba(230,232,242,0.35)"
            secureTextEntry
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirmar contraseña *</Text>
          <TextInput
            style={styles.input}
            value={formData.confirmPassword}
            onChangeText={(value) => handleInputChange('confirmPassword', value)}
            placeholder="Repite tu contraseña"
            placeholderTextColor="rgba(230,232,242,0.35)"
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={[styles.registerButton, loading && styles.disabledButton]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.registerButtonText}>Crear cuenta</Text>
          )}
        </TouchableOpacity>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
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
    backgroundColor: '#0F1020', // Fondo oscuro del LoginScreen
  },
  form: {
    margin: 20,
    backgroundColor: 'rgba(255,255,255,0.06)', // Fondo de tarjeta del LoginScreen
    borderRadius: 12,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)', // Borde del LoginScreen
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#E6E8F2', // Color de texto del LoginScreen
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(230,232,242,0.7)', // Color de texto secundario del LoginScreen
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)', // Borde del LoginScreen
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.06)', // Fondo de input del LoginScreen
    color: '#E6E8F2', // Color de texto del LoginScreen
  },
  registerButton: {
    backgroundColor: '#4C6FFF', // Color accent del LoginScreen
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: 'rgba(76,111,255,0.5)', // Versión deshabilitada del accent
  },
  registerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginText: {
    fontSize: 14,
    color: 'rgba(230,232,242,0.7)', // Color de texto secundario del LoginScreen
  },
  loginLink: {
    fontSize: 14,
    color: '#4C6FFF', // Color accent del LoginScreen
    fontWeight: '600',
  },
});