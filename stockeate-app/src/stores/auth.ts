import { create } from "zustand";
import { api, setAuthToken } from "../api";

type AuthState = {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const getMsg = (e: any): string => {
  const d = e?.response?.data;
  if (Array.isArray(d?.message)) return d.message.join(", ");
  return d?.message || e?.message || "Error inesperado";
};

export const useAuth = create<AuthState>((set) => ({
  token: null,

  login: async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      const access = data?.access_token as string;
      set({ token: access });
      setAuthToken(access); 
    } catch (e: any) {
      throw new Error(getMsg(e));
    }
  },

  register: async (email, password) => {
    try {
      const { data } = await api.post("/auth/register", { email, password });
      const access = data?.access_token as string;
      set({ token: access });
      setAuthToken(access);
    } catch (e: any) {
      throw new Error(getMsg(e));
    }
  },

  logout: async () => {
    try {
      // si el backend expone logout server-side, podría pegarle acá
      // await api.post("/auth/logout");
    } finally {
      set({ token: null });
      setAuthToken(null); // quita Authorization
      // NO se guarda nada, así que al cerrar la app se pierde naturalmente.
    }
  },
}));
