import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api';

type AuthState = {
  token: string | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string, dni?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const getMsg = (e: any): string => {
  const d = e?.response?.data;
  if (Array.isArray(d?.message)) return d.message.join(', ');
  return d?.message || e?.message || 'Error inesperado';
};

export const useAuth = create<AuthState>((set) => ({
  token: null,

  hydrate: async () => {
    try {
      const t = await AsyncStorage.getItem('token');
      set({ token: t });
    } catch (e) {
      console.warn('hydrate error', e);
      set({ token: null });
    }
  },

  login: async (email, password) => {
    try {
      const { data } = await api.post('/auth/login', { email, password });
      await AsyncStorage.setItem('token', data.access_token);
      set({ token: data.access_token });
    } catch (e: any) {
      throw new Error(getMsg(e));
    }
  },

register: async (email, password, firstName, lastName, dni) => {
  try {
    // DEBUG: Ver qué datos estamos enviando
    const requestData = { 
      email, 
      password,
      firstName,
      lastName,
      dni
    };
    console.log('🚀 Datos enviados al backend:', requestData);
    
    // Enviar todos los campos requeridos por el backend de Lisandro
    const { data } = await api.post('/auth/register', requestData);
    
    // NO auto-login, para que vuelva al login
    // await AsyncStorage.setItem('token', data.access_token);
    // set({ token: data.access_token });
  } catch (e: any) {
    throw new Error(getMsg(e));
  }
},

  logout: async () => {
    try {
      // borro de AsyncStorage
      await AsyncStorage.removeItem('token');

      // extra por las dudas en web
      if (typeof window !== 'undefined') {
        try { window.localStorage.removeItem('token'); } catch {}
      }

      // Si no guardás otras cosas, podés despejar todo:
      // await AsyncStorage.clear();
      // if (typeof window !== 'undefined') window.localStorage.clear();
    } finally {
      // esto fuerza a App.tsx a mostrar el stack de Login
      set({ token: null });
    }
  },
}));
