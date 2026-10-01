import { Button } from '../ui/button';
import { useUiStore } from '../../store/ui.store';
import { nextTheme, themeMeta } from '../../lib/themes';

export const ThemeToggle = ({ className }: { className?: string }) => {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const { icon: Icon, label } = themeMeta(theme);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => setTheme(nextTheme(theme))}
      title={`${label} theme — click to switch`}
    >
      <Icon />
    </Button>
  );
};
