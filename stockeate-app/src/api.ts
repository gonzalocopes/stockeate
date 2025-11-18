import axios, { AxiosRequestHeaders } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// Config por ENV, fallback a Render
const baseURL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "https://stockeate.onrender.com";
console.log("[API baseURL]", baseURL);

export const api = axios.create({
  baseURL,
  timeout: 30000,
});

// Interceptor de Debug "Rayos X"
api.interceptors.request.use((request) => {
  console.log(
    `🚀 [AXIOS RAY-X] Petición: ${request.method?.toUpperCase()} ${request.baseURL}${request.url}`
  );
  return request;
});

// Interceptor de Token
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (token && config.headers) {
      (config.headers as AxiosRequestHeaders).set(
        "Authorization",
        `Bearer ${token}`
      );
    }
  } catch (e) {
    console.error("Error reading token from AsyncStorage", e);
  }
  return config;
});

// -------- Wake / Health --------
export async function wakeServer() {
  try {
    await api.get("/health", { timeout: 5000 });
  } catch {
    try {
      await api.get("/branches", { timeout: 8000 });
    } catch {}
  }
}

// -------- Tipos de Sync --------
export type PullProduct = {
  id: string;
  code: string;
  name: string;
  price?: number;
  stock?: number;
  branch_id: string;
  updated_at?: number;
  archived?: number;
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
  customerCuit?: string;
  customerAddress?: string;
  customerTaxCondition?: string;
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

export type PullPayload = {
  clock: number;
  full: boolean;
  products: PullProduct[];
  stockMoves: PullMove[];
  remitos: PullRemito[];
  remitoItems: PullRemitoItem[];
};

export async function pullFromServer(
  branchId: string,
  since?: number
): Promise<PullPayload> {
  const { data } = await api.get<PullPayload>("/sync/pull", {
    params: { branchId, since },
  });
  return data;
}

// -------- Upload de Remito (imagen/PDF) --------
export async function uploadRemitoFile(
  file: { uri: string; name: string; type?: string },
  branchId: string
) {
  const formData = new FormData();

  if (Platform.OS === "web") {
    // 🕸️ WEB: el uri suele ser blob:, lo convertimos a Blob real
    const response = await fetch(file.uri);
    const blob = await response.blob();
    formData.append("file", blob, file.name);
  } else {
    // 📱 NATIVO: usamos el objeto con uri
    formData.append(
      "file",
      {
        uri: file.uri,
        name: file.name,
        type: file.type || "application/octet-stream",
      } as any
    );
  }

  formData.append("branchId", branchId);

  // Importante: NO forzar Content-Type,
  // dejamos que Axios / RN / navegador agreguen el boundary correcto.
  const headers: Record<string, string> = {
    "ngrok-skip-browser-warning": "true",
  };

  try {
    const { data } = await api.post("/digitalized-remito/upload", formData, {
      headers,
    });
    return data;
  } catch (error: any) {
    console.error(
      "Error en uploadRemitoFile:",
      JSON.stringify(
        {
          message: error?.message,
          status: error?.response?.status,
          data: error?.response?.data,
        },
        null,
        2
      )
    );
    throw error;
  }
}
/* asdad*/