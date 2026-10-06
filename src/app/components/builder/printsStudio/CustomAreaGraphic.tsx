import { useId } from 'react';
import { svgPaint } from '../../../lib/studioPaint';
import { imageAdjustmentFilter } from '../../../lib/imageAdjustments';
import { customAreaBounds, customAreaPath, customAreaViewport, type CustomAreaPoint } from '../../../lib/customAreaGeometry';
import type { DesignElement } from '../PrintsDesignStep';
import { PatternGraphic } from './PatternGraphic';

export function CustomAreaGraphic({ element, points, garmentMask }: {
  element: DesignElement;
  points: CustomAreaPoint[];
  garmentMask?: string;
  selectedPoint?: number | null;
  editing?: boolean;
  onSelectPoint?: (index: number) => void;
  onPointPointerDown?: (event: React.PointerEvent<SVGCircleElement>, index: number) => void;
}) {
  const id = useId().replace(/:/g, '');
  const { width, height } = customAreaViewport(element);
  const paint = svgPaint(element.color ?? '#E53935', `custom-area-${id}`, width, height);
  const path = customAreaPath(points, true);
  const bounds = customAreaBounds(points);
  const coverage = { x: bounds.x - bounds.width / 2, y: bounds.y - bounds.height / 2, width: bounds.width, height: bounds.height };
  const fill = element.customAreaFillTransform;
  const scale = Math.max(.1, (fill?.scale ?? 100) / 100);
  const opacity = Math.max(0, Math.min(1, (fill?.opacity ?? 100) / 100));
  const fillTransform = `translate(${width / 2 + (fill?.x ?? 0)} ${height / 2 + (fill?.y ?? 0)}) rotate(${fill?.rotation ?? 0}) scale(${scale}) translate(${-width / 2} ${-height / 2})`;
  const outline = element.customAreaOutline;
  const outlineWidth = Math.max(0, outline?.width ?? 2);
  const dash = outline?.style === 'dashed' ? `${outlineWidth * 3} ${outlineWidth * 2}`
    : outline?.style === 'dotted' ? `0 ${outlineWidth * 3}` : undefined;

  return <div className="relative h-full w-full overflow-visible">
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none"
      aria-label={element.customAreaName ?? 'Custom Area'} data-custom-area-svg
      style={{ overflow: 'visible', maskImage: garmentMask, maskSize: '100% 100%', maskRepeat: 'no-repeat', filter: imageAdjustmentFilter(element) }}>
      <defs dangerouslySetInnerHTML={{ __html: paint.defs }} />
      <defs>
        <clipPath id={`area-clip-${id}`} clipPathUnits="userSpaceOnUse"><path d={path} /></clipPath>
        {element.customAreaTexture && <pattern id={`area-texture-${id}`} width={128} height={128}
          patternUnits="userSpaceOnUse" patternTransform={fillTransform}>
          <image href={element.customAreaTexture} width={128} height={128} preserveAspectRatio="none" />
        </pattern>}
      </defs>
      <g data-custom-area-transform transform={element.flipHorizontal || element.flipVertical
        ? `translate(${element.flipHorizontal ? width : 0} ${element.flipVertical ? height : 0}) scale(${element.flipHorizontal ? -1 : 1} ${element.flipVertical ? -1 : 1})`
        : undefined}>
        <g data-custom-area-fill clipPath={`url(#area-clip-${id})`}>
          {element.customAreaImage ? <image data-custom-area-image href={element.customAreaImage}
            width={width} height={height} preserveAspectRatio="none" transform={fillTransform} opacity={opacity} />
            : element.customAreaPattern ? <PatternGraphic element={{ ...element, width, height, flipHorizontal: false, flipVertical: false }} bounds={coverage} />
              : <path d={path} fill={paint.color} />}
          {element.customAreaTexture && <path data-custom-area-texture d={path} fill={`url(#area-texture-${id})`} opacity={opacity} />}
          {/* Double the stroke and clip its outer half to keep the full outline inside the area. */}
          {outline?.enabled && outlineWidth > 0 && <path data-custom-area-outline d={path} fill="none"
            stroke={outline.color} strokeWidth={outlineWidth * 2} strokeOpacity={Math.max(0, Math.min(1, outline.opacity / 100))}
            strokeDasharray={dash} strokeLinecap={outline.style === 'dotted' ? 'round' : 'butt'} strokeLinejoin="round" />}
        </g>
      </g>
    </svg>
  </div>;
}