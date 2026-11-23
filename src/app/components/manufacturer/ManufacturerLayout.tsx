import { translateInterface as cerigaTranslate, translateInterfaceLabel as cerigaTranslateLabel, useCerigaTranslation } from '../../i18n/i18n';
import { LanguageSelect } from '../../i18n/LanguageProvider';
import '../portal-navigation.css';
import './manufacturer-sidebar.css';
import {ManufacturerOnboardingShell} from './ManufacturerOnboardingShell';
import { ReactNode, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMyManufacturerProfile, fetchMyProfileRole } from '../../data/manufacturerDb';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Settings,
  ClipboardList,
  Ship,
  Truck,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '../ui/sheet';
import { getFactoryWorkspace } from '../../data/manufacturerPortalMock';
import { usePortalNotifications } from '../../hooks/usePortalNotifications';
import { cn } from '../ui/utils';
import { useManufacturerPricing } from '../../data/manufacturerPricing';

import{FactoryAccessProvider,useFactoryAccess,factoryManagementPages,factoryPageAllowed}from '../../contexts/FactoryAccessContext';
import{teamRpc}from '../../lib/factoryTeam';

const RED = '#CC2D24';

const navItems = [
  { path: '/manufacturer', label: 'Overview', icon: LayoutDashboard, end: true },
  { path: '/manufacturer/quotations', label: 'Quotes', icon: ClipboardList },
  { path: '/manufacturer/orders', label: 'Orders', icon: Package },
  { path: '/manufacturer/fulfilment', label: 'Production & delivery', icon: Truck },
  { path: '/manufacturer/statistics', label: 'Statistics', icon: BarChart3 },
  { path: '/manufacturer/messages', label: 'Messages', icon: MessageCircle },
  { path: '/manufacturer/settings', label: 'Settings', icon: Settings },
] as const;

export function ManufacturerLayout({children}:{children:ReactNode}){return <FactoryAccessProvider><ManufacturerWorkspace>{children}</ManufacturerWorkspace></FactoryAccessProvider>;}
function ManufacturerWorkspace({ children }: { children: ReactNode }) {
  

 const {access,ready:accessReady,error:accessError}=useFactoryAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user, authReady } = useAuth();
  useManufacturerPricing();
  const { unread: notifUnread } = usePortalNotifications('manufacturer');
  const { t, label: translateLabel } = useCerigaTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isLgUp, setIsLgUp] = useState(true);
  const demoWorkspace = getFactoryWorkspace();
  const [dbFactoryName, setDbFactoryName] = useState<string | null>(null);
  const [dbOnboarded, setDbOnboarded] = useState<boolean | null>(null);
  const [dbRole, setDbRole] = useState<string | null>(null);
  const [loadError,setLoadError]=useState('');
  const [dbRoleResolved, setDbRoleResolved] = useState(!isSupabaseConfigured);
  const locationState = location.state as { manufacturerOnboardingComplete?: boolean } | null;
  const onboardingJustCompleted = locationState?.manufacturerOnboardingComplete === true;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsLgUp(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    if (!authReady || !isSupabaseConfigured) return;
    if (!user) {
      setDbRoleResolved(true);
      return;
    }
    setDbRoleResolved(false);
    if (onboardingJustCompleted) {
      setDbOnboarded(true);
    }
    let cancelled = false;
    void Promise.all([fetchMyManufacturerProfile(), fetchMyProfileRole()])
      .then(([profile, role]) => {
        if (cancelled) return;
        setDbRole(role);
        setDbRoleResolved(true);
        if (profile) {
                setDbFactoryName(profile.factoryName);
          setDbOnboarded(profile.onboardingComplete);
        }else setDbOnboarded(false);
        setLoadError('');
      }).catch(cause=>{if(!cancelled){setLoadError(cause instanceof Error?cause.message:'Could not verify your factory account');setDbRoleResolved(false);}});
    return () => {
      cancelled = true;
    };
  }, [authReady, user, onboardingJustCompleted, demoWorkspace.onboardingComplete,access?.factoryId]);

  if(isSupabaseConfigured&&accessReady&&access?.passwordSetupRequired)return <Navigate to="/team-password" replace/>;
  if(isSupabaseConfigured&&accessReady&&access&&!access.factoryId&&(access.hadMembership||access.organisations.length>0))return <main className="mx-auto mt-16 max-w-lg space-y-4 rounded-2xl border border-white/10 p-6 text-white"><h1 className="text-xl font-semibold">{cerigaTranslate("interface.text_cb75a94ba50a8320")}</h1><p className="text-sm text-white/55">{cerigaTranslate("interface.text_d3b5fc214add9dac")}</p>{access.organisations.length>0?<select aria-label={cerigaTranslate("interface.text_53bd8d0a0a692b9a")} defaultValue="" className="w-full rounded-lg border border-white/20 bg-[#111113] p-3" onChange={e=>void teamRpc('switch_factory_organisation',{p_factory:e.target.value}).then(()=>window.location.reload()).catch(err=>setLoadError(err.message))}><option disabled value="">{cerigaTranslate("interface.text_318de98546161683")}</option>{access.organisations.map(o=><option value={o.id} key={o.id}>{o.name}</option>)}</select>:<Link to="/dashboard" className="inline-block text-red-300 underline">{cerigaTranslate("interface.text_9929acfac92cd624")}</Link>}{loadError&&<p role="alert" className="text-red-200">{cerigaTranslateLabel(loadError)}</p>}</main>;
  if(loadError)return <div className="mx-auto mt-16 max-w-lg rounded-xl border border-red-400/25 p-6 text-white"><h1 className="font-semibold">{cerigaTranslate("interface.text_212ce94fc73d52a1")}</h1><p role="alert" className="mt-3 text-sm text-red-200">{cerigaTranslateLabel(loadError)}</p><button type="button" onClick={()=>window.location.reload()} className="mt-4 rounded-lg border border-white/20 px-4 py-2">{cerigaTranslate("interface.text_e15b56dccffcf1e4")}</button></div>;

  const onOnboarding = location.pathname.startsWith('/manufacturer/onboarding');

  const isLocallyOnboarded =
    Boolean(
      user?.id &&
        typeof window !== 'undefined' &&
        localStorage.getItem(`ceriga_manufacturer_onboarded_${user.id}`) === 'true',
    ) ||
    Boolean(
      user?.email &&
        typeof window !== 'undefined' &&
        localStorage.getItem(`ceriga_manufacturer_onboarded_${user.email.toLowerCase()}`) ===
          'true',
    ) ||
          (!user && demoWorkspace.onboardingComplete);

  // In demo mode, use the locally persisted workspace. With Supabase, wait for
  // the profile lookup instead of redirecting while its status is still unknown.
  const onboardingComplete = isSupabaseConfigured
    ? dbOnboarded === true
          : (user ? isLocallyOnboarded : demoWorkspace.onboardingComplete);
  const factoryName = dbFactoryName ?? demoWorkspace.factoryName;

  const onboardingStatusResolved = !isSupabaseConfigured || dbOnboarded !== null;
  if (
    isSupabaseConfigured &&
    authReady &&
    !user
  ) {
    return <Navigate to="/manufacturer/login" replace />;
  }

  if (
    isSupabaseConfigured &&
    authReady &&
    user &&
    dbRoleResolved &&
    dbRole !== 'manufacturer' &&
    dbRole !== 'worker'
  ) {
    return <Navigate to="/manufacturer/login" replace />;
  }

  if (
    authReady &&
    onboardingStatusResolved &&
    !onboardingComplete &&
    !onOnboarding &&
    !onboardingJustCompleted
  ) {
    return <Navigate to="/manufacturer/onboarding" replace />;
  }

  const inClientHistory = location.pathname.startsWith('/manufacturer/clients/');
  const isActive = (path: string, end?: boolean) => {
    if (path === '/manufacturer/orders' && inClientHistory) return true;
    if (path === '/manufacturer/settings' && factoryManagementPages.some(item => item.path === location.pathname.replace(/\/$/, ''))) return true;
    if (end) return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const sidebarW = collapsed ? 72 : 220;

  const handleLogout = () => {
    logout();
    navigate('/');
    setSheetOpen(false);
  };

  const visibleNavItems=navItems.filter(item=>!isSupabaseConfigured||factoryPageAllowed(item.path,access?.permissions||[]));
  const NavBlock = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <nav aria-label={t('nav.workspace')} className="flex-1 space-y-1 p-2">
        {visibleNavItems.map((item) => {
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
                active
                  ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]'
                  : 'text-[#A3A3A8] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]',
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
          to="/manufacturer/notifications"
          aria-current={isActive("/manufacturer/notifications") ? "page" : undefined}
          onClick={onNavigate}
          className={cn(
            'mb-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors',
            isActive('/manufacturer/notifications')
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

  if (onOnboarding) {
    return (
      <ManufacturerOnboardingShell>
        <div className="manufacturer-onboarding-access">{isSupabaseConfigured&&accessError?<p role="alert" className="text-red-200">{cerigaTranslateLabel(accessError)}</p>:isSupabaseConfigured&&!accessReady?<p role="status" className="text-white/60">{cerigaTranslate("interface.text_6dea8711b200a8ce")}</p>:isSupabaseConfigured&&((!access?.factoryId&&!onOnboarding)||(access?.factoryId&&!factoryPageAllowed(location.pathname,access.permissions)))?<p role="alert" className="text-white/60">{cerigaTranslate("interface.text_44594404ba637c58")}</p>:<div key={access?.factoryId}>{access?.organisations&&access.organisations.length>1&&<label className="mb-6 block text-xs text-white/60">{cerigaTranslate("interface.text_c46143a78610bd2d")}<select aria-label={cerigaTranslate("interface.text_3e32174f9966df52")} className="ml-3 rounded-lg border border-white/20 bg-[#111113] p-2" value={access.factoryId||''} onChange={e=>void teamRpc('switch_factory_organisation',{p_factory:e.target.value}).then(()=>window.location.reload()).catch(err=>setLoadError(err.message))}>{access.organisations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>}{children}</div>}</div>
      </ManufacturerOnboardingShell>
    );
  }

  return (
    <div className={cn("min-h-dvh overflow-x-hidden bg-[#09090B] pb-[env(safe-area-inset-bottom)] text-[#F0EEEE]",'manufacturer-home-shell')}>
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
          <span
            className="text-[11px] font-extrabold uppercase tracking-[0.2em]"
            style={{ color: RED }}
          >{cerigaTranslate("interface.text_c4b97afe643da8e9")}</span>
          <Link
            to="/manufacturer/notifications"
            aria-current={isActive("/manufacturer/notifications") ? "page" : undefined}
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
          <SheetTitle className="sr-only">{cerigaTranslate("interface.text_5d9e57980c45ca4f")}</SheetTitle>
          <div className="portal-mobile-menu-body">
            <div className="portal-mobile-menu-heading">
              <span className="text-sm font-extrabold uppercase tracking-wide text-[#F0EEEE]">
                {factoryName}
              </span>
            </div>
            <NavBlock onNavigate={() => setSheetOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <aside
        className={cn(
          'ceriga-manufacturer-sidebar fixed left-0 top-0 z-40 hidden h-dvh flex-col border-r border-[#252528] bg-[#09090B] transition-all duration-300 lg:flex',
          collapsed ? 'w-[72px]' : 'w-[220px]',
        )}
      >
        <div
          className={cn(
            'manufacturer-sidebar-heading flex items-center border-b border-[#252528] px-3 py-3',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <Link to="/manufacturer" className="min-w-0 font-semibold uppercase tracking-wide text-[#F0EEEE]">
              <span className="block truncate">{factoryName}</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((x) => !x)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#252528] bg-[#1C1C1E]"
            aria-label={t(collapsed ? "nav.expand" : "nav.collapse")}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4 text-[#A3A3A8]" />
            ) : (
              <ChevronLeft className="h-4 w-4 text-[#A3A3A8]" />
            )}
          </button>
        </div>
        <div className={cn('manufacturer-sidebar-body flex min-h-0 flex-1 flex-col overflow-y-auto', collapsed && 'items-center')}>
          {!collapsed ? (
            <NavBlock />
          ) : (
            <div className="manufacturer-sidebar-icons flex flex-col items-center gap-1 p-2">
              <LanguageSelect compact />
              {visibleNavItems.map((item) => {
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
                      active
                        ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]'
                        : 'text-[#8A8A90] hover:bg-[#1C1C1E] hover:text-[#F0EEEE]',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </Link>
                );
              })}
              <Link
                to="/manufacturer/notifications"
                aria-current={isActive("/manufacturer/notifications") ? "page" : undefined}
                title={cerigaTranslate("nav.notifications")}
                className={cn(
                  'relative flex h-10 w-10 items-center justify-center rounded-xl',
                  isActive('/manufacturer/notifications')
                    ? 'border-l-2 border-[#CC2D24] bg-[#1C0F0F] text-[#E5534A]'
                    : 'text-[#8A8A90] hover:bg-[#1C1C1E]',
                )}
              >
                <Bell className="h-[18px] w-[18px]" />
                {notifUnread > 0 ? (
                  <span className="absolute right-0.5 top-0.5 h-2 w-2 rounded-full bg-[#CC2D24] ring-2 ring-[#09090B]" />
                ) : null}
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
