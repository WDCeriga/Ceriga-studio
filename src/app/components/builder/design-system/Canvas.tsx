import type { ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';

/* All canvas overlays are positioned in screen space (px within the stage), so line widths,
   handles and labels stay constant at every zoom level (AUDIT §12, canvas interaction states). */

/** The single bottom-centre island: view · zoom · guides, plus optional section tools. */
export function CanvasToolbar({ children, label = 'Canvas controls', isStatic }: { children: ReactNode; label?: string; isStatic?: boolean }) {
  return <div className="cx cx-canvas-toolbar" role="toolbar" aria-label={label} data-static={isStatic || undefined}>{children}</div>;
}
export const ToolbarSeparator = () => <span className="cx-toolbar-sep" aria-hidden="true" />;

export function Segmented<T extends string>({ items, value, onChange, label }: {
  items: readonly { id: T; label: string }[]; value: T; onChange: (id: NoInfer<T>) => void; label: string;
}) {
  return (
    <div className="cx-segmented" role="group" aria-label={label}>
      {items.map(item => <button key={item.id} type="button" aria-pressed={item.id === value} onClick={() => onChange(item.id)}>{item.label}</button>)}
    </div>
  );
}

export function ZoomControl({ value, onChange, onFit, min = 25, max = 400 }: { value: number; onChange: (v: number) => void; onFit: () => void; min?: number; max?: number }) {
  const step = (dir: 1 | -1) => onChange(Math.min(max, Math.max(min, Math.round((value + dir * (value >= 100 ? 25 : 10)) / 5) * 5)));
  return (
    <div className="cx-segmented" role="group" aria-label="Zoom">
      <button type="button" className="cx-icon-btn" aria-label="Zoom out" disabled={value <= min} onClick={() => step(-1)}><Minus size={14} /></button>
      <button type="button" className="cx-zoom-value" aria-label={`Zoom ${value}%, fit to canvas`} title="Fit to canvas" onClick={onFit}>{value}%</button>
      <button type="button" className="cx-icon-btn" aria-label="Zoom in" disabled={value >= max} onClick={() => step(1)}><Plus size={14} /></button>
    </div>
  );
}

export type ScreenRect = { x: number; y: number; width: number; height: number };

/** Floating actions anchored above the selection; flips below when there is no room. */
export function ContextToolbar({ anchor, children, label = 'Selection actions', minTop = 56, gap = 10 }: {
  anchor: ScreenRect; children: ReactNode; label?: string; minTop?: number; /** Distance from the selection; use 40 to clear the rotate handle. */ gap?: number;
}) {
  const side = anchor.y - gap - 36 < minTop ? 'bottom' : 'top';
  return (
    <div className="cx cx-context-toolbar" role="toolbar" aria-label={label} data-side={side}
      style={{ left: anchor.x + anchor.width / 2, top: side === 'top' ? anchor.y - gap + 10 : anchor.y + anchor.height + gap - 10 }}>{children}</div>
  );
}

/** Value label pinned to a measurement / dimension / handle, e.g. "A · 51". Clickable when onClick is given. */
export function CanvasValueChip({ x, y, letter, value, unit, active, tone, onClick, label }: {
  x: number; y: number; letter?: string; value: ReactNode; unit?: string; active?: boolean; tone?: 'warning'; onClick?: () => void; label?: string;
}) {
  const content = <>{letter && <b>{letter}</b>}{letter && <span>·</span>}{value}{unit && <span>{unit}</span>}</>;
  return onClick
    ? <button type="button" className="cx cx-chip" style={{ left: x, top: y }} data-active={active || undefined} data-tone={tone} aria-pressed={active} aria-label={label} onClick={onClick}>{content}</button>
    : <span className="cx cx-chip" style={{ left: x, top: y, cursor: 'default' }} data-active={active || undefined} data-tone={tone}>{content}</span>;
}

/** Snap guide line (focus tint), shown only while dragging and actually snapped. */
export function SnapGuide({ orientation, position, from, to, label }: { orientation: 'vertical' | 'horizontal'; position: number; from: number; to: number; label?: string }) {
  const vertical = orientation === 'vertical';
  return (
    <>
      <svg className="cx-overlay" aria-hidden="true">
        <line className="cx-snap-halo" x1={vertical ? position : from} x2={vertical ? position : to} y1={vertical ? from : position} y2={vertical ? to : position} />
        <line className="cx-snap-line" x1={vertical ? position : from} x2={vertical ? position : to} y1={vertical ? from : position} y2={vertical ? to : position} />
      </svg>
      {label && <span className="cx cx-snap-label" style={vertical ? { left: position, top: from } : { left: (from + to) / 2, top: position }}>{label}</span>}
    </>
  );
}

export type PrintArea = ScreenRect & { id: string; name: string; size?: string };

/**
 * Optional print-area guides. `activeId` = area under the drag; `dropId` = valid drop target.
 * Names show only for the active/drop area by default, so labels never crowd the garment or
 * collide with the selection's context toolbar; `labels="all"` shows every name (e.g. a guides preview).
 */
export function PrintAreaOverlay({ areas, activeId, dropId, labels = 'active' }: {
  areas: readonly PrintArea[]; activeId?: string | null; dropId?: string | null; labels?: 'active' | 'all';
}) {
  const named = labels === 'all' ? areas : areas.filter(area => area.id === activeId || area.id === dropId);
  return (
    <div className="cx" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
      <svg className="cx-overlay">
        {areas.map(area => <rect key={`halo-${area.id}`} className="cx-print-halo" x={area.x + .5} y={area.y + .5} width={area.width} height={area.height} rx={3} />)}
        {areas.map(area => <rect key={area.id} className="cx-print-area" x={area.x + .5} y={area.y + .5} width={area.width} height={area.height} rx={3}
          data-active={area.id === activeId || undefined} data-drop={area.id === dropId || undefined} />)}
      </svg>
      {named.map(area => <span key={area.id} className="cx-print-name" style={{ left: area.x, top: area.y }}>{area.name}{area.size ? ` · ${area.size}` : ''}</span>)}
    </div>
  );
}

/* ---------------------------------------------------------------- Selection frame */

export type SelectionMode = 'hover' | 'selected' | 'resizing' | 'rotating' | 'locked';
export type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: readonly HandleId[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/**
 * Object selection in screen space: hover outline, selected box with eight handles and an attached
 * rotate stem, live dimension chip while resizing, angle chip while rotating, lock badge when locked.
 */
export function SelectionFrame({ rect, mode, name, dimension, angle, activeHandle, rotation = 0 }: {
  rect: ScreenRect; mode: SelectionMode; name?: string; dimension?: string; angle?: number; activeHandle?: HandleId; /** Object rotation in degrees; the frame rotates with it. */ rotation?: number;
}) {
  const showHandles = mode === 'selected' || mode === 'resizing' || mode === 'rotating';
  return (
    <div className="cx cx-frame" data-mode={mode} aria-hidden="true"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, transform: rotation ? `rotate(${rotation}deg)` : undefined, ['--cx-rot' as string]: `-${rotation}deg` }}>
      {showHandles && mode !== 'rotating' && HANDLES.map(h => <i key={h} className="cx-handle" data-handle={h} data-active={h === activeHandle || undefined} />)}
      {(mode === 'selected' || mode === 'rotating') && <i className="cx-rotate" data-active={mode === 'rotating' || undefined} />}
      {mode === 'locked' && <span className="cx-lock" />}
      {mode === 'selected' && name && <span className="cx-frame-label">{name}</span>}
      {mode === 'resizing' && dimension && <span className="cx-frame-chip" data-at="se">{dimension}</span>}
      {mode === 'rotating' && angle != null && <span className="cx-frame-chip" data-at="n">{Math.round(angle)}°</span>}
    </div>
  );
}

/* ---------------------------------------------------------------- Path editing */

export type PathAnchor = { x: number; y: number; kind: 'corner' | 'smooth'; selected?: boolean; handleIn?: { x: number; y: number }; handleOut?: { x: number; y: number } };

/** Anchor points and Bézier handles. Handles render only for selected anchors (and are hidden otherwise). */
export function PathHandles({ d, anchors }: { d: string; anchors: readonly PathAnchor[] }) {
  return (
    <svg className="cx cx-overlay" aria-hidden="true">
      <path d={d} className="cx-path-halo" />
      <path d={d} className="cx-path-outline" />
      {anchors.filter(a => a.selected).flatMap((a, i) => [a.handleIn, a.handleOut].filter(Boolean).map((h, j) =>
        <g key={`${i}-${j}`}><line className="cx-bezier-line" x1={a.x} y1={a.y} x2={h!.x} y2={h!.y} /><circle className="cx-bezier-handle" cx={h!.x} cy={h!.y} r={3.5} /></g>))}
      {anchors.map((a, i) => a.kind === 'smooth'
        ? <circle key={i} className="cx-anchor" data-selected={a.selected || undefined} cx={a.x} cy={a.y} r={4} />
        : <rect key={i} className="cx-anchor" data-selected={a.selected || undefined} x={a.x - 3.5} y={a.y - 3.5} width={7} height={7} rx={1} />)}
    </svg>
  );
}

/* ---------------------------------------------------------------- Drag + drop */

/** Ghost of a library item following the cursor, at its real size on the garment. */
export function DragPreview({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return <div className="cx cx-drag-preview" style={{ left: x, top: y }} aria-hidden="true">{children}</div>;
}

/** On-canvas empty state / drop slot, placed where the action happens (e.g. inside back neck). */
export function CanvasEmptySlot({ rect, title, hint, state = 'idle', onClick, surface = 'dark' }: {
  rect: ScreenRect; title: string; hint?: string; state?: 'idle' | 'drop' | 'over'; onClick?: () => void; /** Garment tone under the slot. */ surface?: 'dark' | 'light';
}) {
  return (
    <button type="button" className="cx cx-slot" data-state={state} data-surface={surface} onClick={onClick}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}>
      <span className="cx-slot-title">{title}</span>{hint && <span className="cx-slot-hint">{hint}</span>}
    </button>
  );
}
