import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Copy, CopyPlus, Plus, Upload, Trash2, FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw, ArrowDownToLine, Maximize, ZoomIn, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter, AlignStartVertical, AlignEndVertical } from 'lucide-react';
import type { GarmentView } from '../../data/garmentView';
import { GARMENT_DETAIL_ASSETS, GARMENT_DETAIL_OPTIONS, ZIP_PULL_STYLES, zipPullStyle, zipPullScale, zipPullThumbnail, zipHardwareGeometry, adjustZipPull, createGarmentDetail, detailAsset, detailAxisScale, detailPlacement, detailScale, detailSvg, resizeGarmentDetail, detailRotation, alignGarmentZip, setDetailTransform, detailGesture, alignGarmentDetail,
  type GarmentDetail, type GarmentDetailType, type GarmentDetailVariant, type DetailBounds, type DetailGuide, type DetailAlignment } from '../../data/garmentDetails';
import { TrimColorFamilyPicker } from './TrimColorFamilyPicker';
type MeasurementUnit = '%';
const formatMeasurementDisplay = (value: string, _unit: MeasurementUnit) => value;
const parseMeasurementInput = (value: string, _unit: MeasurementUnit) => value;
import { patchSettings, PATCH_TYPES, PATCH_SHAPES, PATCH_FINISHES, PATCH_EDGES, PATCH_DEPTHS, PATCH_APPLICATIONS, PATCH_MATERIAL_APPLICATIONS, readPatchArtwork, type PatchSettings } from '../../data/garmentPatches';

interface DetailEditorProps {
  details: GarmentDetail[];
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onChange: (details: GarmentDetail[]) => void;
  editor?: DetailEditorState;
}

export interface DetailEditorState {
  part: 'zip' | 'pull';
  closeUp: boolean;
  onPartChange: (part: 'zip' | 'pull') => void;
  onCloseUpChange: (closeUp: boolean) => void;
  snap?: boolean;
  onSnapChange?: (snap: boolean) => void;
  draft?: GarmentDetail | null;
  onDraftChange?: (draft: GarmentDetail | null) => void;
}

function DetailNumberInput({ value, onChange, label, step = .1, min, max }: { value: number; onChange: (value: number) => void; label: string; step?: number; min?: number; max?: number }) {
  const [text, setText] = useState<string | null>(null);
  return <input type="number" step={step} min={min} max={max} aria-label={label} value={text ?? Number(value.toFixed(3))}
    onFocus={() => setText(String(Number(value.toFixed(3))))} onBlur={() => setText(null)}
    onChange={event => { setText(event.target.value); if (Number.isFinite(event.target.valueAsNumber)) onChange(event.target.valueAsNumber); }}
    className="mt-1 w-full min-w-0 rounded border border-white/15 bg-white/5 p-2 text-white" />;
}

export function DetailPositionControls({ detail, bounds, onChange, referenceWidthCm, unit = '%' }: { detail: GarmentDetail; bounds: DetailBounds; onChange: (detail: GarmentDetail) => void; referenceWidthCm: number; unit?: MeasurementUnit }) {
  const [error, setError] = useState('');
  const placement = detailPlacement(detail, bounds);
  const bodyWidth = bounds.maxX - bounds.minX;
  const bodyHeight = bounds.maxY - bounds.minY;
  const cmPerUnit = referenceWidthCm / bodyWidth;
  const display = (designUnits: number) => Number(formatMeasurementDisplay(String(designUnits * cmPerUnit), unit));
  const values = { x: display(placement.x * bodyWidth), y: display(placement.y * bodyHeight), width: display(placement.width), height: display(placement.height), rotation: detailRotation(detail) };
  const labels = { x: 'Centre from left', y: 'Centre from top', width: 'Width', height: detail.type === 'patch' ? 'Height' : 'Length', rotation: 'Rotation' };
  return <details open className="border-y border-white/15 py-3">
    <summary className="cursor-pointer text-xs font-semibold text-white">Position &amp; size</summary>
    <div className="mt-3 grid grid-cols-2 gap-3">
      {(['x', 'y', 'width', 'height', 'rotation'] as const).map(field => <label key={field} className="min-w-0 text-[11px] capitalize text-white/60">
        {labels[field]} ({field === 'rotation' ? 'deg' : unit})
        <DetailNumberInput key={`${detail.id}-${unit}`} step={field === 'rotation' ? 1 : .1} label={`Detail ${labels[field].toLowerCase()} (${field === 'rotation' ? 'deg' : unit})`} value={values[field]}
          onChange={value => {
            const designUnits = Number(parseMeasurementInput(String(value), unit)) / cmPerUnit;
            const converted = field === 'x' ? designUnits / bodyWidth : field === 'y' ? designUnits / bodyHeight : field === 'rotation' ? value : designUnits;
            const next = setDetailTransform(detail, bounds, { [field]: converted });
            setError(next === detail ? 'That size or rotation does not fit here. Move the detail or use a smaller value.' : '');
            if (next !== detail) onChange(next);
          }} />
      </label>)}
    </div>
    {error && <p role="status" className="mt-2 text-[11px] text-amber-300">{error}</p>}
    <div role="group" aria-label="Detail alignment" className="mt-3 flex flex-wrap gap-2">
      {([
        ['horizontal', 'Centre horizontally on garment', AlignHorizontalJustifyCenter], ['vertical', 'Centre vertically in panel', AlignVerticalJustifyCenter],
        ['top', 'Align to panel top', AlignStartVertical], ['bottom', 'Align to bottom hem', AlignEndVertical],
      ] as const).map(([alignment, label, Icon]) => <button key={alignment} type="button" aria-label={label} title={label}
        onClick={() => onChange(alignGarmentDetail(detail, bounds, alignment as DetailAlignment))}
        className="flex h-9 w-9 items-center justify-center rounded border border-white/15 text-white"><Icon size={16} /></button>)}
    </div>
    <div role="group" aria-label="Detail orientation" className="mt-2 flex gap-2">
      {[
        { label: 'Rotate detail left 90 degrees', icon: RotateCcw, action: () => onChange(setDetailTransform(detail, bounds, { rotation: detailRotation(detail) - 90 })) },
        { label: 'Rotate detail right 90 degrees', icon: RotateCw, action: () => onChange(setDetailTransform(detail, bounds, { rotation: detailRotation(detail) + 90 })) },
        { label: 'Flip detail horizontally', icon: FlipHorizontal2, pressed: detail.flipX ?? false, action: () => onChange({ ...detail, flipX: !detail.flipX }) },
        { label: 'Flip detail vertically', icon: FlipVertical2, pressed: detail.flipY ?? false, action: () => onChange({ ...detail, flipY: !detail.flipY }) },
      ].map(({ label, icon: Icon, action, pressed }) => <button key={label} type="button" title={label} aria-label={label} aria-pressed={pressed} onClick={action}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded border border-white/15 text-white ${pressed ? 'bg-white/20' : 'bg-white/5'}`}><Icon size={16} /></button>)}
    </div>
  </details>;
}

function ZipPullMeasurements({ detail, bounds, onChange, referenceWidthCm, unit }: { detail: GarmentDetail; bounds: DetailBounds; onChange: (detail: GarmentDetail) => void; referenceWidthCm: number; unit: MeasurementUnit }) {
  const placement = detailPlacement(detail, bounds);
  const sourceWidth = Number(new DOMParser().parseFromString(detailAsset(detail).svg, 'image/svg+xml').documentElement.getAttribute('viewBox')?.split(/\s+/)[2]) || 48;
  const geometry = zipHardwareGeometry(detail, sourceWidth, sourceWidth * placement.height / placement.width);
  const factor = placement.width / sourceWidth * geometry.hardwareScale * zipPullScale(detail);
  const cmPerUnit = referenceWidthCm / (bounds.maxX - bounds.minX);
  const display = (designUnits: number) => Number(formatMeasurementDisplay(String(designUnits * cmPerUnit), unit));
  const width = display(28 * factor);
  const height = display((zipPullStyle(detail).id === 'short' ? 22 : 50) * factor);
  const trackLength = display(geometry.travel * placement.width / sourceWidth);
  const sliderScale = Math.max(.5, Math.min(1.25, detail.zipSliderScale ?? 1));
  const sliderFactor = placement.width / sourceWidth * geometry.hardwareScale * sliderScale;
  return <details open className="border-b border-white/15 pb-3"><summary className="cursor-pointer text-xs text-white">Pull position &amp; size</summary>
    <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-white/60">
      {(['width', 'height'] as const).map(axis => <label key={axis} className="capitalize">{axis === 'height' ? 'Length' : 'Width'} ({unit})<DetailNumberInput key={`${detail.id}-${unit}`} label={`Zip pull ${axis === 'height' ? 'length' : 'width'} (${unit})`} value={axis === 'width' ? width : height}
        onChange={value => onChange({ ...detail, zipPullScale: zipPullScale({ zipPullScale: zipPullScale(detail) * value / (axis === 'width' ? width : height) }) })} /></label>)}
      <label>Travel from top ({unit})<DetailNumberInput key={`${detail.id}-${unit}`} label={`Zip pull travel (${unit})`} value={(detail.zipSliderPosition ?? (detail.variant === 'zip-05' ? .34 : 0)) * trackLength} min={0} max={trackLength}
        onChange={value => onChange({ ...detail, zipSliderPosition: trackLength > 0 ? Math.max(0, Math.min(1, value / trackLength)) : 0 })} /></label>
      {(['width', 'length'] as const).map(axis => {
        const dimension = display((axis === 'width' ? 16 : 22) * sliderFactor);
        return <label key={axis}>Slider {axis} ({unit})<DetailNumberInput key={`${detail.id}-${unit}`} label={`Zip slider ${axis} (${unit})`} value={dimension}
          onChange={value => onChange({ ...detail, zipSliderScale: Math.max(.5, Math.min(1.25, sliderScale * value / dimension)) })} /></label>;
      })}
    </div>
  </details>;
}

function DetailArtwork({ detail, ratio }: { detail: GarmentDetail; ratio: number }) {
  const body = useMemo(() => detailSvg(detail, ratio, 'body'), [ratio, detail.type, detail.variant, detail.scaleX, detail.scaleY,
    detail.fill, detail.outline, detail.stitch, detail.hardware, detail.zipSliderColor, detail.zipSliderScale, detail.zipTeethColor, detail.zipSliderPosition, detail.zipHardwareScale, detail.flipX, detail.flipY, detail.catalogueAsset, detail.customAsset, detail.patch, detail.id]);
  return <><span className="pointer-events-none absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: body }} />
    {detail.type === 'zip' && !detail.customAsset && <span className="pointer-events-none absolute inset-0 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: detailSvg(detail, ratio, 'pull') }} />}</>;
}

function PatchControls({ detail, onChange }: { detail: GarmentDetail; onChange: (patch: Partial<GarmentDetail>) => void }) {
  const settings = patchSettings(detail.patch);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const latest = useRef({ settings, onChange });
  latest.current = { settings, onChange };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const update = (patch: Partial<PatchSettings>) => onChange({ patch: { ...settings, ...patch } });
  const selectClass = 'mt-1 w-full min-w-0 rounded border border-white/15 bg-[#202023] p-2 text-xs text-white';
  return <section aria-label="Patch construction" className="space-y-3 border-y border-white/15 py-3">
    <div className="grid grid-cols-2 gap-3 text-[11px] text-white/60">
      <label>Patch type<select aria-label="Patch type" className={selectClass} value={settings.material} onChange={event => update({ material: event.target.value as PatchSettings['material'], application: undefined, edgeStyle: undefined, depth: undefined })}>
        {Object.entries(PATCH_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Shape<select aria-label="Patch shape" className={selectClass} value={settings.shape} onChange={event => update({ shape: event.target.value as PatchSettings['shape'] })}>
        {Object.entries(PATCH_SHAPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    <input ref={input} type="file" accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml" aria-label="Patch artwork file" className="hidden" onChange={async event => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
      if (!file) return;
      setBusy(true); setError('');
      try {
        const artwork = await readPatchArtwork(file);
        if (alive.current) latest.current.onChange({ patch: { ...latest.current.settings, ...artwork } });
      } catch (error) { if (alive.current) setError(error instanceof Error ? error.message : 'Unable to read this image.'); }
      finally { if (alive.current) setBusy(false); }
    }} />
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className="flex min-w-0 items-center gap-2 rounded border border-white/15 px-3 py-2 text-xs text-white disabled:opacity-40"><Upload size={14} />{busy ? 'Importing...' : 'Upload artwork'}</button>
      {settings.artwork && <button type="button" title="Remove patch artwork" aria-label="Remove patch artwork" className="p-2 text-white/60" onClick={() => update({ artwork: undefined, artworkName: undefined, contour: undefined, artworkRatio: undefined })}><Trash2 size={14} /></button>}
    </div>
    {settings.artworkName && <div className="break-words text-[10px] text-white/50">{settings.artworkName}</div>}
    {error && <p role="alert" className="text-xs text-amber-300">{error}</p>}
    {settings.shape === 'auto' && !settings.contour && <p role="status" className="text-[11px] text-amber-300">No transparent outline detected. Rounded rectangle used.</p>}
    <div className="grid grid-cols-2 gap-3 text-[11px] text-white/60">
      <label>Border thickness (%)<DetailNumberInput label="Patch border thickness (%)" value={settings.borderThickness} min={0} max={12} onChange={value => update({ borderThickness: Math.max(0, Math.min(12, value)) })} /></label>
      <label>Artwork scale (%)<DetailNumberInput label="Patch artwork scale (%)" value={settings.artworkScale} min={10} max={120} step={1} onChange={value => update({ artworkScale: Math.max(10, Math.min(120, value)) })} /></label>
      <label>Artwork padding (%)<DetailNumberInput label="Patch artwork padding (%)" value={settings.padding} min={0} max={35} onChange={value => update({ padding: Math.max(0, Math.min(35, value)) })} /></label>
      {(settings.shape === 'rounded' || settings.shape === 'auto' && !settings.contour) && <label>Corner radius (%)<DetailNumberInput label="Patch corner radius (%)" value={settings.cornerRadius} min={0} max={50} onChange={value => update({ cornerRadius: Math.max(0, Math.min(50, value)) })} /></label>}
      <label>Attachment finish<select aria-label="Patch attachment finish" className={selectClass} value={settings.finish} onChange={event => update({ finish: event.target.value as PatchSettings['finish'] })}>
        {Object.entries(PATCH_FINISHES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Edge style<select aria-label="Patch edge style" className={selectClass} value={settings.edgeStyle} onChange={event => update({ edgeStyle: event.target.value as PatchSettings['edgeStyle'] })}>
        {Object.entries(PATCH_EDGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      <label>Artwork application<select aria-label="Patch artwork application" className={selectClass} value={settings.application} onChange={event => update({ application: event.target.value as PatchSettings['application'] })}>
        {PATCH_MATERIAL_APPLICATIONS[settings.material].map(value => <option key={value} value={value}>{PATCH_APPLICATIONS[value]}</option>)}
      </select></label>
      {['leather', 'pvc', 'chenille'].includes(settings.material) && <label>Depth<select aria-label="Patch depth" className={selectClass} value={settings.depth} onChange={event => update({ depth: event.target.value as PatchSettings['depth'] })}>
        {Object.entries(PATCH_DEPTHS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>}
    </div>
    {settings.material === 'pvc' && settings.application === 'moulded' && <label className="block text-[11px] text-white/60">Artwork relief<select aria-label="PVC artwork relief" className={selectClass} value={settings.relief} onChange={event => update({ relief: event.target.value as PatchSettings['relief'] })}><option value="raised">Raised</option><option value="recessed">Recessed</option></select></label>}
    {(settings.finish === 'stitched' || settings.finish === 'sewOn') && <label className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" checked={settings.stitchedEdge} onChange={event => update({ stitchedEdge: event.target.checked })} />Visible perimeter stitching</label>}
    <TrimColorFamilyPicker label="Patch background colour" value={detail.fill} onChange={fill => onChange({ fill })} onClear={() => onChange({ fill: '#D4D4D4' })} />
    <TrimColorFamilyPicker label="Patch border colour" value={detail.outline} onChange={outline => onChange({ outline })} onClear={() => onChange({ outline: '#141414' })} />
    {settings.stitchedEdge && (settings.finish === 'stitched' || settings.finish === 'sewOn') && <TrimColorFamilyPicker label="Patch thread colour" value={detail.stitch} onChange={stitch => onChange({ stitch })} onClear={() => onChange({ stitch: '#707070' })} />}
  </section>;
}

export function GarmentDetailsPanel({ details, selectedId, onSelect, onChange, color, view = 'front', onDuplicateToOtherView, onMoveToView, bounds, editor, copiedIds = [], builtins = [], referenceWidthCm = 100, unit = '%' }: DetailEditorProps & {
  color: string; view?: GarmentView; onDuplicateToOtherView?: (detail: GarmentDetail) => void; bounds?: DetailBounds; copiedIds?: string[];
  onMoveToView?: (detail: GarmentDetail, view: GarmentView) => void;
  builtins?: GarmentDetail[];
  referenceWidthCm?: number;
  unit?: MeasurementUnit;
}) {
  const [category, setCategory] = useState<GarmentDetailType>('pocket');
  const [builtinError, setBuiltinError] = useState('');
  const selected = editor?.draft && editor.draft.id === selectedId ? editor.draft : details.find(detail => detail.id === selectedId);
  const asset = selected && detailAsset(selected);
  const update = (patch: Partial<GarmentDetail>) => onChange(details.map(detail => detail.id === selectedId ? { ...detail, ...patch } : detail));
  const add = (type: GarmentDetailType, variant?: GarmentDetailVariant) => {
    const detail = { ...createGarmentDetail(type, details, type === 'patch' ? '#D4D4D4' : color, variant), view };
    onChange([...details, detail]);
    onSelect(detail.id);
  };
  return <div className="space-y-5">
    {editor?.onSnapChange && <label title="Aligns nearby centres and edges while dragging. Hold Alt to move freely." className="flex items-center gap-2 text-xs text-white/70"><input type="checkbox" aria-label="Snap to alignment guides" checked={editor.snap ?? true}
      onChange={event => editor.onSnapChange?.(event.target.checked)} />Snap to alignment guides</label>}
    {builtins.length > 0 && <div className="space-y-2"><h3 className="text-xs font-semibold text-white">Built-in trims</h3>
      {builtins.map(detail => <button key={detail.id} type="button" className="block w-full border-b border-white/15 py-2 text-left text-xs text-white/70"
        onClick={() => {
          if (!bounds || !detail.catalogueAsset) return;
          const placed = detailPlacement(detail, bounds);
          const crop = detail.catalogueAsset.crop;
          if (Math.abs(placed.x - detail.x) > .00001 || Math.abs(placed.y - detail.y) > .00001 ||
            Math.abs(placed.width - (crop.maxX - crop.minX) * detailAxisScale(detail, 'x')) > .01 ||
            Math.abs(placed.height - (crop.maxY - crop.minY) * detailAxisScale(detail, 'y')) > .01) {
            setBuiltinError(`${detail.name} extends outside the editable body area. Its original placement has been kept.`);
            return;
          }
          setBuiltinError('');
          const next = { ...detail, id: crypto.randomUUID(), selected: true }; onChange([...details.filter(item => item.sourceLayerId !== detail.sourceLayerId), next]); onSelect(next.id);
        }}>
        Edit {detail.name}</button>)}
      {builtinError && <p role="status" className="text-xs text-amber-300">{builtinError}</p>}
    </div>}
    <div className="space-y-3">
      <div role="group" aria-label="Detail category" className="grid grid-cols-4 border-b border-white/15">
        {(['pocket', 'zip', 'button', 'hardware'] as const).map(type => <button key={type} type="button"
          aria-pressed={category === type} onClick={() => setCategory(type)}
          className={`min-w-0 border-b-2 px-1 py-2 text-xs ${category === type ? 'border-[#CC2D24] text-white' : 'border-transparent text-white/50 hover:text-white'}`}>
          {GARMENT_DETAIL_ASSETS[type].label}{type !== 'hardware' && 's'}
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
    <section aria-label="Patches" className="space-y-2 border-t border-white/15 pt-3">
      <h3 className="text-xs font-semibold text-white">Patches</h3>
      <button type="button" onClick={() => add('patch')} className="flex items-center gap-2 rounded border border-white/15 bg-white/5 px-3 py-2 text-xs text-white"><Plus size={14} />Add patch</button>
    </section>
    <div className="space-y-1" role="group" aria-label="Added details">
      {details.length === 0 && <p className="text-xs text-white/45">No details</p>}
      {(['pocket', 'zip', 'button', 'hardware', 'patch'] as const).map(type => {
        const items = details.filter(detail => !detail.hidden && detail.type === type);
        const heading = type === 'patch' ? 'Patches' : type === 'hardware' ? 'Hardware' : `${GARMENT_DETAIL_ASSETS[type].label}s`;
        return items.length > 0 && <section key={type} aria-label={`Added ${heading.toLowerCase()}`} className="space-y-1 pt-2">
          <h3 className="text-xs font-semibold text-white">{heading}</h3>
          {items.map(detail => <div key={detail.id} className="flex min-w-0 items-center gap-1 border-b border-white/10 py-1">
        <button type="button" aria-pressed={detail.id === selectedId} onClick={() => { if (type !== 'patch') setCategory(type); onSelect(detail.id); }}
          className={`min-w-0 flex-1 rounded px-2 py-2 text-left text-xs ${detail.id === selectedId ? 'bg-white/10 text-white' : 'text-white/60'}`}>
          {detail.name}{detail.variant && <span className="mt-0.5 block text-[10px] text-white/45">{detailAsset(detail).label}</span>}</button>
        <button type="button" title={`Duplicate ${detail.name}`} aria-label={`Duplicate ${detail.name}`} className="p-2 text-white/60 hover:text-white"
          onClick={() => { const identity = createGarmentDetail(detail.type, details, detail.fill);
            const next = { ...detail, id: identity.id, name: identity.name, sourceLayerId: undefined, arrangementId: undefined, selected: true, scale: detailScale(detail.scale), x: detail.x + .04, y: detail.y + .04 };
            onChange([...details, next]); onSelect(next.id); }}><Copy size={14} /></button>
        <button type="button" title={`Remove ${detail.name}`} aria-label={`Remove ${detail.name}`} className="p-2 text-white/60 hover:text-red-400"
          onClick={() => { onChange(detail.sourceLayerId ? details.map(item => item.id === detail.id ? { ...item, hidden: true, selected: false } : item) : details.filter(item => item.id !== detail.id)); if (selectedId === detail.id) onSelect(null); }}><Trash2 size={14} /></button>
        {onDuplicateToOtherView && <button type="button" title={copiedIds.includes(detail.id) ? 'Opposite-side copy already exists' : `Copy ${detail.name} to opposite side (${view === 'front' ? 'back' : 'front'})`}
          aria-label={`Copy ${detail.name} to opposite side`} disabled={copiedIds.includes(detail.id)} className="p-2 text-white/60 hover:text-white disabled:opacity-30"
          onClick={() => onDuplicateToOtherView(detail)}><CopyPlus size={14} /></button>}
      </div>)}
        </section>;
      })}
    </div>
    {selected && asset && <div className="space-y-4">
      <h3 className="text-xs font-semibold text-white">{selected.name}</h3>
      {selected.type === 'patch' && onMoveToView && <div role="group" aria-label="Patch side" className="flex gap-1">
        {(['front', 'back'] as const).map(side => <button key={side} type="button" aria-pressed={view === side} onClick={() => onMoveToView(selected, side)} className={`flex-1 rounded border border-white/15 py-2 text-xs capitalize text-white ${view === side ? 'bg-white/20' : ''}`}>{side}</button>)}
      </div>}
      {selected.type === 'patch' && !selected.customAsset && <PatchControls key={selected.id} detail={selected} onChange={update} />}
      {editor && <div className="flex flex-wrap items-center justify-between gap-2">
        {selected.type === 'zip' && !selected.customAsset && <div role="group" aria-label="Edit zip part" className="flex border-b border-white/15">
          {(['zip', 'pull'] as const).map(part => <button key={part} type="button" aria-pressed={editor.part === part} onClick={() => editor.onPartChange(part)}
            className={`border-b-2 px-3 py-2 text-xs ${editor.part === part ? 'border-[#CC2D24] text-white' : 'border-transparent text-white/50'}`}>{part === 'zip' ? 'Whole zip' : 'Pull'}</button>)}
        </div>}
        <div role="group" aria-label="Zip preview" className="hidden">
          {[{ closeUp: false, label: 'Full garment', icon: Maximize }, { closeUp: true, label: 'Close-up', icon: ZoomIn }].map(({ closeUp, label, icon: Icon }) =>
            <button key={label} type="button" title={label} aria-label={label} aria-pressed={editor.closeUp === closeUp} onClick={() => editor.onCloseUpChange(closeUp)}
              className={`flex h-9 w-9 items-center justify-center rounded border border-white/15 text-white ${editor.closeUp === closeUp ? 'bg-white/20' : ''}`}><Icon size={16} /></button>)}
        </div>
      </div>}
      {(selected.type !== 'zip' || editor?.part !== 'pull') && <>
      {bounds && Number.isFinite(referenceWidthCm) && referenceWidthCm! > 0
        ? <DetailPositionControls detail={selected} bounds={bounds} onChange={update} referenceWidthCm={referenceWidthCm!} unit={unit} />
        : <p role="status" className="text-xs text-amber-300">Set a positive size M chest width in Measurements to use physical trim dimensions.</p>}
      <label className="flex items-center gap-2 text-xs text-white/60">
        <input type="checkbox" checked={selected.lockProportions ?? false} onChange={event => update({ lockProportions: event.target.checked })} />
        Lock proportions
      </label>
      </>}
      {selected.type === 'zip' && !selected.customAsset && <div className="space-y-3 border-y border-white/15 py-3">
        {bounds && Number.isFinite(referenceWidthCm) && referenceWidthCm! > 0
          ? <ZipPullMeasurements detail={selected} bounds={bounds} onChange={update} referenceWidthCm={referenceWidthCm!} unit={unit} />
          : editor?.part === 'pull' && <p role="status" className="text-xs text-amber-300">Set a positive size M chest width in Measurements to use physical trim dimensions.</p>}
        {editor?.part !== 'pull' && <>
        <label className="flex items-center justify-between gap-2 text-xs text-white/60">Zip length
          <select aria-label="Zip length preset" value="" disabled={!bounds}
            onChange={event => { if (bounds && event.target.value) update(alignGarmentZip(selected, bounds, event.target.value as 'chest' | 'quarter' | 'half' | 'full')); }}
            className="min-w-0 max-w-[65%] rounded border border-white/15 bg-[#202023] p-2 text-white">
            <option value="">Custom</option><option value="chest">Short chest</option><option value="quarter">Long quarter</option><option value="half">Half length</option><option value="full">Full-body / centre-front</option>
          </select>
        </label>
        <button type="button" disabled={!bounds || Math.abs(Math.cos(detailRotation(selected) * Math.PI / 180)) < .001} onClick={() => { if (bounds) update(alignGarmentZip(selected, bounds, 'hem')); }}
          className="flex w-full items-center justify-center gap-2 rounded border border-white/15 p-2 text-xs text-white disabled:opacity-40"><ArrowDownToLine size={14} />Extend to hem</button>
        </>}
        <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-semibold text-white">Zip pull style</h4>
          <button type="button" title="Restore default pull" aria-label="Restore default pull" className="p-2 text-white/60 hover:text-white"
            onClick={() => update({ zipPullStyle: undefined, zipPullColor: undefined, zipPullScale: undefined })}><RotateCcw size={14} /></button></div>
        <div role="group" aria-label="Zip pull style" className="grid grid-cols-2 gap-2">
          {ZIP_PULL_STYLES.map(style => <button key={style.id} type="button" aria-label={style.label} title={style.label} aria-pressed={zipPullStyle(selected).id === style.id}
            onClick={() => update({ zipPullStyle: style.id })}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-md border p-2 text-[11px] leading-tight text-white ${zipPullStyle(selected).id === style.id ? 'border-[#CC2D24] bg-white/10' : 'border-white/15 bg-white/5 hover:border-white/40'}`}>
            <img alt="" src={`data:image/svg+xml,${encodeURIComponent(zipPullThumbnail(style.id))}`} className="h-20 w-full bg-white object-contain p-1" />
            <span className="flex min-h-7 items-center justify-center text-center">{style.label}</span></button>)}
        </div>
        <label className="flex items-center gap-3 text-xs text-white/60">Pull position
          <input className="min-w-0 flex-1 accent-[#CC2D24]" type="range" min="0" max="100" step="1" aria-label="Zip pull position"
            value={Math.round((selected.zipSliderPosition ?? (selected.variant === 'zip-05' ? .34 : 0)) * 100)}
            onChange={event => update({ zipSliderPosition: event.currentTarget.valueAsNumber / 100 })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-xs text-white/60">Pull orientation
          <select aria-label="Zip pull orientation" value={selected.zipPullSide ?? 'center'} onChange={event => update({ zipPullSide: event.target.value as GarmentDetail['zipPullSide'] })}
            className="rounded border border-white/15 bg-[#202023] p-2 text-white"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select>
        </label>
      </div>}
      {(selected.type !== 'patch' || selected.customAsset) && <section aria-label={selected.type === 'zip' ? 'Zip colours' : 'Detail colours'} className="space-y-4">
      {selected.type === 'zip' && <h4 className="text-xs font-semibold text-white">Zip colours</h4>}
      {(selected.type !== 'zip' || editor?.part !== 'pull') && <>
      <TrimColorFamilyPicker label={selected.type === 'zip' ? 'Tape colour' : `${selected.name} colour`} value={selected.fill} onChange={fill => update({ fill })} onClear={() => update({ fill: color })} />
      <TrimColorFamilyPicker label="Outline colour" value={selected.outline} onChange={outline => update({ outline })} onClear={() => update({ outline: '#141414' })} />
      {asset.stitch && <TrimColorFamilyPicker label="Stitch colour" value={selected.stitch} onChange={stitch => update({ stitch })} onClear={() => update({ stitch: '#707070' })} />}
      {asset.hardware && <TrimColorFamilyPicker label={selected.type === 'zip' ? 'Rails & stops colour' : 'Hardware colour'} value={selected.hardware}
        onChange={hardware => update(selected.type === 'zip' ? { hardware, zipPullColor: selected.zipPullColor ?? selected.hardware, zipSliderColor: selected.zipSliderColor ?? selected.hardware } : { hardware })}
        onClear={() => update(selected.type === 'zip' ? { hardware: '#D4D4D4', zipPullColor: selected.zipPullColor ?? selected.hardware, zipSliderColor: selected.zipSliderColor ?? selected.hardware } : { hardware: '#D4D4D4' })} />}
      {selected.type === 'zip' && !selected.customAsset && <TrimColorFamilyPicker label="Teeth colour" value={selected.zipTeethColor ?? selected.outline} onChange={zipTeethColor => update({ zipTeethColor })} onClear={() => update({ zipTeethColor: undefined })} />}
      </>}
      {selected.type === 'zip' && !selected.customAsset && <>
        <TrimColorFamilyPicker label="Slider colour" value={selected.zipSliderColor ?? selected.hardware} onChange={zipSliderColor => update({ zipSliderColor })} onClear={() => update({ zipSliderColor: undefined })} />
        <TrimColorFamilyPicker label="Pull colour" value={selected.zipPullColor ?? selected.hardware} onChange={zipPullColor => update({ zipPullColor })} onClear={() => update({ zipPullColor: undefined })} />
      </>}
      </section>}
    </div>}
  </div>;
}

export function GarmentDetailsOverlay({ details, bounds, selectedId, onSelect, onChange, view = 'front', editor, maskSource, screenMatrix }: {
  details: GarmentDetail[]; bounds: DetailBounds; selectedId?: string | null;
  view?: GarmentView;
  maskSource?: string;
  screenMatrix?: () => DOMMatrix;
  editor?: DetailEditorState;
  onSelect?: (id: string | null) => void; onChange?: (details: GarmentDetail[]) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ pointerId: number; startX: number; startY: number; origin: GarmentDetail;
    canvasScale: number; inverse?: DOMMatrix; corner?: { x: number; y: number }; pullAction?: 'move' | 'resize'; rotationCenter?: { x: number; y: number }; startAngle?: number } | null>(null);
  const [draft, setDraft] = useState<GarmentDetail | null>(null);
  const draftRef = useRef<GarmentDetail | null>(null);
  const [guides, setGuides] = useState<DetailGuide[]>([]);
  const editable = Boolean(onChange);
  const move = (event: PointerEvent<HTMLElement>) => {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const delta = active.inverse ? new DOMPoint(event.clientX, event.clientY).matrixTransform(active.inverse) : null;
    const dx = delta ? delta.x - active.startX : (event.clientX - active.startX) / active.canvasScale;
    const dy = delta ? delta.y - active.startY : (event.clientY - active.startY) / active.canvasScale;
    const result = active.pullAction ? { detail: adjustZipPull(active.origin, bounds, dx, dy, active.pullAction), guides: [] }
      : active.rotationCenter ? { detail: setDetailTransform(active.origin, bounds, { rotation: detailRotation(active.origin) +
        Math.atan2((delta?.y ?? event.clientY) - active.rotationCenter.y, (delta?.x ?? event.clientX) - active.rotationCenter.x) * 180 / Math.PI - active.startAngle! }), guides: [] }
      : detailGesture(active.origin, bounds, details, dx, dy, active.corner, (editor?.snap ?? true) && !event.altKey ? 6 / active.canvasScale : 0);
    draftRef.current = result.detail;
    setGuides(result.guides);
    setDraft(draftRef.current);
    editor?.onDraftChange?.(draftRef.current);
  };
  const start = (event: PointerEvent<HTMLElement | SVGElement>, detail: GarmentDetail, corner?: { x: number; y: number }, pullAction?: 'move' | 'resize', rotate = false) => {
    if (!editable || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); onSelect?.(detail.id);
    editor?.onPartChange(pullAction ? 'pull' : 'zip');
    const placement = detailPlacement(detail, bounds);
    const canvas = rootRef.current!.getBoundingClientRect();
    const inverse = screenMatrix?.().inverse();
    const startPoint = inverse ? new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse) : { x: event.clientX, y: event.clientY };
    const rotationCenter = rotate ? inverse ? { x: placement.left + placement.width / 2, y: placement.top + placement.height / 2 } : { x: canvas.left + (placement.left + placement.width / 2) / 2048 * canvas.width, y: canvas.top + (placement.top + placement.height / 2) / 2048 * canvas.height } : undefined;
    gesture.current = { pointerId: event.pointerId, startX: startPoint.x, startY: startPoint.y, inverse,
      origin: pullAction ? detail : { ...detail, x: placement.x, y: placement.y, scale: detailScale(detail.scale), selected: true },
      canvasScale: canvas.width / 2048, corner, pullAction, rotationCenter,
      startAngle: rotationCenter ? Math.atan2(startPoint.y - rotationCenter.y, startPoint.x - rotationCenter.x) * 180 / Math.PI : undefined };
    draftRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const cancel = () => { gesture.current = null; draftRef.current = null; setDraft(null); setGuides([]); editor?.onDraftChange?.(null); };
  return <div ref={rootRef} className="pointer-events-none absolute inset-0" style={{ zIndex: 240 }} data-garment-details={view}>
    {maskSource && <div className="pointer-events-none absolute inset-0" data-trim-artwork="" style={{ maskImage: `url("${maskSource}")`, maskSize: '100% 100%', maskMode: 'alpha' }}>
      {details.filter(detail => !detail.hidden).map(detail => {
        const current = draft?.id === detail.id ? draft : detail;
        const placement = detailPlacement(current, bounds);
        return <div key={detail.id} className="absolute" style={{ left: `${placement.left / 2048 * 100}%`, top: `${placement.top / 2048 * 100}%`, width: `${placement.width / 2048 * 100}%`, height: `${placement.height / 2048 * 100}%`, transform: `rotate(${detailRotation(current)}deg)` }}>
          <DetailArtwork detail={current} ratio={placement.width / placement.height} />
        </div>;
      })}
    </div>}
    {guides.length > 0 && <svg viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 5 }} aria-hidden="true" data-detail-guides="">
      {guides.map(guide => <line key={`${guide.axis}:${guide.value}`} x1={guide.axis === 'x' ? guide.value : bounds.minX} x2={guide.axis === 'x' ? guide.value : bounds.maxX}
        y1={guide.axis === 'y' ? guide.value : bounds.minY} y2={guide.axis === 'y' ? guide.value : bounds.maxY} stroke="#A76556" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />)}
    </svg>}
    {details.filter(detail => !detail.hidden).map(detail => {
      const current = draft?.id === detail.id ? draft : detail;
      const placement = detailPlacement(current, bounds);
      const selected = editable && selectedId === detail.id;
      const pullSelected = selected && detail.type === 'zip' && !detail.customAsset && editor?.part === 'pull';
      const sourceWidth = Number(new DOMParser().parseFromString(detailAsset(current).svg, 'image/svg+xml').documentElement.getAttribute('viewBox')?.split(/\s+/)[2]) || 48;
      const sourceHeight = sourceWidth * placement.height / placement.width;
      const hardware = zipHardwareGeometry(current, sourceWidth, sourceHeight);
      const pullScale = hardware.hardwareScale * zipPullScale(current);
      const sideways = detailRotation(current) % 180 !== 0;
      return <div key={detail.id} data-detail-id={detail.id} data-detail-variant={detail.variant} data-detail-scale={detailScale(current.scale)}
        data-detail-scale-x={detailAxisScale(current, 'x')} data-detail-scale-y={detailAxisScale(current, 'y')}
        className="pointer-events-none absolute"
        style={{ left: `${placement.left / 2048 * 100}%`, top: `${placement.top / 2048 * 100}%`, width: `${placement.width / 2048 * 100}%`, height: `${placement.height / 2048 * 100}%`,
          transform: `rotate(${detailRotation(current)}deg)`, zIndex: selected ? 1 : undefined }}
        onPointerMove={event => { event.stopPropagation(); move(event); }}
        onPointerUp={event => {
          if (gesture.current?.pointerId !== event.pointerId) return;
          event.stopPropagation(); move(event);
          const next = draftRef.current;
          if (next && (next.x !== detail.x || next.y !== detail.y || next.scale !== detailScale(detail.scale) || next.scaleX !== detail.scaleX || next.scaleY !== detail.scaleY || next.zipSliderPosition !== detail.zipSliderPosition || next.zipPullScale !== detail.zipPullScale || next.rotation !== detail.rotation)) {
            onChange?.(details.map(item => item.id === next.id ? next : { ...item, selected: false }));
          }
          cancel();
        }}
        onPointerCancel={cancel}>
        <button type="button" aria-label={`${detail.name} on garment`} aria-pressed={editable ? selected : undefined} tabIndex={editable ? 0 : -1}
        className={`absolute inset-0 h-full w-full touch-none bg-transparent p-0 ${editable ? 'pointer-events-auto cursor-move' : 'pointer-events-none'}`}
        style={{ outline: selected && !pullSelected ? '1px dashed #CC2D24' : undefined, outlineOffset: 6 }}
        onPointerDown={event => start(event, detail)}
        onClick={event => { event.stopPropagation(); if (editable) { onSelect?.(detail.id); editor?.onPartChange('zip'); } }}
        onKeyDown={event => {
          if (editable && (event.key === 'Delete' || event.key === 'Backspace')) {
            event.preventDefault(); event.stopPropagation(); onChange?.(detail.sourceLayerId ? details.map(item => item.id === detail.id ? { ...item, hidden: true, selected: false } : item) : details.filter(item => item.id !== detail.id)); onSelect?.(null); return;
          }
          if (!editable || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
          event.preventDefault(); event.stopPropagation();
          const increment = event.shiftKey ? 10 : 1;
          const next = { ...detail, x: placement.x + (event.key === 'ArrowLeft' ? -increment : event.key === 'ArrowRight' ? increment : 0) / (bounds.maxX - bounds.minX),
            y: placement.y + (event.key === 'ArrowUp' ? -increment : event.key === 'ArrowDown' ? increment : 0) / (bounds.maxY - bounds.minY) };
          const clamped = detailPlacement(next, bounds);
          onChange?.(details.map(item => item.id === detail.id ? { ...next, x: clamped.x, y: clamped.y } : item));
        }}>
        {!maskSource && <DetailArtwork detail={current} ratio={placement.width / placement.height} />}
        </button>
        {editable && detail.type === 'zip' && !detail.customAsset && editor && <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${sourceWidth} ${sourceHeight}`}>
          <g transform={`translate(${current.flipX ? sourceWidth : 0} ${current.flipY ? sourceHeight : 0}) scale(${current.flipX ? -1 : 1} ${current.flipY ? -1 : 1})`}>
            <g transform={`translate(${hardware.center} ${hardware.pullY}) rotate(${current.zipPullSide === 'left' ? 18 : current.zipPullSide === 'right' ? -18 : 0}) scale(${pullScale})`}>
              <rect role="button" tabIndex={0} aria-label={`Select ${detail.name} pull`} aria-pressed={pullSelected} x="-14" y="0" width="28" height={zipPullStyle(current).id === 'short' ? 22 : 50}
                fill="transparent" stroke={pullSelected ? '#CC2D24' : 'none'} strokeWidth=".6" strokeDasharray="2 2" className="pointer-events-auto touch-none cursor-move"
                onPointerDown={event => start(event, detail, undefined, 'move')} onClick={event => { event.stopPropagation(); onSelect?.(detail.id); editor.onPartChange('pull'); }}
                onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(detail.id); editor.onPartChange('pull'); }
                  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); const increment = event.shiftKey ? 40 : 8;
                    const next = adjustZipPull(detail, bounds, event.key === 'ArrowLeft' ? -increment : event.key === 'ArrowRight' ? increment : 0, event.key === 'ArrowUp' ? -increment : event.key === 'ArrowDown' ? increment : 0, 'move');
                    onChange?.(details.map(item => item.id === detail.id ? next : item)); } }} />
              {pullSelected && <rect role="button" tabIndex={0} aria-label={`Resize ${detail.name} pull`} x="10" y={zipPullStyle(current).id === 'short' ? 18 : 46} width="8" height="8" fill="white" stroke="#CC2D24" strokeWidth=".6"
                className="pointer-events-auto touch-none cursor-nwse-resize" onPointerDown={event => start(event, detail, undefined, 'resize')}
                onKeyDown={event => { if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); event.stopPropagation();
                  const next = { ...detail, zipPullScale: zipPullScale({ zipPullScale: zipPullScale(detail) + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -.05 : .05) }) };
                  onChange?.(details.map(item => item.id === detail.id ? next : item)); }} />}
            </g>
          </g>
        </svg>}
        {selected && !pullSelected && <button type="button" aria-label={`Rotate ${detail.name}`} title={`Rotate ${detail.name}`} className="pointer-events-auto absolute flex h-5 w-5 touch-none items-center justify-center rounded-full border border-[#CC2D24] bg-white text-[#CC2D24]"
          style={{ left: '50%', top: -38, transform: 'translateX(-50%)' }} onPointerDown={event => start(event, detail, undefined, undefined, true)}
          onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return; event.preventDefault(); event.stopPropagation();
            const next = setDetailTransform(detail, bounds, { rotation: detailRotation(detail) + (['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1) * (event.shiftKey ? 15 : 1) });
            onChange?.(details.map(item => item.id === detail.id ? next : item)); }}><RotateCw size={12} /></button>}
        {selected && !pullSelected && [
          { name: 'top left', x: -1, y: -1 }, { name: 'top right', x: 1, y: -1 },
          { name: 'bottom left', x: -1, y: 1 }, { name: 'bottom right', x: 1, y: 1 },
          { name: 'top center', x: 0, y: -1 }, { name: 'bottom center', x: 0, y: 1 },
          { name: 'left center', x: -1, y: 0 }, { name: 'right center', x: 1, y: 0 },
        ].map(corner => <button key={corner.name} type="button" aria-label={`Resize ${detail.name} ${corner.name}`} title={`Resize ${detail.name}`}
          className="pointer-events-auto absolute flex h-5 w-5 touch-none items-center justify-center bg-transparent p-0"
          style={{ left: !corner.x ? '50%' : corner.x < 0 ? -12 : 'calc(100% + 12px)', top: !corner.y ? '50%' : corner.y < 0 ? -12 : 'calc(100% + 12px)', transform: 'translate(-50%, -50%)',
            cursor: !corner.x ? (sideways ? 'ew-resize' : 'ns-resize') : !corner.y ? (sideways ? 'ns-resize' : 'ew-resize')
              : (corner.x === corner.y) !== sideways ? 'nwse-resize' : 'nesw-resize' }}
          onPointerDown={event => start(event, detail, corner)}
          onClick={event => event.stopPropagation()}
          onKeyDown={event => {
            if (!['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            const increment = event.shiftKey ? 40 : 8;
            const dx = event.key === 'ArrowLeft' ? -increment : event.key === 'ArrowRight' ? increment : 0;
            const dy = event.key === 'ArrowUp' ? -increment : event.key === 'ArrowDown' ? increment : 0;
            const next = resizeGarmentDetail(detail, bounds, corner.x, corner.y, dx, dy);
            onChange?.(details.map(item => item.id === detail.id ? next : item));
          }}><span className="h-2 w-2 border border-[#CC2D24] bg-white" /></button>)}
      </div>;
    })}
  </div>;
}