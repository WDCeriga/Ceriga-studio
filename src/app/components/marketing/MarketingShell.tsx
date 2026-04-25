import { ReactNode, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';

const RED = '#CC2D24';

const nav = [
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
] as const;

export function MarketingShell({
  children,
  mainClassName = '',
}: {
  children: ReactNode;
  mainClassName?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="min-h-dvh overflow-x-hidden bg-[#0C0C0D] text-[#F2F0EC]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <header
        className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#0c0c0d]/92 backdrop-blur-md"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex min-h-[4.5rem] max-w-[1320px] items-center justify-between gap-2 px-[max(1rem,env(safe-area-inset-left))] py-2.5 pr-[max(1rem,env(safe-area-inset-right))] sm:h-14 sm:min-h-0 sm:py-0 sm:gap-3 sm:px-6 lg:px-10">
          <Link
            to="/"
            className="shrink-0 font-['Plus_Jakarta_Sans',sans-serif] text-[15px] font-extrabold uppercase tracking-[0.1em] text-[#F2F0EC] sm:text-[13px] sm:tracking-[0.12em]"
          >
            Ceriga Studio
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="text-[11px] font-medium tracking-wide text-white/50 transition-colors hover:text-white"
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 sm:flex sm:gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 text-[10px] font-semibold uppercase tracking-wider text-white/60 hover:bg-white/5 hover:text-white"
            >
              <Link to="/login">Log in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="h-8 bg-[#CC2D24] px-3 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-[#CC2D24]/90"
            >
              <Link to="/signup" className="inline-flex items-center gap-1">
                Launch Studio
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-3 md:hidden">
            <Button
              asChild
              size="sm"
              className="h-12 min-h-12 bg-[#CC2D24] px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#CC2D24]/90 sm:h-10 sm:min-h-0 sm:px-3.5 sm:text-[10px] sm:tracking-wider"
            >
              <Link to="/studio">Build</Link>
            </Button>
            <button
              type="button"
              className="flex h-12 min-h-12 w-12 min-w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white active:bg-white/10 sm:h-11 sm:min-h-0 sm:w-11 sm:min-w-0"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-7 w-7 sm:h-6 sm:w-6" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="top"
          className="h-auto max-h-[min(90dvh,640px)] w-full max-w-none gap-0 rounded-none border-x-0 border-t-0 border-b border-white/10 bg-[#0a0a0a] p-0 text-[#F2F0EC] shadow-[0_24px_60px_rgba(0,0,0,0.65)] [&>button.absolute]:hidden"
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>

          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
            <Link
              to="/"
              className="shrink-0 font-['Plus_Jakarta_Sans',sans-serif] text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#F2F0EC]"
              onClick={() => setMenuOpen(false)}
            >
              Ceriga Studio
            </Link>
            <div className="flex shrink-0 items-center gap-2">
              <SheetClose asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </SheetClose>
              <Button
                asChild
                className="h-10 bg-[#CC2D24] px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#CC2D24]/90"
              >
                <Link to="/studio" onClick={() => setMenuOpen(false)}>
                  Build
                </Link>
              </Button>
            </div>
          </div>

          <nav className="flex flex-col gap-7 px-4 py-10 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
            {nav.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#CFBCA0] transition-colors hover:text-white"
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-3 border-t border-white/10 px-4 py-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <Button asChild variant="outline" className="h-11 w-full border-white/20 bg-transparent text-white hover:bg-white/5">
              <Link to="/login" onClick={() => setMenuOpen(false)}>
                Log in
              </Link>
            </Button>
            <Button asChild className="h-11 w-full bg-[#CC2D24] text-xs font-semibold uppercase tracking-wider hover:bg-[#CC2D24]/90">
              <Link to="/signup" onClick={() => setMenuOpen(false)}>
                Launch Studio
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <main className={mainClassName}>{children}</main>

      <footer className="border-t border-white/[0.06] bg-[#0a0a0b] px-[max(1rem,env(safe-area-inset-left))] py-10 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 md:px-8 lg:px-10">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-10">
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="mb-2 font-['Plus_Jakarta_Sans',sans-serif] text-xs font-extrabold uppercase tracking-[0.14em] text-[#F2F0EC]">
                Ceriga Studio
              </div>
              <p className="max-w-[260px] text-xs leading-relaxed text-white/35">
                Factory-ready tech packs, packaging artwork, and production workflows for apparel teams.
              </p>
            </div>
            <div>
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Product</div>
              <div className="flex flex-col gap-2">
                <Link to="/features" className="text-xs text-white/50 transition-colors hover:text-white/85">
                  Features
                </Link>
                <Link to="/how-it-works" className="text-xs text-white/50 transition-colors hover:text-white/85">
                  How it works
                </Link>
                <Link to="/pricing" className="text-xs text-white/50 transition-colors hover:text-white/85">
                  Pricing
                </Link>
              </div>
            </div>
            <div>
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Account</div>
              <div className="flex flex-col gap-2">
                <Link to="/login" className="text-xs text-white/50 transition-colors hover:text-white/85">
                  Log in
                </Link>
                <Link to="/signup" className="text-xs text-white/50 transition-colors hover:text-white/85">
                  Sign up
                </Link>
              </div>
            </div>
            <div>
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">Legal</div>
              <div className="flex flex-col gap-2">
                <a href="#" className="text-xs text-white/50 transition-colors hover:text-white/85">
                  Terms
                </a>
                <a href="#" className="text-xs text-white/50 transition-colors hover:text-white/85">
                  Privacy
                </a>
              </div>
            </div>
          </div>
          <div
            className="flex flex-col gap-2 border-t border-white/[0.05] pt-6 sm:flex-row sm:items-center sm:justify-between"
            style={{ color: '#ffffff25', fontSize: 10 }}
          >
            <span>© 2026 Ceriga Studio</span>
            <span style={{ color: RED }} className="text-[10px] font-medium">
              Built for production
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function MarketingPageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="border-b border-white/10 px-[max(1rem,env(safe-area-inset-left))] py-8 pr-[max(1rem,env(safe-area-inset-right))] sm:px-6 sm:py-10 md:px-8 lg:px-10 lg:py-14">
      <div className="mx-auto max-w-[720px] text-center">
        <p className="mb-3 text-[9px] font-bold uppercase tracking-[0.22em] text-[#CC2D24]">{eyebrow}</p>
        <h1 className="font-['Plus_Jakarta_Sans',sans-serif] text-[clamp(1.45rem,5vw,2.5rem)] font-extrabold leading-[1.12] tracking-[-0.03em] text-[#F2F0EC]">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-[520px] text-[13px] leading-relaxed text-white/50 sm:mt-4 sm:text-base">{subtitle}</p>
      </div>
    </div>
  );
}
