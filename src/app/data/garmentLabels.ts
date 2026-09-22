export const LABEL_CATEGORIES = { neck: 'Neck Labels', care: 'Care Labels', tag: 'Sleeve & Hem Tags' } as const;
export type LabelCategory = keyof typeof LABEL_CATEGORIES;
export const LABEL_FOLDS = { straight: 'Straight-cut', end: 'End-fold', centre: 'Centre-fold', mitre: 'Mitre-fold', loop: 'Loop-fold', manhattan: 'Manhattan-fold' } as const;
export const LABEL_SHAPES = { rectangle: 'Rectangle', rounded: 'Rounded rectangle', square: 'Square', oval: 'Oval', circle: 'Circle', horizontal: 'Narrow horizontal', vertical: 'Vertical', custom: 'Custom dimensions' } as const;
export const LABEL_METHODS = { woven: 'Woven', fabric: 'Printed fabric', heat: 'Heat-transfer print', dtf: 'DTF', dtg: 'DTG', screen: 'Screen print' } as const;
export const LABEL_FONTS = ['Inter', 'Arial', 'Helvetica', 'Montserrat', 'Poppins', 'Georgia'];
export const LABEL_POSITIONS = {
  'neck-inside': 'Inside back neck - centered', 'neck-left': 'Inside back neck - left', 'neck-right': 'Inside back neck - right',
  'neck-outside': 'Exterior back neck', 'care-left': 'Inside left side seam', 'care-right': 'Inside right side seam', 'care-hem': 'Inside lower hem',
  'sleeve-left': 'Left sleeve opening', 'sleeve-right': 'Right sleeve opening', 'seam-left': 'Left side seam', 'seam-right': 'Right side seam', 'hem': 'Bottom hem',
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
}

export function labelPositions(category: LabelCategory): LabelPosition[] {
  if (category === 'neck') return ['neck-inside', 'neck-left', 'neck-right'];
  if (category === 'care') return ['care-left', 'care-right', 'neck-inside', 'care-hem'];
  return ['sleeve-left', 'sleeve-right', 'seam-left', 'seam-right', 'hem'];
}

export function createGarmentLabel(category: LabelCategory): GarmentLabel {
  return {
    id: crypto.randomUUID(), category, construction: 'physical', method: category === 'care' ? 'fabric' : 'woven', fold: category === 'neck' ? 'end' : 'centre',
    shape: category === 'care' ? 'vertical' : 'rectangle', widthMm: category === 'care' ? 40 : category === 'tag' ? 20 : 50,
    heightMm: category === 'care' ? 100 : 25, foldMm: 5, marginMm: 2,
    background: '#ffffff', foreground: '#171717', border: '#555555', borderEnabled: false,
    brand: category === 'care' ? '[BRAND]' : '', logoWidth: 55, logoX: 50, logoY: 0, font: 'Montserrat', fontSizeMm: category === 'neck' ? 4.5 : 3, fontWeight: 600, letterSpacingMm: 0, textAlign: 'center',
    position: labelPositions(category)[0], exteriorView: 'front', offsetXmm: 0, offsetYmm: 0, rotation: 0,
    size: category === 'care' ? '[SIZE]' : '', composition: category === 'care' ? '[FIBRE CONTENT]' : '',
    origin: category === 'care' ? '[COUNTRY OF ORIGIN]' : '', business: category === 'care' ? '[BUSINESS DETAILS]' : '',
    additional: '', careText: category === 'care' ? '[CARE INSTRUCTIONS]' : '',
    care: { washing: '', bleaching: '', drying: '', ironing: '', cleaning: '' },
  };
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
    fold: printed || curved ? 'straight' : label.fold,
    borderEnabled: printed ? false : label.borderEnabled,
    position: labelPositions(label.category).includes(label.position) ? label.position : labelPositions(label.category)[0],
    foldMm: finite(label.foldMm, 5, 2, 15), marginMm: finite(label.marginMm, 2, .5, Math.min(widthMm, heightMm) / 3),
    fontSizeMm: finite(label.fontSizeMm, 3, 1.5, 20), logoWidth: finite(label.logoWidth, 55, 5, 100),
    fontWeight: finite(Number(label.fontWeight), 600, 100, 900), letterSpacingMm: finite(label.letterSpacingMm, 0, 0, 5),
    sleeveLayer: label.sleeveLayer === 'under' ? 'under' : 'outer',
    logoX: finite(label.logoX, 50, 0, 100), logoY: finite(label.logoY, 25, 0, 100),
    offsetXmm: finite(label.offsetXmm, 0, -40, 40), offsetYmm: finite(label.offsetYmm, 0, -50, 100),
    rotation: label.category === 'tag' ? finite(label.rotation, 0, -30, 30) : 0,
  };
}

export function unfoldedLabelSize(label: GarmentLabel) {
  const { widthMm: width, heightMm: height, foldMm: fold } = label;
  if (label.construction === 'printed' || label.fold === 'straight') return { width, height };
  if (label.fold === 'end') return { width: width + fold * 2, height };
  if (label.fold === 'mitre') return { width: width + fold * 2, height: height + fold };
  return { width, height: height * 2 + (label.fold === 'manhattan' ? fold * 2 : 0) };
}

export function isInteriorLabel(label: GarmentLabel) {
  return label.position !== 'neck-outside' && (label.position.startsWith('neck-') || label.position.startsWith('care-'));
}

export function labelVisible(label: GarmentLabel, view: 'front' | 'back', interior = false) {
  if (label.category === 'neck' || label.position.startsWith('neck-')) return view === 'front';
  if (isInteriorLabel(label)) return interior;
  return !interior && (label.position === 'neck-outside' ? view === 'back' : view === label.exteriorView);
}

export function labelTextLines(label: GarmentLabel) {
  return labelTextSections(label).map(section => section.text);
}

export function labelTextSections(label: GarmentLabel) {
  return [
    { key: 'brand', text: label.brand }, { key: 'size', text: label.size },
    ...(label.category === 'care' ? [{ key: 'composition', text: label.composition }, { key: 'careText', text: label.careText }, { key: 'origin', text: label.origin }, { key: 'business', text: label.business }] : []),
    { key: 'additional', text: label.additional },
  ].filter(section => section.text.trim());
}

export function labelWarnings(label: GarmentLabel) {
  const warnings: string[] = [];
  if (labelTextSections(label).some(section => /\[[^\]]+\]/.test(section.text))) warnings.push('Replace template placeholders before production');
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
  return { ...label, categoryName: LABEL_CATEGORIES[label.category], manufacturingMethod: LABEL_METHODS[label.method], attachment: LABEL_POSITIONS[label.position],
    finishedMm: { width: label.widthMm, height: label.heightMm }, unfoldedMm: unfoldedLabelSize(label),
    incomplete: labelWarnings(label), productionNote: 'Confirm fold allowances, care instructions, artwork and attachment with the manufacturer before production.' };
}