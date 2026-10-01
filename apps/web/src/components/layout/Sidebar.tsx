import { Link } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronRight, X } from 'lucide-react';
import { resolveIcon } from '../../lib/icons';
import { shortLabel, useNavigation } from '../../lib/navigation';
import { useUiStore } from '../../store/ui.store';
import { cn } from '../../lib/utils';

// Collapsed (default): a narrow rail with icon + short label per section; the section's pages
// appear as tabs in the page header (see PageLayout).
// Expanded: sections as rows; a section with several pages shows a chevron and, when active,
// lists its pages underneath — only the active section is expanded.
const NavContent = ({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) => {
  const { sections, activeSection, activeModule } = useNavigation();

  return (
    <nav aria-label="Main" className={cn('flex flex-col py-3', collapsed ? 'gap-1 px-2' : 'gap-0.5 px-3')}>
      {sections.map((section) => {
        const Icon = resolveIcon(section.icon);
        const active = section.key === activeSection?.key;
        const hasChildren = section.modules.length > 1;
        const showChildren = !collapsed && active && hasChildren;

        return (
          <div key={section.key}>
            <Link
              to={section.modules[0].path}
              onClick={onNavigate}
              aria-current={active && !hasChildren ? 'page' : undefined}
              aria-expanded={!collapsed && hasChildren ? showChildren : undefined}
              title={collapsed ? section.label : undefined}
              className={cn(
                'relative flex rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                collapsed
                  ? 'flex-col items-center gap-1 px-1 py-2.5 text-2xs font-medium'
                  : 'items-center gap-3 px-3 py-2.5 text-sm font-medium',
                active
                  ? 'bg-sidebar-active font-semibold text-primary before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary'
                  : 'text-foreground-soft hover:bg-accent hover:text-primary',
              )}
            >
              <Icon className={cn('shrink-0', collapsed ? 'size-5' : 'size-[18px]')} strokeWidth={active ? 1.9 : 1.6} />
              <span className={cn(collapsed ? 'w-full truncate text-center leading-tight' : 'flex-1 truncate')}>{section.label}</span>
              {!collapsed && hasChildren ? (
                <ChevronRight
                  aria-hidden
                  className={cn('size-4 shrink-0 text-muted-foreground transition-transform duration-150', showChildren && 'rotate-90')}
                  strokeWidth={1.75}
                />
              ) : null}
            </Link>

            {showChildren ? (
              <ul className="mb-1 ml-[1.6rem] mt-0.5 space-y-0.5 border-l border-sidebar-border pl-3">
                {section.modules.map((module) => {
                  const current = module.key === activeModule?.key;
                  return (
                    <li key={module.key}>
                      <Link
                        to={module.path}
                        onClick={onNavigate}
                        aria-current={current ? 'page' : undefined}
                        className={cn(
                          'block truncate rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-lg:py-2.5',
                          current ? 'bg-sidebar-active/60 font-semibold text-primary' : 'text-foreground-soft hover:bg-accent hover:text-primary',
                        )}
                      >
                        {shortLabel(module)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
};

interface SidebarProps {
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export const Sidebar = ({ mobileOpen, onMobileOpenChange }: SidebarProps) => {
  const collapsed = useUiStore((state) => state.navCollapsed);

  return (
    <>
      <aside
        className={cn(
          'sticky top-topbar hidden h-[calc(100vh-theme(spacing.topbar))] shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar transition-[width] duration-150 lg:block',
          collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
        )}
      >
        <NavContent collapsed={collapsed} />
      </aside>

      {/* Mobile: a modal drawer (focus trapped, Esc / backdrop to close). */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/30 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col bg-sidebar shadow-popover duration-150 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden"
          >
            <div className="flex h-topbar shrink-0 items-center justify-between bg-primary pl-4 pr-1 text-primary-foreground">
              <DialogPrimitive.Title className="text-base font-bold tracking-wide">
                KESHAV <span className="font-normal text-primary-foreground/80">Trading & Co</span>
              </DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="Close navigation"
                className="flex size-11 items-center justify-center rounded-md hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
              >
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavContent collapsed={false} onNavigate={() => onMobileOpenChange(false)} />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};
