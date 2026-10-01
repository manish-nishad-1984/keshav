import { Link } from 'react-router-dom';
import { Check, ChevronDown, LogOut, Menu, Search, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { OPEN_COMMAND_PALETTE_EVENT } from '../common/CommandPalette';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { useNavigation } from '../../lib/navigation';
import { useUiStore } from '../../store/ui.store';
import { PALETTES, THEMES } from '../../lib/themes';
import { cn } from '../../lib/utils';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const SHORTCUT = isMac ? '⌘K' : 'Ctrl+K';

const menuHeading = 'px-2 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground';

// Topbar icon buttons: 44px tap target on mobile, 36px on desktop.
const iconButton =
  'inline-flex size-11 items-center justify-center rounded-md text-primary-foreground/90 transition-colors duration-150 hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70 sm:size-9 [&_svg]:size-5';

const initials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

const openSearch = () => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));

export const Topbar = ({ onOpenMobile }: { onOpenMobile: () => void }) => {
  const { user, logout } = useAuth();
  const toggleNavCollapsed = useUiStore((state) => state.toggleNavCollapsed);
  const navCollapsed = useUiStore((state) => state.navCollapsed);
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const palette = useUiStore((state) => state.palette);
  const setPalette = useUiStore((state) => state.setPalette);
  const { activeModule, settingsModule, canSeeSettings } = useNavigation();
  const onSettings = Boolean(settingsModule && activeModule?.key === settingsModule.key);

  return (
    <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-1 bg-primary px-1.5 text-primary-foreground shadow-sm sm:gap-2 sm:px-3">
      <button type="button" aria-label="Open navigation" className={cn(iconButton, 'lg:hidden')} onClick={onOpenMobile}>
        <Menu strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label={navCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        aria-expanded={!navCollapsed}
        className={cn(iconButton, 'hidden lg:inline-flex')}
        onClick={toggleNavCollapsed}
      >
        <Menu strokeWidth={1.75} />
      </button>

      <Link
        to="/dashboard"
        className="flex items-baseline gap-2 rounded-md px-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
      >
        <span className="text-lg font-bold tracking-wide">KESHAV</span>
        <span className="hidden text-sm text-primary-foreground/80 sm:inline">Trading & Co</span>
      </Link>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1.5">
        {/* Opens the existing command palette (Ctrl/⌘+K). */}
        <button
          type="button"
          onClick={openSearch}
          className="hidden h-9 w-64 items-center gap-2 rounded-md border border-primary-foreground/25 bg-primary-foreground/10 px-3 text-sm text-primary-foreground/75 transition-colors duration-150 hover:bg-primary-foreground/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70 md:flex"
        >
          <Search className="size-4" strokeWidth={1.75} />
          <span className="flex-1 text-left">Search anything…</span>
          <kbd className="rounded border border-primary-foreground/30 px-1.5 text-2xs">{SHORTCUT}</kbd>
        </button>
        <button type="button" aria-label={`Search (${SHORTCUT})`} className={cn(iconButton, 'md:hidden')} onClick={openSearch}>
          <Search strokeWidth={1.75} />
        </button>

        {canSeeSettings && settingsModule ? (
          <Link
            to={settingsModule.path}
            aria-label="Settings"
            title="Settings"
            aria-current={onSettings ? 'page' : undefined}
            className={cn(iconButton, onSettings && 'bg-primary-foreground/15 text-primary-foreground')}
          >
            <Settings strokeWidth={1.75} />
          </Link>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex h-11 items-center gap-1.5 rounded-md pl-1 pr-1.5 transition-colors duration-150 hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70 sm:h-9"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-foreground text-xs font-bold text-primary">
                {initials(user?.fullName)}
              </span>
              <ChevronDown className="size-4 text-primary-foreground/80" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium">{user?.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            {/* Appearance: mode and colour are independent; the menu stays open while choosing. */}
            <p className={menuHeading}>Mode</p>
            <div role="group" aria-label="Mode" className="grid grid-cols-4 gap-1 px-1 pb-1">
              {THEMES.map(({ key, label, icon: Icon }) => (
                <DropdownMenuItem
                  key={key}
                  role="menuitemradio"
                  aria-checked={theme === key}
                  onSelect={(e) => {
                    e.preventDefault();
                    setTheme(key);
                  }}
                  className={cn(
                    'flex-col gap-1 border px-1 py-1.5 text-2xs font-medium',
                    theme === key ? 'border-primary bg-accent text-primary' : 'border-transparent text-foreground-soft',
                  )}
                >
                  <Icon />
                  {label}
                </DropdownMenuItem>
              ))}
            </div>
            <p className={menuHeading}>Colour</p>
            <div role="group" aria-label="Colour" className="grid grid-cols-4 gap-1 px-1 pb-1.5">
              {PALETTES.map(({ key, label, swatch }) => (
                <DropdownMenuItem
                  key={key}
                  role="menuitemradio"
                  aria-checked={palette === key}
                  aria-label={label}
                  title={label}
                  onSelect={(e) => {
                    e.preventDefault();
                    setPalette(key);
                  }}
                  className="justify-center py-1.5"
                >
                  <span
                    className={cn(
                      'flex size-7 items-center justify-center rounded-full text-white ring-offset-2 ring-offset-popover',
                      palette === key && 'ring-2 ring-foreground/40',
                    )}
                    style={{ backgroundColor: swatch }}
                  >
                    {palette === key ? <Check strokeWidth={2.5} /> : null}
                  </span>
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void logout()}>
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
