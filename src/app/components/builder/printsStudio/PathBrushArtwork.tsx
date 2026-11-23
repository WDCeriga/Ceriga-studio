import { useContext, useEffect, useId, useMemo, useState } from 'react';
import type { DesignElement } from '../PrintStudioEditor';
import { ArtworkResolutionContext } from './ArtworkResolutionContext';
import { artworkPixelRatio } from '../../../lib/artworkResolution';
import { artworkFlipStyle } from '../../../lib/artworkFlip';
import { replayDrawingToCanvas } from '../../../lib/drawingRaster';
import { paddedDrawing, pathBrushDrawing, pathBrushPadding } from '../../../lib/pathBrush';
import { shapePathData, shapeToEditablePath, type ShapePath } from '../../../lib/shapeGeometry';
import { svgPaint } from '../../../lib/studioPaint';
import { supportsVectorDrawing, vectorDrawingMarkup } from '../../../lib/vectorDrawing';

/** Any brush along a live path. Vector brushes stay vector; 3D brushes replay at display resolution. */
export function PathBrushArtwork({ element: el }: { element: DesignElement }) {
  const id = 'path-brush-' + useId().replace(/:/g, ''), display = useContext(ArtworkResolutionContext), width = el.width, height = el.height;
  const key = JSON.stringify([el.shapeBrush?.strokes[0]?.settings, el.shapePath, el.shapeParameters, el.content, width, height, el.borderWidth, el.shapeStrokeColor, el.color, el.shapeCornerRadius, el.shapeCornerStyle]);
  const drawing = useMemo(() => pathBrushDrawing(el), [key]), vector = supportsVectorDrawing(drawing), pad = pathBrushPadding(drawing), [raster, setRaster] = useState<{ key: string; url: string }>();
  const markup = useMemo(() => vector ? vectorDrawingMarkup(drawing, id) : '', [drawing, vector, id]);
  useEffect(() => {
    if (vector) return;
    let cancelled = false;
    const full = paddedDrawing(drawing, pad), ratio = artworkPixelRatio(full.width, full.height, display, window.devicePixelRatio || 1);
    void replayDrawingToCanvas(full, ratio, undefined, () => cancelled).then(canvas => { if (canvas && !cancelled) setRaster({ key, url: canvas.toDataURL('image/png') }); }).catch(error => console.warn('Line brush could not render', error));
    return () => { cancelled = true; };
  }, [key, vector, pad, display]);
  const path = shapeToEditablePath(el), scale = (p: ShapePath): ShapePath => ({ ...p, nodes: p.nodes.map(n => ({ x: n.x * width / 100, y: n.y * height / 100, ...(n.in ? { in: { x: n.in.x * width / 100, y: n.in.y * height / 100 } } : {}), ...(n.out ? { out: { x: n.out.x * width / 100, y: n.out.y * height / 100 } } : {}) })), subpaths: undefined });
  const contours = [path, ...(path.subpaths ?? [])].filter(p => p.closed).map(p => shapePathData(scale(p))).join(' '), fill = svgPaint(el.shapeFillColor ?? el.color ?? '#171717', id + '-fill', width, height);
  return <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible" preserveAspectRatio="none" style={artworkFlipStyle(el)} data-vector-brush={drawing.strokes[0]?.settings.brushPreset} data-drawing-ready={vector || raster?.key === key ? 'true' : 'false'}>
    <defs dangerouslySetInnerHTML={{ __html: fill.defs }} />
    {el.shapeFilled && contours && <path d={contours} fill={fill.color} fillRule={el.shapeFillRule ?? 'evenodd'} />}
    {vector ? <g dangerouslySetInnerHTML={{ __html: markup }} /> : raster && <image href={raster.url} x={-pad} y={-pad} width={width + pad * 2} height={height + pad * 2} preserveAspectRatio="none" />}
  </svg>;
}
