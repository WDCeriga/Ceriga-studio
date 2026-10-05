import { useRef, useState, type PointerEvent } from 'react';
import { FlipHorizontal2, RotateCcw } from 'lucide-react';
import { collarEditGeometry, type CollarManualEdits } from '../../data/customCollarEditing';
import { CustomCollarEditor } from './CustomCollarEditor';
import { activeCustomAssets, type CustomAssetDefinition, type CustomAssetInstance, type CustomAssetState, type AssetView } from '../../data/customAssets';
import { assetUserPlacement, editableAssetTransform, registeredAssetGeometry, resizeAssetUserTransform, type AssetUserTransform } from '../../data/customAssetEditing';

interface EditorProps {
  state: CustomAssetState;
  garmentType: string;
  fit: string;
  view: AssetView;
  selectedId?: string | null;
  canvasSize: number;
  onSelect: (id: string) => void;
  onChange: (id: string, transform?: AssetUserTransform) => void;
  onCollarChange?: (id: string, edits?: CollarManualEdits) => void;
  cameraScale?: number;
}

function AssetNumberInput({ label, value, update, positive = false }: {
  label: string; value: number; update: (value: number) => void; positive?: boolean;
}) {
  const [draft, setDraft] = useState<string>();
  return <label className="min-w-0 space-y-1 text-[11px] text-white/65">
    <span>{label}</span><input aria-label={`Custom asset ${label}`} type="number" step="any" min={positive ? .01 : undefined}
      value={draft ?? Number(value.toFixed(2))} onBlur={() => setDraft(undefined)}
      onChange={event => {
        setDraft(event.currentTarget.value);
        const next = event.currentTarget.valueAsNumber;
        if (Number.isFinite(next) && (!positive || next > 0)) update(next);
      }}
      className="block h-9 w-full min-w-0 rounded border border-white/20 bg-black/30 px-2 text-sm text-white" />
  </label>;
}

export function CustomAssetEditorPanel({ state, garmentType, fit, view, selectedId, canvasSize, onSelect, onChange, onOptionsChange }: EditorProps & {
  onOptionsChange: (options: Pick<CustomAssetState, 'customSleevesLinked' | 'customAssetAspectLocked'>) => void;
}) {
  const assets = activeCustomAssets(state, garmentType, fit, view).filter(item => item.definition.category !== 'pocket');
  if (!assets.length) return null;
  const selected = assets.find(item => item.definition.registration.layerId === selectedId);
  const geometry = selected && registeredAssetGeometry(selected.definition);
  const user = selected && editableAssetTransform(selected.definition, selected.instance, canvasSize);
  const base = selected?.definition.registration.defaultTransform;
  const width = geometry && base && user ? geometry.width * (base.scaleX ?? base.scale) * (user.scaleX ?? user.scale) : 0;
  const height = geometry && base && user ? geometry.height * (base.scaleY ?? base.scale) * (user.scaleY ?? user.scale) : 0;
  const change = (transform: AssetUserTransform) => selected && onChange(selected.definition.registration.layerId, transform);
  const numberInput = (label: string, value: number, update: (value: number) => void, positive = false) =>
    <AssetNumberInput key={`${selected?.definition.id}:${label}`} label={label} value={value} update={update} positive={positive} />;
  return <section aria-label="Accepted asset transforms" className="mt-5 space-y-3 border-t border-white/15 pt-4" style={{ letterSpacing: 0 }}>
    <h3 className="text-xs font-semibold text-white">Accepted assets</h3>
    <div className="flex flex-wrap gap-2" role="group" aria-label="Select accepted asset">
      {assets.map(({ definition }) => <button key={definition.id} type="button" aria-pressed={selectedId === definition.registration.layerId}
        onClick={() => onSelect(definition.registration.layerId)} className="max-w-full rounded border border-white/20 px-2 py-1 text-left text-xs text-white aria-pressed:border-[#CC2D24]">
        {definition.registration.side ? `${definition.registration.side === 'left' ? 'Left' : 'Right'} sleeve` : definition.name}
      </button>)}
    </div>
    {selected && user && geometry && !(selected.definition.category === 'collar' && collarEditGeometry(selected.definition.svg)) && <>
      <div className="flex flex-wrap items-center gap-3">
        {selected.definition.category === 'sleeve' && <label className="flex items-center gap-2 text-xs text-white/80"><input type="checkbox" checked={state.customSleevesLinked !== false}
          onChange={event => onOptionsChange({ customSleevesLinked: event.target.checked })} />Link sleeves</label>}
        <label className="flex items-center gap-2 text-xs text-white/80"><input type="checkbox" checked={state.customAssetAspectLocked === true}
          onChange={event => onOptionsChange({ customAssetAspectLocked: event.target.checked })} />Lock aspect ratio</label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {numberInput('X (SVG units)', user.x, x => change({ ...user, x }))}
        {numberInput('Y (SVG units)', user.y, y => change({ ...user, y }))}
        {numberInput('Width (SVG units)', width, value => change(resizeAssetUserTransform(user, value / width, state.customAssetAspectLocked ? 'both' : 'width')), true)}
        {numberInput('Height (SVG units)', height, value => change(resizeAssetUserTransform(user, value / height, state.customAssetAspectLocked ? 'both' : 'height')), true)}
        {numberInput('Scale (%)', user.scale * 100, value => change(resizeAssetUserTransform(user, value / (user.scale * 100), 'both')), true)}
        {numberInput('Rotation (degrees)', user.rotation, rotation => change({ ...user, rotation }))}
      </div>
      <div className="flex gap-2">
        <button type="button" title="Mirror asset" aria-label="Mirror asset" aria-pressed={Boolean(user.mirror)} onClick={() => change({ ...user, mirror: !user.mirror })}
          className="flex h-9 w-9 items-center justify-center rounded border border-white/20 text-white aria-pressed:bg-white/20"><FlipHorizontal2 size={16} /></button>
        <button type="button" title="Reset to registered default" aria-label="Reset to registered default" onClick={() => onChange(selected.definition.registration.layerId)}
          className="flex h-9 w-9 items-center justify-center rounded border border-white/20 text-white"><RotateCcw size={16} /></button>
      </div>
    </>}
  </section>;
}

type GestureMode = 'move' | 'rotate' | 'both' | 'width' | 'height';

function AssetHandles({ definition, instance, selected, canvasSize, locked, onSelect, onChange }: {
  definition: CustomAssetDefinition; instance: CustomAssetInstance; selected: boolean; canvasSize: number; locked: boolean;
  onSelect: () => void; onChange: (transform: AssetUserTransform) => void;
}) {
  const gesture = useRef<{ pointerId: number; mode: GestureMode; user: AssetUserTransform; start: DOMPoint; localStart: DOMPoint;
    inverse: DOMMatrix; anchor: DOMPoint; handle: DOMPoint; horizontalSpan: number; verticalSpan: number } | null>(null);
  const geometry = registeredAssetGeometry(definition);
  if (!geometry) return null;
  const user = editableAssetTransform(definition, instance, canvasSize);
  const placement = assetUserPlacement(definition, user, canvasSize);
  const matrix = new DOMMatrix().translate(geometry.center.x + placement.x * 2048 / canvasSize, geometry.center.y + placement.y * 2048 / canvasSize)
    .rotate(placement.rotation).scale(placement.scaleX!, placement.scaleY!).translate(-geometry.center.x, -geometry.center.y);
  const { bounds, center, anchor } = geometry;
  const point = (horizontal: number, vertical: number) => matrix.transformPoint({ x: horizontal, y: vertical });
  const corners = [point(bounds.minX, bounds.minY), point(bounds.maxX, bounds.minY), point(bounds.maxX, bounds.maxY), point(bounds.minX, bounds.maxY)];
  const side = definition.registration.side ?? 'asset';
  const radius = 7 * 2048 / canvasSize;
  const pointer = (event: PointerEvent<SVGSVGElement>) => new DOMPoint(event.clientX, event.clientY).matrixTransform(event.currentTarget.getScreenCTM()!.inverse());
  const start = (event: PointerEvent<SVGElement>, mode: GestureMode, handle: DOMPoint) => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); onSelect();
    const svg = event.currentTarget.ownerSVGElement!;
    const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
    const local = matrix.inverse().transformPoint(position);
    gesture.current = { pointerId: event.pointerId, mode: locked && (mode === 'width' || mode === 'height') ? 'both' : mode,
      user, start: position, localStart: local, inverse: matrix.inverse(), anchor: point(anchor.x, anchor.y), handle,
      horizontalSpan: Math.abs(local.x - anchor.x) > geometry.width * .1 ? local.x - anchor.x : (local.x < center.x ? -1 : 1) * geometry.width,
      verticalSpan: Math.abs(local.y - anchor.y) > geometry.height * .1 ? local.y - anchor.y : geometry.height };
    svg.focus(); svg.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const position = pointer(event);
    if (current.mode === 'move') { onChange({ ...current.user, x: current.user.x + position.x - current.start.x, y: current.user.y + position.y - current.start.y }); return; }
    if (current.mode === 'rotate') {
      const angle = Math.atan2(position.y - current.anchor.y, position.x - current.anchor.x) - Math.atan2(current.start.y - current.anchor.y, current.start.x - current.anchor.x);
      onChange({ ...current.user, rotation: current.user.rotation + Math.atan2(Math.sin(angle), Math.cos(angle)) * 180 / Math.PI }); return;
    }
    const local = current.inverse.transformPoint(position);
    let factor: number;
    if (current.mode === 'width') factor = 1 + (local.x - current.localStart.x) / current.horizontalSpan;
    else if (current.mode === 'height') factor = 1 + (local.y - current.localStart.y) / current.verticalSpan;
    else {
      const horizontal = current.handle.x - current.anchor.x;
      const vertical = current.handle.y - current.anchor.y;
      factor = 1 + ((position.x - current.start.x) * horizontal + (position.y - current.start.y) * vertical) / Math.max(1, horizontal * horizontal + vertical * vertical);
    }
    onChange(resizeAssetUserTransform(current.user, factor, current.mode));
  };
  const cancel = () => { const current = gesture.current; gesture.current = null; if (current) onChange(current.user); };
  const handle = (position: DOMPoint, mode: GestureMode, name: string) => <circle key={name} cx={position.x} cy={position.y} r={radius}
    fill="white" stroke="#CC2D24" strokeWidth={radius / 4} pointerEvents="all" aria-label={`${side} sleeve ${name}`} role="button"
    style={{ cursor: mode === 'rotate' ? 'grab' : mode === 'width' ? 'ew-resize' : mode === 'height' ? 'ns-resize' : 'nwse-resize' }}
    onPointerDown={event => start(event, mode, position)}><title>{name}</title></circle>;
  const top = point(center.x, bounds.minY);
  const rotation = new DOMMatrix().translate(top.x, top.y).rotate(placement.rotation).transformPoint({ x: 0, y: -radius * 4 });
  return <svg viewBox="0 0 2048 2048" data-custom-asset-editor={definition.registration.layerId} tabIndex={-1}
    className="pointer-events-none absolute inset-0 h-full w-full overflow-visible outline-none" style={{ zIndex: selected ? 225 : 201, touchAction: 'none' }}
    onPointerMove={move} onPointerUp={event => { if (gesture.current?.pointerId === event.pointerId) { move(event); gesture.current = null; event.currentTarget.releasePointerCapture(event.pointerId); } }}
    onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={event => { if (event.key === 'Escape') cancel(); }}>
    <polygon points={corners.map(corner => `${corner.x},${corner.y}`).join(' ')} fill="transparent" stroke={selected ? '#CC2D24' : 'none'}
      strokeWidth={radius / 4} pointerEvents="all" style={{ cursor: 'move' }} role="button" aria-label={`Move ${side} ${definition.category}`}
      onPointerDown={event => start(event, 'move', point(center.x, center.y))} />
    {selected && <>
      <line x1={top.x} y1={top.y} x2={rotation.x} y2={rotation.y} stroke="#CC2D24" strokeWidth={radius / 4} />
      {corners.map((corner, index) => handle(corner, 'both', `proportional resize ${index + 1}`))}
      {handle(point(bounds.minX, center.y), 'width', 'left width')}
      {handle(point(bounds.maxX, center.y), 'width', 'right width')}
      {handle(point(center.x, bounds.maxY), 'height', 'sleeve length')}
      {handle(rotation, 'rotate', 'rotation')}
      <circle cx={point(anchor.x, anchor.y).x} cy={point(anchor.x, anchor.y).y} r={radius / 2} fill="#CC2D24" pointerEvents="none"><title>Attachment pivot</title></circle>
    </>}
  </svg>;
}

export function CustomAssetEditorOverlay({ state, garmentType, fit, view, selectedId, canvasSize, onSelect, onChange, onCollarChange, cameraScale = 1 }: EditorProps) {
  return <>{activeCustomAssets(state, garmentType, fit, view).filter(item => item.definition.category !== 'pocket').map(({ definition, instance }) =>
    definition.category === 'collar' && collarEditGeometry(definition.svg) ? (onCollarChange && <CustomCollarEditor key={`${view}:${definition.id}`}
      definition={definition} instance={instance} selected={selectedId === definition.registration.layerId} canvasSize={canvasSize} cameraScale={cameraScale}
      onSelect={() => onSelect(definition.registration.layerId)} onChange={edits => onCollarChange(definition.registration.layerId, edits)} />) :
    <AssetHandles key={`${view}:${definition.id}`} definition={definition} instance={instance} selected={selectedId === definition.registration.layerId}
      canvasSize={canvasSize} locked={state.customAssetAspectLocked === true} onSelect={() => onSelect(definition.registration.layerId)}
      onChange={transform => onChange(definition.registration.layerId, transform)} />)}</>;
}