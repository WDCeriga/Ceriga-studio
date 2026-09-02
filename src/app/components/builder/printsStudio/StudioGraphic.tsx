import type { DesignElement } from '../PrintsDesignStep';

function strokeOf(el: DesignElement) {
  return el.color ?? '#FFFFFF';
}

function weightOf(el: DesignElement) {
  return Math.max(1.5, el.borderWidth ?? 4);
}

function flipStyle(element: DesignElement): { transform: string; transformOrigin: string } | undefined {
  if (!element.flipHorizontal) return undefined;
  return { transform: 'scaleX(-1)', transformOrigin: 'center' };
}

export function StudioGraphic({ element }: { element: DesignElement }) {
  const stroke = strokeOf(element);
  const sw = weightOf(element);
  const fill = element.type === 'shape' ? 'none' : stroke;
  const flip = flipStyle(element);

  if (element.type === 'shape') {
    return (
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
        style={flip}
        aria-hidden
      >
        {element.content === 'ellipse' ? (
          <ellipse cx="50" cy="50" rx="42" ry="32" fill="none" stroke={stroke} strokeWidth={sw} />
        ) : element.content === 'rect' ? (
          <rect x="12" y="18" width="76" height="64" fill="none" stroke={stroke} strokeWidth={sw} rx="4" />
        ) : element.content === 'line' ? (
          <line x1="8" y1="50" x2="92" y2="50" stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
        ) : element.content === 'zigzag' ? (
          <polyline
            points="4,86 16,14 28,86 40,14 52,86 64,14 76,86 88,14 96,86"
            fill="none"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="miter"
            strokeLinecap="butt"
            strokeMiterlimit={8}
          />
        ) : element.content === 'squiggly' ? (
          <path
            d="M4 50 C 12.25 12, 19.75 12, 28 50 S 43.75 88, 52 50 S 67.75 12, 76 50 S 91.75 88, 96 50"
            fill="none"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : element.content === 'triangle' ? (
          <polygon points="50,12 90,86 10,86" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        ) : element.content === 'star' ? (
          <polygon
            points="50,8 61,38 94,38 67,58 78,90 50,70 22,90 33,58 6,38 39,38"
            fill="none"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        ) : (
          <polygon points="8,30 62,30 62,18 92,50 62,82 62,70 8,70" fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        )}
      </svg>
    );
  }

  if (element.type === 'pattern') {
    const n = Math.max(2, Math.min(8, element.patternCount ?? (element.content === 'checks' || element.content === 'dots' ? 4 : 5)));
    return (
      <svg viewBox="0 0 80 80" className="h-full w-full" preserveAspectRatio="none" style={flip} aria-hidden>
        {element.content === 'stripes' ? (
          <>
            {Array.from({ length: n }, (_, i) => {
              const step = 80 / n;
              return <rect key={i} x={i * step} y="0" width={step * 0.45} height="80" fill={fill} />;
            })}
          </>
        ) : element.content === 'stripes-h' ? (
          <>
            {Array.from({ length: n }, (_, i) => {
              const step = 80 / n;
              return <rect key={i} x="0" y={i * step} width="80" height={step * 0.45} fill={fill} />;
            })}
          </>
        ) : element.content === 'checks' ? (
          <>
            <rect width="80" height="80" fill="transparent" />
            {Array.from({ length: n }, (_, yi) =>
              Array.from({ length: n }, (_, xi) =>
                (xi + yi) % 2 === 0 ? (
                  <rect
                    key={`${xi}-${yi}`}
                    x={(xi * 80) / n}
                    y={(yi * 80) / n}
                    width={80 / n}
                    height={80 / n}
                    fill={fill}
                  />
                ) : null,
              ),
            )}
          </>
        ) : element.content === 'dots' ? (
          <>
            {Array.from({ length: n }, (_, yi) =>
              Array.from({ length: n }, (_, xi) => {
                const cell = 80 / n;
                return (
                  <circle
                    key={`${xi}-${yi}`}
                    cx={cell * (xi + 0.5)}
                    cy={cell * (yi + 0.5)}
                    r={cell * 0.22}
                    fill={fill}
                  />
                );
              }),
            )}
          </>
        ) : (
          <g stroke={fill} strokeWidth="7">
            {Array.from({ length: n }, (_, i) => {
              const x = -10 + (i * 90) / Math.max(1, n - 1);
              return <line key={i} x1={x} y1="10" x2={x + 80} y2="90" />;
            })}
          </g>
        )}
      </svg>
    );
  }

  if (element.content === 'holes') {
    return (
      <svg viewBox="0 0 120 100" className="h-full w-full" preserveAspectRatio="none" style={flip} aria-hidden>
        <ellipse cx="38" cy="42" rx="16" ry="13" fill="#1a1a1a" stroke="#0b0b0b" strokeWidth="3" />
        <ellipse cx="78" cy="58" rx="11" ry="9" fill="#141414" stroke="#070707" strokeWidth="2.5" />
        <ellipse cx="62" cy="28" rx="7" ry="6" fill="#111" />
      </svg>
    );
  }

  if (element.content === 'rips') {
    return (
      <svg viewBox="0 0 120 100" className="h-full w-full" preserveAspectRatio="none" style={flip} aria-hidden>
        <path
          d="M18 48 L34 40 L48 54 L62 36 L78 58 L96 42 L108 50 L96 62 L74 70 L58 52 L42 68 L24 58 Z"
          fill="#0f0f0f"
          stroke="#2a2a2a"
          strokeWidth="1.5"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 100" className="h-full w-full" preserveAspectRatio="none" style={flip} aria-hidden>
      {Array.from({ length: 28 }, (_, i) => {
        const x = 8 + (i * 17) % 104;
        const y = 10 + ((i * 29) % 80);
        return <circle key={i} cx={x} cy={y} r={1.4 + (i % 3) * 0.7} fill="rgba(255,255,255,0.38)" />;
      })}
    </svg>
  );
}
