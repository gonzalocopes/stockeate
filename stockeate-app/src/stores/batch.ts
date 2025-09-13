import { create } from "zustand";
export type BatchItem = { id: string; code: string; name: string; unitPrice: number; qty: number };
type S = {
  items: Record<string, BatchItem>;
  addOrInc: (p: Omit<BatchItem, "qty">) => void;
  inc: (id: string) => void; dec: (id: string) => void; remove: (id: string) => void; clear: () => void;
  asArray: () => BatchItem[];
};
export const useBatch = create<S>((set, get) => ({
  items: {},
  addOrInc: (p) => set((s) => {
    const existing = s.items[p.id];
    if (existing) return { items: { ...s.items, [p.id]: { ...existing, qty: existing.qty + 1 } } };
    return { items: { ...s.items, [p.id]: { ...p, qty: 1 } } };
  }),
  inc: (id) => set((s) => ({ items: { ...s.items, [id]: { ...s.items[id], qty: s.items[id].qty + 1 } } })),
  dec: (id) => set((s) => {
    const it = s.items[id]; if (!it) return s;
    if (it.qty <= 1) { const { [id]:_, ...rest } = s.items; return { items: rest }; }
    return { items: { ...s.items, [id]: { ...it, qty: it.qty - 1 } } };
  }),
  remove: (id) => set((s) => { const { [id]:_, ...rest } = s.items; return { items: rest }; }),
  clear: () => set({ items: {} }),
  asArray: () => Object.values(get().items),
}));
