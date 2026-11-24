import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toCanvas } from 'html-to-image';
import type { DesignElement } from '../PrintStudioEditor';
import { drawingMaskCss, type GarmentDrawingMask } from './useGarmentDrawingMask';
import { DesignGroupArtwork } from './DesignGroupArtwork';
import { waitForDrawingReplay } from './DrawingArtwork';
import { maskEdges, maskOutline, rememberWrapOutline, rotatedExtent, wrapSlices, type MaskOutline } from '../../../lib/artworkWrap';

const CAPTURE_RATIO = 2;
const alphaByMask = new WeakMap<HTMLCanvasElement, Uint8ClampedArray>();
function maskAlpha(canvas: HTMLCanvasElement) {
  let alpha = alphaByMask.get(canvas);
  if (!alpha) { alpha = canvas.getContext('2d', { willReadFrequently: true })?.getImageData(0, 0, canvas.width, canvas.height).data; if (alpha) alphaByMask.set(canvas, alpha); }
  return alpha;
}

function crossesEdge(element: DesignElement, alpha: Uint8ClampedArray, mask: GarmentDrawingMask) {
  const sx = mask.canvas.width / mask.width, sy = mask.canvas.height / mask.height, extent = rotatedExtent(element);
  return [extent.top, element.y, extent.bottom].some(y => {
    const edges = maskEdges(alpha, mask.canvas.width, mask.canvas.height, element.x * sx, y * sy);
    return !edges || extent.right > edges.right / sx || extent.left < edges.left / sx || extent.top < edges.top / sy;
  });
}

type Composed = { canvas: HTMLCanvasElement; box: { x: number; y: number; width: number; height: number }; overShoulder: boolean };
/** Draws only the part cut off at the garment edge, continuing row by row from the opposite edge. */
function composeWrap(art: HTMLCanvasElement, outline: MaskOutline, mask: GarmentDrawingMask): Composed | null {
  const output = document.createElement('canvas'); output.width = art.width; output.height = art.height;
  const ctx = output.getContext('2d', { willReadFrequently: true })!, slices = wrapSlices(outline, art.width, art.height);
  ctx.imageSmoothingEnabled = false;
  for (const row of slices.rows) ctx.drawImage(art, row.sx, row.y, row.width, 1, row.dx, row.y, row.width, 1);
  const beforeShoulder = ctx.getImageData(0, 0, output.width, output.height).data;
  let sidePixels = 0; for (let i = 3; i < beforeShoulder.length; i += 4) if (beforeShoulder[i] > 8) sidePixels++;
  for (const column of slices.columns) { ctx.save(); ctx.translate(column.dx, column.flipAt); ctx.scale(1, -1); ctx.drawImage(art, column.x, 0, 1, column.height, 0, 0, 1, column.height); ctx.restore(); }
  const data = ctx.getImageData(0, 0, output.width, output.height).data;
  let minX = output.width, minY = output.height, maxX = -1, maxY = -1, total = 0;
  for (let y = 0; y < output.height; y++) for (let x = 0; x < output.width; x++) if (data[(y * output.width + x) * 4 + 3] > 8) { total++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  if (maxX < 0) return null;
  const ratioX = mask.width / output.width, ratioY = mask.height / output.height;
  return { canvas: output, overShoulder: total - sidePixels > sidePixels, box: { x: minX * ratioX, y: minY * ratioY, width: (maxX - minX + 1) * ratioX, height: (maxY - minY + 1) * ratioY } };
}

function WrapPiece({ element, side, mask, outline, onOpen, onMove }: { element: DesignElement; side: 'front' | 'back'; mask: GarmentDrawingMask; outline: MaskOutline; onOpen?: (id: string, side: 'front' | 'back') => void; onMove?: (id: string, dx: number, dy: number) => void }) {
  const source = useRef<HTMLDivElement>(null), visual = useRef<HTMLCanvasElement>(null), hitBox = useRef<HTMLDivElement>(null);
  const [composed, setComposed] = useState<Composed | null>(null), [capturing, setCapturing] = useState(true), [selected, setSelected] = useState(false), [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const artKey = useMemo(() => JSON.stringify(element), [element]);
  const group = useMemo(() => ({ id: `artwork-wrap-${element.id}`, type: 'group', content: 'artwork-wrap', x: mask.width / 2, y: mask.height / 2, width: mask.width, height: mask.height, rotation: 0, opacity: 100, side, groupSourceWidth: mask.width, groupSourceHeight: mask.height, children: [{ ...element, side, locked: true }] }) as DesignElement, [artKey, mask.width, mask.height, side]);

  useEffect(() => { setCapturing(true); }, [group, outline]);
  useEffect(() => {
    if (!capturing || !source.current) return;
    let cancelled = false;
    const run = async () => {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (cancelled || !source.current) return;
      await waitForDrawingReplay(source.current).catch(() => undefined);
      const art = await toCanvas(source.current, { pixelRatio: CAPTURE_RATIO, width: mask.width, height: mask.height, skipFonts: element.type !== 'text' && element.type !== 'group', preferredFontFormat: 'woff2', style: { opacity: '1' } });
      if (cancelled) return;
      setComposed(composeWrap(art, outline, mask)); setDrag(null); setCapturing(false);
    };
    void run().catch(error => { if (!cancelled) { console.warn('Could not draw the wrapped artwork.', error); setCapturing(false); } });
    return () => { cancelled = true; };
  }, [capturing, outline, mask, element.type]);
  useEffect(() => {
    const target = visual.current;
    if (!target || !composed) return;
    target.width = composed.canvas.width; target.height = composed.canvas.height;
    target.getContext('2d')?.drawImage(composed.canvas, 0, 0);
  }, [composed]);
  useEffect(() => {
    if (!selected) return;
    const away = (event: PointerEvent) => { if (event.target !== hitBox.current) setSelected(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(false); };
    document.addEventListener('pointerdown', away, true); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', away, true); document.removeEventListener('keydown', key); };
  }, [selected]);

  const onArt = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!composed) return false;
    const layer = event.currentTarget.parentElement!.getBoundingClientRect(), x = Math.floor((event.clientX - layer.left) / layer.width * composed.canvas.width), y = Math.floor((event.clientY - layer.top) / layer.height * composed.canvas.height);
    return (composed.canvas.getContext('2d', { willReadFrequently: true })!.getImageData(x, y, 1, 1).data[3] ?? 0) > 8;
  };
  const begin = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (!selected && !onArt(event))) return;
    event.preventDefault(); event.stopPropagation();
    setSelected(true);
    if (!onMove) return;
    const layer = event.currentTarget.parentElement!.getBoundingClientRect(), scaleX = layer.width / mask.width, scaleY = layer.height / mask.height, startX = event.clientX, startY = event.clientY, button = event.currentTarget;
    button.setPointerCapture(event.pointerId);
    let last = { x: 0, y: 0 };
    const move = (next: PointerEvent) => { last = { x: (next.clientX - startX) / scaleX, y: (next.clientY - startY) / scaleY }; setDrag(last); };
    const end = () => {
      button.removeEventListener('pointermove', move); button.removeEventListener('pointerup', end); button.removeEventListener('pointercancel', end);
      if (Math.hypot(last.x, last.y) < 1) { setDrag(null); return; }
      const sign = composed?.overShoulder ? -1 : 1;
      onMove(element.id, last.x * sign, last.y * sign);
    };
    button.addEventListener('pointermove', move); button.addEventListener('pointerup', end); button.addEventListener('pointercancel', end);
  };

  const shift = drag ? `translate(${drag.x}px, ${drag.y}px)` : undefined, box = composed?.box;
  return <>
    {capturing && <div ref={source} data-editor-chrome aria-hidden="true" className="pointer-events-none absolute left-0 top-0" style={{ width: mask.width, height: mask.height, opacity: 0 }}><DesignGroupArtwork element={group} /></div>}
    {composed && <div data-editor-chrome data-wrapped-artwork aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ zIndex: 240, maskImage: drawingMaskCss(mask, mask.width, mask.height, mask.width / 2, mask.height / 2, 0), maskSize: '100% 100%', maskRepeat: 'no-repeat' }}><canvas ref={visual} className="absolute inset-0 h-full w-full" style={{ transform: shift, opacity: (element.opacity ?? 100) / 100, mixBlendMode: element.artworkBlendMode }} /></div>}
    {box && onOpen && <div data-editor-chrome data-wrapped-hits className="pointer-events-none absolute inset-0" style={{ zIndex: selected ? 241 : 1 }}><div ref={hitBox} role="button" tabIndex={0} data-wrap-hit aria-label="Select wrapped artwork" className="absolute cursor-move" style={{ pointerEvents: 'auto', touchAction: 'none', left: box.x, top: box.y, width: box.width, height: box.height, transform: shift, boxShadow: selected ? '0 0 0 1px #2F6FED' : undefined }} onPointerDown={begin} onDoubleClick={() => { setSelected(false); onOpen(element.id, side === 'front' ? 'back' : 'front'); }} /></div>}
  </>;
}

/** Shows the part of the art cut off at the other side's edge. It stays linked to the original. */
export function ArtworkWrapLayer({ elements, side, mask, onSelect, onMove }: { elements: DesignElement[]; side: 'front' | 'back'; mask: GarmentDrawingMask; onSelect?: (id: string, side: 'front' | 'back') => void; onMove?: (id: string, dx: number, dy: number) => void }) {
  const outline = useMemo(() => { const alpha = maskAlpha(mask.canvas); return alpha && mask.width && mask.height ? maskOutline(alpha, mask.canvas.width, mask.canvas.height) : null; }, [mask]);
  const pieces = useMemo(() => {
    const alpha = maskAlpha(mask.canvas);
    if (!alpha || !outline) return [];
    return elements.filter(element => (element.side ?? 'front') !== side && !element.hidden && !element.wrapOff && !element.referenceHidden && !element.customAreaOpen && !element.sketchOnly && !element.tracingReference && !element.patternTarget && element.type !== 'distress' && element.type !== 'customArea' && crossesEdge(element, alpha, mask));
  }, [elements, side, mask, outline]);
  useEffect(() => { if (outline) rememberWrapOutline(location.pathname, side, { outline, width: mask.width, height: mask.height }); }, [outline, side, mask.width, mask.height]);
  if (!outline) return null;
  return <>{pieces.map(element => <WrapPiece key={element.id} element={element} side={side} mask={mask} outline={outline} onOpen={onSelect} onMove={onMove} />)}</>;
}
