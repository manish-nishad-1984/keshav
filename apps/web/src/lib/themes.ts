import { Leaf, Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import type { Palette, Theme } from '../store/ui.store';

// Shared theme metadata for the account menu, command palette and theme toggle.
// Comfort (default): deeper blue-gray workspace and off-white surfaces — lower glare for all-day use.
// Light: the brighter variant. System: follows the OS, using Comfort for light and Dark for dark.
export const THEMES: readonly { key: Theme; label: string; icon: LucideIcon }[] = [
  { key: 'comfort', label: 'Comfort', icon: Leaf },
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Monitor },
];

export const themeMeta = (theme: Theme) => THEMES.find((t) => t.key === theme) ?? THEMES[0];

export const nextTheme = (theme: Theme): Theme => {
  const index = THEMES.findIndex((t) => t.key === theme);
  return THEMES[(index + 1) % THEMES.length].key;
};

// Colour palettes for the swatch picker. `swatch` is the brand colour (keep in sync with the
// [data-palette] blocks in index.css).
export const PALETTES: readonly { key: Palette; label: string; swatch: string }[] = [
  { key: 'blue', label: 'KESHAV Blue', swatch: 'hsl(206 92.5% 41.6%)' },
  { key: 'teal', label: 'Teal', swatch: 'hsl(180 82% 29%)' },
  { key: 'green', label: 'Emerald', swatch: 'hsl(152 68% 31%)' },
  { key: 'indigo', label: 'Indigo', swatch: 'hsl(234 60% 52%)' },
  { key: 'purple', label: 'Purple', swatch: 'hsl(268 52% 49%)' },
  { key: 'maroon', label: 'Maroon', swatch: 'hsl(346 64% 37%)' },
  { key: 'saffron', label: 'Saffron', swatch: 'hsl(24 86% 40%)' },
  { key: 'graphite', label: 'Graphite', swatch: 'hsl(215 25% 30%)' },
];
