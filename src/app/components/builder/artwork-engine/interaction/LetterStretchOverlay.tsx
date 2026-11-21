import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';
import { outlineLettering } from '../../../../lib/editableLettering';
import { shapeWorldPath } from '../../../../lib/artworkPathOperations';
import { loadFontLibrary } from '../../printsStudio/designLibrary';
import { IDENTITY_LETTER, LETTER_HANDLES, stretchLetter, type Handle, type LetterBox, type LetterTransform } from '../geometry/letterStretch';
import { setLetterSelection, useLetterSelection } from '../state/letterSelection';
import './letter-stretch.css';

type Letter = LetterBox & { key: string; label: string; pivot: { x: number; y: number } };
type Point = { x: number; y: number };

/**
 * Stretch any letter on the canvas: drag an edge or corner, Shift keeps proportion, Alt scales from the centre.
 * The words stay live text. Works in the text's own axes, so rotated text behaves.
 */
export function LetterStretchOverlay({ element, width, height, scale, onChange, onDone }: {
  element: DesignElement; width: number; height: number; scale: number;
  onChange: (patch: Partial<DesignElement>, transient?: boolean) => void; onDone: () => void;
}) {
  const [letters, setLetters] = useState<Letter[]>([]);
  const svg = useRef<SVGSVGElement>(null), dragging = useRef(false);
  const selection = useLetterSelection(), activeKey = selection?.elementId === element.id ? selection.key : null;
  const angle = element.rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const toLocal = (p: Point) => { const x = p.x - element.x, y = p.y - element.y; return { x: x * cos + y * sin, y: -x * sin + y * cos }; };
  const k = 1 / Math.max(.05, scale);

  useEffect(() => {
    let live = true;
    outlineLettering(element, loadFontLibrary()).then(patch => {
      if (!live || !patch.shapePath) return;
      const shape = { ...element, ...patch } as DesignElement, world = shapeWorldPath(shape), paths = [world, ...(world.subpaths ?? [])];
      const centre = toLocal({ x: shape.x, y: shape.y });
      setLetters((patch.letteringParts ?? []).flatMap(part => {
        const nodes = paths.filter(path => path.letterKey === part.key).flatMap(path => path.nodes).map(toLocal);
        if (!nodes.length) return [];
        const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y), left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
        const pivot = part.pivot ? { x: centre.x + (part.pivot.x / 100 - .5) * shape.width, y: centre.y + (part.pivot.y / 100 - .5) * shape.height } : { x: (left + right) / 2, y: (top + bottom) / 2 };
        return [{ key: part.key, label: part.label, left, right, top, bottom, pivot }];
      }));
    }).catch(() => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(element)]);

  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !dragging.current) { event.preventDefault(); event.stopPropagation(); onDone(); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [onDone]);
  useEffect(() => () => setLetterSelection(null), []);

  const pointer = (x: number, y: number): Point => { const m = svg.current?.getScreenCTM()?.inverse(); const p = m ? new DOMPoint(x, y).matrixTransform(m) : { x, y }; return toLocal({ x: p.x, y: p.y }); };
  const gesture = (event: ReactPointerEvent, letter: Letter, handle: Handle | null) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    setLetterSelection({ elementId: element.id, key: letter.key });
    const origin = pointer(event.clientX, event.clientY), before: LetterTransform = element.textGlyphTransforms?.[letter.key] ?? IDENTITY_LETTER;
    let final = before, frame = 0, moved = false;
    const write = (transient: boolean) => onChange({ textGlyphTransforms: { ...element.textGlyphTransforms, [letter.key]: final } }, transient);
    const move = (e: PointerEvent) => {
      const p = pointer(e.clientX, e.clientY), dx = p.x - origin.x, dy = p.y - origin.y; moved = true;
      final = handle
        ? stretchLetter(before, letter, letter.pivot, handle, dx, dy, { proportional: e.shiftKey, fromCentre: e.altKey, flipX: element.flipHorizontal, flipY: element.flipVertical })
        : { ...before, x: before.x + dx * (element.flipHorizontal ? -1 : 1), y: before.y + (e.shiftKey ? 0 : dy) * (element.flipVertical ? -1 : 1) };
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; write(true); });
    };
    const stop = () => { dragging.current = false; if (frame) cancelAnimationFrame(frame); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
    const up = () => { stop(); if (moved) write(false); };
    const cancel = () => { stop(); if (moved) onChange({ textGlyphTransforms: { ...element.textGlyphTransforms, [letter.key]: before } }, true); };
    dragging.current = true;
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel);
  };

  return <svg ref={svg} data-editor-chrome className="cx-letter-stretch" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Stretch letters">
    <g transform={`translate(${element.x} ${element.y}) rotate(${element.rotation})`}>
      {letters.map(letter => {
        const active = letter.key === activeKey, w = letter.right - letter.left, h = letter.bottom - letter.top;
        return <g key={letter.key}>
          <rect className={active ? 'is-active' : undefined} aria-label={`Letter ${letter.label}`} x={letter.left} y={letter.top} width={w} height={h} onPointerDown={event => gesture(event, letter, null)} />
          {active && LETTER_HANDLES.map(handle => {
            const x = letter.left + w * (handle.x + 1) / 2, y = letter.top + h * (handle.y + 1) / 2, size = 8 * k;
            return <rect key={handle.id} className="cx-letter-stretch__handle" aria-label={`Stretch ${letter.label} ${handle.id}`} x={x - size / 2} y={y - size / 2} width={size} height={size} rx={1.5 * k} style={{ cursor: handle.cursor }} onPointerDown={event => gesture(event, letter, handle)} />;
          })}
        </g>;
      })}
    </g>
  </svg>;
}
