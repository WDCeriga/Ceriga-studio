import type { CSSProperties } from 'react';

const stroke = '#8A8A90';
const common: CSSProperties = {
  fill: 'none',
  stroke,
  strokeWidth: 1.4,
  strokeLinejoin: 'round',
  strokeLinecap: 'round',
};

/** Flat technical line-art icons for project cards (tech-pack style). */
export function GarmentFlatIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const key = type.toLowerCase();

  if (key.includes('hoodie')) {
    return (
      <svg viewBox="0 0 120 120" className={className} width="100%" height="100%" aria-hidden>
        <path
          d="M40 22 L34 14 Q60 4 86 14 L80 22 L92 30 L100 52 L88 60 L88 100 Q60 106 32 100 L32 60 L20 52 L28 30 Z"
          style={common}
        />
        <path d="M45 16 Q60 26 75 16" style={common} />
        <circle cx="60" cy="40" r="9" style={common} />
        <path d="M48 62 Q60 68 72 62" style={common} />
      </svg>
    );
  }

  if (key.includes('trouser') || key.includes('pant') || key.includes('jogger') || key.includes('short')) {
    return (
      <svg viewBox="0 0 120 120" className={className} width="100%" height="100%" aria-hidden>
        <path
          d="M42 12 L78 12 L82 60 L94 104 L80 106 L66 62 L60 62 L52 106 L38 104 L34 60 Z"
          style={common}
        />
        <path d="M42 12 L78 12" style={common} />
        <path d="M60 12 L60 30" style={common} />
        <rect x="48" y="16" width="24" height="10" rx="2" style={common} />
      </svg>
    );
  }

  if (key.includes('sweat')) {
    return (
      <svg viewBox="0 0 120 120" className={className} width="100%" height="100%" aria-hidden>
        <path
          d="M40 22 L34 14 Q60 6 86 14 L80 22 L94 32 L100 54 L88 62 L88 102 Q60 108 32 102 L32 62 L20 54 L26 32 Z"
          style={common}
        />
        <ellipse cx="60" cy="18" rx="11" ry="5" style={common} />
        <path d="M32 88 L88 88" style={{ ...common, strokeDasharray: '3 4' }} />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 120" className={className} width="100%" height="100%" aria-hidden>
      <path
        d="M42 18 L36 12 Q60 4 84 12 L78 18 L92 26 L86 44 L78 40 L78 100 Q60 106 42 100 L42 40 L34 44 L28 26 Z"
        style={common}
      />
      <ellipse cx="60" cy="14" rx="10" ry="4" style={common} />
      <rect
        x="48"
        y="52"
        width="24"
        height="24"
        rx="1"
        style={{ ...common, strokeDasharray: '2 3' }}
      />
    </svg>
  );
}

export function SpecGridTexture({ patternId = 'specGrid' }: { patternId?: string }) {
  return (
    <svg
      viewBox="0 0 200 200"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-50"
      aria-hidden
    >
      <defs>
        <pattern id={patternId} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#333338" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="200" height="200" fill={`url(#${patternId})`} />
    </svg>
  );
}
