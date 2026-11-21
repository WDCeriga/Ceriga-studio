import type { SpacingHint } from '../geometry/spacing';

/**
 * Draws equal-spacing hints: a thin measured line for each equal gap with end ticks and a small
 * distance chip. Quiet ink, constant size at any zoom (inverseScale).
 */
export function SpacingHints({ hints, inverseScale = 1, unitsPerCm }: { hints?: SpacingHint[]; inverseScale?: number; unitsPerCm?: number }) {
  if (!hints?.length) return null;
  const label = (gap: number) => unitsPerCm && unitsPerCm > 0 ? `${(gap / unitsPerCm).toFixed(1)} cm` : `${Math.round(gap)}`;
  const t = 3 * inverseScale;
  return <svg data-artwork-spacing-hints className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible" aria-hidden="true">
    {hints.flatMap((hint, h) => hint.gaps.map((gap, g) => {
      const horizontal = gap.axis === 'x';
      const [x1, y1, x2, y2] = horizontal ? [gap.from, gap.at, gap.to, gap.at] : [gap.at, gap.from, gap.at, gap.to];
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      return <g key={`${h}-${g}`} stroke="#2F6FED" strokeWidth={inverseScale} vectorEffect="non-scaling-stroke">
        <line x1={x1} y1={y1} x2={x2} y2={y2} />
        {horizontal ? <><line x1={x1} x2={x1} y1={y1 - t} y2={y1 + t} /><line x1={x2} x2={x2} y1={y2 - t} y2={y2 + t} /></>
          : <><line y1={y1} y2={y1} x1={x1 - t} x2={x1 + t} /><line y1={y2} y2={y2} x1={x2 - t} x2={x2 + t} /></>}
        <foreignObject x={mx + (horizontal ? -30 : 7) * inverseScale} y={my + (horizontal ? 7 : -8) * inverseScale} width={60 * inverseScale} height={16 * inverseScale} style={{ overflow: 'visible' }}>
          <div className="cx-spacing-chip" style={{ transform: `scale(${inverseScale})`, transformOrigin: 'top left', width: 60 }}>{label(hint.gap)}</div>
        </foreignObject>
      </g>;
    }))}
  </svg>;
}
