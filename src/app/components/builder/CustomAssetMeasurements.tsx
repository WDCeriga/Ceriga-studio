import { useEffect, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { detailPlacement, detailRotation, type GarmentDetail } from '../../data/garmentDetails';
import { isCustomCollarAssetId } from '../../data/garmentSvgCatalog';
import { getPotraceSvgBBox } from '../../lib/tshirtSvgUtils';
import { formatMeasurementDisplay, type MeasurementUnit } from '../../lib/measurements';
import { cn } from '../ui/utils';
import { MeasurementGuideOverlay, type MeasurementGuideDef } from './measurementGuides';
import { buildHoodieMeasurements, sampleMeasurementShape, type HoodieMeasurementSnapshot, type MeasurementPoint, type MeasurementSource } from './measurementGeometry';

export interface AssetMeasurement { id: string; name: string; view: 'front' | 'back'; corners: MeasurementPoint[]; width: number; height: number }
export interface AssetMeasurementSnapshot extends HoodieMeasurementSnapshot { assets: AssetMeasurement[] }

export function geometryMeasurementGuides(snapshot: HoodieMeasurementSnapshot): MeasurementGuideDef[] {
  const factor = 1000 / 2048;
  const guides = snapshot.measurements.map(measurement => {
    const left = ['bodyLength', 'hoodHeight', 'hoodBackToFrontLength', 'pocketHeight', 'waistbandHeight'].includes(measurement.id);
    const x1 = measurement.start.x * factor, y1 = measurement.start.y * factor;
    const x2 = measurement.end.x * factor, y2 = measurement.end.y * factor;
    const label = measurement.label.replace('Kangaroo ', '').replace(' opening width', ' opening').replace('Hood back-to-front length', 'Back to front');
    return { id: measurement.id, label, x1, y1, x2, y2,
      labelX: left ? 105 : 895, labelY: Math.max(24, Math.min(976, (y1 + y2) / 2)), labelAlign: 'center' as const,
      dimensionX: left ? Math.min(x1, x2) - 24 : undefined,
      dimensionY: measurement.id === 'waistbandWidth' ? Math.max(y1, y2) + 22 : undefined };
  });
  for (const lane of [105, 895]) {
    const ordered = guides.filter(guide => guide.labelX === lane).sort((first, second) => first.labelY - second.labelY);
    for (let index = 1; index < ordered.length; index++) ordered[index].labelY = Math.max(ordered[index].labelY, ordered[index - 1].labelY + 40);
    for (let index = ordered.length - 1; index >= 0; index--) ordered[index].labelY = Math.min(ordered[index].labelY, 975 - (ordered.length - 1 - index) * 40);
  }
  return guides;
}

export async function customAssetMeasurements(sources: MeasurementSource[], details: GarmentDetail[], snapshot: HoodieMeasurementSnapshot): Promise<AssetMeasurement[]> {
  if (snapshot.view === 'back') return [];
  const base = sources.find(source => source.id === 'base');
  if (!base) return [];
  const body = await sampleMeasurementShape(base.svgRaw);
  const matrix = new DOMMatrix(base.matrix);
  const cmPerUnit = snapshot.referenceWidthCm / ((body.maxX - body.minX) * Math.hypot(matrix.a, matrix.b));
  const asset = (id: string, name: string, source: MeasurementSource, corners: MeasurementPoint[]): AssetMeasurement => {
    const transform = new DOMMatrix(source.matrix);
    const mapped = corners.map(point => { const result = transform.transformPoint(point); return { x: result.x, y: result.y }; });
    return { id, name, corners: mapped, view: snapshot.view,
      width: Math.hypot(mapped[1].x - mapped[0].x, mapped[1].y - mapped[0].y) * cmPerUnit,
      height: Math.hypot(mapped[2].x - mapped[1].x, mapped[2].y - mapped[1].y) * cmPerUnit };
  };
  const rows = details.filter(detail => !detail.hidden && (detail.view ?? 'front') === snapshot.view).flatMap(detail => {
    const source = sources.find(candidate => candidate.id === (detail.attachment ?? 'base'));
    if (!source) return [];
    const bounds = getPotraceSvgBBox(source.svgRaw);
    if (!bounds) return [];
    const placement = detailPlacement(detail, bounds);
    const rotation = new DOMMatrix().translate(placement.left + placement.width / 2, placement.top + placement.height / 2).rotate(detailRotation(detail));
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([horizontal, vertical]) => {
      const point = rotation.transformPoint({ x: horizontal * placement.width / 2, y: vertical * placement.height / 2 });
      return { x: point.x, y: point.y };
    });
    return [asset(`detail:${snapshot.view}:${detail.id}`, detail.name, source, corners)];
  });
  for (const source of sources.filter(candidate => isCustomCollarAssetId(candidate.assetId))) {
    const bounds = await sampleMeasurementShape(source.svgRaw);
    rows.push(asset(`custom:${source.id}`, source.displayName ?? source.id, source, [
      { x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY },
      { x: bounds.maxX, y: bounds.maxY }, { x: bounds.minX, y: bounds.maxY },
    ]));
  }
  return rows;
}

export function CustomAssetMeasurementLayer({ sources, fit, view, referenceWidthCm, details = [], highlightedId, onHighlight, onMeasurementsChange }: {
  sources: MeasurementSource[]; fit: string; view: 'front' | 'back'; referenceWidthCm: number; details?: GarmentDetail[];
  highlightedId: string | null; onHighlight: (id: string | null) => void; onMeasurementsChange: (snapshot: AssetMeasurementSnapshot) => void;
}) {
  const [result, setResult] = useState<{ key: string; snapshot?: AssetMeasurementSnapshot; error?: string }>();
  const key = JSON.stringify({ sources, fit, view, referenceWidthCm, details });
  useEffect(() => {
    let active = true;
    onMeasurementsChange({ measurements: [], assets: [], referenceWidthCm, view });
    void buildHoodieMeasurements(sources, fit, view, referenceWidthCm).then(async snapshot => ({ ...snapshot, assets: await customAssetMeasurements(sources, details, snapshot) }))
      .then(snapshot => { if (active) { setResult({ key, snapshot }); onMeasurementsChange(snapshot); } })
      .catch(error => { if (active) setResult({ key, error: String(error) }); });
    return () => { active = false; };
  }, [key, onMeasurementsChange]);
  const snapshot = result?.key === key ? result.snapshot : undefined;
  if (result?.key === key && result.error) return <p role="alert" className="absolute bottom-0 text-xs text-red-300">Measurement geometry unavailable.</p>;
  if (!snapshot) return null;
  const selected = snapshot.assets.find(asset => asset.id === highlightedId);
  const guides = geometryMeasurementGuides(snapshot);
  if (selected) {
    for (const [index, label] of ['Width', 'Height'].entries()) {
      const first = selected.corners[index], last = selected.corners[index + 1];
      guides.push({ id: selected.id, label, x1: first.x / 2.048, y1: first.y / 2.048, x2: last.x / 2.048, y2: last.y / 2.048,
        labelX: 895, labelY: Math.max(24, Math.min(936, first.y / 2.048)) + index * 40, labelAlign: 'center' });
    }
  }
  return <div data-hoodie-measurements-ready={fit} className="pointer-events-none absolute inset-0" style={{ zIndex: 260 }}>
    <MeasurementGuideOverlay guides={guides} highlightedId={highlightedId} onHighlight={onHighlight} />
    <svg viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full" aria-label="Custom asset measurement guides">
      {snapshot.assets.map(asset => <polygon key={asset.id} data-asset-measurement={asset.id} points={asset.corners.map(point => `${point.x},${point.y}`).join(' ')}
        fill="transparent" stroke={asset.id === highlightedId ? '#FF3B30' : 'none'} strokeWidth={3} style={{ pointerEvents: 'all', cursor: 'pointer' }}
        role="button" tabIndex={0} aria-label={`Measure ${asset.name}`} onPointerEnter={() => onHighlight(asset.id)} onPointerLeave={() => onHighlight(null)}
        onFocus={() => onHighlight(asset.id)} onBlur={() => onHighlight(null)} onClick={() => onHighlight(asset.id)} />)}
    </svg>
  </div>;
}

export function CustomAssetMeasurements({ assets, unit, highlightedId, onHighlight }: {
  assets: AssetMeasurement[]; unit: MeasurementUnit; highlightedId: string | null; onHighlight: (id: string | null) => void;
}) {
  if (!assets.length) return null;
  return <section aria-label="Custom asset measurements" className="space-y-3 border-t border-white/10 pt-4">
    <h3 className="text-[10px] font-medium tracking-wider text-white/60">CUSTOM ASSET MEASUREMENTS</h3>
    {assets.map(asset => <div key={asset.id} data-asset-measurement-row={asset.id} onPointerEnter={() => onHighlight(asset.id)} onPointerLeave={() => onHighlight(null)}
      className={cn('min-w-0 rounded-md border p-3', highlightedId === asset.id ? 'border-[#FF3B30]/60 bg-[#FF3B30]/5' : 'border-white/10')}>
      <button type="button" className="flex w-full min-w-0 items-center gap-2 text-left text-xs text-white" onFocus={() => onHighlight(asset.id)} onBlur={() => onHighlight(null)} onClick={() => onHighlight(asset.id)}>
        <Crosshair size={14} className="shrink-0" /><span className="min-w-0 break-words">{asset.name}</span>
      </button>
      <dl className="mt-2 grid grid-cols-2 gap-3 text-[10px] text-white/70">
        <div><dt>Width</dt><dd>{formatMeasurementDisplay(String(asset.width), unit)} {unit}</dd></div>
        <div><dt>Height / length</dt><dd>{formatMeasurementDisplay(String(asset.height), unit)} {unit}</dd></div>
      </dl>
    </div>)}
  </section>;
}