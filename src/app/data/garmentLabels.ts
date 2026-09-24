export const LABEL_CATEGORIES = { neck: 'Neck Labels', care: 'Care Labels', tag: 'Sleeve & Hem Tags', hand: 'Hand Tags' } as const;
export type LabelCategory = keyof typeof LABEL_CATEGORIES;
export const LABEL_FOLDS = { straight: 'Straight cut', end: 'End fold', centre: 'Centre fold', mitre: 'Mitre fold', loop: 'Loop fold', manhattan: 'Manhattan fold', die: 'Die cut' } as const;
export const LABEL_REGIONS = { top: 'Top - brand / logo', upper: 'Middle - size', middle: 'Bottom - composition / content', lower: 'Bottom - care', bottom: 'Bottom - origin / business' } as const;
export type LabelRegion = keyof typeof LABEL_REGIONS;
export interface LabelRegionTransform { x: number; y: number; scale: number; rotation: number; flipX: boolean; flipY: boolean }
export const DEFAULT_REGION_TRANSFORM: LabelRegionTransform = { x: 0, y: 0, scale: 100, rotation: 0, flipX: false, flipY: false };
export const LABEL_PRESETS = { classic: 'Classic', framed: 'Framed', minimal: 'Essential', 'brand-led': 'Brand first', 'size-led': 'Size first', 'care-stack': 'Care stack' } as const;
export const LABEL_SIZE_VERTICAL = { top: 'Top', 'upper-middle': 'Upper Middle', center: 'Centre', 'lower-middle': 'Lower Middle', bottom: 'Bottom' } as const;
export const LABEL_SHAPES = { rectangle: 'Rectangle', rounded: 'Rounded rectangle', square: 'Square', oval: 'Oval', circle: 'Circle', horizontal: 'Narrow horizontal', vertical: 'Vertical', custom: 'Custom dimensions' } as const;
export const LABEL_METHODS = { woven: 'Woven', fabric: 'Printed fabric', heat: 'Heat-transfer print', dtf: 'DTF', dtg: 'DTG', screen: 'Screen print' } as const;
export const LABEL_FONTS = ['Inter', 'Arial', 'Helvetica', 'Montserrat', 'Poppins', 'Georgia'];
export const LABEL_POSITIONS = {
  'neck-inside': 'Inside back neck - centered', 'neck-left': 'Inside back neck - left', 'neck-right': 'Inside back neck - right',
  'neck-outside': 'Exterior back neck', 'care-left': 'Inside left side seam', 'care-right': 'Inside right side seam', 'care-hem': 'Inside lower hem',
  'sleeve-left': 'Left sleeve opening', 'sleeve-right': 'Right sleeve opening', 'seam-left': 'Left side seam', 'seam-right': 'Right side seam', 'hem': 'Bottom hem', 'hand': 'Swing tag - cord attachment',
} as const;
export type LabelPosition = keyof typeof LABEL_POSITIONS;
export const CARE_OPTIONS = {
  washing: { '': 'Incomplete', 'no': 'Do not wash', '30': 'Wash at 30 C', '40': 'Wash at 40 C', '60': 'Wash at 60 C' },
  bleaching: { '': 'Incomplete', 'no': 'Do not bleach', 'any': 'Any bleach', 'oxygen': 'Non-chlorine bleach only' },
  drying: { '': 'Incomplete', 'no': 'Do not tumble dry', 'low': 'Tumble dry low', 'normal': 'Tumble dry normal', 'flat': 'Dry flat', 'line': 'Line dry' },
  ironing: { '': 'Incomplete', 'no': 'Do not iron', 'low': 'Iron low', 'medium': 'Iron medium', 'high': 'Iron high' },
  cleaning: { '': 'Incomplete', 'no': 'Do not dry clean', 'P': 'Professional dry clean - P', 'F': 'Professional dry clean - F' },
} as const;
export type CareCategory = keyof typeof CARE_OPTIONS;
export const LABEL_BLOCKS = { brand: 'Brand / logo', size: 'Size', composition: 'Fibre composition', careText: 'Care information', origin: 'Country of origin', business: 'Company details', additional: 'Footer' } as const;
export type LabelBlockKey = keyof typeof LABEL_BLOCKS;
export const LABEL_HIERARCHIES = { 'brand-first': 'Brand first', 'size-first': 'Size first', 'large-size-top': 'Large size top', 'large-size-bottom': 'Large size bottom', inline: 'Brand + inline size', split: 'Split' } as const;
export interface LabelBlock {
  key: LabelBlockKey;
  enabled: boolean;
  alignment: 'left' | 'center' | 'right';
  font: string;
  fontData?: string;
  fontWeight: number;
  fontSizeMm: number;
  color: string;
  spaceAboveMm: number;
  spaceBelowMm: number;
  share: number;
}
export type TagFaceDesign = Pick<GarmentLabel, 'brand' | 'logo' | 'logoWidth' | 'logoX' | 'logoY' | 'size' | 'composition' | 'careText' | 'care' | 'origin' | 'business' | 'additional' | 'background' | 'foreground' | 'border' | 'borderEnabled' | 'font' | 'fontData' | 'fontWeight' | 'fontSizeMm' | 'letterSpacingMm' | 'textAlign' | 'sizePosition' | 'sizeVertical' | 'sizeFontSizeMm' | 'sizeScale' | 'regions' | 'blocks' | 'hierarchy' | 'preset' | 'editingMode' | 'position' | 'offsetXmm' | 'offsetYmm' | 'rotation' | 'sleeveLayer'>;
const TAG_FACE_FIELDS = ['brand', 'logo', 'logoWidth', 'logoX', 'logoY', 'size', 'composition', 'careText', 'care', 'origin', 'business', 'additional', 'background', 'foreground', 'border', 'borderEnabled', 'font', 'fontData', 'fontWeight', 'fontSizeMm', 'letterSpacingMm', 'textAlign', 'sizePosition', 'sizeVertical', 'sizeFontSizeMm', 'sizeScale', 'regions', 'blocks', 'hierarchy', 'preset', 'editingMode', 'position', 'offsetXmm', 'offsetYmm', 'rotation', 'sleeveLayer'] as const;
export interface GarmentLabel {
  id: string;
  category: LabelCategory;
  construction: 'physical' | 'printed';
  method: keyof typeof LABEL_METHODS;
  fold: keyof typeof LABEL_FOLDS;
  shape: keyof typeof LABEL_SHAPES;
  widthMm: number;
  heightMm: number;
  foldMm: number;
  marginMm: number;
  background: string;
  foreground: string;
  border: string;
  borderEnabled: boolean;
  brand: string;
  logo?: { name: string; data: string; aspect: number };
  logoWidth: number;
  logoX: number;
  logoY: number;
  font: string;
  fontData?: string;
  fontSizeMm: number;
  fontWeight: number;
  letterSpacingMm: number;
  textAlign: 'left' | 'center' | 'right';
  position: LabelPosition;
  exteriorView: 'front' | 'back';
  sleeveLayer?: 'outer' | 'under';
  offsetXmm: number;
  offsetYmm: number;
  rotation: number;
  size: string;
  composition: string;
  origin: string;
  business: string;
  additional: string;
  careText: string;
  care: Record<CareCategory, string>;
  editingMode?: 'preset' | 'custom';
  preset?: keyof typeof LABEL_PRESETS;
  sizePosition?: 'left' | 'center' | 'right';
  sizeVertical?: keyof typeof LABEL_SIZE_VERTICAL;
  sizeFontSizeMm?: number;
  sizeScale?: number;
  regions?: Partial<Record<LabelRegion, LabelRegionTransform>>;
  blocks?: LabelBlock[];
  hierarchy?: keyof typeof LABEL_HIERARCHIES;
  faces?: Partial<Record<'front' | 'back', TagFaceDesign>>;
}

export const MANUFACTURER_CARE_NOTE = 'Manufacturer will add care label based on how it was made.';
export const PREVIEW_CARE: Record<CareCategory, string> = { washing: '30', bleaching: 'no', drying: 'low', ironing: 'low', cleaning: 'no' };

export function generatedCareText(label: GarmentLabel) {
  const care = label.blocks ? PREVIEW_CARE : label.care;
  return (Object.keys(CARE_OPTIONS) as CareCategory[]).map(key => (CARE_OPTIONS[key] as Record<string, string>)[care[key]] ?? '').filter(text => text && text !== 'Incomplete').join('\n');
}

export function labelBlocks(label: GarmentLabel): LabelBlock[] {
  if (label.blocks) return label.blocks;
  return (Object.keys(LABEL_BLOCKS) as LabelBlockKey[]).map(key => ({
    key, enabled: key === 'brand' ? Boolean(label.logo || label.brand.trim()) : key === 'careText' ? Boolean(label.careText.trim() || Object.values(label.care).some(Boolean)) : Boolean(label[key].trim()),
    alignment: key === 'size' ? label.sizePosition ?? 'center' : label.textAlign,
    font: label.font, fontData: label.fontData, fontWeight: key === 'brand' ? Math.max(700, label.fontWeight) : key === 'size' ? 600 : 400,
    fontSizeMm: key === 'brand' ? label.fontSizeMm * 1.5 : key === 'size' ? label.sizeFontSizeMm ?? label.fontSizeMm * 1.15 : Math.max(1.5, label.fontSizeMm * .85),
    color: label.foreground, spaceAboveMm: 0, spaceBelowMm: .5,
    share: key === 'brand' ? 3 : key === 'size' ? 2 : key === 'careText' ? 3 : 1,
  }));
}

export function applyLabelHierarchy(label: GarmentLabel, hierarchy: keyof typeof LABEL_HIERARCHIES): GarmentLabel {
  const order: LabelBlockKey[] = hierarchy === 'size-first' || hierarchy === 'large-size-top'
    ? ['size', 'brand', 'composition', 'careText', 'origin', 'business', 'additional']
    : hierarchy === 'large-size-bottom' ? ['brand', 'composition', 'careText', 'origin', 'business', 'additional', 'size']
      : ['brand', 'size', 'composition', 'careText', 'origin', 'business', 'additional'];
  const blocks = labelBlocks(label);
  return { ...label, hierarchy, blocks: order.map(key => {
    const block = blocks.find(candidate => candidate.key === key)!;
    return { ...block, ...(key === 'brand' ? { share: hierarchy === 'brand-first' ? 4 : 2, alignment: hierarchy === 'split' ? 'left' as const : block.alignment } : {}),
      ...(key === 'size' ? { share: hierarchy.startsWith('large-size') ? 5 : hierarchy === 'size-first' ? 4 : 2, fontSizeMm: hierarchy.startsWith('large-size') ? 9 : 5, alignment: hierarchy === 'split' ? 'right' as const : block.alignment } : {}) };
  }) };
}

function captureTagFace(label: GarmentLabel): TagFaceDesign {
  return structuredClone(Object.fromEntries(TAG_FACE_FIELDS.map(key => [key, label[key]]))) as TagFaceDesign;
}

export function switchTagFace(label: GarmentLabel, side: 'front' | 'back'): GarmentLabel {
  if (label.category !== 'tag' || side === label.exteriorView) return label;
  const blank = createGarmentLabel('tag');
  blank.brand = ''; blank.blocks = labelBlocks(blank).map(block => ({ ...block, enabled: false }));
  const design = label.faces?.[side] ?? captureTagFace(blank);
  return { ...label, ...structuredClone(design), exteriorView: side, faces: { ...label.faces, [label.exteriorView]: captureTagFace(label) } };
}

export function copyTagFrontToBack(label: GarmentLabel): GarmentLabel {
  const front = label.exteriorView === 'front' ? captureTagFace(label) : label.faces?.front;
  if (!front) return label;
  return { ...label, ...(label.exteriorView === 'back' ? structuredClone(front) : {}), faces: { ...label.faces, back: structuredClone(front) } };
}

export function labelExportFaces(label: GarmentLabel): GarmentLabel[] {
  return [label];
}

export function labelPositions(category: LabelCategory): LabelPosition[] {
  if (category === 'neck') return ['neck-inside', 'neck-left', 'neck-right'];
  if (category === 'care') return ['care-left', 'care-right', 'neck-inside', 'care-hem'];
  if (category === 'hand') return ['hand'];
  return ['sleeve-left', 'sleeve-right', 'seam-left', 'seam-right', 'hem'];
}

export function createGarmentLabel(category: LabelCategory): GarmentLabel {
  const label: GarmentLabel = {
    id: crypto.randomUUID(), category, construction: 'physical', method: category === 'care' || category === 'hand' ? 'fabric' : 'woven', fold: category === 'neck' ? 'end' : category === 'hand' ? 'die' : 'centre',
    shape: category === 'care' ? 'vertical' : 'rectangle', widthMm: category === 'care' ? 40 : category === 'tag' ? 20 : 50,
    heightMm: category === 'care' ? 100 : category === 'hand' ? 85 : 25, foldMm: 5, marginMm: 2,
    background: '#ffffff', foreground: '#171717', border: '#555555', borderEnabled: false,
    brand: category === 'tag' ? '' : 'YOUR BRAND', logoWidth: 70, logoX: 50, logoY: 50, font: 'Montserrat', fontSizeMm: category === 'neck' ? 4.5 : 3, fontWeight: 600, letterSpacingMm: 0, textAlign: 'center',
    position: labelPositions(category)[0], exteriorView: 'front', offsetXmm: 0, offsetYmm: 0, rotation: 0,
    size: category === 'tag' ? '' : 'M', composition: category === 'care' ? '100% COTTON' : category === 'hand' ? 'ESSENTIAL COLLECTION' : '',
    origin: category === 'care' ? '[COUNTRY OF ORIGIN]' : '', business: '',
    additional: '', careText: category === 'care' ? MANUFACTURER_CARE_NOTE : '',
    care: { washing: '', bleaching: '', drying: '', ironing: '', cleaning: '' },
    editingMode: 'preset', preset: 'classic', sizePosition: 'center', sizeVertical: 'center', sizeFontSizeMm: category === 'neck' ? 4 : 3.45, sizeScale: 100, regions: {},
  };
  const blocks = labelBlocks(label);
  return { ...label, careText: category === 'care' ? generatedCareText({ ...label, blocks }) : '', blocks, hierarchy: 'brand-first' };
}

export function applyLabelPreset(label: GarmentLabel, preset: keyof typeof LABEL_PRESETS): GarmentLabel {
  if (preset === 'care-stack' && label.construction === 'physical' && label.method === 'woven') return label;
  const styled = applyLabelHierarchy(label, preset === 'size-led' ? 'size-first' : 'brand-first');
  return normalizeLabel({ ...styled, preset, regions: {}, fontWeight: preset === 'minimal' ? 400 : 600,
    sizePosition: preset === 'care-stack' ? 'left' : 'center', sizeVertical: 'center',
    sizeScale: preset === 'minimal' ? 80 : 100,
    sizeFontSizeMm: preset === 'size-led' ? 6 : label.category === 'neck' ? 4 : 3.45,
    borderEnabled: preset === 'framed',
    blocks: styled.blocks!.map(block => ({ ...block,
      enabled: block.key === 'careText' ? preset === 'care-stack' || label.category === 'care' : block.enabled,
      share: block.key === 'careText' ? preset === 'care-stack' ? 6 : 3 : preset === 'classic' && block.key === 'brand' ? 2 : block.share,
      fontWeight: preset === 'minimal' ? 400 : block.key === 'brand' ? 700 : block.key === 'size' ? 600 : 400,
      spaceAboveMm: preset === 'framed' ? 1 : 0,
      spaceBelowMm: preset === 'minimal' ? 1.5 : .5,
    })),
  });
}

export function normalizeLabel(label: GarmentLabel): GarmentLabel {
  const finite = (value: number, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : fallback));
  const printed = label.category === 'neck' && label.construction === 'printed';
  const curved = ['oval', 'circle'].includes(label.shape);
  const widthMm = finite(label.widthMm, 40, 8, 150);
  const heightMm = ['circle', 'square'].includes(label.shape) ? widthMm : finite(label.heightMm, 25, 8, 250);
  return { ...label, widthMm, heightMm,
    construction: printed ? 'printed' : 'physical',
    method: printed ? (['heat', 'dtf', 'dtg', 'screen'].includes(label.method) ? label.method : 'heat') : (['woven', 'fabric'].includes(label.method) ? label.method : 'woven'),
    fold: printed ? 'straight' : curved ? 'die' : label.fold,
    borderEnabled: label.borderEnabled,
    position: labelPositions(label.category).includes(label.position) ? label.position : labelPositions(label.category)[0],
    foldMm: finite(label.foldMm, 5, 2, 15), marginMm: finite(label.marginMm, 2, .5, Math.min(widthMm, heightMm) / 3),
    fontSizeMm: finite(label.fontSizeMm, 3, 1.5, 20), logoWidth: finite(label.logoWidth, 55, 5, 100),
    fontWeight: finite(Number(label.fontWeight), 600, 100, 900), letterSpacingMm: finite(label.letterSpacingMm, 0, 0, 5),
    sleeveLayer: label.sleeveLayer === 'under' ? 'under' : 'outer',
    logoX: finite(label.logoX, 50, 0, 100), logoY: finite(label.logoY, 25, 0, 100),
    offsetXmm: finite(label.offsetXmm, 0, -40, 40), offsetYmm: finite(label.offsetYmm, 0, -50, 100),
    rotation: label.category === 'tag' ? finite(label.rotation, 0, -30, 30) : 0,
    editingMode: label.editingMode === 'custom' ? 'custom' : 'preset',
    preset: label.preset && label.preset in LABEL_PRESETS ? label.preset : 'classic',
    sizePosition: label.sizePosition === 'left' || label.sizePosition === 'right' ? label.sizePosition : 'center',
    sizeVertical: label.sizeVertical && label.sizeVertical in LABEL_SIZE_VERTICAL ? label.sizeVertical : 'center',
    sizeFontSizeMm: finite(label.sizeFontSizeMm ?? label.fontSizeMm * 1.15, 3.45, 1.5, 20),
    sizeScale: finite(label.sizeScale ?? 100, 100, 20, 100),
    hierarchy: label.hierarchy && label.hierarchy in LABEL_HIERARCHIES ? label.hierarchy : 'brand-first',
    ...(label.blocks ? { blocks: labelBlocks({ ...label, blocks: undefined }).map(fallback => {
      const block = label.blocks!.find(candidate => candidate.key === fallback.key);
      return block ? { ...fallback, ...block, enabled: Boolean(block.enabled),
        alignment: ['left', 'center', 'right'].includes(block.alignment) ? block.alignment : fallback.alignment,
        fontSizeMm: finite(block.fontSizeMm, fallback.fontSizeMm, 1.5, 20), fontWeight: finite(block.fontWeight, fallback.fontWeight, 100, 900),
        spaceAboveMm: finite(block.spaceAboveMm, 0, 0, 20), spaceBelowMm: finite(block.spaceBelowMm, .5, 0, 20), share: finite(block.share, 1, 1, 10),
      } : { ...fallback, enabled: false };
    }).sort((first, second) => label.blocks!.findIndex(block => block.key === first.key) - label.blocks!.findIndex(block => block.key === second.key)), careText: generatedCareText(label) } : {}),
    regions: Object.fromEntries(Object.keys(LABEL_REGIONS).map(region => {
      const value = { ...DEFAULT_REGION_TRANSFORM, ...label.regions?.[region as LabelRegion] };
      return [region, { x: finite(value.x, 0, -100, 100), y: finite(value.y, 0, -100, 100), scale: finite(value.scale, 100, 20, 150), rotation: finite(value.rotation, 0, -180, 180), flipX: Boolean(value.flipX), flipY: Boolean(value.flipY) }];
    })),
  };
}

export function unfoldedLabelSize(label: GarmentLabel) {
  const { widthMm: width, heightMm: height, foldMm: fold } = label;
  if (label.construction === 'printed' || label.fold === 'straight' || label.fold === 'die') return { width, height };
  if (label.fold === 'end') return { width: width + fold * 2, height };
  if (label.fold === 'mitre') return { width: width + fold * 2, height: height + fold };
  return { width, height: height * 2 + (label.fold === 'manhattan' ? fold * 2 : 0) };
}

export function isInteriorLabel(label: GarmentLabel) {
  return label.position !== 'neck-outside' && (label.position.startsWith('neck-') || label.position.startsWith('care-'));
}

export function labelVisible(label: GarmentLabel, view: 'front' | 'back', interior = false) {
  if (label.category === 'hand') return false;
  if (label.category === 'neck' || label.position.startsWith('neck-')) return view === 'front';
  if (isInteriorLabel(label)) return interior;
  return !interior && (label.position === 'neck-outside' ? view === 'back' : view === label.exteriorView);
}

export function labelTextLines(label: GarmentLabel) {
  return labelTextSections(label).map(section => section.text);
}

export function labelTextSections(label: GarmentLabel) {
  if (label.blocks) return label.blocks.filter(block => block.enabled).map(block => ({ key: block.key, text: block.key === 'brand' && label.logo ? '' : block.key === 'careText' ? generatedCareText(label) : label[block.key] })).filter(section => section.text.trim());
  return [
    { key: 'brand', text: label.logo ? '' : label.brand }, { key: 'size', text: label.size },
    ...(['neck', 'care', 'hand'].includes(label.category) ? [{ key: 'composition', text: label.composition }, { key: 'careText', text: label.careText }, { key: 'origin', text: label.origin }] : []),
    { key: 'business', text: label.business },
    { key: 'additional', text: label.additional },
  ].filter(section => section.text.trim());
}

export function labelWarnings(label: GarmentLabel) {
  const warnings: string[] = [];
  if (labelTextSections(label).some(section => /\[[^\]]+\]/.test(section.text))) warnings.push('Replace template placeholders before production');
  if (label.blocks) {
    for (const block of label.blocks.filter(block => block.enabled)) {
      if (block.key !== 'careText' && !(block.key === 'brand' && label.logo) && !label[block.key].trim()) warnings.push(`${LABEL_BLOCKS[block.key]} incomplete`);
    }
    return warnings;
  }
  if (!label.brand.trim() && !label.logo) warnings.push('Brand artwork incomplete');
  if (label.category === 'care') {
    for (const category of Object.keys(CARE_OPTIONS) as CareCategory[]) {
      if (!label.care[category]) warnings.push(`${category[0].toUpperCase() + category.slice(1)} symbol incomplete`);
    }
    for (const [key, value] of Object.entries({ size: label.size, composition: label.composition, origin: label.origin, 'care instructions': label.careText || Object.values(label.care).filter(Boolean).join('') })) {
      if (!value.trim()) warnings.push(`${key[0].toUpperCase() + key.slice(1)} incomplete`);
    }
  }
  return warnings;
}

export function labelSpecification(label: GarmentLabel) {
  return { ...label, ...(label.category === 'tag' && label.faces ? { faces: { ...label.faces, [label.exteriorView]: captureTagFace(label) } } : {}), categoryName: LABEL_CATEGORIES[label.category], manufacturingMethod: LABEL_METHODS[label.method], attachment: LABEL_POSITIONS[label.position],
    ...(label.blocks ? { care: { washing: '', bleaching: '', drying: '', ironing: '', cleaning: '' }, careText: label.blocks.some(block => block.key === 'careText' && block.enabled) ? MANUFACTURER_CARE_NOTE : '', careResponsibility: 'manufacturer' } : {}),
    finishedMm: { width: label.widthMm, height: label.heightMm }, unfoldedMm: unfoldedLabelSize(label),
    incomplete: labelWarnings(label), productionNote: 'Confirm fold allowances, care instructions, artwork and attachment with the manufacturer before production.' };
}