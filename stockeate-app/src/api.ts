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

// Interceptor de Token (para TODAS las peticiones Axios normales)
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
    await api.get("/branches", { timeout: 20000 });
  } catch (e) {
    console.error("WAKE_SERVER_FAIL", e);
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
// ⚠️ IMPORTANTE: acá NO usamos axios, usamos fetch para evitar el "Network Error" en APK.
export async function uploadRemitoFile(
  file: { uri: string; name: string; type?: string },
  branchId: string
) {
  const formData = new FormData();

  if (Platform.OS === "web") {
    // 🕸️ WEB: convertir el blob
    const response = await fetch(file.uri);
    const blob = await response.blob();
    const webFile = new File([blob], file.name, {
      type: file.type || blob.type || "application/octet-stream",
    });
    formData.append("file", webFile);
  } else {
    // 📱 NATIVO (Android / iOS)
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

  // Traemos el token a mano (no pasa por el interceptor de axios porque usamos fetch)
  const token = await AsyncStorage.getItem("token");

  const headers: Record<string, string> = {
    Accept: "application/json",
    "ngrok-skip-browser-warning": "true",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = `${baseURL}/digitalized-remito/upload`;
  console.log("[Upload][fetch] POST", url, "branchId:", branchId);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    const text = await response.text();
    if (!response.ok) {
      console.error(
        "[Upload][fetch] Error HTTP",
        response.status,
        text.slice(0, 400)
      );
      throw new Error(`Upload failed with status ${response.status}`);
    }

    try {
      const json = JSON.parse(text);
      console.log("[Upload][fetch] OK, respuesta:", json);
      return json;
    } catch (parseErr) {
      console.error("[Upload][fetch] Error parseando JSON:", parseErr, text);
      throw new Error("Respuesta de la API no es JSON válido");
    }
  } catch (error: any) {
    console.error(
      "[Upload][fetch] Network/other error:",
      error?.message ?? error
    );
    throw error;
  }
}
