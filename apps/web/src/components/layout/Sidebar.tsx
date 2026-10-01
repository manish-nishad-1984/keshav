import { Link } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { resolveIcon } from '../../lib/icons';
import { shortLabel, useNavigation } from '../../lib/navigation';
import { useUiStore } from '../../store/ui.store';
import { cn } from '../../lib/utils';

// Rail mode: one icon + short label per section, linking to the section's first page; the
// section's sibling pages appear as tabs in the page header (see PageLayout).
// Expanded mode: sections as rows, with only the active section showing its child links.
const NavContent = ({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) => {
  const { sections, activeSection, activeModule } = useNavigation();

  return (
    <nav aria-label="Main" className={cn('flex flex-col gap-1 py-3', expanded ? 'px-2.5' : 'px-2')}>
      {sections.map((section) => {
        const Icon = resolveIcon(section.icon);
        const active = section.key === activeSection?.key;
        const target = section.modules[0];
        const showChildren = expanded && active && section.modules.length > 1;

        return (
          <div key={section.key}>
            <Link
              to={target.path}
              onClick={onNavigate}
              aria-current={active && section.modules.length === 1 ? 'page' : undefined}
              title={expanded ? undefined : section.label}
              className={cn(
                'group relative flex rounded-md transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                expanded
                  ? 'items-center gap-2.5 px-2.5 py-2 text-sm font-medium max-lg:py-3'
                  : 'flex-col items-center gap-1 px-1 py-2.5 text-2xs font-medium',
                active ? 'bg-accent text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {active ? (
                <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" />
              ) : null}
              <Icon className={cn('shrink-0', expanded ? 'size-[18px]' : 'size-5')} strokeWidth={1.75} />
              <span className={cn(expanded ? 'truncate' : 'w-full truncate text-center leading-tight')}>{section.label}</span>
            </Link>

            {showChildren ? (
              <ul className="mb-1 ml-[1.375rem] mt-0.5 space-y-0.5 border-l border-border pl-2.5">
                {section.modules.map((module) => {
                  const current = module.key === activeModule?.key;
                  return (
                    <li key={module.key}>
                      <Link
                        to={module.path}
                        onClick={onNavigate}
                        aria-current={current ? 'page' : undefined}
                        className={cn(
                          'block truncate rounded-md px-2.5 py-1.5 text-[13px] max-lg:py-2.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          current ? 'font-semibold text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
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
  const expanded = useUiStore((state) => state.navExpanded);

  return (
    <>
      <aside
        className={cn(
          'sticky top-topbar hidden h-[calc(100vh-theme(spacing.topbar))] shrink-0 overflow-y-auto border-r border-border bg-card transition-[width] duration-150 lg:block',
          expanded ? 'w-sidebar' : 'w-sidebar-collapsed',
        )}
      >
        <NavContent expanded={expanded} />
      </aside>

      {/* Mobile: a modal drawer (focus trapped, Esc / backdrop to close). */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-foreground/30 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col bg-card shadow-popover duration-150 data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left lg:hidden"
          >
            <div className="flex h-topbar shrink-0 items-center justify-between bg-primary px-4 text-primary-foreground">
              <DialogPrimitive.Title className="text-base font-bold tracking-wide">KESHAV</DialogPrimitive.Title>
              <DialogPrimitive.Close
                aria-label="Close navigation"
                className="flex size-11 items-center justify-center rounded-md hover:bg-primary-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
              >
                <X className="size-5" />
              </DialogPrimitive.Close>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavContent expanded onNavigate={() => onMobileOpenChange(false)} />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
};
