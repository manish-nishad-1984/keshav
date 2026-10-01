import { Link } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Search, Settings } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../common/ThemeToggle';
import { OPEN_COMMAND_PALETTE_EVENT } from '../common/CommandPalette';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { shortLabel, useNavigation } from '../../lib/navigation';
import { useUiStore } from '../../store/ui.store';
import { cn } from '../../lib/utils';

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

// Topbar icon buttons: 44px tap target on mobile, 36px on desktop.
const iconButton =
  'inline-flex size-11 items-center justify-center rounded-md text-primary-foreground/90 transition-colors duration-150 hover:bg-primary-foreground/10 hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70 sm:size-9 [&_svg]:size-[18px]';

const initials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

export const Topbar = ({ onOpenMobile }: { onOpenMobile: () => void }) => {
  const { user, logout } = useAuth();
  const toggleNavExpanded = useUiStore((state) => state.toggleNavExpanded);
  const navExpanded = useUiStore((state) => state.navExpanded);
  const { activeSection, activeModule, settingsModule, canSeeSettings } = useNavigation();
  const onSettings = Boolean(settingsModule && activeModule?.key === settingsModule.key);

  const crumbs =
    activeSection && activeModule
      ? activeSection.modules.length > 1
        ? [activeSection.label, shortLabel(activeModule)]
        : [activeModule.label]
      : activeModule
        ? [activeModule.label]
        : [];

  return (
    <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-1 bg-primary px-1.5 text-primary-foreground shadow-sm sm:gap-2 sm:px-3">
      <button type="button" aria-label="Open navigation" className={cn(iconButton, 'lg:hidden')} onClick={onOpenMobile}>
        <Menu />
      </button>
      <button
        type="button"
        aria-label={navExpanded ? 'Collapse navigation' : 'Expand navigation'}
        aria-expanded={navExpanded}
        className={cn(iconButton, 'hidden lg:inline-flex')}
        onClick={toggleNavExpanded}
      >
        <Menu />
      </button>

      <Link
        to="/dashboard"
        className="rounded-md px-1.5 text-base font-bold tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70"
      >
        KESHAV
      </Link>

      {crumbs.length ? (
        <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center border-l border-primary-foreground/25 pl-3 text-sm md:flex">
          <ol className="flex min-w-0 items-center gap-1.5">
            {crumbs.map((crumb, i) => (
              <li key={crumb} className="flex min-w-0 items-center gap-1.5">
                {i > 0 ? <span className="text-primary-foreground/60">/</span> : null}
                <span
                  aria-current={i === crumbs.length - 1 ? 'page' : undefined}
                  className={cn('truncate', i === crumbs.length - 1 ? 'text-primary-foreground' : 'text-primary-foreground/80')}
                >
                  {crumb}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          aria-label={`Search (${isMac ? '⌘K' : 'Ctrl+K'})`}
          title={`Search (${isMac ? '⌘K' : 'Ctrl+K'})`}
          className={iconButton}
          onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
        >
          <Search />
        </button>
        <ThemeToggle className={iconButton} />
        {canSeeSettings && settingsModule ? (
          <Link
            to={settingsModule.path}
            aria-label="Settings"
            title="Settings"
            aria-current={onSettings ? 'page' : undefined}
            className={cn(iconButton, onSettings && 'bg-primary-foreground/15 text-primary-foreground')}
          >
            <Settings />
          </Link>
        ) : null}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="ml-1 flex h-11 items-center gap-1 rounded-md pl-1 pr-1.5 transition-colors duration-150 hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/70 sm:h-9"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-primary-foreground/20 text-xs font-semibold">
                {initials(user?.fullName)}
              </span>
              <ChevronDown className="size-4 text-primary-foreground/80" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <div className="px-2 py-1.5">
              <p className="truncate text-sm font-medium">{user?.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
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
