import { useState } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { outlineLettering } from '../../../../lib/editableLettering';
import { loadFontLibrary } from '../../printsStudio/designLibrary';
import { StudioNumber, StudioRange } from '../../shell/StudioControls';
import { edgeOffset, textOnEdge, type GarmentEdge } from '../geometry/garmentEdges';
import { useGarmentEdges } from '../state/garmentEdges';
import './garment-edges.css';

const DEFAULT_GAP_MM = 8;

function EdgeGlyph({ edge }: { edge: GarmentEdge }) {
  const nodes = edge.path.nodes, xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const left = Math.min(...xs), top = Math.min(...ys), size = Math.max(Math.max(...xs) - left, Math.max(...ys) - top, 1);
  const px = (x: number) => 3 + (x - left) / size * 26, py = (y: number) => 3 + (y - top) / size * 18 + (18 - (Math.max(...ys) - top) / size * 18) / 2;
  return <svg viewBox="0 0 32 24" aria-hidden="true"><path d={nodes.map((n, i) => `${i ? 'L' : 'M'}${px(n.x).toFixed(1)} ${py(n.y).toFixed(1)}`).join('')} /></svg>;
}

/** Follow a real garment edge, then control the distance, position, side and size along it. */
export function GarmentEdgeControls({ element: el, update, units }: { element: DesignElement; update: (patch: Partial<DesignElement>) => void; units: number }) {
  const { edges, side } = useGarmentEdges();
  const [error, setError] = useState('');
  const linked = el.textEdge, current = edges.find(edge => edge.id === linked?.id);
  const mm = (value: number) => value * 10 / Math.max(.0001, units), px = (value: number) => value * Math.max(.0001, units) / 10;
  if (!edges.length && !linked) return null;
  const follow = async (edge: GarmentEdge) => {
    try {
      setError('');
      const plain = { ...el, textPath: undefined, textEdge: undefined, textShapeMode: 'none' as const, vectorTextEffects: undefined, textCurveAmount: 0, textBadge: undefined, autoWidth: true, autoHeight: true };
      const outline = await outlineLettering(plain, loadFontLibrary());
      update({ ...textOnEdge(el, edge, side, linked?.gap ?? px(DEFAULT_GAP_MM), outline.textLayoutWidth ?? outline.width), textShapeSource: el.textShapeSource ?? { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation, autoWidth: el.autoWidth, autoHeight: el.autoHeight } });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not place the text on this edge.'); }
  };
  const moved = Boolean(linked && el.textPath && Math.hypot(el.x - linked.x, el.y - linked.y) > .5);
  const sit = current?.sit ?? 'below';
  const setGap = (gap: number) => el.textPath && linked && update({ textEdge: { ...linked, gap }, textPath: { ...el.textPath, offset: edgeOffset(sit, gap, el.fontSize ?? 30) } });
  return <div className="cx-edges">
    <span className="cx-edges__title">Follow garment</span>
    <div className="cx-edges__grid" role="group" aria-label="Garment edge">
      {edges.map(edge => <button key={edge.id} type="button" aria-pressed={linked?.id === edge.id && linked.side === side} onClick={() => void follow(edge)}><EdgeGlyph edge={edge} /><span>{edge.label}</span></button>)}
    </div>
    {error && <p role="alert">{error}</p>}
    {linked && el.textPath && <div className="cx-edges__controls">
      <StudioNumber label="Distance from edge" unit="mm" min={-100} max={200} step={.5} value={Number(mm(linked.gap).toFixed(1))} onChange={value => setGap(px(value))} />
      <StudioRange label="Slide along edge" unit="mm" min={-300} max={300} value={Math.round(mm(el.textPath.shift ?? 0))} onChange={value => update({ textPath: { ...el.textPath!, shift: px(value) } })} />
      {moved && current && <button type="button" className="studio-outline-action" onClick={() => void follow(current)}>Snap back to {current.label.toLowerCase()}</button>}
    </div>}
  </div>;
}
