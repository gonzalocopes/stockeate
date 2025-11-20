// store/themeStore.ts
import { create } from 'zustand';
import { themes } from '../screens/useThemeColors';


type Thememode = 'light' | 'dark';

export interface Theme {
    mode: Thememode;
    theme: typeof themes.light;
    toggleTheme: () => void;
}

export const useThemeStore = create<Theme>((set, get) => ({
    mode: 'light',
    theme: themes.light,
    toggleTheme: () => {
        const newMode = get().mode === 'light' ? 'dark' : 'light';
        set({ mode: newMode, theme: themes[newMode] });
    },
}));