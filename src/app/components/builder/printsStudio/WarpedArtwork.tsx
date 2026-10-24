import {artworkPixelRatio} from '../../../lib/artworkResolution';
import {ArtworkResolutionContext} from './ArtworkResolutionContext';
import { useContext, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { toCanvas } from 'html-to-image';
import { waitForImageFilters } from '../../../lib/imageFilterRendering';
import { artworkEffectPadding } from '../../../lib/textEffectRendering';
import { isIdentityWarp, interpolateWarpGrid, warpGrid, type WarpControlPoint, type WarpSettings } from '../../../lib/warpGeometry';
import type { DesignElement } from '../PrintStudioEditor';

function affineMap(source: WarpControlPoint[], target: WarpControlPoint[]) {
  const [p0, p1, p2] = source;
  const [q0, q1, q2] = target;
  const det = p0!.x * (p1!.y - p2!.y) + p1!.x * (p2!.y - p0!.y) + p2!.x * (p0!.y - p1!.y);
  if (Math.abs(det) < 1e-5) return null;
  const solve = (v0: number, v1: number, v2: number) => ({
    a: (v0 * (p1!.y - p2!.y) + v1 * (p2!.y - p0!.y) + v2 * (p0!.y - p1!.y)) / det,
    c: (v0 * (p2!.x - p1!.x) + v1 * (p0!.x - p2!.x) + v2 * (p1!.x - p0!.x)) / det,
    e: (v0 * (p1!.x * p2!.y - p2!.x * p1!.y) + v1 * (p2!.x * p0!.y - p0!.x * p2!.y) + v2 * (p0!.x * p1!.y - p1!.x * p0!.y)) / det,
  });
  const x = solve(q0!.x, q1!.x, q2!.x);
  const y = solve(q0!.y, q1!.y, q2!.y);
  return { a: x.a, b: y.a, c: x.c, d: y.c, e: x.e, f: y.e };
}

function drawTriangle(
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  source: WarpControlPoint[],
  target: WarpControlPoint[],
) {
  const matrix = affineMap(source, target);
  if (!matrix) return;
  context.save();
  context.beginPath();
  // Slight overlap prevents antialiased cracks between adjacent texture triangles.
  const centre={x:(target[0]!.x+target[1]!.x+target[2]!.x)/3,y:(target[0]!.y+target[1]!.y+target[2]!.y)/3};
  const clip=target.map(p=>{const dx=p.x-centre.x,dy=p.y-centre.y,d=Math.hypot(dx,dy)||1;return {x:p.x+dx/d*.75,y:p.y+dy/d*.75}});
  context.moveTo(clip[0]!.x,clip[0]!.y);context.lineTo(clip[1]!.x,clip[1]!.y);context.lineTo(clip[2]!.x,clip[2]!.y);
  context.closePath();
  context.clip();
  context.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
  context.drawImage(image, 0, 0);
  context.restore();
}

function drawMesh(
  context: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  settings: WarpSettings,
  width: number,
  height: number,
  padding = 0,
) {
  if(isIdentityWarp(settings)){context.clearRect(0,0,width,height);context.drawImage(image,0,0,width,height);return {x:0,y:0,width:1,height:1}}
  const size = settings.mode === 'freeform' ? settings.gridSize : 3;
  const points = warpGrid(settings);
  const segments = (size - 1) * 8;
  const mapPoint = (x: number, y: number) => {
    const innerWidth = Math.max(1, width - padding * 2);
    const innerHeight = Math.max(1, height - padding * 2);
    const localX = (x * width - padding) / innerWidth;
    const localY = (y * height - padding) / innerHeight;
    const clampX = Math.max(0, Math.min(1, localX));
    const clampY = Math.max(0, Math.min(1, localY));
    const mapped = interpolateWarpGrid(points, size, clampX, clampY);
    return { x: (mapped.x + localX - clampX) * innerWidth + padding, y: (mapped.y + localY - clampY) * innerHeight + padding };
  };
  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  for (let row = 0; row < segments; row += 1) {
    const y0 = row / segments;
    const y1 = (row + 1) / segments;
    for (let column = 0; column < segments; column += 1) {
      const x0 = column / segments;
      const x1 = (column + 1) / segments;
      const source = [
        { x: x0 * image.width, y: y0 * image.height },
        { x: x1 * image.width, y: y0 * image.height },
        { x: x1 * image.width, y: y1 * image.height },
        { x: x0 * image.width, y: y1 * image.height },
      ];
      const target = [mapPoint(x0, y0), mapPoint(x1, y0), mapPoint(x1, y1), mapPoint(x0, y1)];
      drawTriangle(context, image, [source[0]!, source[1]!, source[2]!], [target[0]!, target[1]!, target[2]!]);
      drawTriangle(context, image, [source[0]!, source[2]!, source[3]!], [target[0]!, target[2]!, target[3]!]);
    }
  }
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
  };
}

export function sourceSignature(element: DesignElement) {
  const content = element.content ?? '';
  const contentKey = element.type === 'text' || element.type === 'shape' || element.type === 'pattern' || element.type === 'distress'
    ? content
    : `${content.length}:${content.slice(0, 48)}:${content.slice(-24)}`;
  return [element.id, element.type, contentKey, element.groupSourceWidth, element.groupSourceHeight,
    element.children ? JSON.stringify(element.children) : '', element.color, element.fontSize, element.fontFamily,
    element.textAlign, element.fontStyle, element.fontWeight, element.textTransform, element.letterSpacing,
    element.lineSpacing, element.textFillMode, element.textUnderline, element.textStrikethrough,
    element.textLinePosition, element.textLineColor, element.textLineThickness, element.textLineOffset,
    element.textCurveAmount, element.textCurveShape, element.textCurveDirection, element.textCurveRadius, element.textCurveSpacing,
    element.textCurveSide, element.verticalText, element.textList, element.textListLineStyles, element.textListIndent,
    element.shapeFilled, element.shapeFillColor, element.shapeStrokeColor, JSON.stringify(element.shapeParameters), JSON.stringify(element.shapePath), JSON.stringify(element.shapeEffects),
    element.borderWidth, element.borderColor, element.shadowBlur, element.shadowColor,
    element.shadowOffsetX, element.shadowOffsetY, element.shadowOpacity, element.shadowEdge,
    element.textShadowEnabled, JSON.stringify(element.textEffects), element.patternCount, element.patternScale, element.patternSpacing,
    element.patternRotation, element.patternThickness, element.patternRandomise, element.patternSeed,
    element.patternSpacingX, element.patternSpacingY, JSON.stringify(element.patternColors), element.patternRoughness, element.patternVariation,
    element.patternSource, element.patternSourceWidth, element.patternSourceHeight, element.patternRepeat,
    element.patternRandomPosition, element.patternRandomRotation, element.patternMinScale, element.patternMaxScale,
    JSON.stringify(element.patternOptions), element.patternOffsetX, element.patternOffsetY, element.patternAlignment, element.patternAlignment === 'continuous' ? element.x : 0, element.patternAlignment === 'continuous' ? element.y : 0,
    element.cornerRadius, element.cropTop, element.cropRight,
    element.cropBottom, element.cropLeft, element.flipHorizontal, element.flipVertical, element.filterBlur, element.filterBrightness,
    element.filterContrast, element.filterSaturate, element.filterExposure, element.filterTemperature,
    element.filterTint, element.filterHighlights, element.filterHue, element.filterNoise, element.filterGrain,
    element.filterSharpen, JSON.stringify(element.imageFilter), element.customAreaName, element.customAreaPattern,
    JSON.stringify(element.customAreaPoints), element.customAreaViewWidth, element.customAreaViewHeight,
    JSON.stringify(element.customAreaOutline), JSON.stringify(element.customAreaFillTransform), element.customAreaTexture,
    element.customAreaImage ? `${element.customAreaImage.length}:${element.customAreaImage.slice(0, 48)}:${element.customAreaImage.slice(-24)}` : ''].join('|');
}

export function WarpedArtwork({
  element,
  warp,
  editing,
  children,
  onCommit,
}: {
  element: DesignElement;
  warp: WarpSettings;
  editing: boolean;
  children: ReactNode;
  onCommit: (warp: WarpSettings) => void;
}) {
  const displayScale=useContext(ArtworkResolutionContext),density=window.devicePixelRatio||1;
  const sourceRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const liveWarpRef = useRef<WarpSettings | null>(null);
  const displayedWarpRef = useRef(warp);
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const capturedSignature = useRef('');
  const [liveWarp, setLiveWarp] = useState<WarpSettings | null>(null);
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState({ width: Math.max(1, element.width), height: Math.max(1, element.height) });
  const signature = useMemo(() => sourceSignature(element), [element]);
  const displayedWarp = liveWarp ?? warp;
  displayedWarpRef.current = displayedWarp;
  const displayPoints = warpGrid(displayedWarp);
  const padding = artworkEffectPadding(element);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return;
    let cancelled = false;
    const capture = async () => {
      const width = Math.max(1, source.offsetWidth || element.width);
      const height = Math.max(1, source.offsetHeight || element.height);
      setDimensions((previous) => previous.width === width && previous.height === height ? previous : { width, height });
      try {
        await waitForImageFilters(source);
        if (cancelled) return;
        const raster = await toCanvas(source, { pixelRatio: artworkPixelRatio(width+padding*2,height+padding*2,displayScale,density), width: width + padding * 2, height: height + padding * 2, skipFonts: true, style: { width: `${width}px`, height: `${height}px`, transform: `translate(${padding}px, ${padding}px)`, opacity: '1' }, filter: child => !(child instanceof Element) || !child.matches('[data-editor-chrome]') });
        if (!cancelled) { capturedSignature.current = signature; setSourceCanvas(raster); }
      } catch {
        if (!cancelled) setSourceCanvas(null);
      }
    };
    void capture();
    return () => { cancelled = true; };
  }, [signature, element.width, element.height, dimensions.width, dimensions.height,displayScale,density]);

  useEffect(() => {
    const source = sourceRef.current;
    if (!source) return;
    const measure = () => {
      const width = Math.max(1, source.offsetWidth || element.width);
      const height = Math.max(1, source.offsetHeight || element.height);
      setDimensions((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(source);
    return () => observer.disconnect();
  }, [element.width, element.height]);

  useEffect(() => {
    if (!sourceCanvas || !canvasRef.current || capturedSignature.current !== signature) return;
    const canvas = canvasRef.current;
    if (canvas.width !== sourceCanvas.width || canvas.height !== sourceCanvas.height) {
      canvas.width = sourceCanvas.width;
      canvas.height = sourceCanvas.height;
    }
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      if (capturedSignature.current !== signature) return;
      const pixelScale = canvas.width / (dimensions.width + padding * 2);
      const pixelPadding = padding * pixelScale;
      const gridBounds = drawMesh(context, sourceCanvas, displayedWarpRef.current, canvas.width, canvas.height, pixelPadding);
      canvas.dataset.warpReady = signature + JSON.stringify(displayedWarpRef.current);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width;
      let minY = canvas.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          if (pixels[(y * canvas.width + x) * 4 + 3]! <= 8) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      const bounds = maxX < minX ? gridBounds : {
        x: (minX - pixelPadding) / (canvas.width - pixelPadding * 2),
        y: (minY - pixelPadding) / (canvas.height - pixelPadding * 2),
        width: (maxX - minX + 1) / (canvas.width - pixelPadding * 2),
        height: (maxY - minY + 1) / (canvas.height - pixelPadding * 2),
      };
      canvas.parentElement?.dispatchEvent(new CustomEvent('warp-bounds', { bubbles: true, detail: bounds }));
    });
  }, [sourceCanvas, displayedWarp, signature, padding, dimensions.width, dimensions.height]);

  useEffect(() => () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); }, []);

  const pointerToNormalized = (event: PointerEvent<SVGElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    return { x: Math.max(0, Math.min(1, local.x / dimensions.width)), y: Math.max(0, Math.min(1, local.y / dimensions.height)) };
  };

  const startControlDrag = (event: PointerEvent<SVGCircleElement>, index: number) => {
    if (!editing || displayedWarp.mode !== 'freeform') return;
    event.preventDefault();
    event.stopPropagation();
    const svg = event.currentTarget.ownerSVGElement;
    const original = displayedWarp.points;
    setActivePoint(index);
    const move = (pointer: globalThis.PointerEvent) => {
      const matrix = svg?.getScreenCTM();
      if (!svg || !matrix) return;
      const point = svg.createSVGPoint();
      point.x = pointer.clientX;
      point.y = pointer.clientY;
      const local = point.matrixTransform(matrix.inverse());
      const points = original.map((control, controlIndex) => controlIndex === index
        ? { x: Math.max(0, Math.min(1, local.x / dimensions.width)), y: Math.max(0, Math.min(1, local.y / dimensions.height)) }
        : control);
      const next = { ...displayedWarp, points };
      liveWarpRef.current = next;
      setLiveWarp(next);
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      const next = liveWarpRef.current;
      setLiveWarp(null);
      liveWarpRef.current = null;
      if (next) onCommit(next);
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
      setLiveWarp(null);
      liveWarpRef.current = null;
    };
    liveWarpRef.current = displayedWarp;
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', finish, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
  };

  useEffect(() => { if (liveWarp) liveWarpRef.current = liveWarp; }, [liveWarp]);

  const size = displayedWarp.gridSize;
  const gridLines = displayedWarp.mode === 'freeform' ? Array.from({ length: size }, (_, index) => {
    const fixed = index / (size - 1);
    const samples = Array.from({ length: 25 }, (_, step) => step / 24);
    return {
      key: `row-${index}`,
      points: samples.map((sample) => interpolateWarpGrid(displayPoints, size, sample, fixed)),
      vertical: false,
    };
  }).concat(Array.from({ length: size }, (_, index) => {
    const fixed = index / (size - 1);
    const samples = Array.from({ length: 25 }, (_, step) => step / 24);
    return {
      key: `column-${index}`,
      points: samples.map((sample) => interpolateWarpGrid(displayPoints, size, fixed, sample)),
      vertical: true,
    };
  })) : [];

  return <div className={`relative w-full overflow-visible ${element.type === 'text' ? 'h-auto' : 'h-full'}`} data-warp-layer>
    <div ref={sourceRef} aria-hidden className={element.type === 'text' ? 'pointer-events-none relative w-full opacity-0' : 'pointer-events-none absolute inset-0 opacity-0'}>{children}</div>
    <canvas ref={canvasRef} className="absolute" style={{ left: -padding, top: -padding, width: dimensions.width + padding * 2, height: dimensions.height + padding * 2 }} aria-label="Warped design" data-warp-canvas data-warp-expected={signature + JSON.stringify(warp)} />
    {editing && displayedWarp.mode === 'freeform' ? (
      <svg className="pointer-events-none absolute inset-0 z-50 h-full w-full overflow-visible" viewBox={`0 0 ${dimensions.width} ${dimensions.height}`} preserveAspectRatio="none" data-warp-mesh data-editor-chrome>
        {gridLines.map(line=>{const boundary=line.key.endsWith('-0')||line.key.endsWith(`-${size-1}`),coords=line.points.map(point=>`${point.x*dimensions.width},${point.y*dimensions.height}`).join(' ');return <g key={line.key}><polyline points={coords} fill="none" stroke="white" strokeOpacity={boundary ? .55 : .3} strokeWidth={boundary?2.5:1.5} vectorEffect="non-scaling-stroke"/><polyline points={coords} fill="none" stroke="#525252" strokeOpacity={boundary ? .8 : .45} strokeWidth={boundary?1:.7} vectorEffect="non-scaling-stroke"/></g>})}
        {displayPoints.map((point,index)=>{const marker=3.5/Math.max(.1,displayScale),hit=10/Math.max(.1,displayScale),x=point.x*dimensions.width,y=point.y*dimensions.height,active=activePoint===index;return <g key={index} role="button" tabIndex={0} aria-label={`Warp point ${index+1}`} aria-pressed={active} data-warp-point={index} style={{outline: 'none'}} className="pointer-events-auto cursor-move" onFocus={()=>setActivePoint(index)} onPointerDown={event=>startControlDrag(event,index)} onKeyDown={event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();const step=event.shiftKey?10:1,points=displayedWarp.points.map((p,i)=>i===index?{x:Math.max(0,Math.min(1,p.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0)/(dimensions.width*Math.max(.1,displayScale)))),y:Math.max(0,Math.min(1,p.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)/(dimensions.height*Math.max(.1,displayScale))))}:p);onCommit({...displayedWarp,points})}}><rect x={x-hit} y={y-hit} width={hit*2} height={hit*2} fill="transparent"/><rect x={x-marker} y={y-marker} width={marker*2} height={marker*2} rx={marker*.2} fill={active?'#262626':'white'} stroke={active?'white':'#737373'} strokeWidth="1" vectorEffect="non-scaling-stroke"/></g>})}

      </svg>
    ) : null}
  </div>;
}
