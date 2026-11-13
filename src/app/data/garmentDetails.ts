import {zipRoute} from '../lib/zipCurve';
import {warpZipSvg} from '../lib/warpZipSvg';
import pocketSvg from '../../assets/garment-details/patch-pocket.svg?raw';
import zipSvg from '../../assets/garment-details/short-front-zip.svg?raw';
import buttonSvg from '../../assets/garment-details/four-hole-button.svg?raw';
import type { GarmentView } from './garmentView';
import { getGarmentAsset, getGarmentAssetSvgRaw } from './garmentSvgCatalog';
import { tintPotraceSvg } from '../lib/tshirtSvgUtils';
import { DEFAULT_PATCH, patchSvg, type PatchSettings } from './garmentPatches';
import type { CustomAssetDefinition } from './customAssets';
import { centerTorsoSpan, createOpening, openingGapProfile, openingOpenAmount, setOpeningEndpoint, ZIP_TAPE, transformOpening, type GarmentOpening, type OpeningGeometry } from './garmentOpenings';
import { HOODIE_HARDWARE, HOODIE_POCKETS, hoodieCordSvg, splitHoodiePocketSvg, type HoodieTrimSettings } from './hoodieTrimAssets';

export const GARMENT_DETAIL_ASSETS = {
  pocket: { label: 'Pocket', svg: pocketSvg, width: .2, ratio: 200 / 220, x: .72, y: .4, stitch: true, hardware: false },
  zip: { label: 'Zip', svg: zipSvg, width: .055, ratio: 48 / 240, x: .5, y: .31, stitch: true, hardware: true },
  button: { label: 'Button', svg: buttonSvg, width: .06, ratio: 1, x: .5, y: .43, stitch: false, hardware: false },
  patch: { label: 'Patch', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160"><rect x="5" y="5" width="190" height="150" rx="12" fill="#DDD" stroke="#555" stroke-width="5" stroke-dasharray="3 2"/></svg>', width: .2, ratio: 1.25, x: .35, y: .4, stitch: true, hardware: false },
  drawstring: { ...HOODIE_HARDWARE.drawstring[0], label: 'Drawstring', width: .24, ratio: .8, x: .5, y: .19 },
  eyelet: { ...HOODIE_HARDWARE.eyelet[0], label: 'Eyelet', width: .022, ratio: 1, x: .42, y: .13 },
  aglet: { ...HOODIE_HARDWARE.aglet[0], label: 'Aglet', width: .018, ratio: 12/18, x: .42, y: .24 },
  toggle: { ...HOODIE_HARDWARE.toggle[0], label: 'Cord lock', width: .045, ratio: 1.2, x: .42, y: .87 },
  hoodDetail: { ...HOODIE_HARDWARE.hoodDetail[0], label: 'Hood detail', width: .07, ratio: 1.25, x: .5, y: .16 },
} as const;

export type GarmentDetailType = keyof typeof GARMENT_DETAIL_ASSETS;

const variantSvgs = import.meta.glob<string>('../../assets/garment-details/*/*.svg', { eager: true, query: '?raw', import: 'default' });
export const GARMENT_DETAIL_OPTIONS = {
  ...HOODIE_HARDWARE,
  patch: [],
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
    { id: 'zip-06', label: 'Double zip', stitch: true, hardware: true, width: .0733333333, ratio: 64 / 240 },
    { id: 'zip-07', label: 'Hidden placket zip', stitch: true, hardware: true, width: .0825, ratio: 72 / 240 },
  ],
  pocket: [
    { id: 'pocket-01', label: 'Rounded pocket', stitch: true, hardware: false },
    { id: 'pocket-02', label: 'Square pocket', stitch: true, hardware: false },
    { id: 'pocket-03', label: 'Pointed pocket', stitch: true, hardware: false },
    { id: 'pocket-04', label: 'Flap pocket', stitch: true, hardware: true },
    { id: 'pocket-05', label: 'Divided pocket', stitch: true, hardware: true },
    ...HOODIE_POCKETS,
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

export function detailAsset(detail: Pick<GarmentDetail, 'type' | 'variant' | 'catalogueAsset' | 'patch' | 'customAsset' | 'hoodieTrim' | 'splitPocketGap'>) {
  if (detail.customAsset) {
    const asset = detail.customAsset;
    return { ...GARMENT_DETAIL_ASSETS[asset.detailType ?? detail.type], label: asset.name, svg: asset.svg,
      width: asset.registration.width ?? .2, ratio: asset.registration.ratio ?? 1, stitch: false, hardware: false };
  }
  if (detail.catalogueAsset) {
    const descriptor = detail.catalogueAsset;
    const source = getGarmentAsset(descriptor.id);
    if (source) return { ...GARMENT_DETAIL_ASSETS.pocket, label: source.displayName, svg: getGarmentAssetSvgRaw(source.id) ?? GARMENT_DETAIL_ASSETS.pocket.svg, width: descriptor.width, ratio: descriptor.ratio };
  }
  const base = GARMENT_DETAIL_ASSETS[detail.type];
  if (detail.type === 'patch' && ['circle', 'square'].includes(detail.patch?.shape ?? '')) return { ...base, ratio: 1 };
  const option = GARMENT_DETAIL_OPTIONS[detail.type].find(option => option.id === detail.variant);
  if (!option) return base;
  if (detail.type === 'drawstring') return { ...base, ...option, svg: hoodieCordSvg(option.id.slice(5), detail.hoodieTrim) };
  if (detail.variant === 'hoodie-split' && detail.splitPocketGap) return { ...base, ...option, svg: splitHoodiePocketSvg(detail.splitPocketGap) };
  if ('svg' in option) return { ...base, ...option };
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
  freeResize?: boolean;
  opening?: GarmentOpening;
  zipSliderPosition?: number;
  zipBottomOpening?: number;
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
  customAsset?: CustomAssetDefinition;
  placementArea?: 'canvas';
  sourceLayerId?: string;
  importedClosureId?: string;
  hidden?: boolean;
  arrangementId?: string;
  selected: boolean;
  fill: string;
  outline: string;
  stitch: string;
  hardware: string;
  patch?: PatchSettings;
  hoodieTrim?: HoodieTrimSettings;
  hoodAnchor?: number | null;
  splitPocketGap?: number;
}

export interface DetailBounds { minX: number; minY: number; maxX: number; maxY: number; necklineY?: number; frontNeckCenterX?: number; hoodOpeningY?: number; hoodZipY?: number; polo?: boolean; tshirtFront?: boolean; openingGeometry?: OpeningGeometry }

export function createGarmentDetail(type: GarmentDetailType, details: GarmentDetail[], fill: string, variant?: GarmentDetailVariant): GarmentDetail {
  const asset = detailAsset({ type, variant });
  const label = variant?.startsWith('hoodie-') ? asset.label : GARMENT_DETAIL_ASSETS[type].label;
  let number = 1;
  while (details.some(detail => detail.name === `${label} ${number}`)) number++;
  return { id: crypto.randomUUID(), type, variant, name: `${label} ${number}`, x: asset.x, y: asset.y,
    scale: 1, selected: true, fill, outline: '#141414', stitch: '#707070', hardware: '#D4D4D4', ...(type === 'patch' ? { patch: { ...DEFAULT_PATCH } } : {}) };
}

export function detailLocksProportions(detail: GarmentDetail) {
  return !detail.opening && !detail.freeResize;
}
export function anchorHoodTrim(detail: GarmentDetail, bounds: DetailBounds) {
  if (detail.hoodAnchor === null || bounds.hoodOpeningY === undefined ||
    (detail.hoodAnchor === undefined && !['drawstring', 'eyelet', 'aglet', 'hoodDetail'].includes(detail.type))) return detail;
  const bodyHeight = bounds.maxY - bounds.minY;
  const anchor = (bounds.hoodOpeningY - bounds.minY) / bodyHeight;
  if (detail.hoodAnchor === anchor) return detail;
  const asset = detailAsset(detail);
  const cordOffset = (bounds.maxX - bounds.minX) * asset.width / asset.ratio * .4 / bodyHeight;
  const offset = detail.type === 'eyelet' ? 0 : detail.type === 'aglet' ? .15 : detail.type === 'hoodDetail' ? -.065 : cordOffset;
  return {
    ...detail, placementArea: 'canvas' as const, hoodAnchor: anchor,
    y: anchor + (detail.hoodAnchor === undefined ? offset : detail.y - detail.hoodAnchor),
  };
}

export function detailScale(scale = 1) {
  return Math.max(.2, Math.min(4, Number.isFinite(scale) ? scale : 1));
}

export function detailAxisScale(detail: GarmentDetail, axis: 'x' | 'y') {
  const value = axis === 'x' ? detail.scaleX : detail.scaleY;
  return value !== undefined && Number.isFinite(value) ? Math.max(.2, Math.min(20, value)) : detailScale(detail.scale);
}

export function detailRotation(detail: GarmentDetail) {
  if (detail.opening) return (Math.atan2(detail.opening.end.y - detail.opening.start.y, detail.opening.end.x - detail.opening.start.x) * 180 / Math.PI - 90 + 360) % 360;
  return Number.isFinite(detail.rotation) ? ((detail.rotation! % 360) + 360) % 360 : 0;
}

function detailBaseWidth(detail: GarmentDetail, bounds: DetailBounds, proportion: number) {
  const width = bounds.maxX - bounds.minX;
  if (detail.variant !== 'hoodie-side-seam') return width * proportion;
  const center = (bounds.minX + bounds.maxX) / 2;
  const spans = [.62, .73, .84].map(fraction =>
    centerTorsoSpan(bounds.openingGeometry, center, bounds.minY + (bounds.maxY - bounds.minY) * fraction));
  const torsoWidth = Math.min(width, ...spans.flatMap(span => span === undefined ? [] : [span]));
  return torsoWidth * proportion;
}

export function detailPlacement(detail: GarmentDetail, bounds: DetailBounds) {
  if (detail.opening) {
    const { start, end, width } = detail.opening;
    const height = Math.hypot(end.x - start.x, end.y - start.y);
    const centerX = (start.x + end.x) / 2, centerY = (start.y + end.y) / 2;
    return { x: (centerX - bounds.minX) / (bounds.maxX - bounds.minX), y: (centerY - bounds.minY) / (bounds.maxY - bounds.minY),
      width, height, left: centerX - width / 2, top: centerY - height / 2 };
  }
  const asset = detailAsset(detail);
  const limits = (detail.type === 'patch' || detail.placementArea === 'canvas') ? { minX: 0, minY: 0, maxX: 2048, maxY: 2048 } : bounds;
  const availableWidth = limits.maxX - limits.minX;
  const availableHeight = limits.maxY - limits.minY;
  const bodyWidth = bounds.maxX - bounds.minX;
  const bodyHeight = bounds.maxY - bounds.minY;
  const baseWidth = detailBaseWidth(detail, bounds, asset.width);
  const radians = detailRotation(detail) * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  let width = Math.min(cosine * availableWidth + sine * availableHeight, Math.max(12, baseWidth * detailAxisScale(detail, 'x')));
  let height = Math.min(sine * availableWidth + cosine * availableHeight, Math.max(12, baseWidth / asset.ratio * detailAxisScale(detail, 'y')));
  if (detail.type === 'patch' && ['circle', 'square'].includes(detail.patch?.shape ?? '')) height = width;
  const fit = Math.min(1, availableWidth / (cosine * width + sine * height), availableHeight / (sine * width + cosine * height));
  width *= fit; height *= fit;
  const extentX = cosine * width + sine * height;
  const extentY = sine * width + cosine * height;
  const x = Math.max((limits.minX - bounds.minX + extentX / 2) / bodyWidth, Math.min((limits.maxX - bounds.minX - extentX / 2) / bodyWidth, Number.isFinite(detail.x) ? detail.x : asset.x));
  const y = Math.max((limits.minY - bounds.minY + extentY / 2) / bodyHeight, Math.min((limits.maxY - bounds.minY - extentY / 2) / bodyHeight, Number.isFinite(detail.y) ? detail.y : asset.y));
  return { x, y, width, height, left: bounds.minX + x * bodyWidth - width / 2,
    top: bounds.minY + y * bodyHeight - height / 2 };
}

export function resizeGarmentDetail(detail: GarmentDetail, bounds: DetailBounds, cornerX: number, cornerY: number, dx: number, dy: number): GarmentDetail {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (!cornerX && !cornerY)) return detail;
  if (detail.opening) {
    const placement = detailPlacement(detail, bounds);
    const angle = detailRotation(detail) * Math.PI / 180, cosine = Math.cos(angle), sine = Math.sin(angle);
    const height = Math.min(4096, Math.max(8, placement.height + cornerY * (-dx * sine + dy * cosine)));
    const width = Math.min(600, height / 1.2, Math.max(2, placement.width + cornerX * (dx * cosine + dy * sine)));
    if (detail.opening.frontNeckJoin) return transformOpening(detail, bounds, { width, height });
    return transformOpening(detail, bounds, { width, height,
      x: placement.x + (cosine * cornerX * (width - placement.width) - sine * cornerY * (height - placement.height)) / 2 / (bounds.maxX - bounds.minX),
      y: placement.y + (sine * cornerX * (width - placement.width) + cosine * cornerY * (height - placement.height)) / 2 / (bounds.maxY - bounds.minY) });
  }
  const limits = (detail.type === 'patch' || detail.placementArea === 'canvas') ? { minX: 0, minY: 0, maxX: 2048, maxY: 2048 } : bounds;
  const placement = detailPlacement(detail, bounds);
  const bodyWidth = bounds.maxX - bounds.minX;
  const bodyHeight = bounds.maxY - bounds.minY;
  const asset = detailAsset(detail);
  const baseWidth = detailBaseWidth(detail, bounds, asset.width);
  const baseHeight = baseWidth / asset.ratio;
  const centerX = placement.left + placement.width / 2;
  const centerY = placement.top + placement.height / 2;
  const radians = detailRotation(detail) * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const localDx = dx * cosine + dy * sine;
  const localDy = -dx * sine + dy * cosine;
  const corners = [[limits.minX, limits.minY], [limits.maxX, limits.minY], [limits.maxX, limits.maxY], [limits.minX, limits.maxY]]
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
  if (detailLocksProportions(detail) || detail.type === 'patch' && ['circle', 'square'].includes(detail.patch?.shape ?? '')) {
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
    if (deltaX > 0) fraction = Math.min(fraction, (limits.maxX - startX) / deltaX);
    if (deltaX < 0) fraction = Math.min(fraction, (limits.minX - startX) / deltaX);
    if (deltaY > 0) fraction = Math.min(fraction, (limits.maxY - startY) / deltaY);
    if (deltaY < 0) fraction = Math.min(fraction, (limits.minY - startY) / deltaY);
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
  if (detail.opening) return transformOpening(detail, bounds, patch);
  const original = detailPlacement(detail, bounds);
  const bodyWidth = bounds.maxX - bounds.minX;
  const bodyHeight = bounds.maxY - bounds.minY;
  const baseWidth = detailBaseWidth(detail, bounds, detailAsset(detail).width);
  const baseHeight = baseWidth / detailAsset(detail).ratio;
  let width = patch.width ?? original.width;
  let height = patch.height ?? original.height;
  if (detail.type === 'patch' && ['circle', 'square'].includes(detail.patch?.shape ?? '')) {
    width = patch.width ?? patch.height ?? original.width;
    height = width;
  } else if (detailLocksProportions(detail)) {
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
    : setDetailTransform(origin, bounds, { x: detailPlacement(origin, bounds).x + deltaX / (bounds.maxX - bounds.minX), y: detailPlacement(origin, bounds).y + deltaY / (bounds.maxY - bounds.minY) });
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
  if (source.opening) return details;
  const opposite = view === 'front' ? 'back' : 'front';
  if (details.some(detail => detail.view === opposite && detail.copiedFromId === source.id)) return details;
  const identity = createGarmentDetail(source.type, details, source.fill, source.variant);
  return [...details, { ...source, id: identity.id, name: source.catalogueAsset || source.customAsset ? `${source.name} copy` : identity.name,
    customAsset: source.customAsset ? { ...source.customAsset, provenance: 'derived' } : undefined,
    sourceLayerId: undefined, arrangementId: undefined, view: opposite, selected: false, copiedFromId: source.id,
    x: 1 - source.x, rotation: (360 - detailRotation(source)) % 360, flipX: !source.flipX }];
}

export function alignGarmentZip(detail: GarmentDetail, bounds: DetailBounds, mode: 'chest' | 'quarter' | 'half' | 'full' | 'hem'): GarmentDetail {
  if (detail.type !== 'zip') return detail;
  if (detail.opening && mode !== 'hem') {
    const aligned = createOpening(detail, bounds, 'full-front');
    const opening = aligned.opening!;
    const ratio = mode === 'chest' ? .2 : mode === 'quarter' ? .42 : mode === 'half' ? .6 : 1;
    return setOpeningEndpoint({ ...aligned, opening: { ...opening, width: detail.opening.width, facingColor: detail.opening.facingColor, defaults: detail.opening.defaults, attachment: mode === 'full' ? 'full-front' : 'neckline' } }, bounds, 'end', {
      x: opening.start.x + (opening.end.x - opening.start.x) * ratio,
      y: opening.start.y + (opening.end.y - opening.start.y) * ratio,
    });
  }
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
    return { ...resizeGarmentDetail({ ...detail, freeResize: true }, bounds, 0, direction, -sine * direction * increase, cosine * direction * increase), freeResize: detail.freeResize, zipHardwareScale: hardwareScale };
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
  const hardwareScale = Math.min(Number.isFinite(detail.zipHardwareScale) ? Math.max(.01, detail.zipHardwareScale!) : detail.opening ? width / 40 : 1, height / 240);
  const progress = openingOpenAmount(detail);
  const travel = detail.opening ? height : height - 90 * hardwareScale;
  const sliderY = detail.opening
    ? progress === 0 ? 0 : Math.max(0, openingGapProfile(detail, width, height).tip - 22 * hardwareScale)
    : 10 * hardwareScale + progress * travel;
  return { center: width / 2, hardwareScale, sliderY, travel, pullY: sliderY + 14 * hardwareScale };
}

function renderZipParts(svg: Element, detail: GarmentDetail, width: number, height: number, integratedPlacket = false, showShirtZipStyle = false) {
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
  if (detail.opening) {
    const { amount, tip, bottomTip, halfGap, stations } = openingGapProfile(detail, width, height);
    const style = showShirtZipStyle ? detail.variant : undefined;
    const stitchInset = style === 'zip-02' ? .26 : style === 'zip-03' ? .35 : ZIP_TAPE - 3 / width;
    const toothWidth = style === 'zip-02' ? 3 : style === 'zip-03' ? 6 : style === 'zip-04' ? 7 : style === 'zip-01' ? 5 : 3;
    // The Ring card ends in a point. Keep that shape on the fitted tape.
    const tapeBottom = (offset: number) => style === 'zip-03' ? height - Math.abs(offset) * .45 : height;
    const track = append('g', { 'data-zip-track': '', 'data-opening-amount': amount, 'stroke-linejoin': 'round' });
    const joinedY = amount > 0 ? tip : 0;
    append('rect', { 'data-zip-joined': '', x: center - width * .025, y: joinedY,
      width: width * .05, height: Math.max(0, bottomTip - joinedY), fill: hardware }, track);
    const teeth = append('g', { 'data-zip-teeth': '', stroke: 'var(--detail-teeth, black)', 'stroke-width': 1.4 });
    for (const side of [-1, 1]) {
      const edge = (y: number) => center + side * halfGap(y);
      const outside = (y: number) => edge(y) + side * width * ZIP_TAPE;
      const innerPath = stations.map(y => `${edge(y)} ${y === height ? tapeBottom(halfGap(y)) : y}`).join('L');
      const outerPath = [...stations].reverse().map(y => `${outside(y)} ${y === height ? tapeBottom(outside(y) - center) : y}`).join('L');
      append('path', { 'data-opening-tape': side, d: `M${innerPath}L${outerPath}Z`, fill,
        stroke: integratedPlacket ? 'none' : outline, 'stroke-width': 1 }, track);
      if (integratedPlacket) {
        append('path', { 'data-placket-seam': side, d: `M${outerPath}`, fill: 'none', stroke: outline, 'stroke-width': 1, 'stroke-linecap': 'round' }, track);
      }
      append('path', { d: `M${stations.map(y => `${edge(y) + side * width * stitchInset} ${y}`).join('L')}`, stroke: stitch,
        'stroke-width': style === 'zip-03' ? 1.6 : 1, 'stroke-dasharray': style === 'zip-02' ? '2 3' : '4 4', fill: 'none' }, track);
      if (style === 'zip-04') {
        const weltEdge = (y: number) => edge(y) + side * width * .16;
        append('path', { 'data-zip-welt': side,
          d: `M${edge(0)} 0L${stations.map(y => `${weltEdge(y)} ${y}`).join('L')}L${edge(height)} ${height}`,
          fill: 'none', stroke: outline, 'stroke-width': 1.5 }, track);
      }
      const segments: string[] = [];
      for (let y = 8; y < height - 5; y += 8) {
        const x = edge(y);
        segments.push(`M${x} ${y}h${side * toothWidth}`);
      }
      append('path', { d: segments.join(''), fill: 'none' }, teeth);
      append('rect', { 'data-zip-stops': '', 'data-zip-top-stop': '', x: edge(0) + (side < 0 ? -3 : 0), y: 0, width: 3, height: 3, fill: hardware, stroke: outline, 'stroke-width': .7 });
    }
    if (integratedPlacket && detail.opening.attachment === 'neckline') {
      const stopY = Math.max(0, height - 6);
      append('path', { 'data-placket-bartack': '', d: `M${center - width * .22} ${height - 1.5}h${width * .44}`,
        stroke: stitch, 'stroke-width': 1.4, 'stroke-linecap': 'round' });
      append('rect', { 'data-zip-stops': '', x: center - 3, y: stopY, width: 6, height: 3, rx: 1,
        fill: hardware, stroke: outline, 'stroke-width': .7 });
    } else if (detail.variant === 'zip-06') {
      for (const side of [-1, 1]) append('rect', { 'data-zip-stops': '',
        x: center + side * (halfGap(height) + 2) - 1.5, y: height - 6,
        width: 3, height: 6, fill: hardware, stroke: outline, 'stroke-width': .7 });
    } else {
      append('rect', { 'data-zip-stops': '', x: center - 3, y: height - 3, width: 6, height: 3, fill: hardware, stroke: outline, 'stroke-width': .7 });
    }
  } else {
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
  append('path', { d: segments.join(''), fill: 'none' }, teeth);
  const stops = append('g', { 'data-zip-stops': '', fill: hardware, stroke: outline, 'stroke-width': 1.4 });
  append('rect', { x: railLeft - 1, y: 1, width: 12, height: 3 }, stops);
  append('rect', { x: railLeft - 1, y: height - 4, width: 12, height: 3 }, stops);
  }
  const sliderScale = Number.isFinite(detail.zipSliderScale) ? Math.max(.5, Math.min(1.25, detail.zipSliderScale!)) : 1;
  const slider = append('g', { 'data-zip-slider': '', transform: `translate(${center} ${sliderY}) scale(${hardwareScale * sliderScale})` });
  append('path', { d: 'M-8 0H8V16L4 22H-4L-8 16Z', fill: 'var(--detail-slider, none)', stroke: outline, 'stroke-width': 1.6 }, slider);
  const pull = append('g', { 'data-zip-pull': '', transform: `translate(${center} ${pullY}) scale(${hardwareScale})` });
  const angle = detail.zipPullSide === 'left' ? 18 : detail.zipPullSide === 'right' ? -18 : 0;
  const tab = append('g', { 'data-zip-pull-tab': '', transform: `rotate(${angle})` }, pull);
  append('path', { d: zipPullStyle(detail).path, transform: `scale(${zipPullScale(detail)})`, fill: 'var(--detail-pull, none)',
    'fill-rule': 'evenodd', stroke: outline, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, tab);
  if (detail.opening && detail.variant === 'zip-06') {
    const { bottomTip } = openingGapProfile(detail, width, height);
    const lower = append('g', { 'data-zip-lower-slider': '', transform: `translate(${center} ${bottomTip}) scale(${hardwareScale} ${-hardwareScale})` });
    append('path', { d: 'M-8 0H8V16L4 22H-4L-8 16Z', fill: 'var(--detail-slider, none)', stroke: outline, 'stroke-width': 1.6 }, lower);
    append('path', { d: zipPullStyle(detail).path, transform: `translate(0 14) scale(${zipPullScale(detail)})`,
      fill: 'var(--detail-pull, none)', 'fill-rule': 'evenodd', stroke: outline, 'stroke-width': 1.6 }, lower);
  }
  if (detail.opening && detail.variant === 'zip-07') {
    const { halfGap, stations } = openingGapProfile(detail, width, height);
    const fold = (y: number) => center - halfGap(y);
    const coverEdge = (y: number) => fold(y) + width * .36;
    const seam = (y: number) => fold(y) - width * ZIP_TAPE;
    const trace = (edge: (y: number) => number, rows: number[]) => rows.map(y => `${edge(y)} ${y}`).join('L');
    append('path', { 'data-zip-placket-cover': '', d: `M${trace(coverEdge, stations)}L${trace(seam, [...stations].reverse())}Z`,
      fill, stroke: outline, 'stroke-width': 1.2 });
  }
}

export function detailSvg(detail: GarmentDetail, displayRatio?: number, part?: 'body' | 'pull', joinedNeckline = false, integratedPlacket = false, showShirtZipStyle = false) {
  if (detail.type === 'patch' && !detail.customAsset) return patchSvg(detail, displayRatio ?? detailAsset(detail).ratio * detailAxisScale(detail, 'x') / detailAxisScale(detail, 'y'));
  const asset = detailAsset(detail);
  const raw = detail.catalogueAsset || detail.customAsset ? tintPotraceSvg(asset.svg, /^#[\da-f]{6}$/i.test(detail.fill) ? detail.fill : '#141414') : asset.svg;
  let template = detailTemplates.get(raw);
  if (!template) {
    template = new DOMParser().parseFromString(raw, 'image/svg+xml').documentElement;
    if (!detail.catalogueAsset && !detail.customAsset) detailTemplates.set(raw, template);
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
  if (detail.type === 'zip' && !detail.customAsset) {
    const [, , sourceWidth] = svg.getAttribute('viewBox')!.split(/\s+/).map(Number);
    const ratio = displayRatio ?? asset.ratio * detailAxisScale(detail, 'x') / detailAxisScale(detail, 'y');
    const height = Math.max(12, sourceWidth / ratio);
    svg.setAttribute('viewBox', `0 0 ${sourceWidth} ${height}`);
    svg.setAttribute('overflow', 'visible');
    const curveHeight=detail.opening?.curve?.length?zipRoute(detail.opening).length/detail.opening.width*sourceWidth:height;
    renderZipParts(svg, detail, sourceWidth, curveHeight, integratedPlacket, showShirtZipStyle);
    if(detail.opening?.curve?.length)warpZipSvg(svg,detail.opening,sourceWidth,curveHeight,height);
    if (joinedNeckline && detail.opening) svg.querySelectorAll('[data-zip-top-stop]').forEach(stop => stop.remove());
    if (part === 'body') svg.querySelector('[data-zip-pull]')?.remove();
    if (part === 'pull') Array.from(svg.children).filter(child => !child.hasAttribute('data-zip-pull') || (detail.variant === 'zip-07' && detail.opening && !openingOpenAmount(detail))).forEach(child => child.remove());
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
  if(action==='move'&&detail.opening?.curve?.length){const route=zipRoute(detail.opening),position=openingOpenAmount(detail),p=route.at(route.length*position),q=route.at(route.length*position+1),tx=q.x-p.x,ty=q.y-p.y,len=Math.hypot(tx,ty)||1;return {...detail,zipSliderPosition:Math.max(0,Math.min(1,position+(dx*tx+dy*ty)/len/route.length))};}
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
