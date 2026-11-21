import type { CSSProperties, ReactNode } from 'react';
import { FIT_SILHOUETTES, FIT_SILHOUETTE_VIEWBOX } from './fitSilhouettes';

const garmentMask = `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${FIT_SILHOUETTE_VIEWBOX}'><path d='${FIT_SILHOUETTES.regular.outer}'/></svg>`)}")`;

/** Canvas loading state in the garment's own shape, so the stage never shows a generic box. */
export function GarmentSkeleton({ width = 220, height = 268 }: { width?: number; height?: number }) {
  return <span className="cx-skeleton cx-garment-skeleton" role="status" aria-label="Loading garment"
    style={{ width, height, WebkitMaskImage: garmentMask, maskImage: garmentMask }} />;
}

/** Loading placeholder in the final shape. Shimmer only when motion is allowed. */
export function Skeleton({ width, height, radius, style }: { width?: number | string; height?: number | string; radius?: number; style?: CSSProperties }) {
  return <span className="cx-skeleton" aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

/** Option grid while previews render: same grid, same tile size, no layout shift when they arrive. */
export function OptionGridSkeleton({ count = 6, columns = 3 }: { count?: number; columns?: 2 | 3 | 4 }) {
  return (
    <div className="cx-options" data-density="visual-grid" style={{ ['--cx-cols' as string]: columns }} role="status" aria-label="Loading options">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="cx-option" style={{ cursor: 'default' }}>
          <Skeleton height="var(--cx-thumb)" radius={6} />
          <Skeleton height={9} width="60%" style={{ margin: '2px auto 0' }} />
        </span>
      ))}
    </div>
  );
}

/** Inspector empty state: one line of guidance and at most one action. Never a grey box. */
export function InspectorEmpty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="cx-empty">
      {icon && <span className="cx-empty-icon" aria-hidden="true">{icon}</span>}
      <p className="cx-empty-title">{title}</p>
      {hint && <p className="cx-empty-hint">{hint}</p>}
      {action}
    </div>
  );
}
