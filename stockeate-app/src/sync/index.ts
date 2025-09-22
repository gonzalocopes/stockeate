// src/sync/index.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { pullFromServer, wakeServer, PullPayload } from "../api";
import { applyPull } from "./apply";

async function getLastClock(branchId: string): Promise<number | null> {
  const raw = await AsyncStorage.getItem(`sync_clock:${branchId}`);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function setLastClock(branchId: string, clock: number) {
  await AsyncStorage.setItem(`sync_clock:${branchId}`, String(clock));
}

/**
 * Hace pull (delta si hay clock guardado, o snapshot si no).
 * - Despierta el server (Render).
 * - Aplica productos/movimientos en SQLite (sin duplicar).
 * - Guarda el nuevo clock.
 */
export async function pullBranchCatalog(branchId: string) {
  if (!branchId) {
    return { appliedProducts: 0, appliedMoves: 0, full: false, clock: 0 };
  }

  await wakeServer();

  const since = await getLastClock(branchId);
  let payload: PullPayload | null = null;

  try {
    payload = await pullFromServer(branchId, since ?? undefined);
  } catch (e: any) {
    console.log("SYNC_BRANCH_CATALOG_FAIL", e);
    return { appliedProducts: 0, appliedMoves: 0, full: false, clock: since ?? 0 };
  }

  try {
    await applyPull(branchId, payload);
    await setLastClock(branchId, payload.clock);
  } catch (e) {
    console.log("APPLY_PULL_FAIL", e);
  }

  return {
    appliedProducts: payload?.products?.length ?? 0,
    appliedMoves: payload?.stockMoves?.length ?? 0,
    full: !!payload?.full,
    clock: payload?.clock ?? (since ?? 0),
  };
}
