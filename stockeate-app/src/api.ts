import axios, { AxiosRequestHeaders } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Config por ENV, fallback a Render
const baseURL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "https://stockeate.onrender.com"; // <-- O tu ngrok si estás probando
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

// --- 👇 TIPO ACTUALIZADO ---
export type PullProduct = {
  id: string; // <-- 1. ¡ESTA ES LA LÍNEA QUE FALTABA!
  code: string;
  name: string;
  price?: number;
  stock?: number;
  branch_id: string;
  updated_at?: number;
  archived?: number; // Añadido para consistencia
};
// --- FIN DEL CAMBIO ---

export type PullMove = {
  id: string;
  productCode: string;
  branchId: string;
  delta: number;
  reason?: string;
  created_at?: number;
};

// --- 👇 TIPO ACTUALIZADO ---
export type PullRemito = {
  id: string;
  tmpNumber: string;
  customer?: string;
  customerCuit?: string;
  customerAddress?: string;
  customerTaxCondition?: string;
  notes?: string;
  createdAt: string;
  branchId: string;
};

// --- 👇 TIPO ACTUALIZADO ---
export type PullRemitoItem = {
  id: string;
  remitoId: string;
  productId: string;
  qty: number;
  unitPrice: number;
};

// --- 👇 PullPayload ACTUALIZADO ---
export type PullPayload = {
  clock: number;
  full: boolean;
  products: PullProduct[];
  stockMoves: PullMove[];
  remitos: PullRemito[]; // <-- AÑADIDO
  remitoItems: PullRemitoItem[]; // <-- AÑADIDO
};

export async function pullFromServer(branchId: string, since?: number): Promise<PullPayload> {
  const { data } = await api.get<PullPayload>("/sync/pull", {
    params: { branchId, since },
  });
  return data;
}

// --- Función 'uploadRemitoFile' (ya estaba correcta) ---
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
      'ngrok-skip-browser-warning': 'true',
    },
  });
  return data;
}