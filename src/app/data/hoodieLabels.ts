import { createGarmentLabel, labelBlocks, type GarmentLabel } from './garmentLabels';
import type { HoodieNeckGeometry } from './hoodieNeckGeometry';

export type HoodieLabelView = 'exterior' | 'interior';

export type HoodieInnerBackNeck = HoodieNeckGeometry;

export function hoodieNeckLabelPlacement(label: GarmentLabel, region: HoodieInnerBackNeck, bodyWidth: number) {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const unit = bodyWidth / 500;
  const rotation = clamp(label.rotation, region.rotation.min, region.rotation.max);
  const radians = rotation * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians)), sine = Math.abs(Math.sin(radians));
  const rawWidth = label.widthMm * unit, rawHeight = label.heightMm * unit;
  const rotatedWidth = rawWidth * cosine + rawHeight * sine;
  const rotatedHeight = rawHeight * cosine + rawWidth * sine;
  const { minX, maxX } = region.labelAnchor.bounds;
  const minY = Math.min(region.labelAnchor.bounds.minY, region.openingBounds.minY + 24);
  const maxY = label.category === 'care' ? region.bounds.maxY + rawHeight * region.scale.max : region.bounds.maxY;
  const maxScale = Math.min(region.scale.max, (maxX - minX) / rotatedWidth, (maxY - minY) / rotatedHeight);
  if (!Number.isFinite(maxScale) || maxScale < region.scale.min || unit <= 0) return null;
  const scale = clamp(label.neckScale ?? 1, region.scale.min, maxScale);
  const halfWidth = rotatedWidth * scale / 2, halfHeight = rotatedHeight * scale / 2;
  const positionShift = label.position === 'neck-left' ? -(maxX - minX) / 4 : label.position === 'neck-right' ? (maxX - minX) / 4 : 0;
  const x = clamp(region.center.x + positionShift + label.offsetXmm * unit, minX + halfWidth, maxX - halfWidth);
  const defaultY = region.seamY + (label.construction === 'printed' ? 12 : 3) + rawHeight * scale / 2;
  const y = clamp(defaultY + label.offsetYmm * unit, minY + halfHeight, maxY - halfHeight);
  return { x, y, width: rawWidth * scale, height: rawHeight * scale, scale, rotation, unit, halfWidth, halfHeight,
    offsetXmm: (x - region.center.x - positionShift) / unit, offsetYmm: (y - defaultY) / unit };
}

export function isHoodieNeckLabel(label: GarmentLabel) {
  return label.category === 'neck' || (label.category === 'care' && label.position.startsWith('neck-'));
}

export const HOODIE_LABEL_POSITIONS = {
  'sleeve-left': 'Left cuff edge', 'sleeve-right': 'Right cuff edge', hem: 'Waistband edge',
} as const;

export function hoodieLabelAttachment(label: GarmentLabel) {
  if (isHoodieNeckLabel(label)) return null;
  if (label.category === 'care') return 'base';
  if (label.category !== 'tag' || label.exteriorView !== 'front') return null;
  if (label.position === 'sleeve-left') return 'sleeveHemLeft';
  if (label.position === 'sleeve-right') return 'sleeveHemRight';
  return label.position === 'hem' ? 'bodyHem' : null;
}

export function hoodieLabelVisibility(label: GarmentLabel) {
  if (isHoodieNeckLabel(label)) return 'Inside back neck';
  if (label.category === 'care') return 'Interior garment attachment';
  if (label.category === 'hand') return 'Hand tag';
  if (label.exteriorView === 'back') return 'Back attachment: specification only. No back geometry is available.';
  return hoodieLabelAttachment(label) ? 'Front exterior attachment' : 'Specification only: attachment geometry unavailable.';
}

export function createHoodieSizeLabel(): GarmentLabel {
  const label = createGarmentLabel('neck');
  return { ...label, brand: '', widthMm: 15, heightMm: 15, fold: 'centre',
    blocks: labelBlocks(label).map(block => ({ ...block, enabled: block.key === 'size' })) };
}