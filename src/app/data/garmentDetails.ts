import pocketSvg from '../../assets/garment-details/patch-pocket.svg?raw';
import zipSvg from '../../assets/garment-details/short-front-zip.svg?raw';
import buttonSvg from '../../assets/garment-details/four-hole-button.svg?raw';
import type { GarmentView } from './garmentView';
import { getGarmentAsset } from './garmentSvgCatalog';
import { tintPotraceSvg } from '../lib/tshirtSvgUtils';

export const GARMENT_DETAIL_ASSETS = {
  pocket: { label: 'Pocket', svg: pocketSvg, width: .2, ratio: 200 / 220, x: .72, y: .4, stitch: true, hardware: false },
  zip: { label: 'Zip', svg: zipSvg, width: .055, ratio: 48 / 240, x: .5, y: .31, stitch: true, hardware: true },
  button: { label: 'Button', svg: buttonSvg, width: .06, ratio: 1, x: .5, y: .43, stitch: false, hardware: false },
} as const;

export type GarmentDetailType = keyof typeof GARMENT_DETAIL_ASSETS;

const variantSvgs = import.meta.glob<string>('../../assets/garment-details/*/*.svg', { eager: true, query: '?raw', import: 'default' });
export const GARMENT_DETAIL_OPTIONS = {
  button: [
    { id: 'button-01', label: 'Two-hole rim', stitch: false, hardware: false },
    { id: 'button-02', label: 'Four-hole rim', stitch: false, hardware: false },
    { id: 'button-03', label: 'Flat four-hole', stitch: false, hardware: false },
    { id: 'button-04', label: 'Recessed four-hole', stitch: false, hardware: false },
    { id: 'button-05', label: 'Cross stitch', stitch: true, hardware: false },
  ],
  zip: [
    { id: 'zip-01', label: 'Classic pull', stitch: true, hardware: true },
    { id: 'zip-02', label: 'Slim pull', stitch: true, hardware: true },
    { id: 'zip-03', label: 'Ring pull', stitch: true, hardware: true },
    { id: 'zip-04', label: 'Framed welt', stitch: true, hardware: true, width: .0825, ratio: 72 / 240 },
    { id: 'zip-05', label: 'Open zip', stitch: true, hardware: true, width: .0733333333, ratio: 64 / 240 },
  ],
  pocket: [
    { id: 'pocket-01', label: 'Rounded patch', stitch: true, hardware: false },
    { id: 'pocket-02', label: 'Square patch', stitch: true, hardware: false },
    { id: 'pocket-03', label: 'Pointed patch', stitch: true, hardware: false },
    { id: 'pocket-04', label: 'Envelope flap', stitch: true, hardware: true },
    { id: 'pocket-05', label: 'Divided patch', stitch: true, hardware: true },
  ],
} as const;

export type GarmentDetailVariant = typeof GARMENT_DETAIL_OPTIONS[GarmentDetailType][number]['id'];

export const ZIP_PULL_STYLES = [
  { id: 'standard', label: 'Standard rectangular', path: 'M-6 0H6V36H-6Z M-2 6H2V27H-2Z' },
  { id: 'rounded', label: 'Rounded rectangular', path: 'M-6 0H6V31Q0 39 -6 31Z M-2 6H2V27H-2Z' },
  { id: 'oval', label: 'Oval cut-out', path: 'M0 0C9 0 11 14 11 23C11 42 -11 42 -11 23C-11 14 -9 0 0 0Z M7 26A7 7 0 1 0 -7 26A7 7 0 1 0 7 26Z M-2 4H2V10H-2Z' },
  { id: 'teardrop', label: 'Teardrop', path: 'M0 0C4 0 12 18 12 27C12 44 -12 44 -12 27C-12 18 -4 0 0 0Z M7 29A7 7 0 1 0 -7 29A7 7 0 1 0 7 29Z M-2 5H2V11H-2Z' },
  { id: 'slim', label: 'Slim elongated', path: 'M-4 0H4V43L0 49L-4 43Z M-1 7H1V36H-1Z' },
  { id: 'wide', label: 'Wide tab', path: 'M-5 0H5L11 34Q0 38 -11 34Z M-2 5H2V12H-2Z M-6 27H6V31H-6Z' },
  { id: 'ring', label: 'Ring', path: 'M0 0V7M9 21A9 14 0 1 1 -9 21A9 14 0 1 1 9 21Z M5 21A5 9 0 1 0 -5 21A5 9 0 1 0 5 21Z' },
  { id: 'short', label: 'Minimal short', path: 'M-5 0H5V16Q5 20 0 20Q-5 20 -5 16Z M-2 5H2V13H-2Z' },
] as const;
export type ZipPullStyle = typeof ZIP_PULL_STYLES[number]['id'];

export function zipPullStyle(detail: Pick<GarmentDetail, 'variant' | 'zipPullStyle'>) {
  const fallback = detail.variant === 'zip-03' ? 'ring' : detail.variant === 'zip-02' ? 'slim' : 'rounded';
  return ZIP_PULL_STYLES.find(style => style.id === detail.zipPullStyle) ?? ZIP_PULL_STYLES.find(style => style.id === fallback)!;
}

export function zipPullScale(detail: Pick<GarmentDetail, 'zipPullScale'>) {
  return Number.isFinite(detail.zipPullScale) ? Math.max(.5, Math.min(1.25, detail.zipPullScale!)) : 1;
}

export function zipPullThumbnail(style: ZipPullStyle) {
  const shape = ZIP_PULL_STYLES.find(option => option.id === style) ?? ZIP_PULL_STYLES[0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-22 -5 44 60"><path d="${shape.path}" fill="#D4D4D4" fill-rule="evenodd" stroke="#141414" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}

export function detailAsset(detail: Pick<GarmentDetail, 'type' | 'variant' | 'catalogueAsset'>) {
  if (detail.catalogueAsset) {
    const descriptor = detail.catalogueAsset;
    const source = getGarmentAsset(descriptor.id);
    if (source) return { ...GARMENT_DETAIL_ASSETS.pocket, label: source.displayName, svg: source.svgRaw, width: descriptor.width, ratio: descriptor.ratio };
  }
  const base = GARMENT_DETAIL_ASSETS[detail.type];
  const option = GARMENT_DETAIL_OPTIONS[detail.type].find(option => option.id === detail.variant);
  if (!option) return base;
  const svg = variantSvgs[`../../assets/garment-details/${detail.type}s/${option.id}.svg`];
  return { ...base, ...option, svg: svg ?? base.svg };
}

export interface GarmentDetail {
  id: string;
  view?: GarmentView;
  type: GarmentDetailType;
  variant?: GarmentDetailVariant;
  name: string;
  x: number;
  y: number;
  scale: number;
  scaleX?: number;
  scaleY?: number;
  lockProportions?: boolean;
  zipSliderPosition?: number;
  zipPullSide?: 'left' | 'center' | 'right';
  zipPullStyle?: ZipPullStyle;
  zipPullColor?: string;
  zipPullScale?: number;
  zipSliderColor?: string;
  zipSliderScale?: number;
  zipTeethColor?: string;
  zipHardwareScale?: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  copiedFromId?: string;
  catalogueAsset?: { id: string; width: number; ratio: number; crop: DetailBounds };
  sourceLayerId?: string;
  hidden?: boolean;
  arrangementId?: string;
  selected: boolean;
  fill: string;
  outline: string;
  stitch: string;
  hardware: string;
}

export interface DetailBounds { minX: number; minY: number; maxX: number; maxY: number; necklineY?: number }

export function createGarmentDetail(type: GarmentDetailType, details: GarmentDetail[], fill: string, variant?: GarmentDetailVariant): GarmentDetail {
  const asset = GARMENT_DETAIL_ASSETS[type];
  let number = 1;
  while (details.some(detail => detail.name === `${asset.label} ${number}`)) number++;
  return { id: crypto.randomUUID(), type, variant, name: `${asset.label} ${number}`, x: asset.x, y: asset.y,
    scale: 1, lockProportions: type === 'button', selected: true, fill, outline: '#141414', stitch: '#707070', hardware: '#D4D4D4' };
}

export function detailScale(scale = 1) {
  return Math.max(.2, Math.min(4, Number.isFinite(scale) ? scale : 1));
}

export function detailAxisScale(detail: GarmentDetail, axis: 'x' | 'y') {
  const value = axis === 'x' ? detail.scaleX : detail.scaleY;
  return value !== undefined && Number.isFinite(value) ? Math.max(.2, Math.min(20, value)) : detailScale(detail.scale);
}

export function detailRotation(detail: GarmentDetail) {
  return Number.isFinite(detail.rotation) ? ((detail.rotation! % 360) + 360) % 360 : 0;
}

export function detailPlacement(detail: GarmentDetail, bounds: DetailBounds) {
  const asset = detailAsset(detail);
  const bodyWidth = bounds.maxX - bounds.minX;
  const bodyHeight = bounds.maxY - bounds.minY;
  const baseWidth = bodyWidth * asset.width;
  const radians = detailRotation(detail) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  let width = Math.min(cosine * bodyWidth + sine * bodyHeight, Math.max(12, baseWidth * detailAxisScale(detail, 'x')));
  let height = Math.min(sine * bodyWidth + cosine * bodyHeight, Math.max(12, baseWidth / asset.ratio * detailAxisScale(detail, 'y')));
  const fit = Math.min(1, bodyWidth / (cosine * width + sine * height), bodyHeight / (sine * width + cosine * height));
  width *= fit; height *= fit;
  const extentX = cosine * width + sine * height;
  const extentY = sine * width + cosine * height;
  const x = Math.max(extentX / 2 / bodyWidth, Math.min(1 - extentX / 2 / bodyWidth, Number.isFinite(detail.x) ? detail.x : asset.x));
  const y = Math.max(extentY / 2 / bodyHeight, Math.min(1 - extentY / 2 / bodyHeight, Number.isFinite(detail.y) ? detail.y : asset.y));
  return { x, y, width, height, left: bounds.minX + x * bodyWidth - width / 2,
    top: bounds.minY + y * bodyHeight - height / 2 };
}

export function resizeGarmentDetail(detail: GarmentDetail, bounds: DetailBounds, cornerX: number, cornerY: number, dx: number, dy: number): GarmentDetail {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!cornerX && !cornerY)) return detail;
  const placement = detailPlacement(detail, bounds);
  const bodyWidth = bounds.maxX - bounds.minX;
  const bodyHeight = bounds.maxY - bounds.minY;
  const asset = detailAsset(detail);
  const baseWidth = bodyWidth * asset.width;
  const baseHeight = baseWidth / asset.ratio;
  const centerX = placement.left + placement.width / 2;
  const centerY = placement.top + placement.height / 2;
  const radians = detailRotation(detail) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const localDx = dx * cosine + dy * sine;
  const localDy = -dx * sine + dy * cosine;
  const corners = [[bounds.minX, bounds.minY], [bounds.maxX, bounds.minY], [bounds.maxX, bounds.maxY], [bounds.minX, bounds.maxY]]
    .map(([pointX, pointY]) => ({ x: (pointX - centerX) * cosine + (pointY - centerY) * sine,
      y: -(pointX - centerX) * sine + (pointY - centerY) * cosine }));
  const left = Math.min(...corners.map(point => point.x));
  const right = Math.max(...corners.map(point => point.x));
  const top = Math.min(...corners.map(point => point.y));
  const bottom = Math.max(...corners.map(point => point.y));
  const maxWidth = Math.min(baseWidth * 20, cornerX > 0 ? right + placement.width / 2
    : cornerX < 0 ? placement.width / 2 - left : 2 * Math.min(-left, right));
  const maxHeight = Math.min(baseHeight * 20, cornerY > 0 ? bottom + placement.height / 2
    : cornerY < 0 ? placement.height / 2 - top : 2 * Math.min(-top, bottom));
  const minWidth = Math.min(maxWidth, Math.max(12, baseWidth * .2));
  const minHeight = Math.min(maxHeight, Math.max(12, baseHeight * .2));
  let width = cornerX ? Math.max(minWidth, Math.min(maxWidth, placement.width + cornerX * localDx)) : placement.width;
  let height = cornerY ? Math.max(minHeight, Math.min(maxHeight, placement.height + cornerY * localDy)) : placement.height;
  if (detail.lockProportions) {
    const diagonalX = cornerX * placement.width;
    const diagonalY = cornerY * placement.height;
    const desired = 1 + (localDx * diagonalX + localDy * diagonalY) / (diagonalX ** 2 + diagonalY ** 2);
    const maximum = Math.min(maxWidth / placement.width, maxHeight / placement.height);
    const minimum = Math.min(maximum, Math.max(minWidth / placement.width, minHeight / placement.height));
    const factor = Math.max(minimum, Math.min(maximum, desired));
    width = placement.width * factor;
    height = placement.height * factor;
  }
  let fraction = 1;
  for (const edgeX of [-1, 1]) for (const edgeY of [-1, 1]) {
    const startX = centerX + cosine * edgeX * placement.width / 2 - sine * edgeY * placement.height / 2;
    const startY = centerY + sine * edgeX * placement.width / 2 + cosine * edgeY * placement.height / 2;
    const deltaX = (cosine * (cornerX + edgeX) * (width - placement.width) - sine * (cornerY + edgeY) * (height - placement.height)) / 2;
    const deltaY = (sine * (cornerX + edgeX) * (width - placement.width) + cosine * (cornerY + edgeY) * (height - placement.height)) / 2;
    if (deltaX > 0) fraction = Math.min(fraction, (bounds.maxX - startX) / deltaX);
    if (deltaX < 0) fraction = Math.min(fraction, (bounds.minX - startX) / deltaX);
    if (deltaY > 0) fraction = Math.min(fraction, (bounds.maxY - startY) / deltaY);
    if (deltaY < 0) fraction = Math.min(fraction, (bounds.minY - startY) / deltaY);
  }
  width = placement.width + (width - placement.width) * Math.max(0, fraction);
  height = placement.height + (height - placement.height) * Math.max(0, fraction);
  return { ...detail, scaleX: width / baseWidth, scaleY: height / baseHeight,
    x: placement.x + (cosine * cornerX * (width - placement.width) - sine * cornerY * (height - placement.height)) / 2 / bodyWidth,
    y: placement.y + (sine * cornerX * (width - placement.width) + cosine * cornerY * (height - placement.height)) / 2 / bodyHeight };
}

export function detailFrame(detail: GarmentDetail, bounds: DetailBounds) {
  const placement = detailPlacement(detail, bounds);
  const radians = detailRotation(detail) * Math.PI / 180;
  const extentX = Math.abs(Math.cos(radians)) * placement.width + Math.abs(Math.sin(radians)) * placement.height;
  const extentY = Math.abs(Math.sin(radians)) * placement.width + Math.abs(Math.cos(radians)) * placement.height;
  const centerX = placement.left + placement.width / 2;
  const centerY = placement.top + placement.height / 2;
  return { ...placement, centerX, centerY, minX: centerX - extentX / 2, maxX: centerX + extentX / 2, minY: centerY - extentY / 2, maxY: centerY + extentY / 2 };
}

export function setDetailTransform(detail: GarmentDetail, bounds: DetailBounds, patch: Partial<{ x: number; y: number; width: number; height: number; rotation: number }>): GarmentDetail {
  if (Object.values(patch).some(value => !Number.isFinite(value))) return detail;
  const original = detailPlacement(detail, bounds);
  const bodyWidth = bounds.maxX - bounds.minX;
  const bodyHeight = bounds.maxY - bounds.minY;
  const baseWidth = bodyWidth * detailAsset(detail).width;
  const baseHeight = baseWidth / detailAsset(detail).ratio;
  let width = patch.width ?? original.width;
  let height = patch.height ?? original.height;
  if (detail.lockProportions) {
    if (patch.width !== undefined) height = original.height * width / original.width;
    else if (patch.height !== undefined) width = original.width * height / original.height;
  }
  if (width < Math.max(12, baseWidth * .2) || height < Math.max(12, baseHeight * .2) || width > baseWidth * 20 || height > baseHeight * 20) return detail;
  const next = { ...detail, x: patch.x ?? original.x, y: patch.y ?? original.y, rotation: patch.rotation ?? detail.rotation, scaleX: width / baseWidth, scaleY: height / baseHeight };
  const placed = detailPlacement(next, bounds);
  if (Math.abs(placed.width - width) > .001 || Math.abs(placed.height - height) > .001) return detail;
  if (patch.width !== undefined || patch.height !== undefined) {
    if (Math.abs(placed.x - original.x) > .00001 || Math.abs(placed.y - original.y) > .00001) return detail;
  }
  return { ...next, x: placed.x, y: placed.y };
}

export type DetailAlignment = 'horizontal' | 'vertical' | 'top' | 'bottom';
export function alignGarmentDetail(detail: GarmentDetail, bounds: DetailBounds, alignment: DetailAlignment) {
  const frame = detailFrame(detail, bounds);
  const panelTop = bounds.necklineY ?? bounds.minY;
  const x = alignment === 'horizontal' ? .5 : frame.x;
  const centerY = alignment === 'vertical' ? (panelTop + bounds.maxY) / 2
    : alignment === 'top' ? panelTop + (frame.maxY - frame.minY) / 2
      : alignment === 'bottom' ? bounds.maxY - (frame.maxY - frame.minY) / 2 : frame.centerY;
  return setDetailTransform(detail, bounds, { x, y: (centerY - bounds.minY) / (bounds.maxY - bounds.minY) });
}

export interface DetailGuide { axis: 'x' | 'y'; value: number }
export function detailGesture(origin: GarmentDetail, bounds: DetailBounds, others: GarmentDetail[], dx: number, dy: number,
  corner?: { x: number; y: number }, threshold = 0): { detail: GarmentDetail; guides: DetailGuide[] } {
  const apply = (deltaX: number, deltaY: number) => corner ? resizeGarmentDetail(origin, bounds, corner.x, corner.y, deltaX, deltaY)
    : setDetailTransform(origin, bounds, { x: origin.x + deltaX / (bounds.maxX - bounds.minX), y: origin.y + deltaY / (bounds.maxY - bounds.minY) });
  const unsnapped = apply(dx, dy);
  if (threshold <= 0) return { detail: unsnapped, guides: [] };
  const targets = { x: [bounds.minX, (bounds.minX + bounds.maxX) / 2, bounds.maxX],
    y: [bounds.minY, bounds.necklineY ?? bounds.minY, ((bounds.necklineY ?? bounds.minY) + bounds.maxY) / 2, bounds.maxY] };
  for (const other of others) {
    if (other.hidden || other.id === origin.id || (other.view ?? 'front') !== (origin.view ?? 'front')) continue;
    const frame = detailFrame(other, bounds);
    targets.x.push(frame.minX, frame.centerX, frame.maxX); targets.y.push(frame.minY, frame.centerY, frame.maxY);
  }
  const anchors = (detail: GarmentDetail) => {
    const frame = detailFrame(detail, bounds);
    if (!corner) return { x: [frame.minX, frame.centerX, frame.maxX], y: [frame.minY, frame.centerY, frame.maxY] };
    const radians = detailRotation(detail) * Math.PI / 180;
    return { x: [frame.centerX + Math.cos(radians) * corner.x * frame.width / 2 - Math.sin(radians) * corner.y * frame.height / 2],
      y: [frame.centerY + Math.sin(radians) * corner.x * frame.width / 2 + Math.cos(radians) * corner.y * frame.height / 2] };
  };
  const initial = anchors(unsnapped);
  const matches = (['x', 'y'] as const).map(axis => {
    let best: { axis: 'x' | 'y'; value: number; delta: number } | undefined;
    for (const value of targets[axis]) for (const anchor of initial[axis]) {
      const delta = value - anchor;
      if (Math.abs(delta) <= threshold && (!best || Math.abs(delta) < Math.abs(best.delta))) best = { axis, value, delta };
    }
    return best;
  });
  const detail = apply(dx + (matches[0]?.delta ?? 0), dy + (matches[1]?.delta ?? 0));
  const result = anchors(detail);
  const guides = matches.filter((match): match is NonNullable<typeof match> => Boolean(match && result[match.axis].some(value => Math.abs(value - match.value) < .05)))
    .map(({ axis, value }) => ({ axis, value }));
  return { detail, guides };
}

export function copyDetailToOpposite(details: GarmentDetail[], source: GarmentDetail, view: GarmentView): GarmentDetail[] {
  const opposite = view === 'front' ? 'back' : 'front';
  if (details.some(detail => detail.view === opposite && detail.copiedFromId === source.id)) return details;
  const identity = createGarmentDetail(source.type, details, source.fill, source.variant);
  return [...details, { ...source, id: identity.id, name: source.catalogueAsset ? `${source.name} copy` : identity.name, sourceLayerId: undefined, arrangementId: undefined, view: opposite, selected: false, copiedFromId: source.id,
    x: 1 - source.x, rotation: (360 - detailRotation(source)) % 360, flipX: !source.flipX }];
}

export function alignGarmentZip(detail: GarmentDetail, bounds: DetailBounds, mode: 'chest' | 'quarter' | 'half' | 'full' | 'hem'): GarmentDetail {
  if (detail.type !== 'zip') return detail;
  if (mode === 'hem') {
    const radians = detailRotation(detail) * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    if (Math.abs(cosine) < .001) return detail;
    const frame = detailFrame(detail, bounds);
    const increase = (bounds.maxY - frame.maxY) / Math.abs(cosine);
    const direction = cosine > 0 ? 1 : -1;
    const placement = detailPlacement(detail, bounds);
    const sourceWidth = Number(new DOMParser().parseFromString(detailAsset(detail).svg, 'image/svg+xml').documentElement.getAttribute('viewBox')?.split(/\s+/)[2]) || 48;
    const hardwareScale = zipHardwareGeometry(detail, sourceWidth, sourceWidth * placement.height / placement.width).hardwareScale;
    return { ...resizeGarmentDetail({ ...detail, lockProportions: false }, bounds, 0, direction, -sine * direction * increase, cosine * direction * increase), lockProportions: detail.lockProportions, zipHardwareScale: hardwareScale };
  }
  const original = detailPlacement({ ...detail, rotation: 0 }, bounds);
  const bodyWidth = bounds.maxX - bounds.minX;
  const bodyHeight = bounds.maxY - bounds.minY;
  const neckline = Math.max(bounds.minY, Math.min(bounds.maxY - 12, bounds.necklineY ?? bounds.minY + bodyHeight * .12));
  const top = neckline;
  const available = bounds.maxY - top;
  const height = mode === 'chest' ? Math.min(available, bodyHeight * .2) : mode === 'quarter' ? available * .42 : mode === 'half' ? available * .6 : available;
  return { ...detail, rotation: 0, x: .5,
    y: (top + height / 2 - bounds.minY) / bodyHeight,
    scaleX: original.width / (bodyWidth * detailAsset(detail).width),
    scaleY: height / (bodyWidth * detailAsset(detail).width / detailAsset(detail).ratio) };
}

const detailTemplates = new Map<string, Element>();

export function zipHardwareGeometry(detail: GarmentDetail, width: number, height: number) {
  const hardwareScale = Math.min(Number.isFinite(detail.zipHardwareScale) ? Math.max(.01, detail.zipHardwareScale!) : 1, height / 240);
  const position = detail.zipSliderPosition ?? (detail.variant === 'zip-05' ? .34 : 0);
  const progress = Number.isFinite(position) ? Math.max(0, Math.min(1, position)) : 0;
  const travel = height - 90 * hardwareScale;
  const sliderY = 10 * hardwareScale + progress * travel;
  return { center: width / 2, hardwareScale, sliderY, travel, pullY: sliderY + 14 * hardwareScale };
}

function renderZipParts(svg: Element, detail: GarmentDetail, width: number, height: number) {
  svg.replaceChildren();
  const append = (tag: string, attributes: Record<string, string | number>, parent = svg) => {
    const element = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, String(value)));
    parent.appendChild(element);
    return element;
  };
  const fill = 'var(--detail-fill, none)';
  const outline = 'var(--detail-outline, black)';
  const hardware = 'var(--detail-hardware, none)';
  const stitch = 'var(--detail-stitch, black)';
  const { center, hardwareScale, sliderY, pullY } = zipHardwareGeometry(detail, width, height);
  const open = detail.variant === 'zip-05';
  const track = append('g', { 'data-zip-track': '', 'stroke-linejoin': 'round' });
  if (open) {
    append('path', { d: `M4 1H${center - 10}L${center - 5} ${sliderY + 15 * hardwareScale}V${height - 1}H4Z M${center + 10} 1H${width - 4}V${height - 1}H${center + 5}V${sliderY + 15 * hardwareScale}Z`,
      fill, stroke: outline, 'stroke-width': 2 }, track);
  } else {
    append('rect', { x: 4, y: 1, width: width - 8, height: height - 2, rx: detail.variant === 'zip-02' ? Math.min(6, height / 8) : 0,
      fill, stroke: outline, 'stroke-width': 2 }, track);
  }
  append('path', { d: `M9 7V${height - 7}M${width - 9} 7V${height - 7}`, stroke: stitch, 'stroke-width': 1.4, 'stroke-dasharray': '4 4' }, track);
  if (detail.variant === 'zip-04') append('rect', { x: 19, y: 6, width: width - 38, height: Math.max(1, height - 12),
    fill: 'none', stroke: outline, 'stroke-width': 1.5, 'data-zip-welt': '' }, track);
  const railLeft = center - 5;
  const railRight = center + 5;
  append('path', { d: open
    ? `M${center - 10} 5L${railLeft} ${sliderY + 15 * hardwareScale}V${height - 5}M${center + 10} 5L${railRight} ${sliderY + 15 * hardwareScale}V${height - 5}`
    : `M${railLeft} 5H${railRight}V${height - 5}H${railLeft}Z`,
    fill: open ? 'none' : hardware, stroke: outline, 'stroke-width': 1.4 }, track);
  const teeth = append('g', { 'data-zip-teeth': '', stroke: 'var(--detail-teeth, black)', 'stroke-width': 1.4 });
  const segments: string[] = [];
  for (let toothY = 8; toothY < height - 5; toothY += 8) {
    if (open && toothY < sliderY + 15 * hardwareScale) {
      const spread = 5 * (1 - toothY / (sliderY + 15 * hardwareScale));
      segments.push(`M${railLeft - spread - 2} ${toothY}h4M${railRight + spread - 2} ${toothY}h4`);
    } else segments.push(`M${railLeft} ${toothY}H${railRight}`);
  }
  append('path', { d: segments.join('') }, teeth);
  const stops = append('g', { 'data-zip-stops': '', fill: hardware, stroke: outline, 'stroke-width': 1.4 });
  append('rect', { x: railLeft - 1, y: 1, width: 12, height: 3 }, stops);
  append('rect', { x: railLeft - 1, y: height - 4, width: 12, height: 3 }, stops);
  const sliderScale = Number.isFinite(detail.zipSliderScale) ? Math.max(.5, Math.min(1.25, detail.zipSliderScale!)) : 1;
  const slider = append('g', { 'data-zip-slider': '', transform: `translate(${center} ${sliderY}) scale(${hardwareScale * sliderScale})` });
  append('path', { d: 'M-8 0H8V16L4 22H-4L-8 16Z', fill: 'var(--detail-slider, none)', stroke: outline, 'stroke-width': 1.6 }, slider);
  const pull = append('g', { 'data-zip-pull': '', transform: `translate(${center} ${pullY}) scale(${hardwareScale})` });
  const angle = detail.zipPullSide === 'left' ? 18 : detail.zipPullSide === 'right' ? -18 : 0;
  const tab = append('g', { 'data-zip-pull-tab': '', transform: `rotate(${angle})` }, pull);
  append('path', { d: zipPullStyle(detail).path, transform: `scale(${zipPullScale(detail)})`, fill: 'var(--detail-pull, none)',
    'fill-rule': 'evenodd', stroke: outline, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, tab);
}

export function detailSvg(detail: GarmentDetail, displayRatio?: number, part?: 'body' | 'pull') {
  const asset = detailAsset(detail);
  const raw = detail.catalogueAsset ? tintPotraceSvg(asset.svg, /^#[\da-f]{6}$/i.test(detail.fill) ? detail.fill : '#141414') : asset.svg;
  let template = detailTemplates.get(raw);
  if (!template) {
    template = new DOMParser().parseFromString(raw, 'image/svg+xml').documentElement;
    if (!detail.catalogueAsset) detailTemplates.set(raw, template);
  }
  const svg = template.cloneNode(true) as Element;
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('stroke-linecap', 'round');
  if (detail.catalogueAsset) {
    const crop = detail.catalogueAsset.crop;
    const group = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('transform', `translate(${-crop.minX} ${-crop.minY})`);
    Array.from(svg.children).forEach(child => group.appendChild(child));
    svg.appendChild(group);
    svg.setAttribute('viewBox', `0 0 ${crop.maxX - crop.minX} ${crop.maxY - crop.minY}`);
  }
  if (detail.type === 'zip') {
    const [, , sourceWidth] = svg.getAttribute('viewBox')!.split(/\s+/).map(Number);
    const ratio = displayRatio ?? asset.ratio * detailAxisScale(detail, 'x') / detailAxisScale(detail, 'y');
    const height = Math.max(12, sourceWidth / ratio);
    svg.setAttribute('viewBox', `0 0 ${sourceWidth} ${height}`);
    renderZipParts(svg, detail, sourceWidth, height);
    if (part === 'body') svg.querySelector('[data-zip-pull]')?.remove();
    if (part === 'pull') Array.from(svg.children).filter(child => !child.hasAttribute('data-zip-pull')).forEach(child => child.remove());
  }
  if (detail.flipX || detail.flipY) {
    const [, , width, height] = svg.getAttribute('viewBox')!.split(/\s+/).map(Number);
    const mirrored = svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g');
    mirrored.setAttribute('data-detail-mirror', '');
    mirrored.setAttribute('transform', `translate(${detail.flipX ? width : 0} ${detail.flipY ? height : 0}) scale(${detail.flipX ? -1 : 1} ${detail.flipY ? -1 : 1})`);
    Array.from(svg.children).forEach(child => mirrored.appendChild(child));
    svg.appendChild(mirrored);
  }
  const colors: Record<string, string> = { fill: detail.fill, outline: detail.outline, stitch: detail.stitch, hardware: detail.hardware,
    pull: detail.zipPullColor ?? detail.hardware, slider: detail.zipSliderColor ?? detail.hardware, teeth: detail.zipTeethColor ?? detail.outline };
  const serialized = new XMLSerializer().serializeToString(svg);
  return serialized.replace(/var\(--detail-(\w+), (?:none|black)\)/g,
    (_match, channel: string) => /^#[\da-f]{6}$/i.test(colors[channel]) ? colors[channel] : '#141414');
}

export function adjustZipPull(detail: GarmentDetail, bounds: DetailBounds, dx: number, dy: number, action: 'move' | 'resize'): GarmentDetail {
  const placement = detailPlacement(detail, bounds);
  const sourceWidth = Number(new DOMParser().parseFromString(detailAsset(detail).svg, 'image/svg+xml').documentElement.getAttribute('viewBox')?.split(/\s+/)[2]) || 48;
  const sourceHeight = sourceWidth * placement.height / placement.width;
  const hardware = zipHardwareGeometry(detail, sourceWidth, sourceHeight);
  const radians = detailRotation(detail) * Math.PI / 180;
  const localX = (dx * Math.cos(radians) + dy * Math.sin(radians)) * (detail.flipX ? -1 : 1) * sourceWidth / placement.width;
  const localY = (-dx * Math.sin(radians) + dy * Math.cos(radians)) * (detail.flipY ? -1 : 1) * sourceWidth / placement.width;
  if (action === 'move') return { ...detail, zipSliderPosition: Math.max(0, Math.min(1, (detail.zipSliderPosition ?? (detail.variant === 'zip-05' ? .34 : 0)) + localY / hardware.travel)) };
  const angle = (detail.zipPullSide === 'left' ? 18 : detail.zipPullSide === 'right' ? -18 : 0) * Math.PI / 180;
  const length = zipPullStyle(detail).id === 'short' ? 22 : 50;
  const delta = (-localX * Math.sin(angle) + localY * Math.cos(angle)) / (length * hardware.hardwareScale);
  return { ...detail, zipPullScale: zipPullScale({ zipPullScale: zipPullScale(detail) + delta }) };
}

export function arrangeGarmentDetails(details: GarmentDetail[], source: GarmentDetail, bounds: DetailBounds, count: number, spacing: number, axis: 'x' | 'y') {
  if (!Number.isInteger(count) || count < 2 || count > 12 || !Number.isFinite(spacing) || spacing <= 0) return details;
  const group = source.arrangementId ? details.filter(item => !item.hidden && item.arrangementId === source.arrangementId && (item.view ?? 'front') === (source.view ?? 'front')) : [source];
  const first = group[0];
  const arrangementId = source.arrangementId ?? crypto.randomUUID();
  const arranged: GarmentDetail[] = [];
  for (let index = 0; index < count; index++) {
    const identity = createGarmentDetail(source.type, [...details, ...arranged], source.fill, source.variant);
    const original = group[index] ?? { ...source, id: identity.id, name: source.catalogueAsset ? `${source.name} ${index + 1}` : identity.name, sourceLayerId: undefined, copiedFromId: undefined, selected: false };
    const position = first[axis] + index * spacing;
    const next = setDetailTransform(original, bounds, { [axis]: position });
    if (Math.abs(next[axis] - position) > 1e-6) return details;
    arranged.push({ ...next, arrangementId });
  }
  const ids = new Set(group.map(item => item.id));
  return [...details.filter(item => !ids.has(item.id)), ...arranged];
}