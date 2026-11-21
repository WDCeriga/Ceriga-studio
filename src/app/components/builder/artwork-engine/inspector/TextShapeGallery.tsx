import { useEffect, useMemo, useState } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { outlineLettering } from '../../../../lib/editableLettering';
import { applyVectorTextEffects } from '../../../../lib/vectorTextEffects';
import { shapePathData, type ShapePath } from '../../../../lib/shapeGeometry';
import { loadFontLibrary } from '../../printsStudio/designLibrary';
import './text-shape-gallery.css';

export type WarpType = NonNullable<DesignElement['vectorTextEffects']>[number]['type'];
export type TextShapePick = { kind: 'none' | 'circle' | 'path' | 'stack' } | { kind: 'warp'; type: WarpType };

/** Plan §9.3: the gallery shows the user's own word in every shape. */
export const WARP_TILES: { type: WarpType; label: string }[] = [
  { type: 'arc', label: 'Arc' }, { type: 'arch', label: 'Arch' }, { type: 'bulge', label: 'Bulge' }, { type: 'squeeze', label: 'Squeeze' },
  { type: 'inflate', label: 'Inflate' }, { type: 'fisheye', label: 'Fisheye' }, { type: 'flag', label: 'Flag' }, { type: 'wave', label: 'Wave' },
  { type: 'rise', label: 'Rise' }, { type: 'twist', label: 'Twist' }, { type: 'fan', label: 'Fan' }, { type: 'perspective', label: 'Perspective' },
];
const MODE_TILES: { kind: 'none' | 'circle' | 'path' | 'stack'; label: string; icon: string }[] = [
  { kind: 'none', label: 'Straight', icon: 'M4 12h16' },
  { kind: 'circle', label: 'Circle', icon: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Z' },
  { kind: 'path', label: 'On path', icon: 'M3 16c4-8 8 4 12-4 2-4 4-4 6-3' },
  { kind: 'stack', label: 'Stack', icon: 'M5 6h14M7 12h10M5 18h14' },
];

type Outline = { path: ShapePath; width: number; height: number };

/** One outline of the word (first 12 characters), shared by every tile. */
function useWordOutline(element: DesignElement): Outline | null {
  const word = (element.content || 'Text').replace(/\s+/g, ' ').trim().slice(0, 12) || 'Text';
  const key = JSON.stringify([word, element.fontFamily, element.fontWeight, element.fontStyle, element.letterSpacing, element.fontId]);
  const [outline, setOutline] = useState<{ key: string; value: Outline } | null>(null);
  useEffect(() => {
    let live = true;
    const plain: DesignElement = { ...element, content: word, vectorTextEffects: undefined, textShapeMode: 'none', textPath: undefined, textCurveAmount: 0, textBadge: undefined, textStackFit: false, warp: undefined, perspective: undefined, autoWidth: true, autoHeight: true };
    outlineLettering(plain, loadFontLibrary()).then(patch => {
      if (live && patch.shapePath && patch.width && patch.height) setOutline({ key, value: { path: patch.shapePath, width: patch.width, height: patch.height } });
    }).catch(() => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return outline?.key === key ? outline.value : null;
}

function WarpThumb({ outline, type }: { outline: Outline; type: WarpType }) {
  const view = useMemo(() => {
    const warped = applyVectorTextEffects(outline.path, [{ id: 'preview', type, enabled: true, bend: 60, horizontal: 0, vertical: 0 }], outline.width, outline.height);
    const scaled = (p: ShapePath): ShapePath => ({ ...p, nodes: p.nodes.map(n => ({ x: n.x * outline.width / 100, y: n.y * outline.height / 100, in: n.in && { x: n.in.x * outline.width / 100, y: n.in.y * outline.height / 100 }, out: n.out && { x: n.out.x * outline.width / 100, y: n.out.y * outline.height / 100 } })), subpaths: p.subpaths?.map(scaled) });
    const path = scaled(warped), xs: number[] = [], ys: number[] = [];
    const visit = (p: ShapePath) => { p.nodes.forEach(n => { xs.push(n.x); ys.push(n.y); }); p.subpaths?.forEach(visit); };
    visit(path);
    const left = Math.min(...xs), top = Math.min(...ys), w = Math.max(...xs) - left, h = Math.max(...ys) - top, pad = Math.max(w, h) * .08;
    return { d: shapePathData(path), box: `${left - pad} ${top - pad} ${w + pad * 2} ${h + pad * 2}` };
  }, [outline, type]);
  return <svg viewBox={view.box} preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path d={view.d} fillRule="evenodd" /></svg>;
}

/** Shape gallery for text: straight / circle / path / stack, then every warp drawn with the user's word. */
export function TextShapeGallery({ element, active, onPick }: { element: DesignElement; active: string; onPick: (pick: TextShapePick) => void }) {
  const outline = useWordOutline(element);
  return <div className="cx-text-shapes">
    <div className="cx-text-shapes__modes" role="group" aria-label="Text layout">
      {MODE_TILES.map(tile => <button key={tile.kind} type="button" aria-pressed={active === tile.kind} onClick={() => onPick({ kind: tile.kind })}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="cx-text-shapes__glyph"><path d={tile.icon} /></svg><span>{tile.label}</span>
      </button>)}
    </div>
    <div className="cx-text-shapes__warps" role="group" aria-label="Warp">
      {WARP_TILES.map(tile => <button key={tile.type} type="button" aria-pressed={active === 'warp:' + tile.type} onClick={() => onPick({ kind: 'warp', type: tile.type })} title={tile.label}>
        <span className="cx-text-shapes__preview">{outline ? <WarpThumb outline={outline} type={tile.type} /> : <i aria-hidden="true" />}</span>
        <span>{tile.label}</span>
      </button>)}
    </div>
  </div>;
}
