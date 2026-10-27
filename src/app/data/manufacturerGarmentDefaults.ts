import type { GarmentCategory, GarmentDetail } from './manufacturerOnboardingTypes';

type Suggestions = Pick<GarmentDetail, 'styles' | 'materials' | 'constructionDetails' | 'minGsm' | 'maxGsm'>;

// Editable fabric-weight suggestions, not machine limits or verified abilities.
// GSM refers to the main fabric, not finished garment weight or insulation.
// Commercial reference points: Stanley/Stella Iconics (180 GSM tees, 300–350 GSM
// sweats), Flyer (350 GSM fleece joggers), Jammer Dry (400 GSM French terry).
// https://stanleystella.com/en-pl/collection/ranges/iconics
// https://stanleystella.com/en-us/flyer-sabu006
// https://stanleystella.com/en-gb/jammer-dry-stbu157
// Broad categories span several fabrics; Other intentionally makes no assumptions.
export const GARMENT_DEFAULTS: Record<GarmentCategory, Suggestions> = {
  Hoodies: {
    styles: ['Pullover', 'Full zip', 'Oversized', 'Boxy fit', 'Regular fit'],
    materials: ['Cotton (100%)', 'Cotton / Poly blends', 'Brushed Fleece', 'French Terry'],
    constructionDetails: ['Cut and sew', 'Lined hood', 'Ribbed cuffs and hem', 'Kangaroo pocket'],
    minGsm: 280, maxGsm: 450,
  },
  'T-shirts': {
    styles: ['Regular fit', 'Oversized', 'Boxy fit', 'Slim fit', 'Crewneck', 'Short sleeve'],
    materials: ['Cotton (100%)', 'Cotton / Poly blends', 'Single Jersey'],
    constructionDetails: ['Cut and sew', 'Ribbed neckband', 'Overlocked seams', 'Twin-needle hems'],
    minGsm: 140, maxGsm: 260,
  },
  Sweatshirts: {
    styles: ['Crewneck', 'Regular fit', 'Oversized', 'Drop shoulder', 'Raglan sleeve'],
    materials: ['Cotton (100%)', 'Cotton / Poly blends', 'Brushed Fleece', 'French Terry'],
    constructionDetails: ['Cut and sew', 'Ribbed neckband', 'Ribbed cuffs and hem', 'Overlocked seams'],
    minGsm: 260, maxGsm: 420,
  },
  Joggers: {
    styles: ['Regular fit', 'Relaxed fit', 'Baggy fit', 'Tapered', 'Cuffed ankle', 'Open hem'],
    materials: ['Cotton (100%)', 'Cotton / Poly blends', 'Brushed Fleece', 'French Terry'],
    constructionDetails: ['Elasticated waistband', 'Drawcord waist', 'Side pockets', 'Overlocked seams'],
    minGsm: 260, maxGsm: 400,
  },
  Tracksuits: {
    styles: ['Matching 2-piece', 'Zip jacket + pant', 'Regular fit', 'Relaxed fit', 'Tapered trouser'],
    materials: ['Cotton / Poly blends', 'Polyester', 'Brushed Fleece', 'French Terry', 'Tricot'],
    constructionDetails: ['Zip front', 'Elasticated waistband', 'Side pockets', 'Coordinated top and bottom'],
    minGsm: 220, maxGsm: 360,
  },
  'Zip-up hoodies': {
    styles: ['Full-zip front', 'Regular fit', 'Oversized fit', 'Boxy fit', 'Drop shoulder'],
    materials: ['Cotton (100%)', 'Cotton / Poly blends', 'Brushed Fleece', 'French Terry'],
    constructionDetails: ['Zip front', 'Lined hood', 'Split front pockets', 'Ribbed cuffs and hem'],
    minGsm: 280, maxGsm: 420,
  },
  'Polo shirts': {
    styles: ['Classic piqué', 'Regular fit', 'Slim fit', 'Short sleeve', 'Long sleeve', 'Button collar'],
    materials: ['Cotton (100%)', 'Cotton / Poly blends', 'Piqué', 'Single Jersey'],
    constructionDetails: ['Button placket', 'Knitted collar', 'Set-in sleeves', 'Side vents'],
    minGsm: 180, maxGsm: 240,
  },
  Shorts: {
    styles: ['Sweatshorts', 'Regular fit', 'Relaxed fit', 'Chino shorts', 'Cargo shorts'],
    materials: ['Cotton (100%)', 'Cotton / Poly blends', 'French Terry', 'Canvas / Twill'],
    constructionDetails: ['Side pockets', 'Elasticated waistband', 'Drawcord waist', 'Topstitched hems'],
    minGsm: 180, maxGsm: 320,
  },
  Jackets: {
    styles: ['Bomber', 'Puffer', 'Lightweight', 'Windbreaker', 'Coach jacket', 'Regular fit'],
    materials: ['Nylon', 'Polyester', 'Cotton / Poly blends'],
    constructionDetails: ['Zip front', 'Set-in sleeves', 'Side pockets', 'Lined body'],
    minGsm: 70, maxGsm: 250,
  },
  Jeans: {
    styles: ['Straight leg', 'Slim fit', 'Baggy fit', 'Wide leg', 'Regular rise'],
    materials: ['Denim', 'Stretch Denim', 'Cotton (100%)'],
    constructionDetails: ['Five-pocket construction', 'Zip fly', 'Belt loops', 'Topstitched seams'],
    minGsm: 280, maxGsm: 450,
  },
  Trousers: {
    styles: ['Chino', 'Straight leg', 'Slim fit', 'Wide leg', 'Pleated dress trouser', 'Cargo'],
    materials: ['Cotton (100%)', 'Cotton / Poly blends', 'Canvas / Twill', 'Stretch Twill'],
    constructionDetails: ['Zip fly', 'Belt loops', 'Side pockets', 'Hemmed legs'],
    minGsm: 200, maxGsm: 320,
  },
  Shirts: {
    styles: ['Oxford button-down', 'Regular fit', 'Slim fit', 'Relaxed fit', 'Short sleeve', 'Long sleeve'],
    materials: ['Cotton (100%)', 'Cotton / Poly blends', 'Cotton Poplin', 'Oxford', 'Linen'],
    constructionDetails: ['Button front', 'Collar and stand', 'Back yoke', 'Hemmed body'],
    minGsm: 100, maxGsm: 200,
  },
  Dresses: {
    styles: ['T-shirt dress', 'A-line', 'Shift dress', 'Midi dress', 'Maxi dress'],
    materials: ['Cotton (100%)', 'Single Jersey', 'Viscose / Rayon', 'Cotton Poplin'],
    constructionDetails: ['Cut and sew', 'Shaped side seams', 'Hemmed skirt'],
    minGsm: 120, maxGsm: 240,
  },
  Skirts: {
    styles: ['A-line skirt', 'Mini skirt', 'Midi skirt', 'Maxi skirt', 'Pleated skirt'],
    materials: ['Cotton (100%)', 'Cotton / Poly blends', 'Canvas / Twill', 'Viscose / Rayon'],
    constructionDetails: ['Fitted waistband', 'Side seams', 'Hemmed skirt', 'Zip fastening'],
    minGsm: 140, maxGsm: 280,
  },
  Activewear: {
    styles: ['Leggings', 'Training tops', 'Sports bras', 'Running shorts', 'Training shorts'],
    materials: ['Polyester', 'Nylon', 'Polyester / Elastane', 'Nylon / Elastane', 'Performance Jersey'],
    constructionDetails: ['Cut and sew', 'Stretch seams', 'Elasticated edges'],
    minGsm: 140, maxGsm: 280,
  },
  Outerwear: {
    styles: ['Puffer jacket', 'Parka', 'Windbreaker shell', 'Trench coat', 'Fleece jacket'],
    materials: ['Nylon', 'Polyester', 'Cotton / Poly blends', 'Polyester Fleece'],
    constructionDetails: ['Lined body', 'Front fastening', 'Set-in sleeves', 'Outer pockets'],
    minGsm: 100, maxGsm: 350,
  },
  Headwear: {
    styles: ['Dad hat / 6-panel', 'Snapback', 'Bucket hat', 'Beanie', 'Trucker cap'],
    materials: ['Cotton (100%)', 'Canvas / Twill', 'Polyester', 'Acrylic knit'],
    constructionDetails: ['Panel seaming', 'Topstitching', 'Hemmed or ribbed edge'],
    minGsm: 180, maxGsm: 350,
  },
  Accessories: {
    styles: ['Tote bags', 'Socks', 'Scarves', 'Drawstring bags'],
    materials: ['Cotton (100%)', 'Canvas / Twill', 'Polyester', 'Ribbed knit'],
    constructionDetails: ['Cut and sew', 'Reinforced seams', 'Hemmed edges'],
    minGsm: 150, maxGsm: 400,
  },
  Uniforms: {
    styles: ['Workwear sets', 'Hospitality aprons', 'Polo uniforms', 'Work trousers', 'Uniform shirts'],
    materials: ['Cotton / Poly blends', 'Cotton (100%)', 'Canvas / Twill', 'Piqué'],
    constructionDetails: ['Reinforced seams', 'Topstitching', 'Functional pockets'],
    minGsm: 180, maxGsm: 300,
  },
  Other: { styles: [], materials: [], constructionDetails: [] },
};

export function getGarmentSuggestions(category: string): Suggestions {
  // Legacy workspace names retain their saved names and selections.
  const aliases: Record<string, GarmentCategory> = { 'Zip-ups': 'Zip-up hoodies', Polos: 'Polo shirts' };
  return GARMENT_DEFAULTS[aliases[category] ?? (category as GarmentCategory)] ?? GARMENT_DEFAULTS.Other;
}

export function createGarmentDetail(category: GarmentCategory): GarmentDetail {
  const defaults = getGarmentSuggestions(category);
  return {
    category, ...defaults,
    styles: [...defaults.styles], materials: [...defaults.materials],
    constructionDetails: [...(defaults.constructionDetails ?? [])],
    confirmed: false,
  };
}

export function initializeGarmentDetails(
  categories: GarmentCategory[], existing: Record<string, GarmentDetail> = {},
): Record<string, GarmentDetail> {
  const details = { ...existing };
  for (const category of categories) {
    if (!details[category]) details[category] = createGarmentDetail(category);
  }
  return details;
}

export function garmentReviewError(detail?: GarmentDetail): string | undefined {
  if (!detail?.styles?.length || !detail.materials?.length) {
    return 'Select at least one style and material, or add your own.';
  }
  const weights = [detail.minGsm, detail.maxGsm];
  if (weights.some(value => value !== undefined && (!Number.isFinite(value) || value <= 0))) {
    return 'Fabric weights must be positive numbers.';
  }
  if (detail.minGsm !== undefined && detail.maxGsm !== undefined && detail.minGsm > detail.maxGsm) {
    return 'Minimum GSM cannot exceed maximum GSM.';
  }
}

export function isGarmentConfirmed(detail?: GarmentDetail): detail is GarmentDetail {
  return detail?.confirmed === true && !garmentReviewError(detail);
}
