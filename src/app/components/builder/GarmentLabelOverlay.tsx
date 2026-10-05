import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { isInteriorLabel, labelVisible, normalizeLabel, type GarmentLabel } from '../../data/garmentLabels';
import type { PotraceSvgBBox } from '../../lib/tshirtSvgUtils';
import { LabelArtwork } from './LabelArtwork';

export interface LabelAttachmentLayer {
  id: string;
  svgRaw: string;
  bbox: PotraceSvgBBox;
  matrix: string;
}
export interface LabelFocus { id: string; x: number; y: number; width: number; height: number; context?: { x: number; y: number; width: number; height: number } }
type Mask = { pixels: Uint8ClampedArray; size: number };
const neckAreas = new WeakMap<Mask, { minX: number; maxX: number; minY: number; maxY: number }>();
export function neckLabelArea(mask: Mask) {
  const cached = neckAreas.get(mask);
  if (cached) return cached;
  const heights = new Array<number>(mask.size).fill(0);
  let best = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
  let bestArea = 0;
  for (let row = 0; row < mask.size; row++) {
    const stack: number[] = [];
    for (let column = 0; column <= mask.size; column++) {
      const height = column === mask.size ? 0 : mask.pixels[(row * mask.size + column) * 4 + 3] > 180 ? heights[column] + 1 : 0;
      if (column < mask.size) heights[column] = height;
      while (stack.length && heights[stack[stack.length - 1]] > height) {
        const previous = stack.pop()!;
        const left = stack.length ? stack[stack.length - 1] + 1 : 0;
        const area = heights[previous] * (column - left);
        if (area > bestArea) {
          bestArea = area;
          best = { minX: left, maxX: column, minY: row + 1 - heights[previous], maxY: row + 1 };
        }
      }
      stack.push(column);
    }
  }
  const unit = 2048 / mask.size;
  const area = { minX: (best.minX + 2) * unit, maxX: (best.maxX - 2) * unit, minY: (best.minY + 2) * unit, maxY: (best.maxY - 2) * unit };
  neckAreas.set(mask, area);
  return area;
}

export function constrainNeckLabel(label: GarmentLabel, layers: LabelAttachmentLayer[], referenceWidthMm: number, maskById: Record<string, Mask>) {
  if (label.manualPosition !== undefined) return label;
  if (label.category !== 'neck' && !label.position.startsWith('neck-')) return label;
  const base = layers.find(layer => layer.id === 'base');
  const mask = maskById.innerBackNeck;
  if (!base || !mask) return label;
  const area = neckLabelArea(mask);
  const unit = (base.bbox.maxX - base.bbox.minX) / (referenceWidthMm > 0 ? referenceWidthMm : 500);
  const maxWidth = Math.max(0, Math.floor((area.maxX - area.minX) / unit * 10) / 10);
  const maxHeight = Math.max(0, Math.floor((area.maxY - area.minY) / unit * 10) / 10);
  if (!maxWidth || !maxHeight) return label;
  let widthMm = Math.min(label.widthMm, maxWidth);
  let heightMm = Math.min(label.heightMm, maxHeight);
  if (['circle', 'square'].includes(label.shape)) widthMm = heightMm = Math.min(widthMm, heightMm);
  const horizontalRoom = (maxWidth - widthMm) / 2;
  const shift = label.position === 'neck-left' ? -horizontalRoom : label.position === 'neck-right' ? horizontalRoom : 0;
  return { ...label, widthMm, heightMm, marginMm: Math.min(label.marginMm, widthMm / 3, heightMm / 3), rotation: 0,
    position: label.position === 'neck-outside' ? 'neck-inside' as const : label.position,
    offsetXmm: clamp(label.offsetXmm, -horizontalRoom - shift, horizontalRoom - shift),
    offsetYmm: clamp(label.offsetYmm, 0, maxHeight - heightMm) };
}
const masks = new Map<string, Promise<Mask>>();
export function labelAttachmentMask(raw: string): Promise<Mask> {
  const cached = masks.get(raw);
  if (cached) return cached;
  const promise = (async () => {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0, 512, 512);
    return { pixels: context.getImageData(0, 0, 512, 512).data, size: 512 };
  })();
  masks.set(raw, promise);
  if (masks.size > 40) masks.delete(masks.keys().next().value!);
  promise.catch(() => masks.delete(raw));
  return promise;
}
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
function boundary(mask: Mask | undefined, axis: 'x' | 'y', fixed: number, min: number, max: number, last: boolean) {
  if (!mask) return last ? max : min;
  const scale = mask.size / 2048;
  const fixedPixel = clamp(Math.round(fixed * scale), 0, mask.size - 1);
  const start = clamp(Math.ceil(min * scale), 0, mask.size - 1);
  const finish = clamp(Math.floor(max * scale), 0, mask.size - 1);
  for (let index = last ? finish : start; last ? index >= start : index <= finish; index += last ? -1 : 1) {
    const pixel = axis === 'y' ? index * mask.size + fixedPixel : fixedPixel * mask.size + index;
    if (mask.pixels[pixel * 4 + 3] > 180) return index / scale;
  }
  return last ? max : min;
}

export interface LabelPlacementBounds { minX: number; minY: number; maxX: number; maxY: number }

export function manualLabelPlacement(label: GarmentLabel, bounds: LabelPlacementBounds | undefined, referenceWidthMm: number) {
  if (label.category === 'hand' || !label.manualPosition || !bounds || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) return null;
  const unit = (bounds.maxX - bounds.minX) / (referenceWidthMm > 0 ? referenceWidthMm : 500);
  const width = label.widthMm * unit;
  const height = label.heightMm * unit;
  const x = bounds.minX + label.manualPosition.x * (bounds.maxX - bounds.minX);
  const y = bounds.minY + label.manualPosition.y * (bounds.maxY - bounds.minY);
  const matrix = new DOMMatrix().translate(x, y).rotate(label.rotation).translate(0, -height / 2);
  return { matrix, x: -width / 2, width, height, unit, center: new DOMPoint(x, y), layerId: 'manual' };
}

export function labelPlacement(label: GarmentLabel, layers: LabelAttachmentLayer[], referenceWidthMm: number, maskById: Record<string, Mask> = {}, manualBounds?: LabelPlacementBounds) {
  if (label.category === 'hand') return null;
  if (label.manualPosition !== undefined) return manualLabelPlacement(label, manualBounds ?? layers.find(layer => layer.id === 'base')?.bbox, referenceWidthMm);
  label = constrainNeckLabel(label, layers, referenceWidthMm, maskById);
  const base = layers.find(layer => layer.id === 'base');
  if (!base) return null;
  const body = base.bbox;
  const unit = (body.maxX - body.minX) / (referenceWidthMm > 0 ? referenceWidthMm : 500);
  const width = label.widthMm * unit;
  const height = label.heightMm * unit;
  let layer = base;
  let x = body.centerX;
  let y = body.centerY;
  let angle = label.rotation;
  const offsetX = label.offsetXmm * unit;
  const offsetY = label.offsetYmm * unit;
  if (label.category === 'neck' || label.position.startsWith('neck-')) {
    const inner = layers.find(entry => entry.id === 'innerBackNeck');
    if (!inner || !maskById.innerBackNeck) return null;
    layer = inner;
    const neck = neckLabelArea(maskById.innerBackNeck);
    if (neck.maxX <= neck.minX || neck.maxY <= neck.minY) return null;
    const centerX = (neck.minX + neck.maxX) / 2;
    const shift = label.position === 'neck-left' ? -(neck.maxX - neck.minX - width) / 2 : label.position === 'neck-right' ? (neck.maxX - neck.minX - width) / 2 : 0;
    x = clamp(centerX + shift + offsetX, neck.minX + width / 2, neck.maxX - width / 2);
    y = clamp(neck.minY + offsetY, neck.minY, neck.maxY - height);
  } else if (label.position.startsWith('sleeve-')) {
    const side = label.position.endsWith('left') ? 'Left' : 'Right';
    layer = layers.find(entry => entry.id === `${label.sleeveLayer === 'under' ? 'underSleeve' : 'sleeve'}${side}`) ?? layers.find(entry => entry.id === `sleeve${side}`) ?? base;
    const sleeve = layer.bbox;
    x = clamp(sleeve.centerX + offsetX, sleeve.minX + width / 2, sleeve.maxX - width / 2);
    y = boundary(maskById[layer.id], 'y', x, sleeve.minY, sleeve.maxY, true);
    const leftY = boundary(maskById[layer.id], 'y', x - 8, sleeve.minY, sleeve.maxY, true);
    const rightY = boundary(maskById[layer.id], 'y', x + 8, sleeve.minY, sleeve.maxY, true);
    angle += Math.atan2(rightY - leftY, 16) * 180 / Math.PI;
    y += clamp(offsetY, -2 * unit, 2 * unit);
    y -= height * .35;
  } else if (label.position.endsWith('hem') || label.position === 'hem') {
    x = clamp(body.centerX + offsetX, body.minX + width, body.maxX - width);
    y = boundary(maskById.base, 'y', x, body.centerY, body.maxY, true) - height * (isInteriorLabel(label) ? 1 : .35) + clamp(offsetY, -2 * unit, 2 * unit);
  } else {
    const right = label.position.endsWith('right');
    y = clamp(body.minY + (body.maxY - body.minY) * .65 + offsetY, body.centerY, body.maxY - height);
    const edge = boundary(maskById.base, 'x', y, body.minX, body.maxX, right);
    x = edge + (right ? -1 : 1) * (isInteriorLabel(label) ? width / 2 + unit : width * .15) + clamp(offsetX, -2 * unit, 2 * unit);
  }
  const matrix = new DOMMatrix(layer.matrix).translate(x, y).rotate(angle);
  const center = matrix.transformPoint(new DOMPoint(0, height / 2));
  return { matrix, x: -width / 2, width, height, unit, center, layerId: layer.id };
}

export function GarmentLabelOverlay({ labels, layers, view, interior = false, selectedId, onSelect, onChange, onFocus, referenceWidthMm = 500, manualPlacement = false, manualBounds }: {
  labels: GarmentLabel[]; layers: LabelAttachmentLayer[]; view: 'front' | 'back'; interior?: boolean;
  selectedId?: string | null; onSelect?: (id: string | null) => void; onChange?: (labels: GarmentLabel[]) => void;
  onFocus?: (point: LabelFocus) => void; referenceWidthMm?: number;
  manualPlacement?: boolean; manualBounds?: LabelPlacementBounds;
}) {
  const [maskById, setMaskById] = useState<Record<string, Mask>>({});
  const [draft, setDraft] = useState<GarmentLabel | null>(null);
  const draftRef = useRef<GarmentLabel | null>(null);
  const gesture = useRef<{ label: GarmentLabel; pointer: number; start: DOMPoint; inverse: DOMMatrix; unit: number; resize: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const layerKey = layers.map(layer => layer.svgRaw).join('|');
  useEffect(() => {
    if (manualPlacement) return;
    let active = true;
    void Promise.all(layers.map(async layer => [layer.id, await labelAttachmentMask(layer.svgRaw)] as const)).then(entries => { if (active) setMaskById(Object.fromEntries(entries)); }).catch(() => { if (active) setMaskById({}); });
    return () => { active = false; };
  }, [layerKey, manualPlacement]);
  useEffect(() => { gesture.current = null; draftRef.current = null; setDraft(null); }, [view, interior, layerKey]);
  useEffect(() => {
    if (gesture.current && gesture.current.label.id !== selectedId) { gesture.current = null; draftRef.current = null; setDraft(null); }
  }, [selectedId]);
  useEffect(() => {
    if (manualPlacement || !onChange || view !== 'front' || !maskById.innerBackNeck) return;
    const constrained = labels.map(label => constrainNeckLabel(label, layers, referenceWidthMm, maskById));
    if (constrained.some((label, index) => JSON.stringify(label) !== JSON.stringify(labels[index]))) onChange(constrained);
  }, [labels, layerKey, referenceWidthMm, maskById, view, onChange, manualPlacement]);
  const selected = labels.find(label => label.id === selectedId);
  const place = (label: GarmentLabel) => manualPlacement && label.manualPosition === undefined ? null : labelPlacement(label, layers, referenceWidthMm, maskById, manualBounds);
  const placement = selected && labelVisible(selected, view, interior) ? place(selected) : null;
  const corners = placement ? [[placement.x, 0], [placement.x + placement.width, 0], [placement.x, placement.height], [placement.x + placement.width, placement.height]].map(([x, y]) => placement.matrix.transformPoint(new DOMPoint(x, y))) : [];
  const contextLayers = manualPlacement || selected?.manualPosition !== undefined ? [] : selected?.category === 'neck' || selected?.position.startsWith('neck-')
    ? layers.filter(layer => ['neck', 'innerBackNeck'].includes(layer.id))
    : selected?.position.startsWith('sleeve-')
      ? layers.filter(layer => ['sleeve', 'underSleeve', 'sleeveHem', 'underSleeveHem'].some(prefix => layer.id === `${prefix}${selected.position.endsWith('left') ? 'Left' : 'Right'}`))
      : [];
  const contextCorners = contextLayers.length ? [...corners, ...contextLayers.flatMap(layer => {
    const matrix = new DOMMatrix(layer.matrix);
    const bounds = layer.bbox;
    return [[bounds.minX, bounds.minY], [bounds.maxX, bounds.minY], [bounds.minX, bounds.maxY], [bounds.maxX, bounds.maxY]].map(([x, y]) => matrix.transformPoint(new DOMPoint(x, y)));
  })] : [];
  const contextMinX = Math.min(...contextCorners.map(point => point.x));
  const contextMaxX = Math.max(...contextCorners.map(point => point.x));
  const contextMinY = Math.min(...contextCorners.map(point => point.y));
  const contextMaxY = Math.max(...contextCorners.map(point => point.y));
  const focused = placement && selected ? { id: selected.id, x: placement.center.x, y: placement.center.y,
    width: Math.max(...corners.map(point => point.x)) - Math.min(...corners.map(point => point.x)),
    height: Math.max(...corners.map(point => point.y)) - Math.min(...corners.map(point => point.y)),
    context: contextCorners.length ? { x: (contextMinX + contextMaxX) / 2, y: (contextMinY + contextMaxY) / 2, width: contextMaxX - contextMinX, height: contextMaxY - contextMinY } : undefined } : null;
  useEffect(() => { if (focused) onFocus?.(focused); }, [focused?.id, focused?.x, focused?.y, focused?.width, focused?.height, focused?.context?.x, focused?.context?.y, focused?.context?.width, focused?.context?.height, onFocus]);
  const start = (event: PointerEvent<SVGGElement | SVGRectElement>, label: GarmentLabel, placement: NonNullable<ReturnType<typeof labelPlacement>>, resize: boolean) => {
    if (!onChange || !svgRef.current || event.button !== 0) return;
    event.stopPropagation(); event.preventDefault(); onSelect?.(label.id);
    const matrix = svgRef.current.getScreenCTM(); if (!matrix) return;
    const inverse = new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]).multiply(placement.matrix).inverse();
    gesture.current = { label, pointer: event.pointerId, start: inverse.transformPoint(new DOMPoint(event.clientX, event.clientY)), inverse, unit: placement.unit, resize };
    draftRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<SVGSVGElement>) => {
    const active = gesture.current; if (!active || active.pointer !== event.pointerId) return;
    const point = active.inverse.transformPoint(new DOMPoint(event.clientX, event.clientY));
    const dx = (point.x - active.start.x) / active.unit;
    const dy = (point.y - active.start.y) / active.unit;
    const snap = (value: number) => Math.round(value * 10) / 10;
    const angle = active.label.rotation * Math.PI / 180;
    const manualOffset = active.label.manualPosition && manualBounds ? { manualPosition: {
      x: active.label.manualPosition.x + (dx * Math.cos(angle) - dy * Math.sin(angle)) * active.unit / (manualBounds.maxX - manualBounds.minX),
      y: active.label.manualPosition.y + (dx * Math.sin(angle) + dy * Math.cos(angle)) * active.unit / (manualBounds.maxY - manualBounds.minY),
    } } : { offsetXmm: snap(active.label.offsetXmm + dx), offsetYmm: snap(active.label.offsetYmm + dy) };
    draftRef.current = constrainNeckLabel(normalizeLabel({ ...active.label, ...(active.resize ? { widthMm: snap(active.label.widthMm + dx * 2), heightMm: snap(active.label.heightMm + dy) } : manualOffset) }), layers, referenceWidthMm, maskById);
    setDraft(draftRef.current);
  };
  const awaitingPlacement = selected && selected.category !== 'hand' && (manualPlacement || selected.manualPosition === null) && !selected.manualPosition && selected.exteriorView === view;
  const positionSelected = (x: number, y: number) => {
    if (!selected || selected.category === 'hand' || !manualBounds || !onChange) return;
    onChange(labels.map(label => label.id === selected.id ? normalizeLabel({ ...label, manualPosition: {
      x: (x - manualBounds.minX) / (manualBounds.maxX - manualBounds.minX),
      y: (y - manualBounds.minY) / (manualBounds.maxY - manualBounds.minY),
    } }) : label));
  };
  return <svg ref={svgRef} viewBox="0 0 2048 2048" className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 250 }} data-garment-label-overlay="" onPointerMove={move} onPointerUp={event => {
    if (gesture.current?.pointer !== event.pointerId) return;
    const committed = draftRef.current;
    if (committed) onChange?.(labels.map(label => label.id === committed.id ? committed : label));
    gesture.current = null; draftRef.current = null; setDraft(null);
  }} onPointerCancel={() => { gesture.current = null; draftRef.current = null; setDraft(null); }} onLostPointerCapture={() => { gesture.current = null; draftRef.current = null; setDraft(null); }}>
    {awaitingPlacement && manualBounds && onChange && <rect data-label-placement-target="" data-label-guide="" x={manualBounds.minX} y={manualBounds.minY} width={manualBounds.maxX - manualBounds.minX} height={manualBounds.maxY - manualBounds.minY} fill="transparent" style={{ pointerEvents: 'auto', cursor: 'crosshair' }} role="button" tabIndex={0} aria-label="Position selected label on garment; press Enter to place at center" onPointerDown={event => {
      if (event.button !== 0) return;
      event.stopPropagation(); event.preventDefault();
      const matrix = svgRef.current?.getScreenCTM(); if (!matrix) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      positionSelected(point.x, point.y);
    }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); positionSelected((manualBounds.minX + manualBounds.maxX) / 2, (manualBounds.minY + manualBounds.maxY) / 2); } }} />}
    {labels.filter(label => labelVisible(label, view, interior)).map(saved => {
      const label = constrainNeckLabel(draft?.id === saved.id ? draft : saved, layers, referenceWidthMm, maskById);
      const placement = place(label); if (!placement) return null;
      return <g key={label.id} transform={placement.matrix.toString()} data-garment-label={label.id} data-attachment-layer={placement.layerId}>
        <g transform={`translate(${placement.x} 0) scale(${placement.unit})`} onPointerDown={event => start(event, label, placement, false)} onClick={() => onSelect?.(label.id)} style={{ pointerEvents: onSelect ? 'auto' : 'none', touchAction: 'none', cursor: onChange ? 'move' : undefined }} role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined} aria-label={`Select ${label.brand || label.category} label`} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') onSelect?.(label.id); }}>
          <LabelArtwork label={label} guide={Boolean(onChange && selectedId === label.id)} />
          {onChange && <rect width={label.widthMm} height={label.heightMm} fill="transparent" />}
        </g>
        {onChange && selectedId === label.id && <g data-label-handle="" style={{ pointerEvents: 'auto', touchAction: 'none', cursor: 'nwse-resize' }} onPointerDown={event => start(event, label, placement, true)}>
          <title>Resize label</title>
          <rect x={placement.width / 2 - 7} y={placement.height - 7} width="14" height="14" fill="transparent" />
          <rect x={placement.width / 2 - 1.4} y={placement.height - 1.4} width="2.8" height="2.8" rx=".4" fill="white" stroke="#8f5551" strokeWidth=".8" vectorEffect="non-scaling-stroke" />
        </g>}
      </g>;
    })}
  </svg>;
}