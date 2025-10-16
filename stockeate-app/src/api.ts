// src/api.ts (forzando Render)
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

<<<<<<< Updated upstream
const baseURL = "https://stockeate.onrender.com";
=======
// Config por ENV, fallback a ngrok
const baseURL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "https://2fbaeaf479c7.ngrok-free.app"; // <-- ¡Recuerda actualizar esto con tu URL de ngrok activa!

>>>>>>> Stashed changes
console.log("[API baseURL]", baseURL);

export const api = axios.create({
  baseURL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
<<<<<<< Updated upstream
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers = {
      ...(config.headers ?? {}),
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});
=======
  try {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

// -------- Tipos de Sincronización (Pull) --------

export type PullProduct = {
  code: string;
  name: string;
  price?: number;
  stock?: number;
  branch_id: string;
  updated_at?: number;
};

export type PullMove = {
  id: string;
  productCode: string;
  branchId: string;
  delta: number;
  reason?: string;
  created_at?: number;
};

export type PullRemito = {
  id: string;
  tmpNumber: string;
  customer?: string;
  notes?: string;
  createdAt: string;
  branchId: string;
};

export type PullRemitoItem = {
  id: string;
  remitoId: string;
  productId: string;
  qty: number;
  unitPrice: number;
};

// --- 👇 ÚNICA DEFINICIÓN CORRECTA Y COMPLETA DE PullPayload ---
export type PullPayload = {
  clock: number;
  full: boolean;
  products: PullProduct[];
  stockMoves: PullMove[];
  remitos: PullRemito[];
  remitoItems: PullRemitoItem[];
};

// -------- Funciones de la API --------

export async function pullFromServer(branchId: string, since?: number): Promise<PullPayload> {
  const { data } = await api.get<PullPayload>("/sync/pull", {
    params: { branchId, since },
  });
  console.log("DATOS RECIBIDOS DEL SERVIDOR (PULL):", JSON.stringify(data, null, 2));
  return data;
}

export async function uploadRemitoFile(file: { uri: string; name: string; type?: string; }, branchId: string) {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type || 'application/octet-stream',
  } as any);
  formData.append('branchId', branchId);

  const { data } = await api.post('/digitalized-remito/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'ngrok-skip-browser-warning': 'true', // <-- Cabecera importante restaurada
    },
  });
  return data;
}

// (La función wakeServer se puede eliminar si no la usas, o dejarla)
export async function wakeServer() {
  try {
    await api.get("/health", { timeout: 5000 });
  } catch {}
}
>>>>>>> Stashed changes
