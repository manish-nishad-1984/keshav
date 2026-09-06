import { Menu, PanelLeftClose, PanelLeftOpen, LogOut, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { ThemeToggle } from '../common/ThemeToggle';
import { OPEN_COMMAND_PALETTE_EVENT } from '../common/CommandPalette';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

interface TopbarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
}

export const Topbar = ({ collapsed, onToggleCollapse, onOpenMobile }: TopbarProps) => {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-topbar shrink-0 items-center justify-between border-b border-primary-foreground/10 bg-primary px-3 text-primary-foreground sm:px-5">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground lg:hidden"
          onClick={onOpenMobile}
        >
          <Menu />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground lg:inline-flex"
          onClick={onToggleCollapse}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
          className="hidden items-center gap-2 rounded-md border border-input bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground sm:flex"
        >
          <Search className="size-3.5" />
          Search
          <kbd className="ml-1 rounded border border-border px-1 py-0.5 text-2xs">{isMac ? '⌘K' : 'Ctrl+K'}</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" />
        <div className="hidden text-right sm:block">
          <p className="text-xs font-medium leading-tight text-primary-foreground">{user?.fullName}</p>
          <p className="text-2xs leading-tight text-primary-foreground/70">{user?.email}</p>
        </div>
        <Button variant="outline" size="icon" onClick={() => void logout()} title="Sign out">
          <LogOut />
        </Button>
      </div>
    </header>
  );
};
