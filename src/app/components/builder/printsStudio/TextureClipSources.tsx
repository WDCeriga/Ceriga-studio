import { useEffect, useMemo, useRef, useState } from 'react';
import { toCanvas } from 'html-to-image';
import type { DesignElement } from '../PrintStudioEditor';
import { DesignGroupArtwork } from './DesignGroupArtwork';
import { waitForDrawingReplay } from './DrawingArtwork';

const RATIO = 2;
const placedArt = (item: DesignElement) => !item.hidden && !item.referenceHidden && !item.customAreaOpen && !item.sketchOnly && !item.tracingReference && item.type !== 'distress' && item.type !== 'customArea';

/** Reads the art under a texture and returns its shape, so the texture only marks that art. */
function ClipSource({ element, below, width, height, onMask }: { element: DesignElement; below: DesignElement[]; width: number; height: number; onMask: (id: string, url: string | null) => void }) {
  const host = useRef<HTMLDivElement>(null), belowKey = useMemo(() => JSON.stringify(below), [below]), [capture, setCapture] = useState(0);
  const group = useMemo(() => ({ id: `texture-clip-${element.id}`, type: 'group', content: 'texture-clip', x: width / 2, y: height / 2, width, height, rotation: 0, opacity: 100, side: element.side, groupSourceWidth: width, groupSourceHeight: height, children: below.map(item => ({ ...item, locked: true, opacity: 100, artworkBlendMode: undefined })) }) as DesignElement, [belowKey, element.id, element.side, width, height]);
  useEffect(() => { const timer = window.setTimeout(() => setCapture(value => value + 1), 140); return () => window.clearTimeout(timer); }, [group, element.x, element.y, element.width, element.height, element.rotation]);
  useEffect(() => {
    if (!capture || !host.current) return;
    let cancelled = false;
    void (async () => {
      await waitForDrawingReplay(host.current!).catch(() => undefined);
      const art = await toCanvas(host.current!, { pixelRatio: RATIO, width, height, skipFonts: false, preferredFontFormat: 'woff2', style: { opacity: '1' } });
      if (cancelled) return;
      const local = document.createElement('canvas'); local.width = Math.max(1, Math.round(element.width * RATIO)); local.height = Math.max(1, Math.round(element.height * RATIO));
      const ctx = local.getContext('2d')!; ctx.scale(RATIO, RATIO); ctx.translate(element.width / 2, element.height / 2); ctx.rotate(-element.rotation * Math.PI / 180); ctx.translate(-element.x, -element.y); ctx.drawImage(art, 0, 0, width, height);
      onMask(element.id, local.toDataURL('image/png'));
    })().catch(error => { if (!cancelled) { console.warn('Could not read the art under this texture.', error); onMask(element.id, null); } });
    return () => { cancelled = true; };
  }, [capture]);
  return <div ref={host} data-editor-chrome aria-hidden="true" className="pointer-events-none absolute left-0 top-0" style={{ width, height, opacity: 0 }}><DesignGroupArtwork element={group} /></div>;
}

export function TextureClipSources({ elements, side, onMask }: { elements: DesignElement[]; side: 'front' | 'back'; onMask: (id: string, url: string | null) => void }) {
  const measure = useRef<HTMLDivElement>(null), [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => { const node = measure.current; if (!node) return; const read = () => setSize(old => old.width === node.clientWidth && old.height === node.clientHeight ? old : { width: node.clientWidth, height: node.clientHeight }); read(); const observer = new ResizeObserver(read); observer.observe(node); return () => observer.disconnect(); }, []);
  const onSide = elements.filter(item => (item.side ?? 'front') === side);
  return <div ref={measure} data-editor-chrome aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>{size.width > 0 && onSide.map((element, index) => {
    if (!element.artworkTextureClip) return null;
    const below = onSide.slice(0, index).filter(item => placedArt(item) && !item.artworkTextureClip);
    return below.length ? <ClipSource key={element.id} element={element} below={below} width={size.width} height={size.height} onMask={onMask} /> : null;
  })}</div>;
}
