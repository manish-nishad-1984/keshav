import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';

interface UiState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  /** Desktop sidebar: true = narrow icon rail (default), false = expanded with labels and child links. */
  navCollapsed: boolean;
  toggleNavCollapsed: () => void;
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
      navCollapsed: true,
      toggleNavCollapsed: () => set((state) => ({ navCollapsed: !state.navCollapsed })),
    }),
    {
      name: 'ckfast-ui',
      partialize: (state) => ({ theme: state.theme, navCollapsed: state.navCollapsed }),
      // Keep any preference the user already saved. One build stored it inverted as
      // `navExpanded`; translate that rather than resetting it. Nothing saved → the default rail.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Pick<UiState, 'theme' | 'navCollapsed'>> & { navExpanded?: boolean };
        const navCollapsed =
          typeof saved.navCollapsed === 'boolean'
            ? saved.navCollapsed
            : typeof saved.navExpanded === 'boolean'
              ? !saved.navExpanded
              : current.navCollapsed;
        return { ...current, ...(saved.theme ? { theme: saved.theme } : {}), navCollapsed };
      },
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
