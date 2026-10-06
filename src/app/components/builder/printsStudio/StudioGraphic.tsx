import type { DesignElement } from '../PrintsDesignStep';
import { useId } from 'react';
import { svgPaint } from '../../../lib/studioPaint';
import { PatternGraphic } from './PatternGraphic';
import { artworkFlipStyle } from '../../../lib/artworkFlip';
import { canFillShape } from './studioAssets';
import { shapeToEditablePath, shapePathData, type ShapePath } from '../../../lib/shapeGeometry';
import { ShapeEffectsArtwork } from './ShapeEffectsArtwork';

function strokeOf(el: DesignElement) {
  return el.shapeStrokeColor ?? el.color ?? '#FFFFFF';
}

function scaledPath(path: ShapePath, width: number, height: number): ShapePath {
  const point = (p: { x: number; y: number }) => ({ x: p.x * width / 100, y: p.y * height / 100 });
  return { closed: path.closed, nodes: path.nodes.map(n => ({ ...point(n), ...(n.in ? { in: point(n.in) } : {}), ...(n.out ? { out: point(n.out) } : {}) })), subpaths: path.subpaths?.map(part => scaledPath(part, width, height)) };
}

function weightOf(el: DesignElement) {
  return Math.max(0, el.borderWidth ?? 4);
}

export function StudioGraphic({ element }: { element: DesignElement }) {
  const artwork = <StudioGraphicBase element={element} />;
  return element.type === 'shape' && element.shapeEffects?.some(effect => effect.enabled !== false)
    ? <ShapeEffectsArtwork element={element}>{artwork}</ShapeEffectsArtwork>
    : artwork;
}

function StudioGraphicBase({ element }: { element: DesignElement }) {
  const id = useId().replace(/:/g, '');
  if (element.type === 'pattern') return <PatternGraphic element={element} />;
  const paintWidth = element.shapeGeometry === 'bounds' ? element.width : 100;
  const paintHeight = element.shapeGeometry === 'bounds' ? element.height : paintWidth;
  const paint = svgPaint(strokeOf(element), `paint-${id}`, paintWidth, paintHeight);
  const fillPaint = svgPaint(element.shapeFillColor ?? element.color ?? '#FFFFFF', `fill-${id}`, paintWidth, paintHeight);
  const stroke = paint.color;
  const fill = element.shapeFilled && canFillShape(element) ? fillPaint.color : 'none';
  const definitions = <defs dangerouslySetInnerHTML={{ __html: paint.defs + fillPaint.defs }} />;
  const sw = weightOf(element);
  const flip = artworkFlipStyle(element);
  const legacy = ['ellipse', 'rect', 'line', 'zigzag', 'squiggly', 'triangle', 'star', 'arrow'];
  const boundsLegacy = ['ellipse', 'circle', 'rect', 'semicircle-open', 'semicircle-closed', 'line'];
  const parametric = !!element.shapePath || !!Object.keys(element.shapeParameters ?? {}).length
    || !(element.shapeGeometry === 'bounds' ? boundsLegacy : legacy).includes(element.content);

  if (element.type === 'shape' && parametric) {
    const width = element.shapeGeometry === 'bounds' ? Math.max(sw, element.width) : 100;
    const height = element.shapeGeometry === 'bounds' ? Math.max(sw, element.height) : 100;
    const path = scaledPath(shapeToEditablePath(element), width, height);
    return <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" style={flip} aria-hidden>
      {definitions}
      <path d={shapePathData(path)} fill={fill} fillRule="evenodd" stroke={stroke} strokeWidth={sw}
        strokeLinecap={element.content === 'zigzag' ? 'butt' : 'round'} strokeLinejoin={element.content === 'zigzag' ? 'miter' : 'round'} strokeMiterlimit={8} />
    </svg>;
  }

  if (element.type === 'shape' && element.shapeGeometry === 'bounds') {
    const width = Math.max(sw, element.width);
    const height = Math.max(sw, element.height);
    return <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" style={flip} aria-hidden>
      {definitions}
      {element.content === 'ellipse' || element.content === 'circle' ? <ellipse cx={width / 2} cy={height / 2} rx={(width - sw) / 2} ry={(height - sw) / 2} fill={fill} stroke={stroke} strokeWidth={sw} />
        : element.content === 'semicircle-open' || element.content === 'semicircle-closed' ? <path
            d={`M ${sw / 2} ${height - sw / 2} A ${(width - sw) / 2} ${height - sw} 0 0 1 ${width - sw / 2} ${height - sw / 2}${element.content === 'semicircle-closed' ? ' Z' : ''}`}
            fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
        : element.content === 'rect' ? <rect x={sw / 2} y={sw / 2} width={width - sw} height={height - sw} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        : <line x1={sw / 2} y1={height / 2} x2={width - sw / 2} y2={height / 2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />}
    </svg>;
  }

  if (element.type === 'shape') {
    return (
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full overflow-visible"
        preserveAspectRatio="none"
        style={flip}
        aria-hidden
      >
        {definitions}
        {element.content === 'ellipse' ? (
          <ellipse cx="50" cy="50" rx="42" ry="32" fill={fill} stroke={stroke} strokeWidth={sw} />
        ) : element.content === 'rect' ? (
          <rect x="12" y="18" width="76" height="64" fill={fill} stroke={stroke} strokeWidth={sw} rx="4" />
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
          <polygon points="50,12 90,86 10,86" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        ) : element.content === 'star' ? (
          <polygon
            points="50,8 61,38 94,38 67,58 78,90 50,70 22,90 33,58 6,38 39,38"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        ) : (
          <polygon points="8,30 62,30 62,18 92,50 62,82 62,70 8,70" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
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
