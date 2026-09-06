import { Link, useLocation } from 'react-router-dom';
import { NAV_GROUPS, getModulesByGroup } from '@ckfast/shared';
import { Zap, X } from 'lucide-react';
import { resolveIcon } from '../../lib/icons';
import { usePermissions } from '../../hooks/use-permissions';
import { cn } from '../../lib/utils';

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const SidebarContent = ({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) => {
  const location = useLocation();
  const { hasPermission, isSuperAdmin } = usePermissions();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-topbar shrink-0 items-center gap-2.5 border-b border-primary-foreground/10 bg-primary px-4 text-primary-foreground">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15 text-primary-foreground">
          <Zap className="size-4" strokeWidth={2.5} />
        </span>
        {!collapsed ? (
          <span className="min-w-0 truncate text-sm font-semibold" title="KESHAV Trading & Co.">
            KESHAV Trading & Co.
          </span>
        ) : null}
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group) => {
          const modules = getModulesByGroup(group.key).filter(
            (m) => isSuperAdmin || hasPermission(m.permission),
          );
          if (modules.length === 0) return null;

          return (
            <div key={group.key} className="space-y-1">
              {!collapsed ? <p className="section-label px-2 pb-1">{group.label}</p> : null}
              {modules
                .sort((a, b) => a.order - b.order)
                .map((module) => {
                  const Icon = resolveIcon(module.icon);
                  const active = location.pathname.startsWith(module.path);
                  return (
                    <Link
                      key={module.key}
                      to={module.path}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                        active
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                      title={collapsed ? module.label : undefined}
                    >
                      <Icon className="size-4 shrink-0" />
                      {!collapsed ? <span>{module.label}</span> : null}
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>
    </div>
  );
};

export const Sidebar = ({ collapsed, mobileOpen, onCloseMobile }: SidebarProps) => (
  <>
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-card transition-[width] duration-200 lg:block',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>

    {mobileOpen ? (
      <div className="fixed inset-0 z-40 lg:hidden">
        <div className="absolute inset-0 bg-foreground/30" onClick={onCloseMobile} aria-hidden />
        <aside className="absolute inset-y-0 left-0 w-sidebar bg-card shadow-popover">
          <button
            type="button"
            onClick={onCloseMobile}
            className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
          <SidebarContent collapsed={false} onNavigate={onCloseMobile} />
        </aside>
      </div>
    ) : null}
  </>
);
