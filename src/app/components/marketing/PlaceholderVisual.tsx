import { cn } from '../ui/utils';
import { ImageIcon } from 'lucide-react';

export function PlaceholderVisual({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-[14px] border border-white/[0.08] bg-gradient-to-br from-[#1c1c1f] via-[#121214] to-[#0a0a0b]',
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 20% 15%, rgba(204,45,36,0.14), transparent 55%), radial-gradient(circle at 85% 75%, rgba(255,255,255,0.04), transparent 40%)',
        }}
      />
      <div className="relative flex flex-col items-center gap-2 text-white/25">
        <ImageIcon className="h-10 w-10 sm:h-12 sm:w-12" strokeWidth={1} />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Placeholder</span>
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</span>
        <span className="text-[9px] text-white/25">Replace with product shot</span>
      </div>
    </div>
  );
}
