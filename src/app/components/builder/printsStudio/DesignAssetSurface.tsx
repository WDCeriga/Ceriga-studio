import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { toCanvas } from 'html-to-image';
import { waitForImageFilters } from '../../../lib/imageFilterRendering';
import { artworkEffectPadding } from '../../../lib/textEffectRendering';
import { alphaBounds, boundsQuad, quadMap, validQuad, UNIT_QUAD, type Bounds, type Quad } from '../../../lib/designGeometry';
import type { DesignElement } from '../PrintsDesignStep';
import { drawingMaskCss, type GarmentDrawingMask } from './useGarmentDrawingMask';
import { sourceSignature, WarpedArtwork } from './WarpedArtwork';
import type { WarpSettings } from '../../../lib/warpGeometry';
import { buildArtworkClipPath } from '../../../lib/artworkCrop';
import { alphaContains, registerArtworkHitTest } from '../../../lib/artworkHitTesting';

export function DesignAssetSurface({ element, selected, distort = false, scale, onChange, children, overlay, garmentMask, position, warpEditing = false, onWarpChange, cropping = false, cropOverlay }: {
  element: DesignElement; selected: boolean; distort?: boolean; scale: number; onChange: (patch: Partial<DesignElement>) => void; children: ReactNode; overlay: ReactNode;
  garmentMask?: GarmentDrawingMask | null;
  position?: { x: number; y: number };
  warpEditing?: boolean;
  onWarpChange?: (warp: WarpSettings) => void;
  cropping?: boolean;
  cropOverlay?: ReactNode;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const hitImage = useRef<{ image: ImageData; width: number; height: number; padding: number } | null>(null);
  const captureVersion = useRef(0);
  const [warpRevision, setWarpRevision] = useState(0);
  const [height, setHeight] = useState(element.height);
  const [bounds, setBounds] = useState<Bounds>({ x: 0, y: 0, width: 1, height: 1 });
  const [live, setLive] = useState<Quad | null>(null);
  const cancelDrag = useRef<(() => void) | null>(null);
  const width = Math.max(1, element.width);
  const actualHeight = Math.max(1, height);
  const renderSignature = sourceSignature(element);
  const map = quadMap(live ?? element.perspective);
  const corners = boundsQuad(bounds).map(map.project);
  const selectionLeft = Math.min(...corners.map(point => point.x)) * width;
  const selectionTop = Math.min(...corners.map(point => point.y)) * actualHeight;
  const selectionWidth = Math.max(...corners.map(point => point.x)) * width - selectionLeft;
  const selectionHeight = Math.max(...corners.map(point => point.y)) * actualHeight - selectionTop;

  useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const measure = () => setHeight(node.offsetHeight || element.height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [element.height]);

  useLayoutEffect(() => {
    captureVersion.current++;
    hitImage.current = null;
  }, [renderSignature, element.content, element.customAreaImage, element.customAreaPoints, element.shapeGeometry, element.warp, width, actualHeight, warpRevision, cropping]);

  useLayoutEffect(() => {
    const root = surface.current?.parentElement;
    if (!root?.matches('[data-print-id]')) return;
    return registerArtworkHitTest(root, client => {
      const raster = hitImage.current;
      if (!raster || ((element.type === 'drawing' || element.patternTarget) && garmentMask === null)) return false;
      const rect = root.getBoundingClientRect();
      const angle = element.rotation * Math.PI / 180;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const w = root.offsetWidth, h = root.offsetHeight;
      const pixelScale = rect.width / (Math.abs(cos) * w + Math.abs(sin) * h);
      if (!pixelScale || !w || !h) return false;
      const dx = (client.x - (rect.left + rect.width / 2)) / pixelScale;
      const dy = (client.y - (rect.top + rect.height / 2)) / pixelScale;
      const local = quadMap(live ?? element.perspective).inverse({ x: (dx * cos + dy * sin) / w + 0.5, y: (-dx * sin + dy * cos) / h + 0.5 });
      if (garmentMask && (element.type === 'drawing' || element.patternTarget)) {
        const zone = root.closest<HTMLElement>('[data-print-design-zone]');
        if (zone) {
          const zr = zone.getBoundingClientRect();
          const x = Math.floor((client.x - zr.left) / zr.width * garmentMask.canvas.width);
          const y = Math.floor((client.y - zr.top) / zr.height * garmentMask.canvas.height);
          if (x < 0 || y < 0 || x >= garmentMask.canvas.width || y >= garmentMask.canvas.height ||
            !garmentMask.canvas.getContext('2d')?.getImageData(x, y, 1, 1).data[3]) return false;
        }
      }
      return alphaContains(raster.image, (local.x * raster.width + raster.padding) / (raster.width + raster.padding * 2), (local.y * raster.height + raster.padding) / (raster.height + raster.padding * 2));
    });
  }, [element.rotation, element.perspective, element.type, element.patternTarget, garmentMask, live]);

  useEffect(() => {
    const node = content.current;
    if (!node) return;
    let cancelled = false;
    const version = captureVersion.current;
    const current = () => !cancelled && version === captureVersion.current;
    const timer = setTimeout(async () => {
      try {
        await document.fonts.ready;
        await waitForImageFilters(node);
        if (!current()) return;
        const padding = artworkEffectPadding(element);
        const captureWidth = width + padding * 2;
        const captureHeight = actualHeight + padding * 2;
        const canvas = await toCanvas(node, { pixelRatio: 2, width: captureWidth, height: captureHeight, style: { width: `${width}px`, height: `${actualHeight}px`, transform: `translate(${padding}px, ${padding}px)`, opacity: '1' }, filter: child => !(child instanceof Element) || !child.matches('[data-editor-chrome]') });
        const context = canvas.getContext('2d');
        const image = context?.getImageData(0, 0, canvas.width, canvas.height);
        const measured = image && alphaBounds(image);
        if (current()) {
          hitImage.current = image ? { image, width, height: actualHeight, padding } : null;
          setBounds(measured ? { x: (measured.x * captureWidth - padding) / width, y: (measured.y * captureHeight - padding) / actualHeight, width: measured.width * captureWidth / width, height: measured.height * captureHeight / actualHeight } : { x: 0, y: 0, width: 0, height: 0 });
        }
      } catch {
        if (current()) setBounds({ x: 0, y: 0, width: 1, height: 1 });
      }
    }, 80);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [renderSignature, element.content, element.customAreaImage, element.customAreaPoints, element.shapeGeometry, element.warp, width, actualHeight, warpRevision, cropping]);

  useEffect(() => {
    const node = content.current;
    if (!node) return;
    const onWarpBounds = (event: Event) => {
      const bounds = (event as CustomEvent<Bounds>).detail;
      if (!(event.target instanceof Element) || event.target.closest('[data-asset-content]') !== node) return;
      if (bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) {
        setBounds(bounds);
        setWarpRevision(revision => revision + 1);
      }
    };
    node.addEventListener('warp-bounds', onWarpBounds);
    return () => node.removeEventListener('warp-bounds', onWarpBounds);
  }, []);

  useEffect(() => { if (!selected || !distort) cancelDrag.current?.(); }, [selected, distort]);
  useEffect(() => () => cancelDrag.current?.(), []);

  const startCorner = (event: PointerEvent<HTMLButtonElement>, index: number) => {
    event.stopPropagation(); event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const angle = element.rotation * Math.PI / 180;
    let next = element.perspective ?? UNIT_QUAD;
    const move = (pointer: globalThis.PointerEvent) => {
      const deltaX = (pointer.clientX - startX) / scale;
      const deltaY = (pointer.clientY - startY) / scale;
      const target = corners.map((point, corner) => corner === index ? {
        x: point.x + (deltaX * Math.cos(angle) + deltaY * Math.sin(angle)) / width,
        y: point.y + (-deltaX * Math.sin(angle) + deltaY * Math.cos(angle)) / actualHeight,
      } : point);
      if (!validQuad(target)) return;
      const projection = quadMap(target);
      const full = UNIT_QUAD.map(point => projection.project({ x: (point.x - bounds.x) / bounds.width, y: (point.y - bounds.y) / bounds.height }));
      if (!validQuad(full)) return;
      next = full;
      setLive(full);
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', commit);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key, true);
      setLive(null); cancelDrag.current = null;
    };
    const commit = () => { cleanup(); onChange({ perspective: next }); };
    const cancel = () => cleanup();
    const key = (keyboard: KeyboardEvent) => { if (keyboard.key === 'Escape') { keyboard.preventDefault(); keyboard.stopImmediatePropagation(); cancel(); } };
    cancelDrag.current = cancel;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', commit, { once: true });
    window.addEventListener('pointercancel', cancel, { once: true });
    window.addEventListener('keydown', key, true);
  };

  return <>
    <div ref={surface} data-pattern-clip={element.patternTarget} data-drawing-clip={element.type === 'drawing' && garmentMask !== undefined ? '' : undefined} className="relative w-full" style={{ height: element.type === 'text' ? undefined : '100%', ...((element.type === 'drawing' || element.patternTarget) && garmentMask !== undefined ? {
      visibility: garmentMask ? undefined : 'hidden',
      maskImage: garmentMask ? drawingMaskCss(garmentMask, width, actualHeight, position?.x ?? element.x, position?.y ?? element.y, element.rotation) : undefined,
      maskSize: '100% 100%', maskRepeat: 'no-repeat',
    } : {}) }}>
    <div data-asset-projection className="relative w-full" style={{ height: element.type === 'text' ? undefined : '100%', transformOrigin: '0 0', transform: map.css(width, actualHeight) }}>
      <div ref={content} data-asset-content className="relative w-full" style={{ height: element.type === 'text' ? undefined : '100%', clipPath: buildArtworkClipPath(element, { ignoreCrop: cropping }) }}>
        {element.warp ? <WarpedArtwork element={element} warp={element.warp} editing={warpEditing} onCommit={onWarpChange ?? (() => {})}>{children}</WarpedArtwork> : children}
      </div>
    </div>
    </div>
    {cropping ? <div data-editor-chrome className="pointer-events-auto absolute inset-0" style={{ height: actualHeight, transformOrigin: '0 0', transform: map.css(width, actualHeight) }}>{cropOverlay}</div> : null}
    <div data-visible-bounds className="pointer-events-none absolute" style={{ left: selectionLeft, top: selectionTop, width: selectionWidth, height: selectionHeight }}>
      {selected && !distort && !warpEditing ? overlay : null}
    </div>
    {selected && distort && !warpEditing && <div data-handles data-editor-chrome className="pointer-events-none absolute inset-0 z-50">
      <>
        <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible">
          <polygon data-distort-outline points={corners.map(point => `${point.x * width},${point.y * actualHeight}`).join(' ')}
            fill="none" stroke="#ef4444" strokeWidth={1 / scale} strokeLinejoin="round" />
        </svg>
        {corners.map((point, index) => <button key={index} type="button" aria-label={`Distort corner ${index + 1}`} title={`Distort corner ${index + 1}`} onPointerDown={event => startCorner(event, index)} className="pointer-events-auto absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 touch-none rounded-sm border-2 border-red-500 bg-white" style={{ left: point.x * width, top: point.y * actualHeight, scale: 1 / scale }} />)}
      </>
    </div>}
  </>;
}