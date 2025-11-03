// src/api.ts
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Config por ENV, fallback a Render
const baseURL =
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  "https://stockeate.onrender.com";

console.log("[API baseURL]", baseURL);

export const api = axios.create({
  baseURL,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (token) {
      if (!config.headers) {
        config.headers = {} as any;
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
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

// -------- Auth --------
export async function register(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  role?: string,
  dni?: string,
  cuit?: string,
) {
  const { data } = await api.post("/auth/register", {
    email,
    password,
    firstName,
    lastName,
    role,
    dni,
    cuit,
  });
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", {
    email,
    password,
  });
  return data;
}

export async function updateProfile(
  firstName?: string,
  lastName?: string,
  avatarUrl?: string,
  role?: string,
  dni?: string,
  cuit?: string,
) {
  const { data } = await api.put("/auth/profile", {
    firstName,
    lastName,
    avatarUrl,
    role,
    dni,
    cuit,
  });
  return data;
}

export type PullProduct = {
  code: string;
  name: string;
  price?: number;
  stock?: number;      // <<--- agregado
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

export type PullPayload = {
  clock: number;
  full: boolean;
  products: PullProduct[];
  stockMoves: PullMove[];
};

export async function pullFromServer(branchId: string, since?: number): Promise<PullPayload> {
  const { data } = await api.get<PullPayload>("/sync/pull", {
    params: { branchId, since },
  });
  return data;
}
