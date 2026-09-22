import pocketSvg from '../../assets/garment-details/patch-pocket.svg?raw';
import zipSvg from '../../assets/garment-details/short-front-zip.svg?raw';
import buttonSvg from '../../assets/garment-details/four-hole-button.svg?raw';

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

export function detailAsset(detail: Pick<GarmentDetail, 'type' | 'variant'>) {
  const base = GARMENT_DETAIL_ASSETS[detail.type];
  const option = GARMENT_DETAIL_OPTIONS[detail.type].find(option => option.id === detail.variant);
  if (!option) return base;
  const svg = variantSvgs[`../../assets/garment-details/${detail.type}s/${option.id}.svg`];
  return { ...base, ...option, svg: svg ?? base.svg };
}

export interface GarmentDetail {
  id: string;
  type: GarmentDetailType;
  variant?: GarmentDetailVariant;
  name: string;
  x: number;
  y: number;
  scale: number;
  selected: boolean;
  fill: string;
  outline: string;
  stitch: string;
  hardware: string;
}

export interface DetailBounds { minX: number; minY: number; maxX: number; maxY: number }

export function createGarmentDetail(type: GarmentDetailType, details: GarmentDetail[], fill: string, variant?: GarmentDetailVariant): GarmentDetail {
  const asset = GARMENT_DETAIL_ASSETS[type];
  let number = 1;
  while (details.some(detail => detail.name === `${asset.label} ${number}`)) number++;
  return { id: crypto.randomUUID(), type, variant, name: `${asset.label} ${number}`, x: asset.x, y: asset.y,
    scale: 1, selected: true, fill, outline: '#141414', stitch: '#707070', hardware: '#D4D4D4' };
}

export function detailScale(scale = 1) {
  return Math.max(.2, Math.min(4, Number.isFinite(scale) ? scale : 1));
}

export function detailPlacement(detail: GarmentDetail, bounds: DetailBounds) {
  const asset = detailAsset(detail);
  const bodyWidth = bounds.maxX - bounds.minX;
  const bodyHeight = bounds.maxY - bounds.minY;
  const width = bodyWidth * asset.width * detailScale(detail.scale);
  const height = width / asset.ratio;
  const x = Math.max(-bounds.minX / bodyWidth, Math.min((2048 - bounds.minX) / bodyWidth, detail.x));
  const y = Math.max(-bounds.minY / bodyHeight, Math.min((2048 - bounds.minY) / bodyHeight, detail.y));
  return { x, y, width, height, left: bounds.minX + x * bodyWidth - width / 2,
    top: bounds.minY + y * bodyHeight - height / 2 };
}

export function resizeGarmentDetail(detail: GarmentDetail, bounds: DetailBounds, cornerX: number, cornerY: number, dx: number, dy: number): GarmentDetail {
  const placement = detailPlacement(detail, bounds);
  const diagonalX = cornerX * placement.width;
  const diagonalY = cornerY * placement.height;
  const factor = 1 + (dx * diagonalX + dy * diagonalY) / (diagonalX ** 2 + diagonalY ** 2);
  const scale = detailScale(detailScale(detail.scale) * factor);
  const ratio = scale / detailScale(detail.scale);
  const next = { ...detail, scale,
    x: placement.x + cornerX * placement.width * (ratio - 1) / 2 / (bounds.maxX - bounds.minX),
    y: placement.y + cornerY * placement.height * (ratio - 1) / 2 / (bounds.maxY - bounds.minY) };
  const clamped = detailPlacement(next, bounds);
  return { ...next, x: clamped.x, y: clamped.y };
}

export function detailSvg(detail: GarmentDetail) {
  const colors: Record<string, string> = { fill: detail.fill, outline: detail.outline, stitch: detail.stitch, hardware: detail.hardware };
  return detailAsset(detail).svg.replace(/var\(--detail-(\w+), (?:none|black)\)/g,
    (_match, channel: string) => /^#[\da-f]{6}$/i.test(colors[channel]) ? colors[channel] : '#141414');
}