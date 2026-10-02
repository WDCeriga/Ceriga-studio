import { createGarmentLabel, labelBlocks, type GarmentLabel } from './garmentLabels';
import { getHoodBundleAsset } from './hoodBundles';

export type HoodieLabelView = 'exterior' | 'interior';

const backNeckMappings: Record<string, { center: number; seam: number; arch: number; side: number; bottom: number }> = {
  slim: { center: 1025, seam: 425, arch: 265, side: 390, bottom: 620 },
  regular: { center: 1023, seam: 418, arch: 265, side: 383, bottom: 610 },
  boxy: { center: 1023, seam: 445, arch: 295, side: 402, bottom: 635 },
  cropped: { center: 1021, seam: 460, arch: 292, side: 417, bottom: 656 },
  baggy: { center: 1021, seam: 440, arch: 292, side: 408, bottom: 615 },
};

export function hoodieInnerBackNeck(fit: string, hoodAssetId: string) {
  const neck = backNeckMappings[fit];
  const hood = getHoodBundleAsset(hoodAssetId);
  if (!neck || !hood) return null;
  const scuba = hood.bundle.styleId === 'scuba';
  const deep = hood.bundle.styleId === 'oversized-deep';
  const crossover = hood.variant.frontConstruction === 'crossover';
  const seamY = scuba ? neck.seam - 19 : neck.bottom - (deep ? 100 : 85) - (crossover ? 28 : 0);
  const halfWidth = scuba ? 140 : deep ? 175 : 155;
  const arch = scuba ? neck.arch + 20 : deep ? neck.arch - 30 : neck.arch;
  const side = scuba ? neck.seam - 70 : neck.side;
  const frontEdgeY = seamY + (scuba ? 29 : 34);
  const center = neck.center;
  const minX = center - 65;
  const maxX = center + 65;
  const minY = seamY - 10;
  const maxY = seamY + (scuba ? 48 : 84);
  const panelPath = `M${center - halfWidth} ${arch - 10} H${center + halfWidth} V${maxY + 10} H${center - halfWidth}Z`;
  const seamPath = `M${center - halfWidth} ${seamY + 17} Q${center} ${seamY - 17} ${center + halfWidth} ${seamY + 17}`;
  const exteriorOpeningPath = `M${center} ${arch} C${center - halfWidth * .65} ${arch} ${center - halfWidth} ${side - 60} ${center - halfWidth} ${side} C${center - halfWidth} ${frontEdgeY - 45} ${center - 45} ${frontEdgeY} ${center} ${frontEdgeY} C${center + 45} ${frontEdgeY} ${center + halfWidth} ${frontEdgeY - 45} ${center + halfWidth} ${side} C${center + halfWidth} ${side - 60} ${center + halfWidth * .65} ${arch} ${center} ${arch}Z`;
  const apertureMask = (path: string) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><path fill="white" fill-rule="evenodd" d="M0 0H2048V2048H0Z ${path}"/></svg>`)}")`;
  return {
    id: 'innerBackNeck' as const,
    center: { x: center, y: seamY + 20 },
    bounds: { minX, maxX, minY, maxY },
    rotation: { min: -10, max: 10 },
    scale: { min: .5, max: 2 },
    seamY,
    frontEdgeY,
    panelPath,
    exteriorOpeningPath,
    seamPath,
    seamCoverPath: `M${center - halfWidth - 10} ${arch - 10} H${center + halfWidth + 10} V${seamY + 23} Q${center} ${seamY - 11} ${center - halfWidth - 10} ${seamY + 23}Z`,
    apertureMask: apertureMask(exteriorOpeningPath),
    exteriorApertureMask: apertureMask(exteriorOpeningPath),
    hoodStyle: hood.bundle.styleId,
    construction: hood.variant.frontConstruction,
    occlusion: { exterior: 'partial' as const, interior: 'behind-hood-and-back-seam' as const },
  };
}

export type HoodieInnerBackNeck = NonNullable<ReturnType<typeof hoodieInnerBackNeck>>;

export function hoodieNeckLabelPlacement(label: GarmentLabel, region: HoodieInnerBackNeck, bodyWidth: number) {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const unit = bodyWidth / 500;
  const rotation = clamp(label.rotation, region.rotation.min, region.rotation.max);
  const radians = rotation * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians)), sine = Math.abs(Math.sin(radians));
  const rawWidth = label.widthMm * unit, rawHeight = label.heightMm * unit;
  const rotatedWidth = rawWidth * cosine + rawHeight * sine;
  const rotatedHeight = rawHeight * cosine + rawWidth * sine;
  const { minX, maxX, minY, maxY } = region.bounds;
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
  return label.category === 'neck';
}

export const HOODIE_LABEL_POSITIONS = {
  'sleeve-left': 'Left cuff edge', 'sleeve-right': 'Right cuff edge', hem: 'Waistband edge',
} as const;

export function hoodieLabelAttachment(label: GarmentLabel) {
  if (label.category === 'care') return 'base';
  if (label.category !== 'tag' || label.exteriorView !== 'front') return null;
  if (label.position === 'sleeve-left') return 'sleeveHemLeft';
  if (label.position === 'sleeve-right') return 'sleeveHemRight';
  return label.position === 'hem' ? 'bodyHem' : null;
}

export function hoodieLabelVisibility(label: GarmentLabel) {
  if (isHoodieNeckLabel(label)) return 'Neck preview unavailable: inside back-neck geometry is missing. Label settings are retained.';
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