import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { CommandPalette } from '../components/common/CommandPalette';
import { cn } from '../lib/utils';

export const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <CommandPalette />

      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[padding] duration-200',
          collapsed ? 'lg:pl-sidebar-collapsed' : 'lg:pl-sidebar',
        )}
      >
        <Topbar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onOpenMobile={() => setMobileOpen(true)}
        />

        <main id="main-content" className="flex-1 px-3 py-4 sm:px-5 sm:py-5">
          <div className="mx-auto w-full max-w-[110rem]">
            <Outlet />
          </div>
        </main>

        <footer className="border-t border-border px-5 py-3 text-2xs text-muted-foreground">
          KESHAV Trading & Co. &copy; {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
};
