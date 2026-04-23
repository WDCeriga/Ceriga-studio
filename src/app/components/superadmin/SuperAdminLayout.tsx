import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Package,
  BarChart3,
  Briefcase,
  DollarSign,
  MessageCircle,
  Bell,
  Settings,
  Shield,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { cn } from '../ui/utils';

const RED = '#CC2D24';

const navItems = [
  { path: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/superadmin/users', label: 'Users', icon: Users },
  { path: '/superadmin/orders', label: 'Orders', icon: Package },
  { path: '/superadmin/statistics', label: 'Statistics', icon: BarChart3 },
  { path: '/superadmin/crm', label: 'CRM & roles', icon: Briefcase },
  { path: '/superadmin/pricing', label: 'Pricing', icon: DollarSign },
  { path: '/superadmin/messages', label: 'Messages', icon: MessageCircle },
] as const;

export function SuperAdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isLgUp, setIsLgUp] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsLgUp(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const isActive = (path: string, end?: boolean) => {
    if (end) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const sidebarW = collapsed ? 72 : 220;

  const handleLogout = () => {
    logout();
    navigate('/');
    setSheetOpen(false);
  };

  const NavBlock = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="mb-2 px-2">
        <div className="flex items-center gap-2 rounded-xl border border-[#CC2D24]/30 bg-[#CC2D24]/10 px-3 py-2">
          <Shield className="h-4 w-4 shrink-0 text-[#CC2D24]" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#CC2D24]">Superadmin</div>
            <div className="truncate text-[11px] text-white/50">Owner console</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path, 'end' in item ? item.end : false);
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors',
                active ? 'bg-[#CC2D24] text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="text-[13px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-2">
        <Link
          to="/superadmin/notifications"
          onClick={onNavigate}
          className={cn(
            'mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors',
            isActive('/superadmin/notifications')
              ? 'bg-[#CC2D24] text-white'
              : 'text-white/60 hover:bg-white/5 hover:text-white',
          )}
        >
          <Bell className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[13px] font-medium">Notifications</span>
        </Link>
        <Link
          to="/superadmin/settings"
          onClick={onNavigate}
          className={cn(
            'mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors',
            isActive('/superadmin/settings')
              ? 'bg-[#CC2D24] text-white'
              : 'text-white/60 hover:bg-white/5 hover:text-white',
          )}
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[13px] font-medium">Settings</span>
        </Link>
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-white/45 transition-colors hover:bg-white/5 hover:text-white/80"
        >
          <span className="text-[13px] font-medium">← Studio app</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-white/60 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[13px] font-medium">Log out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#0F0F0F] pb-[env(safe-area-inset-bottom)]">
      {!isLgUp && (
        <header className="fixed left-0 right-0 top-0 z-40 flex min-h-[3.75rem] items-center justify-between border-b border-white/10 bg-black/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.2em]" style={{ color: RED }}>
            Superadmin
          </span>
          <Link
            to="/superadmin/notifications"
            className="flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </Link>
        </header>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="w-[min(300px,88vw)] border-white/10 bg-[#0a0a0a] p-0 text-white [&>button]:text-white/70"
        >
          <SheetTitle className="sr-only">Superadmin navigation</SheetTitle>
          <div className="flex h-full flex-col pt-10">
            <div className="border-b border-white/10 px-4 py-3">
              <span className="text-sm font-extrabold uppercase tracking-wide text-white">Ceriga — Owner</span>
            </div>
            <NavBlock onNavigate={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-dvh flex-col border-r border-white/10 bg-black transition-all duration-300 lg:flex',
          collapsed ? 'w-[72px]' : 'w-[220px]',
        )}
      >
        <div
          className={cn(
            'flex items-center border-b border-white/10 px-3 py-3',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <Link to="/superadmin" className="font-semibold uppercase tracking-wide text-white">
              Owner
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((x) => !x)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-white/5"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4 text-white/60" /> : <ChevronLeft className="h-4 w-4 text-white/60" />}
          </button>
        </div>
        <div className={cn('flex min-h-0 flex-1 flex-col overflow-y-auto', collapsed && 'items-center')}>
          {!collapsed ? (
            <NavBlock />
          ) : (
            <div className="flex flex-col items-center gap-1 p-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path, 'end' in item ? item.end : false);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                      active ? 'bg-[#CC2D24] text-white' : 'text-white/50 hover:bg-white/5 hover:text-white',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </Link>
                );
              })}
              <Link
                to="/superadmin/notifications"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  isActive('/superadmin/notifications') ? 'bg-[#CC2D24] text-white' : 'text-white/50 hover:bg-white/5',
                )}
              >
                <Bell className="h-[18px] w-[18px]" />
              </Link>
              <Link
                to="/superadmin/settings"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  isActive('/superadmin/settings') ? 'bg-[#CC2D24] text-white' : 'text-white/50 hover:bg-white/5',
                )}
              >
                <Settings className="h-[18px] w-[18px]" />
              </Link>
            </div>
          )}
        </div>
      </aside>

      <main
        className="min-h-dvh transition-all duration-300 lg:pt-0"
        style={{
          marginLeft: isLgUp ? sidebarW : 0,
          paddingTop: isLgUp ? 0 : 'calc(3.75rem + env(safe-area-inset-top))',
        }}
      >
        <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
