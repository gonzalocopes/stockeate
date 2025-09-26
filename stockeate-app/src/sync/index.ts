// src/sync/index.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { pullFromServer, wakeServer, PullPayload } from "../api";
import { applyPull } from "./apply";

export async function pullBranchCatalog(branchId: string) {
  if (!branchId) return { appliedProducts: 0, appliedMoves: 0, full: false, clock: 0 };

  await wakeServer();

  // 👇 SIEMPRE snapshot completo para que los deletes se propaguen
  const since: number | undefined = undefined;

  let payload: PullPayload | null = null;

  try {
    payload = await pullFromServer(branchId, since);
  } catch (e: any) {
    console.log("SYNC_BRANCH_CATALOG_FAIL", e?.message || e);
    return { appliedProducts: 0, appliedMoves: 0, full: false, clock: 0 };
  }

  try {
    await applyPull(branchId, payload);
    // opcional: no guardamos clock porque siempre pedimos full
  } catch (e) {
    console.log("APPLY_PULL_FAIL", e);
  }

  return {
    appliedProducts: payload?.products?.length ?? 0,
    appliedMoves: payload?.stockMoves?.length ?? 0,
    full: true,
    clock: payload?.clock ?? 0,
  };
}
