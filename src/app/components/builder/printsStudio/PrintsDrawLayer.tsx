import { useCallback, useEffect, useRef } from 'react';
import { cn } from '../../ui/utils';
import type { DesignElement } from '../PrintsDesignStep';
import { DEFAULT_PRINT_METHOD } from '../PrintsDesignStep';
import { usePrintsStudio, type PrintsStudioTool } from './PrintsStudioContext';
import { recognizeShape, type QuickShape } from '../../../lib/quickShape';
import { zoneToAsset } from '../../../lib/designGeometry';
import { canvasPaint } from '../../../lib/studioPaint';
import { createBrushStabilizer, renderBrushStroke, smoothBrushPoints } from '../../../lib/drawingBrush';
import type { GarmentDrawingMask } from './useGarmentDrawingMask';
import { createDistressStamp, type DistressMark, type DistressMarkKind } from '../../../lib/distressScatter';
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
  garmentSide?: 'front' | 'back';
}

interface Pt {
  x: number;
  y: number;
  p: number;
  tilt: number;
  pen?: boolean;
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
}: PrintsDrawLayerProps) {
  const studio = usePrintsStudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<Pt[]>([]);
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
  const eraseBuffersRef = useRef(new Map<string, HTMLCanvasElement>());
  const lastErasePtRef = useRef<Pt | null>(null);
  const eraseFlushRef = useRef<number | null>(null);
  const smoothTipRef = useRef<Pt | null>(null);
  const stabilizerRef = useRef<ReturnType<typeof createBrushStabilizer> | null>(null);
  const lastDistressStampRef = useRef<(Pt & { t: number }) | null>(null);
  const distressStampsRef = useRef<DistressMark[]>([]);
  const distressCursorRef = useRef<Pt | null>(null);
  const eraseQueueRef = useRef<Pt[]>([]);
  const eraseWarmRef = useRef(false);
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
    if (drawingRef.current && isEraseTool(studioRef.current.tool)) return;
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
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
  }, [zone]);

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

  const eventPoint = (e: React.PointerEvent | PointerEvent, canvas: HTMLCanvasElement): Pt => {
    const rect = canvas.getBoundingClientRect();
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
    distressStampsRef.current.push(...createDistressStamp(pt, (studio.eraserSize / 2) * canvasScale, scatterSettings, kind, canvasScale));
    paintStroke(strokeRef.current, 'distress');
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
    const erase = isEraseTool(tool);
    const strokeAlpha = Math.max(0.04, Math.min(1, s.opacity / 100));
    const cssToCanvas = canvas.width / Math.max(1, canvas.clientWidth || 1);

    const sizeFor = (pt: Pt) => {
      const base = erase || tool === 'distress' ? s.eraserSize : s.brushSize;
      let size = base * cssToCanvas;
      if (s.pressure) size *= 0.35 + 0.65 * pt.p;
      if (s.pencil.tiltShading && pt.tilt > 0.15) size *= 1 + pt.tilt * 1.4;
      return Math.max(1.2, size);
    };

    if (erase) {
      const pt = points[points.length - 1];
      const r = (s.eraserSize / 2) * cssToCanvas;
      const ring = Math.max(1, cssToCanvas);
      sctx.beginPath();
      sctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      sctx.strokeStyle = 'rgba(0,0,0,0.85)';
      sctx.lineWidth = ring * 2.25;
      sctx.stroke();
      sctx.beginPath();
      sctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      sctx.strokeStyle = 'rgba(255,255,255,0.95)';
      sctx.lineWidth = ring;
      sctx.stroke();
      sctx.restore();
      ctx.drawImage(strokeLayer, 0, 0);
      return;
    }

    sctx.strokeStyle = canvasPaint(sctx, s.color, strokeLayer.width, strokeLayer.height);
    sctx.fillStyle = sctx.strokeStyle;

    if (tool === 'distress') {
      sctx.globalCompositeOperation = 'source-over';
      renderDistressMarks(sctx, distressStampsRef.current, s.distressType, cssToCanvas);
      clipToGarment(sctx);
      sctx.restore();
      ctx.save();
      ctx.globalAlpha = strokeAlpha;
      ctx.drawImage(strokeLayer, 0, 0);
      ctx.restore();
      return;
    }

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
        const image = host.querySelector<HTMLImageElement>(`[data-print-id="${element.id}"] img`);
        if (!image?.complete || !image.naturalWidth || image.getAttribute('src') !== element.content) return [element];
        const source = canvasFromImage(image);
        if (!removeBrushMask(source, mask, element, canvas.width / Math.max(1, host.clientWidth), canvas.height / Math.max(1, host.clientHeight), studioRef.current.opacity / 100)) return [element];
        changed = true;
        eraseBuffersRef.current.delete(element.id);
        return canvasHasInk(source) ? [{ ...element, content: source.toDataURL('image/png') }] : [];
      });
      if (changed) {
        sessionRef.current = null;
        elementsRef.current = updated;
        fn(updated);
      }
      return;
    }
    const previous = tool === 'distress' ? distressSessionsRef.current.get(sideRef.current) : sessionRef.current;
    const existing = previous && elementsRef.current.find(element => element.id === previous.element.id);
    // Re-read erased/undone pixels, but never overwrite a layer's edited style or locked state.
    const compatibleDistress = tool === 'distress' && existing && previous && !existing.locked && !existing.hidden &&
      (Object.keys({ ...previous.element, ...existing }) as (keyof DesignElement)[]).every(key =>
        ['content', 'x', 'y', 'width', 'height'].includes(key) || existing[key] === previous.element[key]);
    const canAppend = previous && existing && (existing.side ?? 'front') === sideRef.current &&
      (compatibleDistress || (tool === 'brush' && existing === previous.element &&
        previous.canvas.width === canvas.width && previous.canvas.height === canvas.height));
    const merged = document.createElement('canvas');
    merged.width = canvas.width;
    merged.height = canvas.height;
    const mergedContext = merged.getContext('2d');
    if (!mergedContext) return;
    if (canAppend) {
      if (existing === previous.element && previous.canvas.width === canvas.width && previous.canvas.height === canvas.height) {
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
      ? Math.max(0.04, Math.min(1, studioRef.current.opacity / 100))
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
    const next: DesignElement = {
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
  }, [zone]);

  const ensureEraseBuffer = useCallback(
    (el: DesignElement) => {
      const existing = eraseBuffersRef.current.get(el.id);
      if (existing) return existing;
      const img = zone?.querySelector(`[data-print-id="${el.id}"] img`) as HTMLImageElement | null;
      if (!img?.naturalWidth) return null;
      const buf = canvasFromImage(img);
      eraseBuffersRef.current.set(el.id, buf);
      return buf;
    },
    [zone],
  );

  const flushErase = useCallback(() => {
    eraseFlushRef.current = null;
    onChangeRef.current?.(elementsRef.current);
  }, []);

  const rasterizeDistress = useCallback(
    async (el: DesignElement) => {
      const existing = eraseBuffersRef.current.get(el.id);
      if (existing) return existing;
      const fromImg = ensureEraseBuffer(el);
      if (fromImg) return fromImg;
      const root = zone?.querySelector(`[data-print-id="${el.id}"]`) as HTMLElement | null;
      const svg = root?.querySelector<SVGSVGElement>('[data-asset-content] svg[viewBox]');
      if (!svg || !root) return null;
      const w = Math.max(2, Math.round(root.clientWidth * 2) || Math.round(el.width * 2));
      const h = Math.max(2, Math.round(root.clientHeight * 2) || Math.round(el.height * 2));
      const buf = await svgToCanvas(svg, w, h);
      if (!buf) return null;
      eraseBuffersRef.current.set(el.id, buf);
      return buf;
    },
    [ensureEraseBuffer, zone],
  );

  const warmEraseBuffers = useCallback(async () => {
    const side = sideRef.current;
    const tool = studioRef.current.tool;
    let converted = false;
    const next = [...elementsRef.current];
    for (let i = 0; i < next.length; i++) {
      const el = next[i]!;
      if (!isErasable(el, tool) || (el.side ?? 'front') !== side) continue;
      const buf = await rasterizeDistress(el);
      if (!buf) continue;
      if (el.type === 'distress' && !el.content.startsWith('data:')) {
        next[i] = { ...el, content: buf.toDataURL('image/png') };
        converted = true;
      }
    }
    if (converted) {
      elementsRef.current = next;
      onChangeRef.current?.(next);
    }
  }, [rasterizeDistress]);

  const punchEraserNow = useCallback(
    (points: Pt[]) => {
      const canvas = canvasRef.current;
      const host = zone;
      if (!canvas || !host || points.length < 1) return;
      const cssW = Math.max(1, host.clientWidth);
      const dprX = canvas.width / cssW;
      const dprY = canvas.height / Math.max(1, host.clientHeight);
      const radiusCss = studioRef.current.eraserSize / 2;
      const side = sideRef.current;
      const tool = studioRef.current.tool;
      let changed = false;
      const next = elementsRef.current.map((el) => {
        if (!isErasable(el, tool) || (el.side ?? 'front') !== side) return el;
        const hit = points.some((pt) => {
          const local = zoneToAsset({ x: pt.x / dprX, y: pt.y / dprY }, el);
          return local.x >= -radiusCss / el.width && local.x <= 1 + radiusCss / el.width && local.y >= -radiusCss / el.height && local.y <= 1 + radiusCss / el.height;
        });
        if (!hit) return el;
        const buf = eraseBuffersRef.current.get(el.id) ?? ensureEraseBuffer(el);
        if (!buf) return el;
        const octx = buf.getContext('2d');
        if (!octx) return el;
        octx.save();
        octx.globalCompositeOperation = 'destination-out';
        for (const pt of points) {
          const zx = pt.x / dprX;
          const zy = pt.y / dprY;
          octx.beginPath();
          for (let segment = 0; segment <= 32; segment++) {
            const angle = segment * Math.PI / 16;
            const local = zoneToAsset({ x: zx + Math.cos(angle) * radiusCss, y: zy + Math.sin(angle) * radiusCss }, el);
            if (!segment) octx.moveTo(local.x * buf.width, local.y * buf.height);
            else octx.lineTo(local.x * buf.width, local.y * buf.height);
          }
          octx.closePath();
          octx.fill();
        }
        octx.restore();
        const url = buf.toDataURL('image/png');
        const img = host.querySelector(`[data-print-id="${el.id}"] img`) as HTMLImageElement | null;
        if (img) img.src = url;
        changed = true;
        return el.type === 'shape'
          ? { ...el, type: 'drawing' as const, shapeGeometry: undefined, borderWidth: 0, color: undefined, content: url }
          : { ...el, content: url };
      });
      if (!changed) return;
      elementsRef.current = next;
      if (eraseFlushRef.current == null) {
        eraseFlushRef.current = requestAnimationFrame(flushErase);
      }
    },
    [ensureEraseBuffer, flushErase, zone],
  );

  const punchEraser = useCallback(
    (points: Pt[]) => {
      const tool = studioRef.current.tool;
      const needsWarm = elementsRef.current.some(
          (el) =>
            isErasable(el, tool) &&
            (el.type === 'distress' || el.type === 'shape') &&
            (el.side ?? 'front') === sideRef.current &&
            !eraseBuffersRef.current.has(el.id) &&
            !el.content.startsWith('data:'),
        );
      if (!needsWarm) {
        punchEraserNow(points);
        return;
      }
      eraseQueueRef.current.push(...points);
      if (eraseWarmRef.current) return;
      eraseWarmRef.current = true;
      void warmEraseBuffers().then(() => {
        eraseWarmRef.current = false;
        const queued = eraseQueueRef.current;
        eraseQueueRef.current = [];
        if (queued.length) punchEraserNow(queued);
      });
    },
    [punchEraserNow, warmEraseBuffers],
  );

  const finishEraser = useCallback(() => {
    if (eraseFlushRef.current != null) {
      cancelAnimationFrame(eraseFlushRef.current);
      eraseFlushRef.current = null;
    }
    const side = sideRef.current;
    const next = elementsRef.current.filter((el) => {
      if (!isErasable(el, studioRef.current.tool) || (el.side ?? 'front') !== side) return true;
      const buf = eraseBuffersRef.current.get(el.id);
      if (!buf) return true;
      return canvasHasInk(buf);
    });
    for (const id of [...eraseBuffersRef.current.keys()]) {
      if (!next.some((el) => el.id === id)) eraseBuffersRef.current.delete(id);
    }
    elementsRef.current = next;
    onChangeRef.current?.(next);
  }, []);

  const active = editable && studio.drawing;

  useEffect(() => () => {
    if (shapeTimerRef.current) clearTimeout(shapeTimerRef.current);
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    drawingRef.current = false;
    shapeRef.current = null;
    shapeStrokeRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  }, [studio.tool, garmentSide, editable]);

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
      shapeStrokeRef.current = [];
      commitStroke();
      context.clearRect(0, 0, canvas.width, canvas.height);
    }, 550);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active || drawingRef.current || e.button !== 0) return;
    const s = studioRef.current;
    if (s.pencil.pencilOnly && e.pointerType !== 'pen') return;
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
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

    drawingRef.current = true;
    pointerIdRef.current = e.pointerId;
    strokeSeedRef.current = (Math.random() * 0x7fffffff) | 0;
    const pt = eventPoint(e, canvas);
    strokeRef.current = [pt];
    shapeStrokeRef.current = [pt];
    smoothTipRef.current = pt;
    stabilizerRef.current = createBrushStabilizer(pt, e.timeStamp, canvas.width / Math.max(1, canvas.getBoundingClientRect().width));
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
    } else {
      paintStroke(strokeRef.current, tool);
    }
    if (isEraseTool(tool)) {
      lastErasePtRef.current = pt;
      punchEraser([pt]);
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
    const pt = isEraseTool(tool) ? raw : stabilizerRef.current?.(raw, amount, sample.timeStamp) ?? raw;
    smoothTipRef.current = pt;
    if (tool === 'distress') {
      tryStampDistress(pt, 'move');
      return;
    }
    const last = strokeRef.current[strokeRef.current.length - 1];
    const moved = last ? Math.hypot(pt.x - last.x, pt.y - last.y) : 999;
    const scale = canvas.width / Math.max(1, canvas.getBoundingClientRect().width);
    if (!isEraseTool(tool) && amount > 0 && moved < 0.2 * scale) {
      return;
    }
    if (last && moved > 2.2) {
      strokeRef.current.push(...pointsAlong(last, pt, 2));
    } else {
      strokeRef.current.push(pt);
    }
    if (isEraseTool(tool)) {
      const prev = lastErasePtRef.current;
      const spacing = (studioRef.current.eraserSize / 2) * (canvas.width / Math.max(1, canvas.clientWidth));
      punchEraser(prev ? pointsAlong(prev, pt, Math.max(2, spacing * 0.45)) : [pt]);
      lastErasePtRef.current = pt;
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (drawingRef.current && pointerIdRef.current !== e.pointerId) return;
    const tool = studioRef.current.tool;
    if (!drawingRef.current) {
      if (isEraseTool(tool)) paintStroke([eventPoint(e, canvas)], tool);
      else if (tool === 'distress' && garmentMask) {
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
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const endStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || pointerIdRef.current !== event.pointerId) return;
    drawingRef.current = false;
    pointerIdRef.current = null;
    if (shapeTimerRef.current) clearTimeout(shapeTimerRef.current);
    const heldShape = shapeRef.current;
    shapeRef.current = null;
    holdPointRef.current = null;
    if (holdTimerRef.current) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const tool = studioRef.current.tool;
    const canvas = canvasRef.current;
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
      distressStampsRef.current = [];
      return;
    }
    if (isEraseTool(tool)) {
      finishEraser();
      return;
    }
    commitStroke();
    distressStampsRef.current = [];
  };

  return (
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
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onPointerUp={endStroke}
      onPointerCancel={endStroke}
      aria-hidden={!active}
      style={adjustFilter ? { filter: adjustFilter } : undefined}
    />
  );
}
