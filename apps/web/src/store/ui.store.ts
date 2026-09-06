import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface UiState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const applyTheme = (theme: Theme): void => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme: Theme) => {
        applyTheme(theme);
        set({ theme });
      },
      // sidebarCollapsed / density / expandedNavGroups can live in this same store later —
      // it's a general "shell preferences" store, not theme-only.
    }),
    {
      name: 'ckfast-ui',
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useUiStore.getState();
    if (theme === 'system') applyTheme('system');
  });
}
