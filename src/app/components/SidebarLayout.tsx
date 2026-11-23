import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../i18n/i18n';
import { LanguageSelect } from '../i18n/LanguageProvider';
import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutGrid,
  FolderKanban,
  Package,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Plus,
  Shield,
} from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { Sheet, SheetContent, SheetTitle } from './ui/sheet';
import { cn } from './ui/utils';
import { canAccessSuperadmin } from '../lib/superadminAccess';

interface SidebarLayoutProps {
  children: ReactNode;
}

/** Full IA: Home · Projects · Create · Orders (+ Settings in footer). Catalog is a step, not nav. */
const baseNavItems = [
  { path: '/dashboard', label: 'Home', icon: LayoutGrid },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/create', label: 'Create', icon: Plus },
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
  

  const { t, label: translateLabel } = useCerigaTranslation();
  const navItems = baseNavItems;
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const showSuperadmin = canAccessSuperadmin(user?.email);
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
    if (path === '/create') {
      return (
        location.pathname === '/create' ||
        location.pathname.startsWith('/create/') ||
        location.pathname === '/studio' ||
        location.pathname.startsWith('/studio/')
      );
    }
    if (path === '/projects') {
      return location.pathname === '/projects' || location.pathname === '/drafts';
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
              title={collapsed ? translateLabel(item.label) : undefined}
              data-ai-target={`nav-${item.label.toLowerCase()}`}
              data-ai-label={`Sidebar: ${translateLabel(item.label)}`}
              className={navClass(active, collapsed)}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              {!collapsed && <span>{cerigaTranslateLabel(translateLabel(item.label))}</span>}
            </Link>
          );
        })}
        {showSuperadmin && (
          <Link
            to="/superadmin"
            onClick={onNavigate}
            title={collapsed ? cerigaTranslate("interface.text_9f53f96c1bb7a218") : undefined}
            data-ai-target="nav-superadmin"
            data-ai-label="Sidebar: Superadmin"
            className={navClass(isActive('/superadmin'), collapsed)}
          >
            <Shield className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {!collapsed && <span>{cerigaTranslate("interface.text_9f53f96c1bb7a218")}</span>}
          </Link>
        )}
      </nav>
      <div className="flex flex-col gap-0.5 border-t border-[#252528] p-2 pt-3">
        <Link
          to="/settings"
          onClick={onNavigate}
          title={collapsed ? cerigaTranslate("nav.settings") : undefined}
          data-ai-target="nav-settings"
          data-ai-label="Sidebar: Settings"
          className={navClass(isActive('/settings'), collapsed)}
        >
          <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {!collapsed && <span>{t('nav.settings')}</span>}
        </Link>
        <div className="px-2 py-1"><LanguageSelect compact={collapsed} /></div>
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? cerigaTranslate("authentication.logout") : undefined}
          className={cn(navClass(false, collapsed), 'w-full text-left')}
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {!collapsed && <span>{t('authentication.logout')}</span>}
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
            aria-label={t('nav.openMenu')}
          >
            <Menu className="size-6" strokeWidth={1.75} />
          </button>
          <Link
            to="/dashboard"
            className="ceriga-mono text-[12px] font-medium uppercase tracking-[0.12em] text-[#F0EEEE]"
          >{cerigaTranslate("interface.text_49c6fd48ec76ae54")}</Link>
          <div className="flex items-center gap-2.5">
            <NotificationBell className="size-12 min-h-12 min-w-12 rounded-md border-[#252528] bg-[#161618] shadow-none backdrop-blur-0 [&_svg]:size-[20px]" />
            <Link
              to="/create"
              className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md bg-[#CC2D24] px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-white hover:bg-[#E5534A]"
            >{cerigaTranslate("interface.text_18fdd549b2ed367a")}</Link>
          </div>
        </header>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="left"
          className="w-[min(300px,88vw)] border-[#252528] bg-[#09090B] p-0 text-[#F0EEEE] [&>button]:text-[#A3A3A8]"
        >
          <SheetTitle className="sr-only">{cerigaTranslate("interface.text_eb355944b92d1058")}</SheetTitle>
          <div className="flex h-full flex-col pt-10">
            <div className="border-b border-[#252528] px-4 py-3">
              <Link
                to="/dashboard"
                onClick={() => setSheetOpen(false)}
                className="ceriga-mono text-[12px] font-medium uppercase tracking-[0.1em] text-[#F0EEEE]"
              >{cerigaTranslate("interface.text_38ebb1fe0ef59523")}</Link>
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
            >{cerigaTranslate("interface.text_38ebb1fe0ef59523")}</Link>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B6B72] hover:bg-[#1C1C1E] hover:text-[#A3A3A8]"
            title={isCollapsed ? cerigaTranslate("interface.text_37a5d6485e109bf6") : cerigaTranslate("interface.text_aab31cde23ba9783")}
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
            >{cerigaTranslate("interface.text_3a22ef4d24956d59")}</Link>
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
