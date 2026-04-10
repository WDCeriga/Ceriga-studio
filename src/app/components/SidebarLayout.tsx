import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  ShoppingBag,
  FileText,
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

interface SidebarLayoutProps {
  children: ReactNode;
}

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isLgUp, setIsLgUp] = useState(true);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/studio', label: 'Studio', icon: Sparkles },
    { path: '/catalog', label: 'Catalog', icon: ShoppingBag },
    { path: '/drafts', label: 'Drafts', icon: FileText },
    { path: '/orders', label: 'Orders', icon: Package },
  ];

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

  const sidebarWidth = isCollapsed ? 72 : 212;

  const handleLogout = () => {
    logout();
    navigate('/');
    setSheetOpen(false);
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <nav className="flex-1 space-y-1.5 p-2.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${
                active
                  ? 'bg-[#CC2D24] text-white'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className="h-[18px] w-[18px] flex-shrink-0" />
              <span className="text-[13px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-2.5">
        <Link
          to="/settings"
          onClick={onNavigate}
          className={`mb-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${
            isActive('/settings')
              ? 'bg-[#CC2D24] text-white'
              : 'text-white/60 hover:bg-white/5 hover:text-white'
          }`}
        >
          <Settings className="h-[18px] w-[18px] flex-shrink-0" />
          <span className="text-[13px] font-medium">Settings</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          <span className="text-[13px] font-medium">Log out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0F0F0F] pb-[env(safe-area-inset-bottom)]">
      {/* Mobile / tablet top bar */}
      {!isLgUp && (
        <header className="fixed left-0 right-0 top-0 z-40 flex h-12 items-center justify-between border-b border-white/10 bg-black/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-4">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white hover:bg-white/10"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link
            to="/dashboard"
            className="font-['Plus_Jakarta_Sans',sans-serif] text-[11px] font-extrabold uppercase tracking-[0.2em] text-white sm:text-xs"
          >
            Ceriga
          </Link>
          <div className="flex items-center gap-1.5">
            <NotificationBell className="h-9 w-9 border-white/10 bg-white/5 shadow-none backdrop-blur-0" />
            <Link
              to="/catalog"
              className="rounded-lg bg-[#CC2D24] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white hover:bg-[#CC2D24]/90 sm:px-3 sm:text-[10px]"
            >
              Build
            </Link>
          </div>
        </header>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="w-[min(300px,88vw)] border-white/10 bg-[#0a0a0a] p-0 text-white [&>button]:text-white/70"
        >
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <div className="flex h-full flex-col pt-10">
            <div className="border-b border-white/10 px-4 py-3">
              <Link
                to="/dashboard"
                onClick={() => setSheetOpen(false)}
                className="font-['Plus_Jakarta_Sans',sans-serif] text-sm font-extrabold uppercase tracking-wide text-white"
              >
                Ceriga Studio
              </Link>
            </div>
            <NavLinks onNavigate={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside
        className={`${
          isCollapsed ? 'w-[72px]' : 'w-[212px]'
        } fixed left-0 top-0 z-40 hidden h-dvh flex-col border-r border-white/10 bg-black transition-all duration-300 lg:flex`}
      >
        <div
          className={`${
            isCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3 py-3'
          } flex items-center border-b border-white/10`}
        >
          {!isCollapsed && (
            <Link
              to="/dashboard"
              className="font-['Plus_Jakarta_Sans',sans-serif] text-[14px] font-extrabold uppercase leading-none tracking-[0.3px] text-white"
            >
              CERIGA STUDIO
            </Link>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className={`flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 ${
              isCollapsed ? 'mx-auto' : ''
            }`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-white/60" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5 text-white/60" />
            )}
          </button>
        </div>

        {isCollapsed && (
          <div className="flex justify-center border-b border-white/10 px-2 py-2.5">
            <Link
              to="/dashboard"
              className="text-[11px] font-bold uppercase tracking-widest text-white"
            >
              CS
            </Link>
          </div>
        )}

        <nav className={`${isCollapsed ? 'p-2' : 'p-2.5'} flex-1`}>
          <div className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center ${
                    isCollapsed ? 'justify-center px-1.5' : 'gap-2.5 px-3'
                  } rounded-xl py-2.5 transition-colors ${
                    active
                      ? 'bg-[#CC2D24] text-white'
                      : 'text-white/60 hover:bg-white/5 hover:text-white'
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="text-[13px] font-medium">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className={`${isCollapsed ? 'p-2' : 'p-2.5'} border-t border-white/10`}>
          <Link
            to="/settings"
            className={`mb-2 flex items-center ${
              isCollapsed ? 'justify-center px-1.5' : 'gap-2.5 px-3'
            } rounded-xl py-2.5 transition-colors ${
              isActive('/settings')
                ? 'bg-[#CC2D24] text-white'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
            title={isCollapsed ? 'Settings' : undefined}
          >
            <Settings className="h-[18px] w-[18px] flex-shrink-0" />
            {!isCollapsed && <span className="text-[13px] font-medium">Settings</span>}
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className={`flex w-full items-center ${
              isCollapsed ? 'justify-center px-1.5' : 'gap-2.5 px-3'
            } rounded-xl py-2.5 text-white/60 transition-colors hover:bg-white/5 hover:text-white`}
            title={isCollapsed ? 'Log out' : undefined}
          >
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
            {!isCollapsed && <span className="text-[13px] font-medium">Log out</span>}
          </button>
        </div>
      </aside>

      <main
        className="min-h-dvh overflow-x-hidden transition-all duration-300 lg:pt-0"
        style={{
          marginLeft: isLgUp ? sidebarWidth : 0,
          paddingTop: isLgUp ? 0 : 'calc(3rem + env(safe-area-inset-top))',
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
