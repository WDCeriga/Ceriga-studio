import { cn } from './ui/utils';
import { productGridClass, productGridStyle } from '../styles/productGrid';

export function CatalogGridSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('w-full', className)}>
      <div className={productGridClass} style={productGridStyle}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#111113]"
          >
            <div className="aspect-[3/2] animate-pulse bg-gradient-to-br from-white/[0.06] to-white/[0.02]" />
            <div className="space-y-3 p-3.5">
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/[0.08]" />
              <div className="h-2.5 w-full animate-pulse rounded bg-white/[0.05]" />
              <div className="h-8 animate-pulse rounded-lg bg-white/[0.06]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
