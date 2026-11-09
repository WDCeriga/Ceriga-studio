import {outsideDrawing,isDrawingFinishTap} from '../../../lib/drawingCompletion';
import {drawingPixelRatio} from '../../../lib/artworkResolution';
import {snapshotBrush,offsetRecordedStroke,type RecordedStroke} from '../../../lib/drawingReplay';
import {garmentWearMarks,cropWearMarks} from '../../../lib/wearEditing';
import {garmentWearPalette} from './GarmentWearAppearance';
import { useCallback, useEffect, useRef } from 'react';
import { cn } from '../../ui/utils';
import type { DesignElement } from '../PrintStudioEditor';
import { DEFAULT_PRINT_METHOD } from '../PrintStudioEditor';
import { usePrintsStudio, type PrintsStudioTool } from './PrintsStudioContext';
import { recognizeShape, type QuickShape } from '../../../lib/quickShape';
import { quadMap, zoneToAsset } from '../../../lib/designGeometry';
import { canvasPaint } from '../../../lib/studioPaint';
import { createBrushStabilizer, renderBrushStroke, smoothBrushPoints } from '../../../lib/drawingBrush';
import type { GarmentDrawingMask } from './useGarmentDrawingMask';
import { createDistressStamp, separateDistressMarks, type DistressMark, type DistressMarkKind } from '../../../lib/distressScatter';
import { renderDistressMarks } from '../../../lib/distressRendering';
import { removeBrushMask } from '../../../lib/brushRemoval';

const supportsQuickShape = (preset: string) => ['pen', 'pencil', 'fine-liner', 'technical-pen'].includes(preset);

interface PrintsDrawLayerProps {
  zone: HTMLDivElement | null;
  garmentMask: GarmentDrawingMask | null;
  elements: DesignElement[];
  onChange?: (elements: DesignElement[]) => void;
  editable: boolean;
  adjustFilter?: string;
  displayScale?:number;
  garmentSide?: 'front' | 'back';
  onFinishDrawing?: (id:string)=>void;
}

interface Pt {
  x: number;
  y: number;
  p: number;
  tilt: number;
  pen?: boolean;
}

type ErasePoint = { x: number; y: number };
type EraseLayer = {
  element: DesignElement;
  content: HTMLElement;
  mask: SVGMaskElement;
  contours: ErasePoint[][];
  previousMask: string;
  relief: HTMLElement | null;
  previousReliefVisibility: string;
};

const svgNamespace = 'http://www.w3.org/2000/svg';
const eraseCircle = Array.from({ length: 64 }, (_, index) => {
  const angle = index * Math.PI / 32;
  return { x: Math.cos(angle), y: Math.sin(angle) };
});

function appendEraseContours(mask: SVGMaskElement, contours: ErasePoint[][]) {
  if (!contours.length) return;
  const path = document.createElementNS(svgNamespace, 'path');
  path.setAttribute('fill', 'black');
  path.setAttribute('d', contours.map(contour =>
    'M' + contour.map(point => `${point.x.toFixed(6)},${point.y.toFixed(6)}`).join('L') + 'Z',
  ).join(''));
  mask.append(path);
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  if (Number.isNaN(n)) return '255,255,255';
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function alphaBounds(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 12) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  const pad = 3;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return {
    x,
    y,
    w: Math.min(width - x, maxX + pad - x + 1),
    h: Math.min(height - y, maxY + pad - y + 1),
  };
}

function cropCanvas(source: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }) {
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(box.w));
  out.height = Math.max(1, Math.round(box.h));
  const ctx = out.getContext('2d');
  if (ctx) ctx.drawImage(source, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
  return out;
}

function isPaintElement(el: DesignElement) {
  return el.type === 'drawing' || el.type === 'distress';
}

function isEraseTool(tool: PrintsStudioTool) {
  return tool === 'eraser' || tool === 'distressEraser';
}

function eraseRadius(canvas: HTMLCanvasElement, tool: PrintsStudioTool, size: number, displayWidth?: number) {
  const width = tool === 'eraser' ? displayWidth ?? canvas.getBoundingClientRect().width : canvas.clientWidth;
  return size / 2 * canvas.width / Math.max(1, width);
}

function isErasable(el: DesignElement, tool: PrintsStudioTool) {
  if (el.locked || el.hidden) return false;
  if (tool === 'distressEraser') return el.type === 'distress';
  return isPaintElement(el) || (el.type === 'shape' && el.shapeGeometry === 'bounds');
}

function canvasFromImage(img: HTMLImageElement) {
  const buf = document.createElement('canvas');
  buf.width = Math.max(1, img.naturalWidth);
  buf.height = Math.max(1, img.naturalHeight);
  const ctx = buf.getContext('2d');
  if (ctx) ctx.drawImage(img, 0, 0);
  return buf;
}

function svgToCanvas(svg: SVGElement, w: number, h: number) {
  return new Promise<HTMLCanvasElement | null>((resolve) => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    const vb = (svg as SVGSVGElement).viewBox?.baseVal;
    if (vb && vb.width && vb.height && !clone.getAttribute('viewBox')) {
      clone.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.width} ${vb.height}`);
    }
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const buf = document.createElement('canvas');
      buf.width = w;
      buf.height = h;
      const ctx = buf.getContext('2d');
      if (ctx) ctx.drawImage(image, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(buf);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

function pointsAlong(a: Pt, b: Pt, spacing: number): Pt[] {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  if (dist <= spacing) return [b];
  const n = Math.ceil(dist / spacing);
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      p: b.p,
      tilt: b.tilt,
    });
  }
  return out;
}

function canvasHasInk(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] > 10) return true;
  }
  return false;
}

export function PrintsDrawLayer({
  zone,
  garmentMask,
  elements,
  onChange,
  editable,
  adjustFilter,
  garmentSide = 'front',
  displayScale=1,
  onFinishDrawing,
}: PrintsDrawLayerProps) {
  const studio = usePrintsStudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<Pt[]>([]);
  const replayPointsRef=useRef<Pt[]>([]);
  const shapeStrokeRef = useRef<Pt[]>([]);
  const drawingRef = useRef(false);
  const strokeLayerRef = useRef<HTMLCanvasElement | null>(null);
  const lastPenTapRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const shapeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shapeRef = useRef<QuickShape | null>(null);
  const holdPointRef = useRef<Pt | null>(null);
  const studioRef = useRef(studio);
  const elementsRef = useRef(elements);
  const onChangeRef = useRef(onChange);
  const sideRef = useRef(garmentSide);
  const finishDrawingRef=useRef(onFinishDrawing);finishDrawingRef.current=onFinishDrawing;
  const finishTapRef=useRef<{id:string;x:number;y:number;time:number}|null>(null);
  const eraseMasksRef = useRef<SVGSVGElement>(null);
  const lastErasePtRef = useRef<Pt | null>(null);
  const eraseFlushRef = useRef<number | null>(null);
  const eraseCursorRef = useRef<SVGSVGElement>(null);
  const eraseGestureRef = useRef<Map<string, EraseLayer> | null>(null);
  const smoothTipRef = useRef<Pt | null>(null);
  const stabilizerRef = useRef<ReturnType<typeof createBrushStabilizer> | null>(null);
  const lastDistressStampRef = useRef<(Pt & { t: number }) | null>(null);
  const distressStampsRef = useRef<DistressMark[]>([]);
  const distressCursorRef = useRef<Pt | null>(null);
  const eraseQueueRef = useRef<Pt[]>([]);
  const sessionRef = useRef<{ element: DesignElement; canvas: HTMLCanvasElement } | null>(null);
  const distressSessionsRef = useRef(new Map<string, { element: DesignElement; canvas: HTMLCanvasElement }>());
  const mirrorLayerRef = useRef<HTMLCanvasElement | null>(null);
  const strokeSeedRef = useRef(1);
  const pointerIdRef = useRef<number | null>(null);

  useEffect(() => { sessionRef.current = null; }, [studio.drawingSession, garmentSide]);
  useEffect(() => { distressSessionsRef.current.delete(sideRef.current); }, [studio.distressSession]);

  useEffect(() => {
    studioRef.current = studio;
  }, [studio]);
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    sideRef.current = garmentSide;
  }, [garmentSide]);

  const syncSize = useCallback(() => {
    const canvas = canvasRef.current;
    const host = zone;
    if (!canvas || !host) return;
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    if(drawingRef.current)return;
    const dpr = drawingPixelRatio(w,h,displayScale,window.devicePixelRatio||1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
  }, [zone,displayScale]);

  useEffect(() => {
    syncSize();
    if (!zone) return;
    const ro = new ResizeObserver(() => syncSize());
    ro.observe(zone);
    return () => ro.disconnect();
  }, [zone, syncSize]);

  const clipToGarment = (context: CanvasRenderingContext2D) => {
    context.save();
    context.globalCompositeOperation = 'destination-in';
    if (garmentMask) context.drawImage(garmentMask.canvas, 0, 0, context.canvas.width, context.canvas.height);
    else context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    context.restore();
  };

  const mirrorStroke = (context: CanvasRenderingContext2D) => {
    if (!studioRef.current.symmetry) return;
    const copy = mirrorLayerRef.current ?? document.createElement('canvas');
    mirrorLayerRef.current = copy;
    copy.width = context.canvas.width;
    copy.height = context.canvas.height;
    copy.getContext('2d')?.drawImage(context.canvas, 0, 0);
    context.save();
    context.translate((garmentMask ? garmentMask.axis / garmentMask.width * context.canvas.width : context.canvas.width / 2) * 2, 0);
    context.scale(-1, 1);
    context.drawImage(copy, 0, 0);
    context.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && !drawingRef.current) ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (studio.tool !== 'distress') distressCursorRef.current = null;
  }, [studio.drawing, studio.tool]);

  const eventPoint = (e: React.PointerEvent | PointerEvent, canvas: HTMLCanvasElement, rect = canvas.getBoundingClientRect()): Pt => {
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const tilt = Math.min(1, Math.hypot(e.tiltX ?? 0, e.tiltY ?? 0) / 60);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      p: e.pointerType === 'mouse' ? 0.85 : Math.max(0.08, e.pressure || 0.45),
      tilt,
      pen: e.pointerType === 'pen',
    };
  };

  const DISTRESS_HOLD_MS = 520;

  const distressMinDist = (canvas: HTMLCanvasElement) => {
    const scale = canvas.width / Math.max(1, canvas.clientWidth);
    const count = Math.max(1, studioRef.current.distressScatter.count);
    return Math.max(5, studioRef.current.eraserSize * 0.46 * Math.sqrt(14 / count)) * scale;
  };

  const tryStampDistress = (pt: Pt, source: 'down' | 'move' | 'hold') => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const last = lastDistressStampRef.current;
    const now = performance.now();
    if (source !== 'down' && last) {
      const dist = Math.hypot(pt.x - last.x, pt.y - last.y);
      const minDist = distressMinDist(canvas);
      if (source === 'move' && dist < minDist) return;
      if (source === 'hold' && now - last.t < DISTRESS_HOLD_MS - 30) return;
    }
    if (source === 'down') {
      strokeRef.current = [pt];
      distressStampsRef.current = [];
    } else strokeRef.current.push(pt);
    lastDistressStampRef.current = { ...pt, t: now };
    const studio = studioRef.current;
    const canvasScale = canvas.width / Math.max(1, canvas.clientWidth);
    const pressureScale = studio.pressure && pt.pen ? 0.35 + pt.p * 0.65 : 1;
    const scatterSettings = { ...studio.distressScatter, size: studio.distressScatter.size * canvasScale * pressureScale };
    const kind = studio.distressType as DistressMarkKind;
    const palette=garmentWearPalette(zone,pt.x/canvas.width,pt.y/canvas.height);
    const occupied=kind==='holes'?elementsRef.current.filter(el=>!el.hidden&&(el.side??'front')===sideRef.current&&el.wear?.kind==='holes').flatMap(garmentWearMarks).map(mark=>({...mark,x:mark.x*canvasScale,y:mark.y*canvasScale,width:mark.width*canvasScale,height:mark.height*canvasScale})):[];
    const candidates=createDistressStamp(pt,(studio.eraserSize/2)*canvasScale,scatterSettings,kind,canvasScale);
    const spaced=kind==='holes'?separateDistressMarks(candidates,[...occupied,...distressStampsRef.current],canvasScale):candidates;
    distressStampsRef.current.push(...spaced.map(mark=>({...mark,palette})));
    paintStroke(strokeRef.current, 'distress');
  };

  const paintEraseCursor = (canvas: HTMLCanvasElement, point: Pt, displayWidth: number) => {
    const cursor = eraseCursorRef.current;
    if (!cursor) return;
    const scaleX = canvas.clientWidth / canvas.width;
    const scaleY = canvas.clientHeight / canvas.height;
    const diameter = 2 * eraseRadius(canvas, studioRef.current.tool, studioRef.current.eraserSize, displayWidth);
    const screenDiameter = diameter * displayWidth / canvas.width;
    const width = `${diameter * scaleX}px`;
    const height = `${diameter * scaleY}px`;
    if (cursor.style.width !== width || cursor.style.height !== height) {
      cursor.style.width = width;
      cursor.style.height = height;
    }
    const outlineWidth = String(6 / screenDiameter);
    if (cursor.firstElementChild?.getAttribute('stroke-width') !== outlineWidth) {
      cursor.firstElementChild?.setAttribute('stroke-width', outlineWidth);
      cursor.lastElementChild?.setAttribute('stroke-width', String(2 / screenDiameter));
    }
    cursor.style.transform = `translate3d(${point.x * scaleX}px, ${point.y * scaleY}px, 0) translate(-50%, -50%)`;
    cursor.style.visibility = 'visible';
  };

  const paintStroke = (points: Pt[], tool: PrintsStudioTool) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = studioRef.current;
    let strokeLayer = strokeLayerRef.current;
    if (!strokeLayer) {
      strokeLayer = document.createElement('canvas');
      strokeLayerRef.current = strokeLayer;
    }
    if (strokeLayer.width !== canvas.width || strokeLayer.height !== canvas.height) {
      strokeLayer.width = canvas.width;
      strokeLayer.height = canvas.height;
    }
    // Alpha-bound reads must not switch raster backends between preview and placement.
    const sctx = strokeLayer.getContext('2d', { willReadFrequently: true });
    if (!sctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (points.length < 1) return;

    sctx.clearRect(0, 0, strokeLayer.width, strokeLayer.height);
    sctx.save();
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    sctx.globalAlpha = 1;
    const strokeAlpha = Math.max(0.04, Math.min(1, s.opacity / 100));
    const cssToCanvas = canvas.width / Math.max(1, canvas.clientWidth || 1);

    sctx.strokeStyle = canvasPaint(sctx, s.color, strokeLayer.width, strokeLayer.height);
    sctx.fillStyle = sctx.strokeStyle;

    if (tool === 'distress') {
      sctx.globalCompositeOperation = 'source-over';
      const center=distressStampsRef.current.at(-1);
      renderDistressMarks(sctx, distressStampsRef.current, s.distressType, cssToCanvas,garmentWearPalette(zone,center?center.x/strokeLayer.width:.5,center?center.y/strokeLayer.height:.5));
      clipToGarment(sctx);
      sctx.restore();
      ctx.save();
      ctx.globalAlpha = strokeAlpha;
      ctx.drawImage(strokeLayer, 0, 0);
      ctx.restore();
      return;
    }

    replayPointsRef.current=[...points];
    renderBrushStroke(sctx, points, s, cssToCanvas, strokeSeedRef.current);
    sctx.restore();

    mirrorStroke(sctx);
    clipToGarment(sctx);
    ctx.save();
    ctx.globalAlpha = strokeAlpha;
    ctx.drawImage(strokeLayer, 0, 0);
    ctx.restore();
  };

  useEffect(() => {
    if (!drawingRef.current || studioRef.current.tool !== 'brush') return;
    if (!supportsQuickShape(studioRef.current.brushPreset) || studioRef.current.texture !== 'smooth' || studioRef.current.scatterEnabled || studioRef.current.brushSpacing > 12) {
      if (shapeTimerRef.current) clearTimeout(shapeTimerRef.current);
      shapeTimerRef.current = null;
    }
    paintStroke(strokeRef.current, 'brush');
  }, [studio]);

  const previewDistressAt = (pt: Pt, canvas: HTMLCanvasElement) => {
    const studio = studioRef.current;
    const canvasScale = canvas.width / Math.max(1, canvas.clientWidth);
    const pressureScale = studio.pressure && pt.pen ? 0.35 + pt.p * 0.65 : 1;
    distressStampsRef.current = createDistressStamp(
      pt,
      studio.eraserSize / 2 * canvasScale,
      { ...studio.distressScatter, size: studio.distressScatter.size * canvasScale * pressureScale },
      studio.distressType,
      canvasScale,
    );
    if(studio.distressType==='holes') {
      const occupied=elementsRef.current.filter(el=>!el.hidden&&(el.side??'front')===sideRef.current&&el.wear?.kind==='holes').flatMap(garmentWearMarks).map(mark=>({...mark,x:mark.x*canvasScale,y:mark.y*canvasScale,width:mark.width*canvasScale,height:mark.height*canvasScale}));
      distressStampsRef.current=separateDistressMarks(distressStampsRef.current,occupied,canvasScale);
    }
    paintStroke([pt], 'distress');
    distressStampsRef.current = [];
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const point = distressCursorRef.current;
    if (!canvas || drawingRef.current || studio.tool !== 'distress' || !point || !garmentMask) return;
    previewDistressAt(point, canvas);
  }, [studio.tool, studio.distressScatter, studio.distressType, studio.eraserSize, studio.opacity, garmentMask]);

  const commitStroke = useCallback(() => {
    const canvas = canvasRef.current;
    const strokeLayer = strokeLayerRef.current;
    const host = zone;
    const fn = onChangeRef.current;
    if (!canvas || !strokeLayer || !host || !fn || !alphaBounds(strokeLayer)) return;
    const inkBounds = alphaBounds(strokeLayer)!;
    const tool = studioRef.current.tool;
    if (tool === 'brush' && studioRef.current.brushPreset === 'distress-brush' && studioRef.current.distressMode !== 'paint') {
      const mask = strokeLayer.getContext('2d')!.getImageData(0, 0, strokeLayer.width, strokeLayer.height);
      let changed = false;
      const updated = elementsRef.current.flatMap(element => {
        if (element.type !== 'drawing' || element.locked || element.hidden || (element.side ?? 'front') !== sideRef.current) return [element];
        if(element.drawing){
          const scaleX=canvas.width/Math.max(1,host.clientWidth),scaleY=canvas.height/Math.max(1,host.clientHeight),recording=element.drawing;
          const eraser:RecordedStroke={points:replayPointsRef.current.map(p=>{const local=zoneToAsset({x:p.x/scaleX,y:p.y/scaleY},element);return {...p,x:local.x*recording.width,y:local.y*recording.height}}),settings:{...snapshotBrush(studioRef.current),color:'#000',brushSize:studioRef.current.brushSize*recording.width/element.width},seed:strokeSeedRef.current,opacity:studioRef.current.opacity/100};
          changed=true;return [{...element,drawing:{...recording,erasers:[...(recording.erasers??[]),eraser]}}];
        }
        const image = host.querySelector<HTMLImageElement>(`[data-print-id="${element.id}"] img`);
        if (!image?.complete || !image.naturalWidth || image.getAttribute('src') !== element.content) return [element];
        const source = canvasFromImage(image);
        if (!removeBrushMask(source, mask, element, canvas.width / Math.max(1, host.clientWidth), canvas.height / Math.max(1, host.clientHeight), studioRef.current.opacity / 100)) return [element];
        changed = true;
        return canvasHasInk(source) ? [{ ...element,drawing:undefined, content: source.toDataURL('image/png') }] : [];
      });
      if (changed) {
        sessionRef.current = null;
        elementsRef.current = updated;
        fn(updated);
      }
      return;
    }
    if(tool==='distress'&&!distressStampsRef.current.length)return;
    const previous = tool === 'distress' ? distressSessionsRef.current.get(sideRef.current) : sessionRef.current;
    const existing = previous && elementsRef.current.find(element => element.id === previous.element.id);
    // Re-read erased/undone pixels, but never overwrite a layer's edited style or locked state.
    const unchangedWear=Boolean(existing?.wear&&previous&&existing.wear===previous.element.wear&&(['content','x','y','width','height'] as const).every(key=>existing[key]===previous.element[key]));
    const compatibleDistress = tool === 'distress' && existing?.wear?.kind===studioRef.current.distressType && unchangedWear && previous && !existing.locked && !existing.hidden &&
      (Object.keys({ ...previous.element, ...existing }) as (keyof DesignElement)[]).every(key =>
        ['content', 'x', 'y', 'width', 'height'].includes(key) || existing[key] === previous.element[key]);
    const canAppend = previous && existing && (existing.side ?? 'front') === sideRef.current &&
      (compatibleDistress || (tool === 'brush' && existing === previous.element && !existing.drawing?.cuts?.length && !existing.drawing?.erasers?.length && !existing.eraseContours?.length &&
        previous.canvas.width === canvas.width && previous.canvas.height === canvas.height));
    const merged = document.createElement('canvas');
    merged.width = canvas.width;
    merged.height = canvas.height;
    const mergedContext = merged.getContext('2d');
    if (!mergedContext) return;
    if (canAppend) {
      if ((existing === previous.element || unchangedWear) && previous.canvas.width === canvas.width && previous.canvas.height === canvas.height) {
        mergedContext.drawImage(previous.canvas, 0, 0);
      } else {
        const image = host.querySelector<HTMLImageElement>(`[data-print-id="${existing.id}"] img`);
        if (!image?.complete || !image.naturalWidth || image.getAttribute('src') !== existing.content) return;
        const sx = canvas.width / Math.max(1, host.clientWidth);
        const sy = canvas.height / Math.max(1, host.clientHeight);
        mergedContext.drawImage(image, (existing.x - existing.width / 2) * sx, (existing.y - existing.height / 2) * sy,
          existing.width * sx, existing.height * sy);
      }
    }
    mergedContext.globalAlpha = tool === 'distress'
      ? Math.max(0, Math.min(1, studioRef.current.opacity / 100))
      : studioRef.current.opacity / 100;
    mergedContext.drawImage(strokeLayer, 0, 0);
    const box = alphaBounds(merged);
    if (!box || box.w < 2 || box.h < 2) return;
    const cropped = cropCanvas(merged, box);
    const dataUrl = cropped.toDataURL('image/png');
    const cssW = Math.max(1, host.clientWidth);
    const cssH = Math.max(1, host.clientHeight);
    const scaleX = canvas.width / cssW;
    const scaleY = canvas.height / cssH;
    const originX=box.x/scaleX,originY=box.y/scaleY;
    const recorded:RecordedStroke={points:replayPointsRef.current.map(p=>({...p,x:p.x/scaleX-originX,y:p.y/scaleY-originY})),settings:snapshotBrush(studioRef.current),seed:strokeSeedRef.current,opacity:studioRef.current.opacity/100,
      paintFrame:{x:-originX,y:-originY,width:cssW,height:cssH},
      mirrorAxis:studioRef.current.symmetry?(garmentMask?.axis??cssW/2)-originX:undefined,
      clip:garmentMask?{url:garmentMask.vectorUrl??garmentMask.url,x:-originX,y:-originY,width:garmentMask.width,height:garmentMask.height}:undefined};
    const oldStrokes=canAppend&&previous?.element.drawing?previous.element.drawing.strokes.map(s=>offsetRecordedStroke(s,previous.element.x-previous.element.width/2-originX,previous.element.y-previous.element.height/2-originY)):[];
    const next: DesignElement = {
      ...(tool==='brush'&&recorded.points.length?{drawing:{width:box.w/scaleX,height:box.h/scaleY,strokes:[...oldStrokes,recorded]}}:{}),
      id: canAppend ? previous.element.id : crypto.randomUUID(),
      type: tool === 'distress' ? 'distress' : 'drawing',
      content: dataUrl,
      x: (box.x + box.w / 2) / scaleX,
      y: (box.y + box.h / 2) / scaleY,
      width: box.w / scaleX,
      height: box.h / scaleY,
      rotation: 0,
      opacity: 100,
      locked: false,
      ...(tool==='distress'?{wear:{kind:studioRef.current.distressType,sourceWidth:box.w/scaleX,sourceHeight:box.h/scaleY,
        marks:cropWearMarks([...(canAppend&&existing?garmentWearMarks(existing).map(mark=>({...mark,x:mark.x*scaleX,y:mark.y*scaleY,width:mark.width*scaleX,height:mark.height*scaleY})):[]),...distressStampsRef.current.map(mark=>({...mark,opacity:mark.opacity*studioRef.current.opacity/100}))],box.x,box.y,scaleX,scaleY)}}:{}),
      printMethod: tool === 'distress' ? undefined : DEFAULT_PRINT_METHOD,
      side: sideRef.current,
      aspectLocked: false,
    };
    const updated = canAppend
      ? elementsRef.current.map(element => element.id === next.id ? next : element)
      : [...elementsRef.current, next];
    if (tool === 'brush') sessionRef.current = { element: next, canvas: merged };
    if (tool === 'distress') distressSessionsRef.current.set(sideRef.current, { element: next, canvas: merged });
    elementsRef.current = updated;
    fn(updated);
  }, [zone,garmentMask]);

  const restoreEraseLayers = (layers: Map<string, EraseLayer>) => {
    for (const layer of layers.values()) {
      if (layer.content.style.maskImage === `url("#${layer.mask.id}")`) {
        layer.content.style.maskImage = layer.previousMask;
      }
      if (layer.relief) layer.relief.style.visibility = layer.previousReliefVisibility;
      layer.mask.remove();
    }
  };

  const flushEraser = () => {
    eraseFlushRef.current = null;
    const points = eraseQueueRef.current;
    eraseQueueRef.current = [];
    const layers = eraseGestureRef.current;
    const canvas = canvasRef.current;
    const masks = eraseMasksRef.current;
    if (!canvas || !zone || !masks || !layers || !points.length) return;

    const scaleX = Math.max(1, zone.clientWidth) / canvas.width;
    const scaleY = Math.max(1, zone.clientHeight) / canvas.height;
    const tool = studioRef.current.tool;
    const radius = eraseRadius(canvas, tool, studioRef.current.eraserSize) * scaleX;
    const centers = points.map(point => ({ x: point.x * scaleX, y: point.y * scaleY }));

    for (const element of elementsRef.current) {
      if (!isErasable(element, tool) || (element.side ?? 'front') !== sideRef.current) continue;

      const angle = element.rotation * Math.PI / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const { inverse } = quadMap(element.perspective);
      const toLocal = ({x, y}: ErasePoint) => {
        const dx = x - element.x;
        const dy = y - element.y;
        const local = inverse({
          x: (dx * cos + dy * sin) / element.width + .5,
          y: (-dx * sin + dy * cos) / element.height + .5,
        });
        return { x: element.flipHorizontal ? 1 - local.x : local.x, y: local.y };
      };
      const marginX = radius / element.width;
      const marginY = radius / element.height;
      const nearby = centers.filter(center => {
        const point = toLocal(center);
        return point.x >= -marginX && point.x <= 1 + marginX && point.y >= -marginY && point.y <= 1 + marginY;
      });
      if (!nearby.length) continue;

      let layer = layers.get(element.id);
      if (!layer) {
        const root = zone.querySelector(`[data-print-id="${CSS.escape(element.id)}"]`);
        const content = root?.querySelector<HTMLElement>('[data-asset-content]');
        if (!content) continue;
        const mask = document.createElementNS(svgNamespace, 'mask');
        mask.id = `live-eraser-${crypto.randomUUID()}`;
        mask.setAttribute('maskContentUnits', 'objectBoundingBox');
        mask.style.maskType = 'luminance';
        const background = document.createElementNS(svgNamespace, 'rect');
        background.setAttribute('width', '1');
        background.setAttribute('height', '1');
        background.setAttribute('fill', 'white');
        mask.append(background);
        appendEraseContours(mask, element.eraseContours ?? []);
        masks.append(mask);

        const relief = content.parentElement?.querySelector<HTMLElement>(':scope > [data-print-fabric-relief]') ?? null;
        layer = {
          element, content, mask, contours: [],
          previousMask: content.style.maskImage,
          relief, previousReliefVisibility: relief?.style.visibility ?? '',
        };
        layers.set(element.id, layer);
        content.style.maskImage = `url("#${mask.id}")`;
        if (relief) relief.style.visibility = 'hidden';
      }

      const contours = nearby.map(center => eraseCircle.map(point =>
        toLocal({ x: center.x + point.x * radius, y: center.y + point.y * radius }),
      ));
      layer.contours.push(...contours);
      appendEraseContours(layer.mask, contours);
    }
  };

  const commitEraser = async (layers: Map<string, EraseLayer>) => {
    const results = await Promise.all([...layers.values()].map(async ({ element, content, contours }) => {
      if (element.drawing || element.wear || (element.type === 'shape' && element.shapeGeometry === 'bounds')) {
        return { element, next: { ...element, eraseContours: [...(element.eraseContours ?? []), ...contours] } };
      }

      try {
        const image = content.querySelector<HTMLImageElement>('img');
        const svg = content.querySelector<SVGSVGElement>('svg[viewBox]');
        const buffer = image?.naturalWidth ? canvasFromImage(image) : svg
          ? await svgToCanvas(svg, Math.max(2, content.clientWidth * 2), Math.max(2, content.clientHeight * 2))
          : null;
        const context = buffer?.getContext('2d');
        if (!buffer || !context || eraseGestureRef.current !== layers) return { element, next: element };
        context.globalCompositeOperation = 'destination-out';
        context.beginPath();
        for (const contour of contours) {
          contour.forEach((point, index) => {
            const x = point.x * buffer.width;
            const y = point.y * buffer.height;
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.closePath();
        }
        context.fill();
        if (!canvasHasInk(buffer)) return { element, next: null };
        return { element, next: { ...element, wear: undefined, wearDetail: undefined, content: buffer.toDataURL('image/png') } };
      } catch {
        return { element, next: element };
      }
    }));

    if (eraseGestureRef.current !== layers) return;
    eraseGestureRef.current = null;
    restoreEraseLayers(layers);
    const updates = new Map(results.map(({ element, next }) => [element, next]));
    let changed = false;
    const next = elementsRef.current.flatMap(element => {
      const update = updates.get(element);
      if (update === undefined || update === element) return [element];
      changed = true;
      return update ? [update] : [];
    });
    if (changed) {
      elementsRef.current = next;
      onChangeRef.current?.(next);
    }
  };

  const cancelEraser = useCallback(() => {
    if (eraseFlushRef.current !== null) cancelAnimationFrame(eraseFlushRef.current);
    eraseFlushRef.current = null;
    eraseQueueRef.current = [];
    const layers = eraseGestureRef.current;
    if (layers) restoreEraseLayers(layers);
    eraseGestureRef.current = null;
  }, []);

  const addErasePoint = (point: Pt, canvas: HTMLCanvasElement, displayWidth: number, final = false) => {
    const previous = lastErasePtRef.current;
    const spacing = Math.max(2, eraseRadius(canvas, studioRef.current.tool, studioRef.current.eraserSize, displayWidth) * .45);
    if (previous?.x === point.x && previous.y === point.y) return;
    if (!final && previous && Math.hypot(point.x - previous.x, point.y - previous.y) < spacing / 2) return;
    eraseQueueRef.current.push(...(previous ? pointsAlong(previous, point, spacing) : [point]));
    lastErasePtRef.current = point;
    if (eraseFlushRef.current === null) {
      eraseFlushRef.current = requestAnimationFrame(flushEraser);
    }
  };

  const active = editable && studio.drawing;

  useEffect(() => () => {
    cancelEraser();
    if (shapeTimerRef.current) clearTimeout(shapeTimerRef.current);
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    drawingRef.current = false;
    shapeRef.current = null;
    shapeStrokeRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }, [studio.tool, garmentSide, editable, cancelEraser]);

  const scheduleShape = (point: Pt) => {
    if (shapeTimerRef.current) clearTimeout(shapeTimerRef.current);
    shapeRef.current = null;
    holdPointRef.current = point;
    if (studioRef.current.tool !== 'brush' || !supportsQuickShape(studioRef.current.brushPreset) || studioRef.current.texture !== 'smooth' || studioRef.current.scatterEnabled || studioRef.current.brushSpacing > 12) return;
    shapeTimerRef.current = setTimeout(() => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context || !drawingRef.current) return;
      const shape = recognizeShape(shapeStrokeRef.current);
      if (!shape) return;
      shapeRef.current = shape;
      holdPointRef.current = shapeStrokeRef.current[shapeStrokeRef.current.length - 1];
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.strokeStyle = canvasPaint(context, studioRef.current.color, canvas.width, canvas.height);
      context.translate(shape.x, shape.y);
      context.rotate(shape.rotation * Math.PI / 180);
      context.globalAlpha = 1;
      context.lineWidth = studioRef.current.brushSize * canvas.width / Math.max(1, canvas.clientWidth);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      if (shape.content === 'ellipse' || shape.content === 'circle') context.ellipse(0, 0, shape.width / 2, shape.height / 2, 0, 0, 2 * Math.PI);
      else if (shape.content === 'semicircle-open' || shape.content === 'semicircle-closed') {
        context.ellipse(0, shape.height / 2, shape.width / 2, shape.height, 0, Math.PI, 2 * Math.PI);
        if (shape.content === 'semicircle-closed') context.closePath();
      }
      else if (shape.content === 'rect') context.rect(-shape.width / 2, -shape.height / 2, shape.width, shape.height);
      else { context.moveTo(-shape.width / 2, 0); context.lineTo(shape.width / 2, 0); }
      context.stroke();
      context.restore();
      mirrorStroke(context);
      clipToGarment(context);
      const layer = strokeLayerRef.current;
      const layerContext = layer?.getContext('2d');
      if (layer && layerContext) {
        layerContext.clearRect(0, 0, layer.width, layer.height);
        layerContext.drawImage(canvas, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.save();
        context.globalAlpha = studioRef.current.opacity / 100;
        context.drawImage(layer, 0, 0);
        context.restore();
      }
      drawingRef.current = false;
      pointerIdRef.current = null;
      shapeTimerRef.current = null;
      shapeRef.current = null;
      holdPointRef.current = null;
      strokeRef.current = [];
      replayPointsRef.current=[];
      shapeStrokeRef.current = [];
      commitStroke();
      context.clearRect(0, 0, canvas.width, canvas.height);
    }, 550);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = studioRef.current;
    if (!active || drawingRef.current || eraseGestureRef.current) return;
    if (e.button !== 0 && !(e.button === 2 && isEraseTool(s.tool))) return;
    if (s.pencil.pencilOnly && e.pointerType !== 'pen') return;
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    syncSize();
    if (!canvas) return;
    if ((s.tool === 'brush' || s.tool === 'distress') && !garmentMask) return;

    if (s.pencil.doubleTapTogglesEraser && e.pointerType === 'pen') {
      const now = performance.now();
      if (now - lastPenTapRef.current < 280) {
        s.setTool(s.tool === 'eraser' ? 'brush' : 'eraser');
        lastPenTapRef.current = 0;
        return;
      }
      lastPenTapRef.current = now;
    }

    replayPointsRef.current=[];
    drawingRef.current = true;
    pointerIdRef.current = e.pointerId;
    strokeSeedRef.current = (Math.random() * 0x7fffffff) | 0;
    const rect = canvas.getBoundingClientRect();
    const pt = eventPoint(e, canvas, rect);
    const previous=s.tool==='brush'?sessionRef.current?.element:undefined;
    const unit=canvas.width/Math.max(1,canvas.clientWidth);
    finishTapRef.current=previous&&outsideDrawing({x:pt.x/unit,y:pt.y/unit},previous)?{id:previous.id,x:e.clientX,y:e.clientY,time:e.timeStamp}:null;
    strokeRef.current = [pt];
    shapeStrokeRef.current = [pt];
    smoothTipRef.current = pt;
    stabilizerRef.current = createBrushStabilizer(pt, e.timeStamp, canvas.width / Math.max(1, rect.width));
    scheduleShape(pt);
    const tool = studioRef.current.tool;
    if (tool === 'distress') {
      lastDistressStampRef.current = null;
      tryStampDistress(pt, 'down');
      if (holdTimerRef.current) window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = window.setInterval(() => {
        const tip = smoothTipRef.current;
        if (!drawingRef.current || !tip) return;
        tryStampDistress(tip, 'hold');
      }, DISTRESS_HOLD_MS);
    } else if (isEraseTool(tool)) {
      eraseGestureRef.current = new Map();
      lastErasePtRef.current = null;
      addErasePoint(pt, canvas, rect.width);
      paintEraseCursor(canvas, pt, rect.width);
    } else {
      paintStroke(strokeRef.current, tool);
    }
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const appendPointerSample = (sample: PointerEvent, canvas: HTMLCanvasElement, tool: PrintsStudioTool) => {
    const raw = eventPoint(sample, canvas);
    const anchor = holdPointRef.current;
    const holdTolerance = 4 * canvas.width / Math.max(1, canvas.clientWidth);
    if (anchor && Math.hypot(raw.x - anchor.x, raw.y - anchor.y) < holdTolerance && shapeRef.current) return;
    if (tool === 'brush') shapeStrokeRef.current.push(raw);
    if (!anchor || Math.hypot(raw.x - anchor.x, raw.y - anchor.y) >= holdTolerance) scheduleShape(raw);
    const amount = studioRef.current.stabilization / 100;
    const pt = stabilizerRef.current?.(raw, amount, sample.timeStamp) ?? raw;
    smoothTipRef.current = pt;
    if (tool === 'distress') {
      tryStampDistress(pt, 'move');
      return;
    }
    const last = strokeRef.current[strokeRef.current.length - 1];
    const moved = last ? Math.hypot(pt.x - last.x, pt.y - last.y) : 999;
    const scale = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    if (amount > 0 && moved < 0.2 * scale) {
      return;
    }
    if (last && moved > 2.2) {
      strokeRef.current.push(...pointsAlong(last, pt, 2));
    } else {
      strokeRef.current.push(pt);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const tap=finishTapRef.current;if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>4)finishTapRef.current=null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (drawingRef.current && pointerIdRef.current !== e.pointerId) return;
    const tool = studioRef.current.tool;
    if (isEraseTool(tool)) {
      const rect = canvas.getBoundingClientRect();
      if (drawingRef.current) {
        const samples = e.nativeEvent.getCoalescedEvents?.();
        for (const sample of samples?.length ? samples : [e.nativeEvent]) {
          addErasePoint(eventPoint(sample, canvas, rect), canvas, rect.width);
        }
      }
      paintEraseCursor(canvas, eventPoint(e, canvas, rect), rect.width);
      return;
    }
    if (!drawingRef.current) {
      if (tool === 'distress' && garmentMask) {
        const point = eventPoint(e, canvas);
        distressCursorRef.current = point;
        previewDistressAt(point, canvas);
      }
      return;
    }
    const samples = e.nativeEvent.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length ? samples : [e.nativeEvent]) {
      appendPointerSample(sample, canvas, tool);
    }
    if (tool !== 'distress' && !shapeRef.current) paintStroke(strokeRef.current, tool);
  };

  const onPointerLeave = () => {
    if (drawingRef.current) return;
    distressCursorRef.current = null;
    if (eraseCursorRef.current) eraseCursorRef.current.style.visibility = 'hidden';
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || pointerIdRef.current !== event.pointerId) return;
    drawingRef.current = false;
    pointerIdRef.current = null;
    if (shapeTimerRef.current) clearTimeout(shapeTimerRef.current);
    const finishTap=finishTapRef.current;finishTapRef.current=null;
    const heldShape = shapeRef.current;
    shapeRef.current = null;
    holdPointRef.current = null;
    if (holdTimerRef.current) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const tool = studioRef.current.tool;
    const canvas = canvasRef.current;
    if (isEraseTool(tool) && event.type !== 'pointercancel' && canvas) {
      const rect = canvas.getBoundingClientRect();
      addErasePoint(eventPoint(event, canvas, rect), canvas, rect.width, true);
    }
    if (canvas && tool === 'brush' && !heldShape && event.type !== 'pointercancel') {
      const settings = studioRef.current;
      const raw = eventPoint(event, canvas);
      raw.p = strokeRef.current.at(-1)?.p ?? raw.p;
      const endpoint = stabilizerRef.current?.(raw, settings.stabilization / 100, event.timeStamp) ?? raw;
      const last = strokeRef.current.at(-1);
      if (!last || endpoint.x !== last.x || endpoint.y !== last.y) {
        strokeRef.current.push(endpoint);
        paintStroke(strokeRef.current, tool);
      }
      if (settings.smoothing > 0) {
        paintStroke(smoothBrushPoints(strokeRef.current, settings.smoothing, canvas.width / Math.max(1, canvas.clientWidth)), tool);
      }
    }
    strokeRef.current = [];
    shapeStrokeRef.current = [];
    lastErasePtRef.current = null;
    smoothTipRef.current = null;
    stabilizerRef.current = null;
    lastDistressStampRef.current = null;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (event.type === 'pointercancel') {
      if (eraseCursorRef.current) eraseCursorRef.current.style.visibility = 'hidden';
      cancelEraser();
      distressStampsRef.current = [];
      return;
    }
    if(tool==='brush'&&finishTap&&!heldShape&&isDrawingFinishTap(finishTap,{x:event.clientX,y:event.clientY,time:event.timeStamp})){
      finishDrawingRef.current?.(finishTap.id);return;
    }
    if (isEraseTool(tool)) {
      const layers = eraseGestureRef.current;
      if (!layers) return;
      if (eraseFlushRef.current !== null) cancelAnimationFrame(eraseFlushRef.current);
      flushEraser();
      void commitEraser(layers);
      return;
    }
    commitStroke();
    distressStampsRef.current = [];
  };

  return (
    <>
    <svg ref={eraseMasksRef} aria-hidden="true" className="pointer-events-none absolute" width="0" height="0"/>
    <canvas
      ref={canvasRef}
      data-print-draw-layer
      className={cn(
        'absolute inset-0 z-[18] h-full w-full touch-none',
        active ? 'pointer-events-auto' : 'pointer-events-none',
        isEraseTool(studio.tool) && active && 'cursor-none',
        studio.tool === 'brush' && active && 'cursor-crosshair',
        studio.tool === 'distress' && active && 'cursor-crosshair',
      )}
      onPointerDown={onPointerDown}
      onContextMenu={event => {
        if (!active || !isEraseTool(studio.tool)) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      aria-hidden={!active}
      style={adjustFilter ? { filter: adjustFilter } : undefined}
    />
    {active && isEraseTool(studio.tool) && <svg
      ref={eraseCursorRef}
      data-eraser-cursor
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 z-[30] overflow-visible"
      style={{visibility:'hidden'}}
      viewBox="-1 -1 2 2"
      preserveAspectRatio="none"
    >
      <circle r="1" fill="none" stroke="#171717"/>
      <circle r="1" fill="none" stroke="#fff"/>
    </svg>}
    </>
  );
}
