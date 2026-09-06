import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { NAV_GROUPS, getModulesByGroup } from '@ckfast/shared';
import { resolveIcon } from '../../lib/icons';
import { usePermissions } from '../../hooks/use-permissions';
import { useAuth } from '../../context/AuthContext';
import { useUiStore, type Theme } from '../../store/ui.store';

export const OPEN_COMMAND_PALETTE_EVENT = 'ckfast:open-command-palette';

const NEXT_THEME: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
const THEME_ICON: Record<Theme, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { hasPermission, isSuperAdmin } = usePermissions();
  const { logout } = useAuth();
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    const onOpenRequest = () => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onOpenRequest);
    };
  }, []);

  const runAndClose = (action: () => void) => {
    setOpen(false);
    action();
  };

  const ThemeIcon = THEME_ICON[theme];

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      shouldFilter
      loop
      overlayClassName="fixed inset-0 z-50 bg-foreground/30 animate-in fade-in-0"
      contentClassName="fixed left-1/2 top-[20%] z-50 w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-popover animate-in fade-in-0 zoom-in-95"
      className="flex flex-col"
    >
      <div className="flex items-center border-b border-border px-3">
        <Command.Input
          autoFocus
          placeholder="Search modules, actions…"
          className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
        />
        <kbd className="rounded border border-border px-1.5 py-0.5 text-2xs text-muted-foreground">Esc</kbd>
      </div>

      <Command.List className="max-h-80 overflow-y-auto p-1.5">
        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">No results found.</Command.Empty>

        {NAV_GROUPS.map((group) => {
          const modules = getModulesByGroup(group.key).filter((m) => isSuperAdmin || hasPermission(m.permission));
          if (modules.length === 0) return null;

          return (
            <Command.Group
              key={group.key}
              heading={group.label}
              className="[&_[cmdk-group-heading]]:section-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
            >
              {modules
                .sort((a, b) => a.order - b.order)
                .map((module) => {
                  const Icon = resolveIcon(module.icon);
                  return (
                    <Command.Item
                      key={module.key}
                      value={module.label}
                      onSelect={() => runAndClose(() => navigate(module.path))}
                      className="flex cursor-default items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      {module.label}
                    </Command.Item>
                  );
                })}
            </Command.Group>
          );
        })}

        <Command.Group
          heading="Account"
          className="[&_[cmdk-group-heading]]:section-label [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
        >
          <Command.Item
            value="Toggle theme"
            onSelect={() => runAndClose(() => setTheme(NEXT_THEME[theme]))}
            className="flex cursor-default items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
          >
            <ThemeIcon className="size-4 shrink-0 text-muted-foreground" />
            Toggle theme
          </Command.Item>
          <Command.Item
            value="Sign out"
            onSelect={() => runAndClose(() => void logout())}
            className="flex cursor-default items-center gap-2.5 rounded-md px-2 py-2 text-sm outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
          >
            <LogOut className="size-4 shrink-0 text-muted-foreground" />
            Sign out
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
};
