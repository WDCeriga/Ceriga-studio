import type { PointerEvent } from 'react';
import './selection-chrome.css';

export type SelectionHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLES: SelectionHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const CURSORS = ['ns-resize', 'nesw-resize', 'ew-resize', 'nwse-resize'];

/**
 * Selection chrome for every Artwork surface (garment, multi-select, labels, packaging).
 * Implements the canvas states from the design gallery (/dev/builder-primitives):
 * thin frame · 8 px corner squares · pill side handles · rotate dot on a stalk ·
 * a light size label at rest and a dark chip while transforming. Red is never used.
 * The chrome sits inside the rotated object box, so handles follow the object's rotation;
 * `uiInverseScale` keeps them a constant size at any canvas zoom.
 */
export function SelectionChrome({
  onResizePointerDown, onRotatePointerDown, uiInverseScale = 1, comfortableTouch = false,
  hideBounds = false, rotation = 0, transformLabel, transforming = false,
}: {
  onResizePointerDown: (event: PointerEvent, handle: SelectionHandle) => void;
  onRotatePointerDown: (event: PointerEvent) => void;
  uiInverseScale?: number; comfortableTouch?: boolean; hideBounds?: boolean;
  rotation?: number; transformLabel?: string;
  /** True while a resize/rotate is in progress: the readout becomes the dark live chip. */
  transforming?: boolean;
}) {
  const scale = uiInverseScale > 0 ? uiInverseScale : 1;
  const hit = comfortableTouch ? 28 : 22;
  // A small, zoom-constant outset keeps the frame and handles off the artwork itself (gallery spacing).
  const outset = 6 * scale;
  return <div data-handles data-editor-chrome data-shape-transform className="cx-selection-chrome" style={{ inset: -outset }}>
    {!hideBounds && <span aria-hidden="true" className="cx-selection-chrome__frame" style={{ borderWidth: scale }} />}
    {HANDLES.map(handle => {
      const x = handle.includes('w') ? 0 : handle.includes('e') ? 100 : 50;
      const y = handle.includes('n') ? 0 : handle.includes('s') ? 100 : 50;
      const base = handle === 'n' || handle === 's' ? 0 : handle === 'ne' || handle === 'sw' ? 1 : handle === 'e' || handle === 'w' ? 2 : 3;
      const kind = handle.length === 2 ? 'corner' : handle === 'n' || handle === 's' ? 'h' : 'v';
      return <button key={handle} type="button" aria-label={`Resize ${handle.toUpperCase()}`} className="cx-selection-chrome__hit"
        data-kind={kind}
        style={{ left: x + '%', top: y + '%', width: hit, height: hit, transform: `translate(-50%,-50%) scale(${scale})`,
          cursor: CURSORS[(base + Math.round(rotation / 45) % 4 + 4) % 4] }}
        onPointerDown={event => { if (event.button === 0) onResizePointerDown(event, handle); }}>
        <span aria-hidden="true" className="cx-selection-chrome__handle" />
      </button>;
    })}
    <button type="button" aria-label="Rotate" className="cx-selection-chrome__rotate"
      style={{ top: -30 * scale, transform: `translate(-50%,-50%) scale(${scale})` }}
      onPointerDown={event => { if (event.button === 0) onRotatePointerDown(event); }}>
      <span aria-hidden="true" className="cx-selection-chrome__rotate-dot" />
    </button>
    {transformLabel && <span className="cx-selection-chrome__readout" data-live={transforming || undefined}
      style={{ top: `calc(100% + ${14 * scale}px)`, transform: `translateX(-50%) scale(${scale})` }}>{transformLabel}</span>}
  </div>;
}
