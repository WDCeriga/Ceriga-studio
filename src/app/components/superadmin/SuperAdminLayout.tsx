import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { LanguageSelect } from '../../i18n/LanguageProvider';
import '../portal-navigation.css';
import './superadmin-sidebar.css';
import '../dashboard/superadmin-dashboard.css';
import { ReactNode, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
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
  CalendarOff,
  Route,
  Ship,
  ShieldCheck,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { cn } from '../ui/utils';
import { usePortalNotifications } from '../../hooks/usePortalNotifications';
import { useSuperadminGate } from '../../hooks/useSuperadminGate';
import { PageLoadingFallback } from '../PageLoadingFallback';

const RED = '#CC2D24';

const navItems = [
  { path: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/superadmin/users', label: 'Users', icon: Users },
  { path: '/superadmin/workers', label: 'Team & roles', icon: Briefcase },
  { path: '/superadmin/orders', label: 'Orders', icon: Package },
  { path: '/superadmin/assignment', label: 'Production review', icon: ShieldCheck },
  { path: '/superadmin/statistics', label: 'Statistics', icon: BarChart3 },
  { path: '/superadmin/manufacturers', label: 'Manufacturers', icon: Factory },
  { path: '/superadmin/time-off', label: 'Production calendar', icon: CalendarOff },
  { path: '/superadmin/shipping-onboard', label: 'Shipping', icon: Ship },
  { path: '/superadmin/crm', label: 'CRM', icon: Briefcase },
  { path: '/superadmin/pricing', label: 'Pricing', icon: DollarSign },
  { path: '/superadmin/orders/communication', label: 'Customer requests', icon: MessageCircle },
  { path: '/superadmin/messages', label: 'Messages', icon: MessageCircle },
] as const;

export function SuperAdminLayout({ children }: { children: ReactNode }) {
  

  const { t, label: translateLabel } = useCerigaTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, authReady } = useAuth();
  const { gateReady, allowed: superadminAllowed } = useSuperadminGate();
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

  if (!authReady || !gateReady) {
    return <PageLoadingFallback />;
  }

  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirectTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (!superadminAllowed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#09090B] px-5 text-[#F0EEEE]">
        <div className="w-full max-w-md rounded-2xl border border-[#252528] bg-[#111113] p-6">
          <h1 className="text-xl font-semibold">{cerigaTranslate("interface.text_465cc4463ca3dda4")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            {user.email}{" "}{cerigaTranslate("interface.text_cacb6dfe2a4db3e8")}</p>
          <Link
            to="/dashboard"
            className="mt-5 inline-flex h-10 items-center rounded-lg border border-white/15 px-4 text-sm font-medium text-white/80 hover:bg-white/10"
          >{cerigaTranslate("interface.text_964b595d79606a70")}</Link>
        </div>
      </div>
    );
  }

  const isActive = (path: string, end?: boolean) => {
    if (path === '/superadmin/assignment' && location.pathname.startsWith('/superadmin/quality-control')) return true;
    if (path === '/superadmin/orders' && location.pathname.startsWith('/superadmin/orders/communication')) return false;
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
      <nav aria-label={t('nav.workspace')} className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path, 'end' in item ? item.end : false);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors',
                active ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]' : 'text-[#A3A3A8] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]',
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="text-[13px] font-medium">{cerigaTranslateLabel(translateLabel(item.label))}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[#252528] p-2">
        <Link
          to="/superadmin/notifications"
          aria-current={isActive("/superadmin/notifications") ? "page" : undefined}
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
          <span className="text-[13px] font-medium">{t('nav.notifications')}</span>
        </Link>
        <Link
          to="/superadmin/settings"
          aria-current={isActive("/superadmin/settings") ? "page" : undefined}
          onClick={onNavigate}
          className={cn(
            'mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors',
            isActive('/superadmin/settings')
              ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]'
              : 'text-[#A3A3A8] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]',
          )}
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[13px] font-medium">{t('nav.settings')}</span>
        </Link>
        <Link
          to="/dashboard"
          onClick={onNavigate}
          className="mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[#6B6B72] transition-colors hover:bg-[#1C1C1E] hover:text-[#F0EEEE]"
        >
          <span className="text-[13px] font-medium">{t('nav.app')}</span>
        </Link>
        <div className="px-2 py-1"><LanguageSelect /></div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[#A3A3A8] transition-colors hover:bg-[#1C1C1E] hover:text-[#F0EEEE]"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          <span className="text-[13px] font-medium">{t('authentication.logout')}</span>
        </button>
      </div>
    </>
  );

  return (
    <div className={cn('min-h-dvh overflow-x-hidden bg-[#09090B] pb-[env(safe-area-inset-bottom)]', 'superadmin-overview-shell')}>
      {!isLgUp && (
        <header className="fixed left-0 right-0 top-0 z-40 flex min-h-[3.75rem] items-center justify-between border-b border-[#252528] bg-[#09090B]/95 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
            className="flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#252528] bg-[#1C1C1E] text-[#F0EEEE]"
            aria-label={t('nav.openMenu')}
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.2em]" style={{ color: RED }}>{cerigaTranslate("interface.text_9f53f96c1bb7a218")}</span>
          <Link
            to="/superadmin/notifications"
            aria-current={isActive("/superadmin/notifications") ? "page" : undefined}
            className="relative flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#252528] bg-[#1C1C1E] text-[#F0EEEE]"
            aria-label={cerigaTranslate("interface.text_fbac5d2f7a247d35",{value0:(notifUnread ? cerigaTranslate("interface.text_340606ff6d8fbee7",{value0:(notifUnread)}) : '')})}
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
          aria-describedby={undefined}
          className={"portal-mobile-menu portal-mobile-menu-light w-[min(320px,88vw)] p-0"}
        >
          <SheetTitle className="sr-only">{cerigaTranslate("interface.text_761b701fa9eb1a8e")}</SheetTitle>
          <div className="portal-mobile-menu-body">
            <div className="portal-mobile-menu-heading">
              <span className="text-sm font-extrabold uppercase tracking-wide text-[#F0EEEE]">{cerigaTranslate("interface.text_fcd6ec294a079b6d")}</span>
            </div>
            <NavBlock onNavigate={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <aside
        className={cn(
          'ceriga-admin-sidebar fixed left-0 top-0 z-40 hidden h-dvh flex-col border-r border-[#252528] bg-[#09090B] transition-all duration-300 lg:flex',
          collapsed ? 'w-[72px]' : 'w-[220px]',
        )}
      >
        <div
          className={cn(
            'admin-sidebar-heading flex items-center border-b border-[#252528] px-3 py-3',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <Link to="/superadmin" className="font-semibold uppercase tracking-wide text-[#F0EEEE]">{cerigaTranslate("interface.text_4b1b8aa3608a26da")}</Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((x) => !x)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#252528] bg-[#1C1C1E]"
            aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
          >
            {collapsed ? <ChevronRight className="h-4 w-4 text-[#A3A3A8]" /> : <ChevronLeft className="h-4 w-4 text-[#A3A3A8]" />}
          </button>
        </div>
        <div className={cn('admin-sidebar-body flex min-h-0 flex-1 flex-col overflow-y-auto', collapsed && 'items-center')}>
          {!collapsed ? (
            <NavBlock />
          ) : (
            <div className="admin-sidebar-icons flex flex-col items-center gap-1 p-2">
              <LanguageSelect compact />
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path, 'end' in item ? item.end : false);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={active ? "page" : undefined}
                    title={translateLabel(item.label)}
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
                aria-current={isActive("/superadmin/notifications") ? "page" : undefined}
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
                aria-current={isActive("/superadmin/settings") ? "page" : undefined}
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
