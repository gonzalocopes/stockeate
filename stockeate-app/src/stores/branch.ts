import { create } from "zustand";
export const useBranch = create<{ branchId?: string | null; set: (id: string) => void }>((set) => ({
  branchId: null,
  set: (id: string) => set({ branchId: id }),
}));
