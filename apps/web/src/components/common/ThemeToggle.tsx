import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '../ui/button';
import { useUiStore, type Theme } from '../../store/ui.store';

const NEXT_THEME: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const THEME_ICON: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const THEME_LABEL: Record<Theme, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
};

export const ThemeToggle = ({ className }: { className?: string }) => {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const Icon = THEME_ICON[theme];

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(NEXT_THEME[theme])}
      title={`${THEME_LABEL[theme]} — click to switch`}
    >
      <Icon />
    </Button>
  );
};
