import { useId } from 'react';
import type { DesignElement } from '../PrintsDesignStep';
import { patternGeometry, patternKind } from '../../../lib/patternGeometry';
import { patternDefinition } from '../../../lib/patternCatalog';
import { generatedPatternGeometry, type PatternPrimitive } from '../../../lib/generatedPatterns';
import { artworkFlipStyle } from '../../../lib/artworkFlip';
import { paintDataUrl, parsePaint, solidPaint, svgPaint } from '../../../lib/studioPaint';

type PatternBounds = { x: number; y: number; width: number; height: number };
type PatternGraphicProps = { element: DesignElement; bounds?: PatternBounds };

/** Opacity belongs to the artwork wrapper, shared with the other element types. */
export function PatternGraphic({ element, bounds }: PatternGraphicProps) {
  const definition = patternDefinition(patternKind(element));
  return definition && definition.category !== 'Classic'
    ? <GeneratedPatternGraphic element={element} bounds={bounds} /> : <LegacyPatternGraphic element={element} bounds={bounds} />;
}

function GeneratedPrimitive({ primitive, colors }: { primitive: PatternPrimitive; colors: string[] }) {
  if (primitive.tag === 'image') {
    const { tag: _tag, ...attributes } = primitive;
    return <image {...attributes} preserveAspectRatio="xMidYMid meet" />;
  }
  const { tag, fill, stroke, ...attributes } = primitive;
  const paint = { fill: fill === 'none' ? 'none' : colors[fill ?? 0],
    stroke: stroke === undefined ? undefined : colors[stroke], strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  if (tag === 'path') return <path {...attributes} {...paint} />;
  if (tag === 'circle') return <circle {...attributes} {...paint} />;
  return <rect {...attributes} {...paint} />;
}

function GeneratedPaint({ value, id }: { value: string; id: string }) {
  const paint = parsePaint(value);
  if (!paint) return null;
  const stops = [...paint.stops].sort((a, b) => a.offset - b.offset)
    .map((stop, index) => <stop key={index} offset={stop.offset} stopColor={stop.color} />);
  if (paint.kind === 'linear') {
    const angle = paint.angle * Math.PI / 180;
    const extent = (Math.abs(Math.sin(angle)) + Math.abs(Math.cos(angle))) / 2;
    const x = Math.sin(angle) * extent, y = -Math.cos(angle) * extent;
    return <linearGradient id={id} x1={.5 - x} y1={.5 - y} x2={.5 + x} y2={.5 + y}>{stops}</linearGradient>;
  }
  if (paint.kind === 'radial') return <radialGradient id={id} cx={paint.x} cy={paint.y}
    r={Math.hypot(Math.max(paint.x, 1 - paint.x), Math.max(paint.y, 1 - paint.y))}>{stops}</radialGradient>;
  return <pattern id={id} width={1} height={1} patternContentUnits="objectBoundingBox">
    <image href={paintDataUrl(value, 256, 256)} width={1} height={1} preserveAspectRatio="none" />
  </pattern>;
}

function GeneratedPatternGraphic({ element, bounds }: PatternGraphicProps) {
  const id = useId().replace(/:/g, '');
  const geometry = generatedPatternGeometry(element);
  const { width, height, tileWidth, tileHeight } = geometry;
  const colors = geometry.colors.map((color, index) => parsePaint(color)
    ? `url(#generated-paint-${id}-${index})` : solidPaint(color));
  return <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%"
    className="h-full w-full" preserveAspectRatio="xMinYMin slice" aria-hidden data-pattern={geometry.kind}
    style={{ ...artworkFlipStyle(element), overflow: bounds ? 'visible' : undefined }}>
    <defs>
      {geometry.colors.map((color, index) => <GeneratedPaint key={index} value={color} id={`generated-paint-${id}-${index}`} />)}
      {geometry.motifs.map(motif => <g key={motif.id} id={`motif-${id}-${motif.id}`}>
        {motif.primitives.map((primitive, index) => <GeneratedPrimitive key={index} primitive={primitive} colors={colors} />)}
      </g>)}
      <pattern id={`generated-repeat-${id}`} width={tileWidth} height={tileHeight}
        patternUnits="userSpaceOnUse" patternTransform={`rotate(${geometry.angle})`}>
        {geometry.background !== undefined && <rect width={tileWidth} height={tileHeight} fill={colors[geometry.background]} />}
        {geometry.replicas.map((replica, index) => {
          const motif = geometry.motifs[replica.motif];
          return <use key={index} href={`#motif-${id}-${motif.id}`}
            transform={`translate(${motif.x + replica.dx} ${motif.y + replica.dy}) rotate(${motif.rotation}) scale(${motif.scaleX} ${motif.scaleY})`} />;
        })}
      </pattern>
    </defs>
    <rect {...(bounds ?? { x: 0, y: 0, width, height })} fill={`url(#generated-repeat-${id})`} />
  </svg>;
}

function LegacyPatternGraphic({ element, bounds }: PatternGraphicProps) {
  const id = useId().replace(/:/g, '');
  const geometry = patternGeometry(element);
  const { width, height, tileSize, angle } = geometry;
  const paint = svgPaint(element.color ?? (element.type === 'customArea' ? '#E53935' : '#FFFFFF'), `pattern-paint-${id}`, width, height);
  return <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%"
    className="h-full w-full" preserveAspectRatio="xMinYMin slice" aria-hidden data-pattern={geometry.kind}
    style={{ ...artworkFlipStyle(element), overflow: bounds ? 'visible' : undefined }}>
    <defs dangerouslySetInnerHTML={{ __html: paint.defs }} />
    <defs>
      <pattern id={`repeat-${id}`} width={tileSize} height={tileSize} patternUnits="userSpaceOnUse"
        patternTransform={`rotate(${angle})`}>
        {geometry.rectangles.map((rect, index) => <rect key={index} {...rect} fill="white" />)}
        {geometry.dots.map((dot, index) => <circle key={index} cx={dot.x} cy={dot.y} r={dot.radius} fill="white" />)}
      </pattern>
      <mask id={`pattern-mask-${id}`} maskUnits="userSpaceOnUse" {...(bounds ?? { x: 0, y: 0, width, height })} style={{ maskType: 'alpha' }}>
        <rect {...(bounds ?? { x: 0, y: 0, width, height })} fill={`url(#repeat-${id})`} />
      </mask>
    </defs>
    <rect {...(bounds ?? { x: 0, y: 0, width, height })} fill={paint.color} mask={`url(#pattern-mask-${id})`} />
  </svg>;
}
