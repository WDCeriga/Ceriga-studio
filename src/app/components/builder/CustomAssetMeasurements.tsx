import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Crosshair } from 'lucide-react';
import { arrangeGarmentDetails, detailPlacement, detailRotation, setDetailTransform, type DetailBounds, type GarmentDetail } from '../../data/garmentDetails';
import { isInteriorLabel, labelVisible, normalizeLabel, type GarmentLabel } from '../../data/garmentLabels';
import type { MeasurementUnit } from '../../lib/measurements';
import { Input } from '../ui/input';
import { cn } from '../ui/utils';
import type { DesignElement } from './PrintsDesignStep';
import { constrainNeckLabel, labelAttachmentMask, labelPlacement } from './GarmentLabelOverlay';
import { MeasurementGuideOverlay, type MeasurementGuideDef } from './measurementGuides';
import { buildGeometryGuides, measurementExtent, measurementHemAt, measurementSideClearance, sampleMeasurementShapes, type MeasurementPoint, type MeasurementShape, type MeasurementSource } from './measurementGeometry';

export interface AssetMeasurement {
  id: string;
  name: string;
  kind: string;
  view: 'front' | 'back';
  interior?: boolean;
  corners: MeasurementPoint[];
  width: number;
  height: number;
  rotation: number;
  center: MeasurementPoint;
  left: number;
  top: number;
  centerOffset: number;
  neckOffset?: number;
  hemClearance?: number;
  sideSeamClearance?: number;
  count?: number;
  spacing?: number;
  cmPerUnit: number;
  referenceWidthCm: number;
  bounds: DetailBounds;
  sourceId?: string;
  printCmPerPixel?: number;
  labelSizing?: { effective: GarmentLabel; maxWidthMm: number; maxHeightMm: number };
}

export interface AssetMeasurementSnapshot { view: 'front' | 'back'; assets: AssetMeasurement[] }
export type AssetDimension = 'width' | 'height' | 'diameter' | 'count' | 'spacing' | 'left' | 'top' | 'rotation';
type AssetState = { garmentDetails?: GarmentDetail[]; prints: DesignElement[]; garmentLabels?: GarmentLabel[] };

export function editAssetDimension(state: AssetState, asset: AssetMeasurement, field: AssetDimension, value: number): { changes?: Partial<AssetState>; error?: string } {
  const invalid = { error: 'That dimension does not fit here. Move the asset or use a smaller value.' };
  const positioning = field === 'left' || field === 'top' || field === 'rotation';
  if (!Number.isFinite(value) || !positioning && value <= 0) return { error: 'Enter a valid measurement.' };
  if (asset.id.startsWith('detail:')) {
    const details = state.garmentDetails ?? [];
    const detail = details.find(item => item.id === asset.sourceId && (item.view ?? 'front') === asset.view);
    if (!detail) return { error: 'Select this built-in trim in Trims & Details before resizing it.' };
    if (positioning) {
      if (detail.type !== 'patch' && detail.customAsset?.category !== 'pocket') return invalid;
      const normalized = value / asset.cmPerUnit / (field === 'left' ? asset.bounds.maxX - asset.bounds.minX : asset.bounds.maxY - asset.bounds.minY);
      const next = setDetailTransform(detail, asset.bounds, field === 'rotation' ? { rotation: value } : { [field === 'left' ? 'x' : 'y']: normalized });
      if (next === detail || field === 'left' && Math.abs(next.x - normalized) > .00001 || field === 'top' && Math.abs(next.y - normalized) > .00001) return invalid;
      return { changes: { garmentDetails: details.map(item => item.id === detail.id ? next : item) } };
    }
    if (field === 'count' || field === 'spacing') {
      if (detail.type !== 'button') return invalid;
      const members = detail.arrangementId ? details.filter(item => !item.hidden && item.arrangementId === detail.arrangementId && (item.view ?? 'front') === asset.view) : [detail];
      const axis = members.length > 1 && Math.abs(members[1].x - members[0].x) > Math.abs(members[1].y - members[0].y) ? 'x' : 'y';
      const span = axis === 'x' ? asset.bounds.maxX - asset.bounds.minX : asset.bounds.maxY - asset.bounds.minY;
      const count = field === 'count' ? value : members.length;
      if (count === 1) return { changes: { garmentDetails: details.filter(item => !members.slice(1).some(member => member.id === item.id)).map(item => item.id === members[0].id ? { ...item, arrangementId: undefined } : item) } };
      const spacing = (field === 'spacing' ? value : asset.spacing ?? asset.width * 1.5) / asset.cmPerUnit / span;
      const next = arrangeGarmentDetails(details, detail, asset.bounds, count, spacing, axis);
      return next === details ? { error: 'Use 1-12 buttons and spacing that fits on the garment.' } : { changes: { garmentDetails: next } };
    }
    const members = field === 'diameter' && detail.arrangementId ? details.filter(item => item.arrangementId === detail.arrangementId && (item.view ?? 'front') === asset.view) : [detail];
    const replacements = new Map<string, GarmentDetail>();
    for (const member of members) {
      const unlocked = { ...member, lockProportions: false };
      const units = value / asset.cmPerUnit;
      const next = setDetailTransform(unlocked, asset.bounds, field === 'diameter' ? { width: units, height: units } : { [field]: units });
      if (next === unlocked) return invalid;
      replacements.set(member.id, { ...next, lockProportions: member.lockProportions });
    }
    return { changes: { garmentDetails: details.map(item => replacements.get(item.id) ?? item) } };
  }
  if (asset.id.startsWith('print:') && (field === 'width' || field === 'height') && asset.printCmPerPixel) {
    const pixels = value / asset.printCmPerPixel;
    if (pixels < 1 || pixels > 4096) return { error: 'Print frames must be between 1 and 4096 design pixels.' };
    return { changes: { prints: state.prints.map(item => item.id === asset.sourceId && (item.view ?? 'front') === asset.view
      ? { ...item, [field]: pixels, ...(field === 'width' ? { autoWidth: false } : { autoHeight: false }) } : item) } };
  }
  if (asset.labelSizing && (field === 'width' || field === 'height')) {
    const { effective, maxWidthMm, maxHeightMm } = asset.labelSizing;
    const key = field === 'width' ? 'widthMm' : 'heightMm';
    const millimetres = effective[key] * value / asset[field];
    const square = ['circle', 'square'].includes(effective.shape);
    const next = normalizeLabel({ ...effective, [key]: millimetres, ...(square ? { widthMm: millimetres, heightMm: millimetres } : {}) });
    if (Math.abs(next[key] - millimetres) > .001 || next.widthMm > maxWidthMm || next.heightMm > maxHeightMm) return invalid;
    return { changes: { garmentLabels: state.garmentLabels?.map(item => item.id === asset.sourceId ? next : item) } };
  }
  return { error: 'This asset is no longer available.' };
}

export function assetMeasurement(id: string, name: string, kind: string, view: 'front' | 'back', corners: MeasurementPoint[], bounds: DetailBounds, shapes: MeasurementShape[], referenceWidthCm: number): AssetMeasurement {
  const center = { x: corners.reduce((sum, point) => sum + point.x, 0) / 4, y: corners.reduce((sum, point) => sum + point.y, 0) / 4 };
  const cmPerUnit = referenceWidthCm / (bounds.maxX - bounds.minX);
  const distance = (first: MeasurementPoint, second: MeasurementPoint) => Math.hypot(first.x - second.x, first.y - second.y);
  const hem = measurementHemAt(shapes, center.x * 1000 / 2048);
  const sideClearance = kind === 'patch' ? measurementSideClearance(shapes, corners.map(point => ({ x: point.x * 1000 / 2048, y: point.y * 1000 / 2048 }))) : undefined;
  const neck = buildGeometryGuides(shapes).find(guide => guide.id === 'neckDrop');
  return { id, name, kind, view, corners, center, cmPerUnit, referenceWidthCm, bounds,
    width: distance(corners[0], corners[1]) * cmPerUnit,
    height: distance(corners[1], corners[2]) * cmPerUnit,
    rotation: (Math.atan2(corners[1].y - corners[0].y, corners[1].x - corners[0].x) * 180 / Math.PI + 360) % 360,
    left: (center.x - bounds.minX) * cmPerUnit, top: (center.y - bounds.minY) * cmPerUnit,
    centerOffset: (center.x - (bounds.minX + bounds.maxX) / 2) * cmPerUnit,
    neckOffset: neck ? (center.y - neck.y2 * 2048 / 1000) * cmPerUnit : undefined,
    hemClearance: hem === undefined ? undefined : (hem * 2048 / 1000 - measurementExtent(corners).bottom) * cmPerUnit,
    sideSeamClearance: sideClearance === undefined ? undefined : sideClearance * 2048 / 1000 * cmPerUnit };
}

function rectangle(centerX: number, centerY: number, width: number, height: number, rotation: number) {
  const matrix = new DOMMatrix().translate(centerX, centerY).rotate(rotation);
  return [[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]]
    .map(([x, y]) => { const point = matrix.transformPoint({ x, y }); return { x: point.x, y: point.y }; });
}

export function detailMeasurements(details: GarmentDetail[], view: 'front' | 'back', bounds: DetailBounds, shapes: MeasurementShape[], referenceWidthCm: number) {
  const visible = details.filter(detail => (detail.view ?? 'front') === view && !detail.hidden);
  const rows = visible.map(detail => {
    const placement = detailPlacement(detail, bounds);
    return { ...assetMeasurement(`detail:${view}:${detail.id}`, detail.name, detail.customAsset ? `Custom ${detail.type}` : detail.catalogueAsset ? 'Catalogue asset' : detail.type, view,
      rectangle(placement.left + placement.width / 2, placement.top + placement.height / 2, placement.width, placement.height, detailRotation(detail)), bounds, shapes, referenceWidthCm), sourceId: detail.id };
  });
  return rows.map((row, index) => {
    const arrangement = visible[index].arrangementId;
    if (!arrangement) return row;
    const members = rows.filter((_, memberIndex) => visible[memberIndex].arrangementId === arrangement);
    const distances = members.filter(member => member.id !== row.id).map(member => Math.hypot(member.center.x - row.center.x, member.center.y - row.center.y) * row.cmPerUnit);
    return { ...row, count: members.length, spacing: distances.length ? Math.min(...distances) : undefined };
  });
}

export function printMeasurements(elements: DesignElement[], root: HTMLElement, view: 'front' | 'back', bounds: DetailBounds, shapes: MeasurementShape[], referenceWidthCm: number) {
  const zone = root.querySelector<HTMLElement>('[data-print-design-zone]');
  if (!zone?.parentElement?.clientWidth) return [];
  const unitsPerPixel = 2048 / zone.parentElement.clientWidth;
  return elements.filter(element => (element.view ?? 'front') === view).flatMap((element, index) => {
    const node = Array.from(zone.querySelectorAll<HTMLElement>('[data-print-id]')).find(candidate => candidate.dataset.printId === element.id);
    if (!node) return [];
    const corners = rectangle((zone.offsetLeft + node.offsetLeft) * unitsPerPixel, (zone.offsetTop + node.offsetTop) * unitsPerPixel,
      node.offsetWidth * unitsPerPixel, node.offsetHeight * unitsPerPixel, element.rotation);
    const row = assetMeasurement(`print:${view}:${element.id}`, `${view === 'front' ? 'Front' : 'Back'} ${element.type === 'text' ? 'Text' : 'Print'} ${index + 1}`, 'Print frame', view, corners, bounds, shapes, referenceWidthCm);
    return [{ ...row, sourceId: element.id, printCmPerPixel: unitsPerPixel * row.cmPerUnit }];
  });
}

export function CustomAssetMeasurementLayer({ sources, bounds, details = [], labels = [], prints = [], referenceWidthCm = 50, unit = 'cm', view, selectedId, highlightedId, onSelect, onMeasurementsChange }: {
  sources: MeasurementSource[]; bounds?: DetailBounds; details?: GarmentDetail[]; labels?: GarmentLabel[]; prints?: DesignElement[];
  referenceWidthCm?: number; unit?: MeasurementUnit; view: 'front' | 'back'; selectedId?: string | null; highlightedId?: string | null;
  onSelect?: (id: string | null) => void; onMeasurementsChange?: (snapshot: AssetMeasurementSnapshot) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [overlayTarget, setOverlayTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setOverlayTarget(svgRef.current?.closest<HTMLElement>('[data-print-garment-backdrop]')?.parentElement ?? null); }, []);
  const [snapshot, setSnapshot] = useState<AssetMeasurementSnapshot>({ view, assets: [] });
  const assets = snapshot.view === view ? snapshot.assets : [];
  const shapes = sampleMeasurementShapes(sources);
  const guides = buildGeometryGuides(shapes);
  const inputKey = JSON.stringify({ sources, bounds, details, labels, prints, referenceWidthCm, view });
  useEffect(() => {
    const root = svgRef.current?.closest<HTMLElement>('[data-measurement-preview]');
    if (!bounds || !root) { setSnapshot({ view, assets: [] }); return; }
    let active = true;
    let masks: Record<string, Awaited<ReturnType<typeof labelAttachmentMask>>> = {};
    const update = () => {
      if (!active) return;
      const detailRows = detailMeasurements(details, view, bounds, shapes, referenceWidthCm);
      const catalogueRows = sources.filter(source => source.assetName).map(source => {
        const matrix = new DOMMatrix(source.matrix);
        const { minX, maxX, minY, maxY } = source.bbox;
        const corners = [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]].map(([x, y]) => {
          const point = matrix.transformPoint({ x, y }); return { x: point.x, y: point.y };
        });
        return assetMeasurement(`detail:${view}:builtin-${view}-${source.id}`, source.assetName!, 'Catalogue asset', view, corners, bounds, shapes, referenceWidthCm);
      });
      const printRows = printMeasurements(prints, root, view, bounds, shapes, referenceWidthCm);
      const labelRows = labels.filter(label => labelVisible(label, view, true) || labelVisible(label, view, false)).flatMap(label => {
        const placement = labelPlacement(label, sources, referenceWidthCm * 10, masks);
        if (!placement) return [];
        const corners = [[placement.x, 0], [placement.x + placement.width, 0], [placement.x + placement.width, placement.height], [placement.x, placement.height]].map(([x, y]) => {
          const point = placement.matrix.transformPoint({ x, y }); return { x: point.x, y: point.y };
        });
        const effective = constrainNeckLabel(normalizeLabel(label), sources, referenceWidthCm * 10, masks);
        const maximum = constrainNeckLabel({ ...effective, widthMm: 150, heightMm: 250 }, sources, referenceWidthCm * 10, masks);
        return [{ ...assetMeasurement(`label:${view}:${label.id}`, label.brand || `${label.category} label`, label.construction === 'printed' ? 'Printed label' : 'Label', view, corners, bounds, shapes, referenceWidthCm), interior: isInteriorLabel(label), sourceId: label.id,
          labelSizing: { effective, maxWidthMm: maximum.widthMm, maxHeightMm: maximum.heightMm } }];
      });
      const next = { view, assets: [...detailRows, ...catalogueRows, ...printRows, ...labelRows] };
      setSnapshot(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    update();
    void Promise.all(sources.map(async source => [source.id, await labelAttachmentMask(source.svgRaw)] as const)).then(entries => { masks = Object.fromEntries(entries); update(); }).catch(() => {});
    const observer = new ResizeObserver(update);
    observer.observe(root);
    root.querySelectorAll<HTMLElement>('[data-print-id], [data-print-design-zone]').forEach(node => observer.observe(node));
    void document.fonts.ready.then(update);
    return () => { active = false; observer.disconnect(); };
  }, [inputKey]);
  const snapshotKey = JSON.stringify({ view, assets });
  useEffect(() => { onMeasurementsChange?.({ view, assets }); }, [snapshotKey, onMeasurementsChange]);
  const selected = assets.find(asset => asset.id === selectedId);
  const selectedBounds = selected ? measurementExtent(selected.corners) : undefined;
  const dimension = (value: number) => `${(unit === 'in' ? value / 2.54 : value).toFixed(1)} ${unit}`;
  const dimensionGuides: MeasurementGuideDef[] = selected ? [
    { id: 'chestWidth', label: `Width ${dimension(selected.width)}`, x1: selected.corners[0].x, y1: selected.corners[0].y, x2: selected.corners[1].x, y2: selected.corners[1].y, labelX: selected.center.x, labelY: selectedBounds!.top - 35, labelAlign: 'center' },
    { id: 'halfLength', label: `Height ${dimension(selected.height)}`, x1: selected.corners[1].x, y1: selected.corners[1].y, x2: selected.corners[2].x, y2: selected.corners[2].y, labelX: selectedBounds!.right + 160, labelY: selected.center.y, labelAlign: 'center' },
  ].map(guide => ({ ...guide, x1: guide.x1 * 1000 / 2048, y1: guide.y1 * 1000 / 2048, x2: guide.x2 * 1000 / 2048, y2: guide.y2 * 1000 / 2048,
    labelX: Math.max(95, Math.min(905, guide.labelX * 1000 / 2048)), labelY: Math.max(20, Math.min(980, guide.labelY * 1000 / 2048)) })) as MeasurementGuideDef[] : [];
  const overlay = <>
    <MeasurementGuideOverlay guides={guides} view={view} highlightedId={highlightedId || (selected ? selected.id : null)} />
    <svg ref={svgRef} viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 260 }} aria-label="Custom asset measurement guides">
      {assets.filter(asset => !asset.interior || selected?.interior).map(asset => <polygon key={asset.id} data-asset-measurement={asset.id} points={asset.corners.map(point => `${point.x},${point.y}`).join(' ')}
        fill={selectedId === asset.id ? '#FF3B3015' : 'transparent'} stroke={selectedId === asset.id ? '#FF3B30' : 'none'} strokeWidth={3}
        style={{ pointerEvents: 'all', cursor: 'pointer' }} role="button" tabIndex={0} aria-label={`Measure ${asset.name}`} aria-pressed={selectedId === asset.id}
        onClick={event => { event.stopPropagation(); onSelect?.(selectedId === asset.id ? null : asset.id); }}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect?.(asset.id); } }} />)}
      {selected && bounds && <path d={`M${(bounds.minX + bounds.maxX) / 2},${selected.center.y}H${selected.center.x}V${bounds.minY}`}
        fill="none" stroke="#FF3B30" strokeWidth={2} strokeDasharray="8 5" />}
    </svg>
    {selected && <div className="pointer-events-none absolute inset-0" style={{ zIndex: 261, opacity: highlightedId ? .3 : 1 }}><MeasurementGuideOverlay guides={dimensionGuides} highlightedId={null} /></div>}
  </>;
  return overlayTarget ? createPortal(overlay, overlayTarget) : overlay;
}

function AssetDimensionInput({ asset, field, label, unit, onEdit }: { asset: AssetMeasurement; field: AssetDimension; label: string; unit: MeasurementUnit; onEdit: (asset: AssetMeasurement, field: AssetDimension, value: number) => string | undefined }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const value = field === 'diameter' ? asset.width : field === 'count' ? asset.count ?? 1 : asset[field] ?? asset.width * 1.5;
  const factor = field === 'count' || field === 'rotation' || unit === 'cm' ? 1 : 2.54;
  const suffix = field === 'rotation' ? 'deg' : unit;
  const commit = () => {
    if (draft === null) return;
    setError(draft.trim() === '' ? 'Enter a value.' : onEdit(asset, field, Number(draft) * factor) ?? '');
    setDraft(null);
  };
  return <label className="min-w-0 text-[10px] text-white/50">{label}{field !== 'count' && ` (${suffix})`}
    <Input type="number" min={field === 'rotation' ? undefined : field === 'left' || field === 'top' ? 0 : field === 'count' ? 1 : .001} max={field === 'count' ? 12 : undefined} step={field === 'count' || field === 'rotation' ? 1 : .01}
      aria-label={`${asset.name} ${label} (${field === 'count' ? 'count' : suffix})`} value={draft ?? Number((value / factor).toFixed(4))}
      onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(null); setError(''); } }}
      className="mt-1 h-8 border-white/15 bg-white/5 text-[11px] text-white" />
    {error && <span role="status" className="mt-1 block text-amber-300">{error}</span>}
  </label>;
}

export function CustomAssetMeasurements({ assets, unit, selectedId, onSelect, onEdit, view }: {
  assets: AssetMeasurement[]; unit: MeasurementUnit; selectedId: string | null; onSelect: (id: string | null) => void;
  onEdit: (asset: AssetMeasurement, field: AssetDimension, value: number) => string | undefined; view: 'front' | 'back';
}) {
  const display = (value: number | undefined) => value === undefined ? 'Not available' : `${(unit === 'in' ? value / 2.54 : value).toFixed(2)} ${unit}`;
  if (!assets.length) return null;
  return <section aria-label="Custom asset measurements" className="space-y-3 border-t border-white/10 pt-4">
    <h3 className="text-[10px] font-medium tracking-wider text-white/60">CUSTOM ASSET MEASUREMENTS</h3>
    <div className="text-[10px] capitalize text-white/50">{view} | Drawing reference: body width {display(assets[0].referenceWidthCm)}</div>
    {assets.map(asset => <div key={asset.id} data-asset-measurement-row={asset.id} className={cn('min-w-0 rounded-md border p-3', selectedId === asset.id ? 'border-[#FF3B30]/60 bg-[#FF3B30]/5' : 'border-white/10')}>
      <button type="button" className="flex w-full min-w-0 items-center gap-2 text-left text-xs text-white" onClick={() => onSelect(selectedId === asset.id ? null : asset.id)} aria-pressed={selectedId === asset.id}>
        <Crosshair size={14} className="shrink-0" /><span className="min-w-0 break-words">{asset.name}</span>
      </button>
      <p className="mt-1 break-words text-[10px] text-white/45">{asset.kind} | {asset.view}{asset.interior ? ' | Interior' : ''}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        {(asset.kind === 'button' ? [['diameter', 'Diameter'], ['count', 'Number of buttons'], ...(asset.count ? [['spacing', 'Centre spacing']] : [])] : [['width', 'Width'], ['height', asset.kind === 'zip' ? 'Length' : 'Height']]).map(([field, label]) =>
          <AssetDimensionInput key={`${field}-${unit}`} asset={asset} field={field as AssetDimension} label={label} unit={unit} onEdit={onEdit} />)}
        {(asset.kind === 'patch' || asset.kind === 'Custom pocket') && ([['left', 'X centre from body left'], ['top', 'Y centre from body top'], ['rotation', 'Rotation']] as const).map(([field, label]) =>
          <AssetDimensionInput key={`${field}-${unit}`} asset={asset} field={field} label={label} unit={unit} onEdit={onEdit} />)}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
        {Object.entries(asset.kind === 'patch' ? { 'Hem clearance': display(asset.hemClearance), 'Nearest side seam (outline)': display(asset.sideSeamClearance) } : { 'Centre from body left': display(asset.left), 'Centre from body top': display(asset.top), 'Centre-line offset (+ right)': display(asset.centerOffset), 'Centre below neck opening': display(asset.neckOffset), 'Hem clearance': display(asset.hemClearance), Rotation: `${asset.rotation.toFixed(1)} deg` }).map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-white/45">{label}</dt><dd className="break-words tabular-nums text-white/85">{value}</dd></div>)}
      </dl>
    </div>)}
  </section>;
}