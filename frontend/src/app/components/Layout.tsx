import { useState } from 'react';
import { Outlet } from 'react-router';
import { Menu } from 'lucide-react';
import { AppStoreProvider } from '../context/AppStoreContext';
import { PriceVisibilityProvider } from '../context/PriceVisibilityContext';
import Sidebar from './Sidebar';
import {
  SIDEBAR_LAYOUT_MODE_STORAGE_KEY,
  loadSidebarLayoutMode,
  serializeSidebarLayoutMode,
  toggleSidebarLayoutMode,
  type SidebarLayoutMode,
} from './sidebarState';

export default function Layout() {
  const [sidebarMode, setSidebarMode] = useState<SidebarLayoutMode>(() => {
    if (typeof window === 'undefined') return 'expanded';
    return loadSidebarLayoutMode(window.localStorage.getItem(SIDEBAR_LAYOUT_MODE_STORAGE_KEY));
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleSidebarMode = () => {
    setSidebarMode((current) => {
      const next = toggleSidebarLayoutMode(current);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(SIDEBAR_LAYOUT_MODE_STORAGE_KEY, serializeSidebarLayoutMode(next));
      }
      return next;
    });
  };

  const desktopOffset = sidebarMode === 'expanded' ? 'lg:ml-64' : 'lg:ml-20';

  return (
    <AppStoreProvider>
      <PriceVisibilityProvider>
        <div className="h-screen overflow-hidden bg-white">
          <Sidebar
            mode={sidebarMode}
            onToggleMode={toggleSidebarMode}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />
          <div className={`ml-0 flex h-screen min-w-0 flex-col transition-[margin] duration-200 ${desktopOffset}`}>
            <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-gray-200 bg-white px-4 shadow-sm lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Navigation öffnen"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
              >
                <Menu size={24} />
              </button>
              <div>
                <p className="text-sm font-semibold text-gray-900">HWERP</p>
                <p className="text-xs text-gray-500">Navigation</p>
              </div>
            </header>
            <main className="flex-1 overflow-y-auto bg-white">
              <Outlet />
            </main>
          </div>
        </div>
      </PriceVisibilityProvider>
    </AppStoreProvider>
  );
}
