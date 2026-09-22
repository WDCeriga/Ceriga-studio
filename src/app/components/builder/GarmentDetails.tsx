import { useRef, useState, type PointerEvent } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { GARMENT_DETAIL_ASSETS, GARMENT_DETAIL_OPTIONS, createGarmentDetail, detailAsset, detailPlacement, detailScale, detailSvg, resizeGarmentDetail,
  type GarmentDetail, type GarmentDetailType, type GarmentDetailVariant, type DetailBounds } from '../../data/garmentDetails';
import { TrimColorFamilyPicker } from './TrimColorFamilyPicker';

interface DetailEditorProps {
  details: GarmentDetail[];
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onChange: (details: GarmentDetail[]) => void;
}

export function GarmentDetailsPanel({ details, selectedId, onSelect, onChange, color }: DetailEditorProps & { color: string }) {
  const [category, setCategory] = useState<GarmentDetailType>('pocket');
  const selected = details.find(detail => detail.id === selectedId);
  const asset = selected && detailAsset(selected);
  const update = (patch: Partial<GarmentDetail>) => onChange(details.map(detail => detail.id === selectedId ? { ...detail, ...patch } : detail));
  const add = (type: GarmentDetailType, variant: GarmentDetailVariant) => {
    const detail = createGarmentDetail(type, details, color, variant);
    onChange([...details, detail]);
    onSelect(detail.id);
  };
  return <div className="space-y-5">
    <div className="space-y-3">
      <div role="group" aria-label="Detail category" className="grid grid-cols-3 border-b border-white/15">
        {(Object.keys(GARMENT_DETAIL_ASSETS) as GarmentDetailType[]).map(type => <button key={type} type="button"
          aria-pressed={category === type} onClick={() => setCategory(type)}
          className={`min-w-0 border-b-2 px-1 py-2 text-xs ${category === type ? 'border-[#CC2D24] text-white' : 'border-transparent text-white/50 hover:text-white'}`}>
          {GARMENT_DETAIL_ASSETS[type].label}s
        </button>)}
      </div>
      <div role="group" aria-label={`${GARMENT_DETAIL_ASSETS[category].label} options`} className="grid grid-cols-3 gap-2">
        {GARMENT_DETAIL_OPTIONS[category].map(option => <button key={option.id} type="button"
          aria-label={`Add ${GARMENT_DETAIL_ASSETS[category].label} ${option.id.slice(-2)}: ${option.label}`}
          title={option.label} onClick={() => add(category, option.id)}
          className="flex min-w-0 flex-col items-center gap-2 rounded-md border border-white/15 bg-white/5 p-2 text-[10px] leading-tight text-white hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#CC2D24]">
          <img alt="" src={`data:image/svg+xml,${encodeURIComponent(detailAsset({ type: category, variant: option.id }).svg)}`} className="h-16 w-full bg-white object-contain p-1.5" />
          <span className="flex min-h-7 items-center gap-1"><Plus size={12} className="shrink-0" /><span className="break-words">{option.label}</span></span>
        </button>)}
      </div>
    </div>
    <div className="space-y-1" role="group" aria-label="Added details">
      {details.length === 0 && <p className="text-xs text-white/45">No details</p>}
      {details.map(detail => <div key={detail.id} className="flex min-w-0 items-center gap-1 border-b border-white/10 py-1">
        <button type="button" aria-pressed={detail.id === selectedId} onClick={() => onSelect(detail.id)}
          className={`min-w-0 flex-1 rounded px-2 py-2 text-left text-xs ${detail.id === selectedId ? 'bg-white/10 text-white' : 'text-white/60'}`}>
          {detail.name}{detail.variant && <span className="mt-0.5 block text-[10px] text-white/45">{detailAsset(detail).label}</span>}</button>
        <button type="button" title={`Duplicate ${detail.name}`} aria-label={`Duplicate ${detail.name}`} className="p-2 text-white/60 hover:text-white"
          onClick={() => { const identity = createGarmentDetail(detail.type, details, detail.fill);
            const next = { ...detail, id: identity.id, name: identity.name, selected: true, scale: detailScale(detail.scale), x: detail.x + .04, y: detail.y + .04 };
            onChange([...details, next]); onSelect(next.id); }}><Copy size={14} /></button>
        <button type="button" title={`Remove ${detail.name}`} aria-label={`Remove ${detail.name}`} className="p-2 text-white/60 hover:text-red-400"
          onClick={() => { onChange(details.filter(item => item.id !== detail.id)); if (selectedId === detail.id) onSelect(null); }}><Trash2 size={14} /></button>
      </div>)}
    </div>
    {selected && asset && <div className="space-y-4">
      <h3 className="text-xs font-semibold text-white">{selected.name}</h3>
      <label className="flex items-center justify-between gap-3 text-xs text-white/60">Size (%)
        <input type="number" min="20" max="400" step="5" aria-label={`${selected.name} size`} value={Math.round(detailScale(selected.scale) * 100)}
          onChange={event => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) update({ scale: detailScale(value / 100) }); }}
          className="w-20 rounded border border-white/15 bg-white/5 px-2 py-2 text-white" />
      </label>
      <TrimColorFamilyPicker label={`${selected.name} colour`} value={selected.fill} onChange={fill => update({ fill })} onClear={() => update({ fill: color })} />
      <TrimColorFamilyPicker label="Outline colour" value={selected.outline} onChange={outline => update({ outline })} onClear={() => update({ outline: '#141414' })} />
      {asset.stitch && <TrimColorFamilyPicker label="Stitch colour" value={selected.stitch} onChange={stitch => update({ stitch })} onClear={() => update({ stitch: '#707070' })} />}
      {asset.hardware && <TrimColorFamilyPicker label={selected.type === 'zip' ? 'Pull & teeth colour' : 'Hardware colour'} value={selected.hardware} onChange={hardware => update({ hardware })} onClear={() => update({ hardware: '#D4D4D4' })} />}
    </div>}
  </div>;
}

export function GarmentDetailsOverlay({ details, bounds, selectedId, onSelect, onChange }: {
  details: GarmentDetail[]; bounds: DetailBounds; selectedId?: string | null;
  onSelect?: (id: string | null) => void; onChange?: (details: GarmentDetail[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ pointerId: number; startX: number; startY: number; origin: GarmentDetail;
    canvasScale: number; corner?: { x: number; y: number } } | null>(null);
  const [draft, setDraft] = useState<GarmentDetail | null>(null);
  const draftRef = useRef<GarmentDetail | null>(null);
  const editable = Boolean(onChange);
  const move = (event: PointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = (event.clientX - active.startX) / active.canvasScale;
    const dy = (event.clientY - active.startY) / active.canvasScale;
    const next = active.corner ? resizeGarmentDetail(active.origin, bounds, active.corner.x, active.corner.y, dx, dy)
      : { ...active.origin, x: active.origin.x + dx / (bounds.maxX - bounds.minX), y: active.origin.y + dy / (bounds.maxY - bounds.minY) };
    const placement = detailPlacement(next, bounds);
    draftRef.current = { ...next, x: placement.x, y: placement.y };
    setDraft(draftRef.current);
  };
  const start = (event: PointerEvent<HTMLButtonElement>, detail: GarmentDetail, corner?: { x: number; y: number }) => {
    if (!editable || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); onSelect?.(detail.id);
    const placement = detailPlacement(detail, bounds);
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      origin: { ...detail, x: placement.x, y: placement.y, scale: detailScale(detail.scale), selected: true },
      canvasScale: rootRef.current!.getBoundingClientRect().width / 2048, corner };
    draftRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const cancel = () => { gesture.current = null; draftRef.current = null; setDraft(null); };
  return <div ref={rootRef} className="pointer-events-none absolute inset-0" style={{ zIndex: 240 }} data-garment-details="front">
    {details.map(detail => {
      const current = draft?.id === detail.id ? draft : detail;
      const placement = detailPlacement(current, bounds);
      const selected = editable && selectedId === detail.id;
      return <div key={detail.id} data-detail-id={detail.id} data-detail-variant={detail.variant} data-detail-scale={detailScale(current.scale)}
        className="pointer-events-none absolute"
        style={{ left: `${placement.left / 2048 * 100}%`, top: `${placement.top / 2048 * 100}%`, width: `${placement.width / 2048 * 100}%`, height: `${placement.height / 2048 * 100}%`,
          zIndex: selected ? 1 : undefined }}
        onPointerMove={event => { event.stopPropagation(); move(event); }}
        onPointerUp={event => {
          if (gesture.current?.pointerId !== event.pointerId) return;
          event.stopPropagation(); move(event);
          const next = draftRef.current;
          if (next && (next.x !== detail.x || next.y !== detail.y || next.scale !== detailScale(detail.scale))) {
            onChange?.(details.map(item => item.id === next.id ? next : { ...item, selected: false }));
          }
          cancel();
        }}
        onPointerCancel={cancel}>
        <button type="button" aria-label={`${detail.name} on garment`} aria-pressed={editable ? selected : undefined} tabIndex={editable ? 0 : -1}
        className={`absolute inset-0 h-full w-full touch-none bg-transparent p-0 ${editable ? 'pointer-events-auto cursor-move' : 'pointer-events-none'}`}
        style={{ outline: selected ? '1px dashed #CC2D24' : undefined, outlineOffset: 12 }}
        onPointerDown={event => start(event, detail)}
        onClick={event => { event.stopPropagation(); if (editable) onSelect?.(detail.id); }}
        onKeyDown={event => {
          if (editable && (event.key === 'Delete' || event.key === 'Backspace')) {
            event.preventDefault(); event.stopPropagation(); onChange?.(details.filter(item => item.id !== detail.id)); onSelect?.(null); return;
          }
          if (!editable || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const increment = event.shiftKey ? .05 : .01;
          const next = { ...detail, x: placement.x + (event.key === 'ArrowLeft' ? -increment : event.key === 'ArrowRight' ? increment : 0),
            y: placement.y + (event.key === 'ArrowUp' ? -increment : event.key === 'ArrowDown' ? increment : 0) };
          const clamped = detailPlacement(next, bounds);
          onChange?.(details.map(item => item.id === detail.id ? { ...next, x: clamped.x, y: clamped.y } : item));
        }}>
        <span className="pointer-events-none absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: detailSvg(current) }} />
        </button>
        {selected && [
          { name: 'top left', x: -1, y: -1 }, { name: 'top right', x: 1, y: -1 },
          { name: 'bottom left', x: -1, y: 1 }, { name: 'bottom right', x: 1, y: 1 },
        ].map(corner => <button key={corner.name} type="button" aria-label={`Resize ${detail.name} ${corner.name}`} title={`Resize ${detail.name}`}
          className="pointer-events-auto absolute flex h-5 w-5 touch-none items-center justify-center bg-transparent p-0"
          style={{ left: corner.x < 0 ? -12 : 'calc(100% + 12px)', top: corner.y < 0 ? -12 : 'calc(100% + 12px)', transform: 'translate(-50%, -50%)',
            cursor: corner.x === corner.y ? 'nwse-resize' : 'nesw-resize' }}
          onPointerDown={event => start(event, detail, corner)}
          onClick={event => event.stopPropagation()}
          onKeyDown={event => {
            if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            const scale = detailScale(detailScale(detail.scale) + (['ArrowUp', 'ArrowRight'].includes(event.key) ? .05 : -.05));
            onChange?.(details.map(item => item.id === detail.id ? { ...item, scale } : item));
          }}><span className="h-2 w-2 border border-[#CC2D24] bg-white" /></button>)}
      </div>;
    })}
  </div>;
}