import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type BranchState = {
  id: string | null;
  name: string | null;
  hydrate: () => Promise<void>;
  set: (id: string, name?: string | null) => Promise<void>;
  clear: () => Promise<void>;
};

export const useBranch = create<BranchState>((set) => ({
  id: null,
  name: null,

  hydrate: async () => {
    try {
      const [id, name] = await Promise.all([
        AsyncStorage.getItem('branch_id'),
        AsyncStorage.getItem('branch_name'),
      ]);
      set({ id, name });
    } catch {
      set({ id: null, name: null });
    }
  },

  set: async (id, name) => {
    await AsyncStorage.setItem('branch_id', id);
    if (name != null) await AsyncStorage.setItem('branch_name', name);
    set({ id, name: name ?? null });
  },

  clear: async () => {
    await Promise.all([
      AsyncStorage.removeItem('branch_id'),
      AsyncStorage.removeItem('branch_name'),
    ]);
    set({ id: null, name: null });
  },
}));
