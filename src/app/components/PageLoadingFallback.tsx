import { cn } from './ui/utils';

export function PageLoadingFallback({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0C0C0D] px-6',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="h-10 w-10 animate-pulse rounded-full border-2 border-[#CC2D24]/40 border-t-[#CC2D24]" />
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/35">Loading…</p>
    </div>
  );
}
