import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/layout/Sidebar';
import { Topbar } from '../components/layout/Topbar';
import { CommandPalette } from '../components/common/CommandPalette';

export const AppLayout = () => {
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

      <Topbar onOpenMobile={() => setMobileOpen(true)} />

      <div className="flex">
        <Sidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />

        <div className="flex min-h-[calc(100vh-theme(spacing.topbar))] min-w-0 flex-1 flex-col">
          <main id="main-content" className="flex-1 px-3 py-3 sm:px-5 sm:py-4">
            <div className="mx-auto w-full max-w-[110rem]">
              <Outlet />
            </div>
          </main>

          <footer className="border-t border-border px-5 py-2.5 text-2xs text-muted-foreground">
            KESHAV Trading & Co. &copy; {new Date().getFullYear()}
          </footer>
        </div>
      </div>
    </div>
  );
};
