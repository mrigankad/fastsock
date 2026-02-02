import { create } from 'zustand';

interface ThemeState {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  isDarkMode: localStorage.getItem('darkMode') === 'true' || 
             (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches),
  toggleDarkMode: () => set((state) => {
    const newValue = !state.isDarkMode;
    localStorage.setItem('darkMode', newValue.toString());
    return { isDarkMode: newValue };
  }),
  setDarkMode: (value: boolean) => {
    localStorage.setItem('darkMode', value.toString());
    set({ isDarkMode: value });
  },
}));