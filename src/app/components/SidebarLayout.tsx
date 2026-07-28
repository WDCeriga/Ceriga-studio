import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutGrid,
  ShoppingBag,
  FileStack,
  Package,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Sparkles,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { Sheet, SheetContent, SheetTitle } from './ui/sheet';
import { cn } from './ui/utils';

interface SidebarLayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { path: '/studio', label: 'Studio', icon: Sparkles },
  { path: '/catalog', label: 'Catalog', icon: ShoppingBag },
  { path: '/drafts', label: 'Drafts', icon: FileStack },
  { path: '/orders', label: 'Orders', icon: Package },
];

function navClass(active: boolean, collapsed?: boolean) {
  return cn(
    'flex items-center gap-2.5 rounded-[5px] py-2.5 text-[13.5px] font-medium transition-colors',
    collapsed ? 'justify-center px-1.5' : 'px-2.5',
    active
      ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]'
      : 'border-l-2 border-transparent text-[#A3A3A8] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]',
  );
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isLgUp, setIsLgUp] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsLgUp(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const isActive = (path: string) => {
    if (path === '/studio') {
      return location.pathname === '/studio' || location.pathname.startsWith('/studio/');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const sidebarWidth = isCollapsed ? 72 : 216;

  const handleLogout = () => {
    void logout();
    navigate('/');
    setSheetOpen(false);
  };

  const NavLinks = ({
    onNavigate,
    collapsed = false,
  }: {
    onNavigate?: () => void;
    collapsed?: boolean;
  }) => (
    <>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={navClass(active, collapsed)}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-0.5 border-t border-[#252528] p-2 pt-3">
        <Link
          to="/settings"
          onClick={onNavigate}
          title={collapsed ? 'Settings' : undefined}
          className={navClass(isActive('/settings'), collapsed)}
        >
          <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {!collapsed && <span>Settings</span>}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? 'Log out' : undefined}
          className={cn(navClass(false, collapsed), 'w-full text-left')}
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {!collapsed && <span>Log out</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="ceriga-page min-h-dvh overflow-x-hidden pb-[env(safe-area-inset-bottom)]">
      {!isLgUp && (
        <header className="fixed left-0 right-0 top-0 z-40 flex min-h-[4.35rem] items-center justify-between border-b border-[#252528] bg-[#09090B]/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-5">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex size-12 min-h-12 min-w-12 shrink-0 items-center justify-center rounded-md border border-[#252528] bg-[#161618] text-[#F0EEEE] hover:bg-[#1C1C1E]"
            aria-label="Open menu"
          >
            <Menu className="size-6" strokeWidth={1.75} />
          </button>
          <Link
            to="/dashboard"
            className="ceriga-mono text-[12px] font-medium uppercase tracking-[0.12em] text-[#F0EEEE]"
          >
            Ceriga
          </Link>
          <div className="flex items-center gap-2.5">
            <NotificationBell className="size-12 min-h-12 min-w-12 rounded-md border-[#252528] bg-[#161618] shadow-none backdrop-blur-0 [&_svg]:size-[20px]" />
            <Link
              to="/catalog"
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md bg-[#CC2D24] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white hover:bg-[#E5534A]"
            >
              Build
            </Link>
          </div>
        </header>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="w-[min(300px,88vw)] border-[#252528] bg-[#09090B] p-0 text-[#F0EEEE] [&>button]:text-[#A3A3A8]"
        >
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <div className="flex h-full flex-col pt-10">
            <div className="border-b border-[#252528] px-4 py-3">
              <Link
                to="/dashboard"
                onClick={() => setSheetOpen(false)}
                className="ceriga-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[#F0EEEE]"
              >
                Ceriga Studio
              </Link>
            </div>
            <NavLinks onNavigate={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-dvh flex-col border-r border-[#252528] bg-[#09090B] transition-all duration-300 lg:flex',
          isCollapsed ? 'w-[72px]' : 'w-[216px]',
        )}
      >
        <div
          className={cn(
            'flex items-center px-3.5 py-5',
            isCollapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!isCollapsed && (
            <Link
              to="/dashboard"
              className="ceriga-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[#F0EEEE]"
            >
              Ceriga Studio
            </Link>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B6B72] hover:bg-[#1C1C1E] hover:text-[#A3A3A8]"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {isCollapsed && (
          <div className="mb-2 flex justify-center px-2">
            <Link
              to="/dashboard"
              className="ceriga-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#F0EEEE]"
            >
              CS
            </Link>
          </div>
        )}

        <NavLinks collapsed={isCollapsed} />
      </aside>

      <main
        className="min-h-dvh overflow-x-hidden transition-all duration-300 lg:pt-0"
        style={{
          marginLeft: isLgUp ? sidebarWidth : 0,
          paddingTop: isLgUp ? 0 : 'calc(4.35rem + env(safe-area-inset-top))',
        }}
      >
        {isLgUp && location.pathname !== '/dashboard' && (
          <div className="fixed right-5 top-5 z-30 sm:right-6 sm:top-6">
            <NotificationBell />
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
