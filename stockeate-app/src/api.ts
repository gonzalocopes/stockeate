// src/api.ts
import axios, { AxiosRequestHeaders } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Config por ENV, fallback a Render
const baseURL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "https://stockeate.onrender.com"; // <-- URL de producción (o tu ngrok para pruebas)
console.log("[API baseURL]", baseURL);

export const api = axios.create({
  baseURL,
  timeout: 30000,
});

// Interceptor de Debug "Rayos X"
api.interceptors.request.use(request => {
  console.log(`🚀 [AXIOS RAY-X] Petición: ${request.method?.toUpperCase()} ${request.baseURL}${request.url}`);
  return request;
});

// Interceptor de Token
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (token && config.headers) {
      (config.headers as AxiosRequestHeaders).set("Authorization", `Bearer ${token}`);
    }
  } catch (e) {
    console.error("Error reading token from AsyncStorage", e);
  }
  return config;
});

// -------- Pull (para sync) --------
export async function wakeServer() {
  try {
    await api.get("/health", { timeout: 5000 });
  } catch {
    try {
      await api.get("/branches", { timeout: 8000 });
    } catch {}
  }
}

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

// --- 👇 TIPO ACTUALIZADO CON NUEVOS CAMPOS ---
export type PullRemito = {
  id: string;
  tmpNumber: string;
  customer?: string;
  // --- CAMPOS NUEVOS AÑADIDOS ---
  customerCuit?: string;
  customerAddress?: string;
  customerTaxCondition?: string;
  // --- FIN CAMPOS NUEVOS ---
  notes?: string;
  createdAt: string; // O Date
  branchId: string;
};

export type PullRemitoItem = {
  id: string;
  remitoId: string;
  productId: string;
  qty: number;
  unitPrice: number;
};

// --- PullPayload (ya estaba correcto) ---
export type PullPayload = {
  clock: number;
  full: boolean;
  products: PullProduct[];
  stockMoves: PullMove[];
  remitos: PullRemito[];
  remitoItems: PullRemitoItem[];
};

export async function pullFromServer(branchId: string, since?: number): Promise<PullPayload> {
  const { data } = await api.get<PullPayload>("/sync/pull", {
    params: { branchId, since },
  });
  // console.log("DATOS RECIBIDOS (PULL):", JSON.stringify(data, null, 2));
  return data;
}

// --- 👇 FUNCIÓN 'uploadRemitoFile' REAL RESTAURADA ---
export async function uploadRemitoFile(file: { uri: string; name: string; type?: string; }, branchId: string) {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.type || 'application/octet-stream',
  } as any);
  formData.append('branchId', branchId);

  // Usamos la instancia 'api' global
  const { data } = await api.post('/digitalized-remito/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      'ngrok-skip-browser-warning': 'true', // Útil para pruebas con ngrok
    },
  });
  return data;
}