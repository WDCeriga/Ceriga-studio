import { cn } from './ui/utils';
import { productGridClass, productGridStyle } from '../styles/productGrid';

export function CatalogGridSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('w-full', className)}>
      <div className={productGridClass} style={productGridStyle}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-[6px] border border-[#252528] bg-[#161618]"
          >
            <div className="aspect-[3/2] animate-pulse bg-gradient-to-br from-[#252528] to-[#111113]" />
            <div className="space-y-3 p-3.5">
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-[#252528]" />
              <div className="h-2.5 w-full animate-pulse rounded bg-[#252528]/70" />
              <div className="h-8 animate-pulse rounded-[4px] bg-[#252528]/80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
