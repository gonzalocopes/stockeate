import { create } from 'zustand';

export type BatchItem = {
  product_id: string;
  code: string;
  name: string;
  qty: number;
  unit_price: number;
};

type BatchState = {
  items: BatchItem[];
  addOrInc: (item: Omit<BatchItem, 'qty'>, inc?: number) => void;
  dec: (code: string) => void;
  remove: (code: string) => void;
  clear: () => void;
  totalQty: () => number;
};

export const useBatch = create<BatchState>((set, get) => ({
  items: [],

  addOrInc: (item, inc = 1) => {
    const items = [...get().items];
    const idx = items.findIndex(i => i.code === item.code);
    if (idx >= 0) {
      items[idx] = { ...items[idx], qty: items[idx].qty + inc };
    } else {
      items.push({ ...item, qty: inc });
    }
    set({ items });
  },

  dec: (code) => {
    const items = [...get().items];
    const idx = items.findIndex(i => i.code === code);
    if (idx >= 0) {
      const next = items[idx].qty - 1;
      if (next <= 0) items.splice(idx, 1);
      else items[idx] = { ...items[idx], qty: next };
      set({ items });
    }
  },

  remove: (code) => {
    set({ items: get().items.filter(i => i.code !== code) });
  },

  clear: () => set({ items: [] }),

  totalQty: () => get().items.reduce((a, b) => a + b.qty, 0),
}));
