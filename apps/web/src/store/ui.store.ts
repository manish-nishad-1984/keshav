import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'comfort' | 'light' | 'dark' | 'system';
/** Colour palette (brand + surface tint), independent of the mode. See [data-palette] in index.css. */
export type Palette = 'blue' | 'teal' | 'green' | 'indigo' | 'purple' | 'maroon' | 'saffron' | 'graphite';

interface UiState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  palette: Palette;
  setPalette: (palette: Palette) => void;
  /** Desktop sidebar: true = narrow icon rail (default), false = expanded with labels and child links. */
  navCollapsed: boolean;
  toggleNavCollapsed: () => void;
}

const applyTheme = (theme: Theme): void => {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
  // Comfort = the default light look (lower-glare tokens layered over :root, see index.css).
  root.classList.toggle('theme-comfort', !isDark && theme !== 'light');
};

const applyPalette = (palette: Palette): void => {
  // Blue is the :root default, so it needs no attribute.
  if (palette === 'blue') document.documentElement.removeAttribute('data-palette');
  else document.documentElement.setAttribute('data-palette', palette);
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'comfort',
      setTheme: (theme: Theme) => {
        applyTheme(theme);
        set({ theme });
      },
      palette: 'blue',
      setPalette: (palette: Palette) => {
        applyPalette(palette);
        set({ palette });
      },
      navCollapsed: true,
      toggleNavCollapsed: () => set((state) => ({ navCollapsed: !state.navCollapsed })),
    }),
    {
      name: 'ckfast-ui',
      // v1: 'comfort' became the default. 'light' was the old default rather than an explicit
      // choice, so move it to comfort; dark/system choices are kept.
      version: 1,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as { theme?: Theme };
        if (version < 1 && state.theme === 'light') return { ...state, theme: 'comfort' } as UiState;
        return state as UiState;
      },
      partialize: (state) => ({ theme: state.theme, palette: state.palette, navCollapsed: state.navCollapsed }),
      // Keep any preference the user already saved. One build stored it inverted as
      // `navExpanded`; translate that rather than resetting it. Nothing saved → the default rail.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<Pick<UiState, 'theme' | 'palette' | 'navCollapsed'>> & { navExpanded?: boolean };
        const navCollapsed =
          typeof saved.navCollapsed === 'boolean'
            ? saved.navCollapsed
            : typeof saved.navExpanded === 'boolean'
              ? !saved.navExpanded
              : current.navCollapsed;
        return {
          ...current,
          ...(saved.theme ? { theme: saved.theme } : {}),
          ...(saved.palette ? { palette: saved.palette } : {}),
          navCollapsed,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
          applyPalette(state.palette);
        }
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
