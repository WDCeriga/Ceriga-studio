import { useCallback, useEffect, useRef } from 'react';
import { cn } from '../../ui/utils';
import type { DesignElement } from '../PrintsDesignStep';
import { DEFAULT_PRINT_METHOD } from '../PrintsDesignStep';
import { usePrintsStudio, type PrintsStudioTool } from './PrintsStudioContext';

interface PrintsDrawLayerProps {
  zone: HTMLDivElement | null;
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
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  if (Number.isNaN(n)) return '255,255,255';
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function makeGrain(intensity: number) {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(size, size);
  const amp = Math.max(0, Math.min(1, intensity / 100));
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 255 - Math.round(Math.random() * 160 * amp);
    img.data[i] = n;
    img.data[i + 1] = n;
    img.data[i + 2] = n;
    img.data[i + 3] = Math.round(90 * amp);
  }
  ctx.putImageData(img, 0, 0);
  return ctx.createPattern(c, 'repeat');
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
  if (tool === 'distressEraser') return el.type === 'distress';
  return isPaintElement(el);
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

/** Streamer + catch-up: kills shake inside a lag radius, then follows the intended path. */
function stabilizeInput(raw: Pt, tip: Pt, amount: number, pxScale: number): Pt {
  const a = Math.max(0, Math.min(1, amount));
  if (a < 0.005) return raw;
  const lag = a * a * 80 * pxScale;
  const follow = Math.pow(1 - a, 1.75);
  const dx = raw.x - tip.x;
  const dy = raw.y - tip.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.05) {
    return {
      x: tip.x,
      y: tip.y,
      p: tip.p + (raw.p - tip.p) * Math.max(0.2, follow),
      tilt: raw.tilt,
    };
  }
  const move = dist > lag ? (dist - lag) / dist : follow;
  return {
    x: tip.x + dx * move,
    y: tip.y + dy * move,
    p: tip.p + (raw.p - tip.p) * Math.max(0.22, move),
    tilt: raw.tilt,
  };
}

export function PrintsDrawLayer({
  zone,
  elements,
  onChange,
  editable,
  adjustFilter,
  garmentSide = 'front',
}: PrintsDrawLayerProps) {
  const studio = usePrintsStudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeRef = useRef<Pt[]>([]);
  const drawingRef = useRef(false);
  const strokeLayerRef = useRef<HTMLCanvasElement | null>(null);
  const lastPenTapRef = useRef(0);
  const holdTimerRef = useRef<number | null>(null);
  const studioRef = useRef(studio);
  const elementsRef = useRef(elements);
  const onChangeRef = useRef(onChange);
  const sideRef = useRef(garmentSide);
  const eraseBuffersRef = useRef(new Map<string, HTMLCanvasElement>());
  const lastErasePtRef = useRef<Pt | null>(null);
  const eraseFlushRef = useRef<number | null>(null);
  const smoothTipRef = useRef<Pt | null>(null);
  const lastDistressStampRef = useRef<(Pt & { t: number }) | null>(null);
  const eraseQueueRef = useRef<Pt[]>([]);
  const eraseWarmRef = useRef(false);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && !drawingRef.current) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [studio.drawing, studio.tool]);

  const eventPoint = (e: React.PointerEvent, canvas: HTMLCanvasElement): Pt => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const tilt = Math.min(1, Math.hypot(e.tiltX ?? 0, e.tiltY ?? 0) / 60);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      p: e.pointerType === 'mouse' ? 0.85 : Math.max(0.08, e.pressure || 0.45),
      tilt,
    };
  };

  const DISTRESS_HOLD_MS = 520;

  const distressMinDist = (canvas: HTMLCanvasElement) => {
    const scale = canvas.width / Math.max(1, canvas.clientWidth);
    return Math.max(16, studioRef.current.eraserSize * 1.2) * scale;
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
    if (source === 'down') strokeRef.current = [pt];
    else strokeRef.current.push(pt);
    lastDistressStampRef.current = { ...pt, t: now };
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
    const sctx = strokeLayer.getContext('2d');
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

    sctx.strokeStyle = `rgba(${hexToRgb(s.color)},1)`;
    sctx.fillStyle = sctx.strokeStyle;

    if (tool === 'distress') {
      const kind = s.distressType;
      sctx.globalCompositeOperation = 'source-over';
      for (const pt of points) {
        const r = sizeFor(pt);
        if (kind === 'rips') {
          sctx.strokeStyle = 'rgba(12,12,12,0.92)';
          sctx.fillStyle = 'rgba(18,18,18,0.88)';
          sctx.lineWidth = Math.max(1.6, r * 0.22);
          sctx.beginPath();
          sctx.moveTo(pt.x - r, pt.y - r * 0.15);
          sctx.lineTo(pt.x - r * 0.2, pt.y + r * 0.35);
          sctx.lineTo(pt.x + r * 0.15, pt.y - r * 0.4);
          sctx.lineTo(pt.x + r, pt.y + r * 0.2);
          sctx.stroke();
          sctx.beginPath();
          sctx.ellipse(pt.x, pt.y, r * 0.22, r * 0.55, -0.4, 0, Math.PI * 2);
          sctx.fill();
        } else if (kind === 'abrasion') {
          sctx.fillStyle = 'rgba(255,255,255,0.72)';
          const dots = 7 + Math.round(r / 5);
          for (let i = 0; i < dots; i++) {
            const dr = r * (0.06 + Math.random() * 0.18);
            sctx.beginPath();
            sctx.arc(
              pt.x + (Math.random() - 0.5) * r * 1.8,
              pt.y + (Math.random() - 0.5) * r * 1.8,
              dr,
              0,
              Math.PI * 2,
            );
            sctx.fill();
          }
        } else {
          sctx.fillStyle = 'rgba(10,10,10,0.92)';
          const hr = r * (0.4 + Math.random() * 0.45);
          sctx.beginPath();
          sctx.ellipse(
            pt.x + (Math.random() - 0.5) * r * 0.25,
            pt.y + (Math.random() - 0.5) * r * 0.25,
            hr,
            hr * 0.7,
            Math.random() * 0.6,
            0,
            Math.PI * 2,
          );
          sctx.fill();
        }
      }
      sctx.restore();
      ctx.save();
      ctx.globalAlpha = strokeAlpha;
      ctx.drawImage(strokeLayer, 0, 0);
      ctx.restore();
      return;
    }

    if (points.length === 1) {
      const pt = points[0];
      sctx.beginPath();
      sctx.arc(pt.x, pt.y, sizeFor(pt) / 2, 0, Math.PI * 2);
      sctx.fill();
    } else {
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const pt = points[i];
        sctx.beginPath();
        sctx.lineWidth = sizeFor(pt);
        sctx.moveTo(prev.x, prev.y);
        sctx.lineTo(pt.x, pt.y);
        sctx.stroke();
      }
    }

    if (!erase && s.grain > 4) {
      const pattern = makeGrain(s.grain);
      if (pattern) {
        sctx.globalCompositeOperation = 'source-atop';
        sctx.globalAlpha = Math.min(0.42, s.grain / 240);
        sctx.fillStyle = pattern;
        sctx.fillRect(0, 0, strokeLayer.width, strokeLayer.height);
      }
    }
    sctx.restore();

    ctx.save();
    ctx.globalAlpha = strokeAlpha;
    ctx.drawImage(strokeLayer, 0, 0);
    ctx.restore();
  };

  const commitStroke = useCallback(() => {
    const canvas = canvasRef.current;
    const strokeLayer = strokeLayerRef.current;
    const host = zone;
    const fn = onChangeRef.current;
    if (!canvas || !strokeLayer || !host || !fn) return;
    const box = alphaBounds(strokeLayer);
    if (!box || box.w < 2 || box.h < 2) return;
    const cropped = cropCanvas(strokeLayer, box);
    const dataUrl = cropped.toDataURL('image/png');
    const cssW = Math.max(1, host.clientWidth);
    const cssH = Math.max(1, host.clientHeight);
    const scaleX = canvas.width / cssW;
    const scaleY = canvas.height / cssH;
    const tool = studioRef.current.tool;
    const next: DesignElement = {
      id: `${Date.now()}-${Math.round(Math.random() * 1e4)}`,
      type: tool === 'distress' ? 'distress' : 'drawing',
      content: dataUrl,
      x: (box.x + box.w / 2) / scaleX,
      y: (box.y + box.h / 2) / scaleY,
      width: box.w / scaleX,
      height: box.h / scaleY,
      rotation: 0,
      opacity: studioRef.current.opacity,
      locked: false,
      printMethod: tool === 'distress' ? undefined : DEFAULT_PRINT_METHOD,
      side: sideRef.current,
      aspectLocked: false,
    };
    fn([...elementsRef.current, next]);
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
      const svg = root?.querySelector('svg');
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
        const pad = radiusCss + 2;
        const hit = points.some((pt) => {
          const zx = pt.x / dprX;
          const zy = pt.y / dprY;
          return (
            zx >= el.x - el.width / 2 - pad &&
            zx <= el.x + el.width / 2 + pad &&
            zy >= el.y - el.height / 2 - pad &&
            zy <= el.y + el.height / 2 + pad
          );
        });
        if (!hit) return el;
        const buf = eraseBuffersRef.current.get(el.id) ?? ensureEraseBuffer(el);
        if (!buf) return el;
        const octx = buf.getContext('2d');
        if (!octx) return el;
        octx.save();
        octx.globalCompositeOperation = 'destination-out';
        const left = el.x - el.width / 2;
        const top = el.y - el.height / 2;
        for (const pt of points) {
          const zx = pt.x / dprX;
          const zy = pt.y / dprY;
          const lx = ((zx - left) / Math.max(1, el.width)) * buf.width;
          const ly = ((zy - top) / Math.max(1, el.height)) * buf.height;
          const r = (radiusCss / Math.max(1, el.width)) * buf.width;
          octx.beginPath();
          octx.arc(lx, ly, Math.max(1.2, r), 0, Math.PI * 2);
          octx.fill();
        }
        octx.restore();
        const url = buf.toDataURL('image/png');
        const img = host.querySelector(`[data-print-id="${el.id}"] img`) as HTMLImageElement | null;
        if (img) img.src = url;
        changed = true;
        return { ...el, content: url };
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
            el.type === 'distress' &&
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

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    const s = studioRef.current;
    if (s.pencil.pencilOnly && e.pointerType !== 'pen') return;
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;

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
    const pt = eventPoint(e, canvas);
    strokeRef.current = [pt];
    smoothTipRef.current = pt;
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

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const tool = studioRef.current.tool;
    const raw = eventPoint(e, canvas);
    if (!drawingRef.current) {
      if (isEraseTool(tool)) paintStroke([raw], tool);
      return;
    }
    const amount = studioRef.current.stabilization / 100;
    const pxScale = canvas.width / Math.max(1, canvas.clientWidth);
    const tip = smoothTipRef.current ?? raw;
    const pt = isEraseTool(tool) ? raw : stabilizeInput(raw, tip, amount, pxScale);
    smoothTipRef.current = pt;
    if (tool === 'distress') {
      tryStampDistress(pt, 'move');
      return;
    }
    const last = strokeRef.current[strokeRef.current.length - 1];
    const moved = last ? Math.hypot(pt.x - last.x, pt.y - last.y) : 999;
    if (!isEraseTool(tool) && amount >= 0.005 && moved < 0.45) {
      return;
    }
    if (last && moved > 2.2) {
      strokeRef.current.push(...pointsAlong(last, pt, 2));
    } else {
      strokeRef.current.push(pt);
    }
    paintStroke(strokeRef.current, tool);
    if (isEraseTool(tool)) {
      const prev = lastErasePtRef.current;
      const spacing = (studioRef.current.eraserSize / 2) * (canvas.width / Math.max(1, canvas.clientWidth));
      punchEraser(prev ? pointsAlong(prev, pt, Math.max(2, spacing * 0.45)) : [pt]);
      lastErasePtRef.current = pt;
    }
  };

  const onPointerLeave = () => {
    if (drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const endStroke = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (holdTimerRef.current) {
      window.clearInterval(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const tool = studioRef.current.tool;
    strokeRef.current = [];
    lastErasePtRef.current = null;
    smoothTipRef.current = null;
    lastDistressStampRef.current = null;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isEraseTool(tool)) {
      finishEraser();
      return;
    }
    commitStroke();
  };

  return (
    <canvas
      ref={canvasRef}
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
