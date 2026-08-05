import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Package,
  BarChart3,
  Briefcase,
  Factory,
  DollarSign,
  MessageCircle,
  Bell,
  Settings,
  LogOut,
  Menu,
  ChevronLeft,
  ChevronRight,
  Ruler,
  CalendarOff,
  Route,
  Ship,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { cn } from '../ui/utils';
import { usePortalNotifications } from '../../hooks/usePortalNotifications';

const RED = '#CC2D24';

const navItems = [
  { path: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/superadmin/users', label: 'Users', icon: Users },
  { path: '/superadmin/orders', label: 'Orders', icon: Package },
  { path: '/superadmin/assignment', label: 'Assignment', icon: Route },
  { path: '/superadmin/statistics', label: 'Statistics', icon: BarChart3 },
  { path: '/superadmin/manufacturers', label: 'Manufacturers', icon: Factory },
  { path: '/superadmin/time-off', label: 'Capacity', icon: CalendarOff },
  { path: '/superadmin/shipping-onboard', label: 'Shipping', icon: Ship },
  { path: '/superadmin/crm', label: 'CRM & roles', icon: Briefcase },
  { path: '/superadmin/pricing', label: 'Pricing', icon: DollarSign },
  { path: '/superadmin/measurement-guides', label: 'Measurement guides', icon: Ruler },
  { path: '/superadmin/messages', label: 'Messages', icon: MessageCircle },
] as const;

export function SuperAdminLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { unread: notifUnread } = usePortalNotifications('superadmin');
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
    void logout();
    navigate('/');
    setSheetOpen(false);
  };

  const NavBlock = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
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
                active ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]' : 'text-[#A3A3A8] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]',
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="text-[13px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[#252528] p-2">
        <Link
          to="/superadmin/notifications"
          onClick={onNavigate}
          className={cn(
            'mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors',
            isActive('/superadmin/notifications')
              ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]'
              : 'text-[#A3A3A8] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]',
          )}
        >
          <span className="relative">
            <Bell className="h-[18px] w-[18px] shrink-0" />
            {notifUnread > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#CC2D24] px-1 text-[9px] font-bold text-[#F0EEEE]">
                {notifUnread > 9 ? '9+' : notifUnread}
              </span>
            ) : null}
          </span>
          <span className="text-[13px] font-medium">Notifications</span>
        </Link>
        <Link
          to="/superadmin/settings"
          onClick={onNavigate}
          className={cn(
            'mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors',
            isActive('/superadmin/settings')
              ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]'
              : 'text-[#A3A3A8] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]',
          )}
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[13px] font-medium">Settings</span>
        </Link>
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[#6B6B72] transition-colors hover:bg-[#1C1C1E] hover:text-[#F0EEEE]"
        >
          <span className="text-[13px] font-medium">← Studio app</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[#A3A3A8] transition-colors hover:bg-[#1C1C1E] hover:text-[#F0EEEE]"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[13px] font-medium">Log out</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-dvh overflow-x-hidden bg-[#09090B] pb-[env(safe-area-inset-bottom)]">
      {!isLgUp && (
        <header className="fixed left-0 right-0 top-0 z-40 flex min-h-[3.75rem] items-center justify-between border-b border-[#252528] bg-[#09090B]/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#252528] bg-[#1C1C1E] text-[#F0EEEE]"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.2em]" style={{ color: RED }}>
            Superadmin
          </span>
          <Link
            to="/superadmin/notifications"
            className="relative flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#252528] bg-[#1C1C1E] text-[#F0EEEE]"
            aria-label={`Notifications${notifUnread ? `, ${notifUnread} unread` : ''}`}
          >
            <Bell className="h-5 w-5" />
            {notifUnread > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#CC2D24] px-1 text-[9px] font-bold text-[#F0EEEE]">
                {notifUnread > 9 ? '9+' : notifUnread}
              </span>
            ) : null}
          </Link>
        </header>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="w-[min(300px,88vw)] border-[#252528] bg-[#09090B] p-0 text-[#F0EEEE] [&>button]:text-[#A3A3A8]"
        >
          <SheetTitle className="sr-only">Superadmin navigation</SheetTitle>
          <div className="flex h-full flex-col pt-10">
            <div className="border-b border-[#252528] px-4 py-3">
              <span className="text-sm font-extrabold uppercase tracking-wide text-[#F0EEEE]">Ceriga — Owner</span>
            </div>
            <NavBlock onNavigate={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-dvh flex-col border-r border-[#252528] bg-[#09090B] transition-all duration-300 lg:flex',
          collapsed ? 'w-[72px]' : 'w-[220px]',
        )}
      >
        <div
          className={cn(
            'flex items-center border-b border-[#252528] px-3 py-3',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <Link to="/superadmin" className="font-semibold uppercase tracking-wide text-[#F0EEEE]">
              Owner
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((x) => !x)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#252528] bg-[#1C1C1E]"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4 text-[#A3A3A8]" /> : <ChevronLeft className="h-4 w-4 text-[#A3A3A8]" />}
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
                      active ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]' : 'text-[#8A8A90] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </Link>
                );
              })}
              <Link
                to="/superadmin/notifications"
                className={cn(
                  'relative flex h-10 w-10 items-center justify-center rounded-xl',
                  isActive('/superadmin/notifications') ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]' : 'text-[#8A8A90] hover:bg-[#1C1C1E]',
                )}
              >
                <Bell className="h-[18px] w-[18px]" />
                {notifUnread > 0 ? (
                  <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#CC2D24] ring-2 ring-[#09090B]" />
                ) : null}
              </Link>
              <Link
                to="/superadmin/settings"
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  isActive('/superadmin/settings') ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]' : 'text-[#8A8A90] hover:bg-[#1C1C1E]',
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
