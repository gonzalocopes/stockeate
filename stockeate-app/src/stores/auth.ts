// G:\proyectos\stockeate\stockeate-app\src\stores\auth.ts

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';

type AuthState = {
  token: string | null;
  // 👇 AÑADIDO: user (para el menú hamburguesa)
  user: { name: string; email: string } | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  // 👇 MODIFICADO: La firma de register ahora acepta todos los campos
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    dni: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
};

const getMsg = (e: any): string => {
  const d = e?.response?.data;
  if (Array.isArray(d?.message)) return d.message.join(', ');
  return d?.message || e?.message || 'Error inesperado';
};

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null, // 👈 AÑADIDO

  hydrate: async () => {
    try {
      const t = await AsyncStorage.getItem('token');
      // 👇 AÑADIDO: lógica para cargar el usuario también
      const u = await AsyncStorage.getItem('user');
      set({ token: t, user: u ? JSON.parse(u) : null });
    } catch (e) {
      console.warn('hydrate error', e);
      set({ token: null, user: null });
    }
  },

  login: async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await AsyncStorage.setItem('token', data.access_token);
      
      // 👇 AÑADIDO: Decodificar token para guardar datos del usuario (opcional pero útil)
      // Nota: Esta es una decodificación simple, no una verificación.
      const payload = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64').toString());
      const user = { name: payload.name || 'Usuario', email: payload.email };
      await AsyncStorage.setItem('user', JSON.stringify(user));
      
      set({ token: data.access_token, user });
    } catch (e: any) {
      throw new Error(getMsg(e));
    }
  },

  // 👇 MODIFICADO: 'register' ahora usa todos los campos
  register: async (email, password, firstName, lastName, dni) => {
    try {
      // Ahora enviamos todos los campos al backend
      await api.post('/auth/register', {
        email,
        password,
        firstName,
        lastName,
        dni,
      });
      
      // No hacemos auto-login, el usuario deberá iniciar sesión
    } catch (e: any) {
      throw new Error(getMsg(e));
    }
  },

  logout: async () => {
    try {
      // borro de AsyncStorage
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user'); // 👈 AÑADIDO

      // extra por las dudas en web
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem('token');
          window.localStorage.removeItem('user'); // 👈 AÑADIDO
        } catch {}
      }
    } catch (e) {
      console.warn('logout error', e);
    } finally {
      // Limpiamos el estado
      set({ token: null, user: null }); // 👈 MODIFICADO
    }
  },
}));

// Helper para decodificar (requiere 'buffer', usualmente ya está en RN)
import { Buffer } from 'buffer';
