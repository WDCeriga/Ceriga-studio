import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DesignElement } from '../../PrintStudioEditor';
import { loadFontLibrary } from '../../printsStudio/designLibrary';
import { outlineTextForCombine } from '../geometry/combine';
import { builderPieces, mergePieces, pieceSvgPath, rebuildFromPieces, type BuilderPiece } from '../geometry/shapeBuilder';
import { stopShapeBuilder } from '../state/shapeBuilder';
import './shape-builder.css';

/**
 * Shape builder on the canvas: the selection splits into pieces. Drag across pieces to merge them,
 * Alt-click a piece to remove it, Enter / Done to build, Esc to cancel. Lives in garment coordinates.
 */
export function ShapeBuilderOverlay({ elements, ids, onCommit }: {
  elements: DesignElement[];
  ids: string[];
  onCommit: (next: DesignElement[], selectedId?: string) => void;
}) {
  const [pieces, setPieces] = useState<BuilderPiece[] | null>(null);
  const [prepared, setPrepared] = useState<DesignElement[] | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const dragging = useRef(false);
  const imports = useMemo(() => loadFontLibrary(), []);

  useEffect(() => {
    let live = true;
    outlineTextForCombine(elements, ids, imports).then(next => {
      if (!live) return;
      setPrepared(next);
      try { setPieces(builderPieces(next, ids)); } catch { setPieces([]); }
    });
    return () => { live = false; };
    // Built once per session: later edits come from this overlay itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join('|')]);

  const done = () => {
    if (prepared && pieces?.length) {
      const result = rebuildFromPieces(prepared, ids, pieces, () => crypto.randomUUID());
      onCommit(result.elements, result.created[0]);
    }
    stopShapeBuilder();
  };
  const latest = useRef(done); latest.current = done;
  useEffect(() => {
    document.documentElement.dataset.shapeBuilder = 'on';
    return () => { delete document.documentElement.dataset.shapeBuilder; };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); stopShapeBuilder(); }
      if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); latest.current(); }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, []);
  useEffect(() => {
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      setTrail(current => { if (current.length > 1) setPieces(list => list ? mergePieces(list, current) : list); return []; });
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  if (!pieces) return null;
  return <>
    <svg className="cx-shape-builder" data-editor-chrome aria-label="Shape builder" onPointerDown={event => event.stopPropagation()}>
      {pieces.map(piece => {
        const active = trail.includes(piece.id), hot = hover === piece.id;
        return <path key={piece.id} d={pieceSvgPath(piece.polygon)} fillRule="evenodd"
          className={active ? 'is-merging' : hot ? 'is-hover' : undefined}
          onPointerEnter={() => { setHover(piece.id); if (dragging.current) setTrail(current => current.includes(piece.id) ? current : [...current, piece.id]); }}
          onPointerLeave={() => setHover(current => current === piece.id ? null : current)}
          onPointerDown={event => {
            event.stopPropagation(); event.preventDefault();
            if (event.altKey) { setPieces(list => list ? list.filter(item => item.id !== piece.id) : list); return; }
            dragging.current = true; setTrail([piece.id]);
          }} />;
      })}
    </svg>
    {createPortal(<div className="cx-shape-builder-bar" data-editor-chrome role="toolbar" aria-label="Shape builder" onPointerDown={event => event.stopPropagation()}>
      <strong>Shape builder</strong>
      <span>Drag across pieces to merge · Alt-click to remove</span>
      <button type="button" onClick={() => stopShapeBuilder()}>Cancel</button>
      <button type="button" className="is-primary" onClick={done}>Done</button>
    </div>, document.body)}
  </>;
}
