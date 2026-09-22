import type { GarmentType } from './builderSteps';
import { withLayeredLongSleeves, withLongSleeves } from './tshirtLongSleeves';
import { withTshirtHemStyles, type TshirtHemStyles } from './tshirtHemStyles';

export const GARMENT_NONE = '__none__';

export type GarmentSvgGarmentType = 'tshirt' | 'hoodie' | 'trousers' | 'tshirtTest';

export interface GarmentSvgConfig {
  assetRoot: string;
  categoryOrder: readonly string[];
  optionalCategories: readonly string[];
  detailCategories: readonly string[];
  categoryLayerId: Record<string, string>;
  categoryZIndex: Record<string, number>;
  stepCategories: Partial<Record<number, readonly string[]>>;
  trimBindings: {
    neck?: readonly string[];
    sleeve?: readonly string[];
    cuff?: readonly string[];
    pocket?: readonly string[];
  };
  splitSleeves: boolean;
  splitSleeveHems: boolean;
  /**
   * Every part in this pack is a closed fill region covering its share of the
   * garment, so the builder can offer one colour per part rather than a single
   * fabric colour plus trims.
   */
  perPartColors?: boolean;
  /** Categories that still render but are chosen for the user by `selectionLinks`. */
  hiddenCategories?: readonly string[];
  /**
   * Parts that have to be cut to fit each other, so choosing one picks the other.
   * A neckline is the case that needs it: the opening is punched out of the body
   * fill, so a V-neck only looks right on a body cut with a V-shaped opening.
   */
  selectionLinks?: readonly {
    from: string;
    to: string;
    /** When set, the link only runs for this pack fit. */
    whenFit?: string;
    /** Display name in `from` -> display name it forces in `to`. */
    map: Readonly<Record<string, string>>;
  }[];
  /** Pack-specific body fits shown on the measurements step. */
  fits?: readonly { id: string; name: string }[];
  /**
   * Parts the fit owns: picking Slim or Boxy swaps these so the body, sleeves
   * and hems stay a matching cut. Categories left out stay the user's choice
   * (the neckline, as long as that neck is offered on the fit).
   */
  fitParts?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /**
   * Default choice per category for a fit when nothing is selected yet.
   * Used for Neck, which is not in `fitParts` so the user can still switch it.
   */
  fitPreferred?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** Extra fits an asset may appear in, besides the one its name belongs to. */
  assetAlsoInFits?: Readonly<Record<string, readonly string[]>>;
  /**
   * The pack is the complete definition of the garment, so construction steps it
   * has no parts for are hidden rather than falling back to the generic option
   * lists. Packs that rely on those fallbacks must leave this off.
   */
  restrictStepsToPack?: boolean;
  sleeveCategory?: string;
  sleeveHemCategory?: string;
  previewStepMax: number;
  layerLabels: Record<string, string>;
}

export interface GarmentAsset {
  id: string;
  category: string;
  fileName: string;
  displayName: string;
  svgRaw: string;
  garmentType: GarmentSvgGarmentType;
}

export type GarmentAssetSelection = Partial<Record<string, string>>;

/** Runtime neck traced from an uploaded photo, seated on the slim test tee. */
export const CUSTOM_COLLAR_NECK_ID = 'tshirtTest/Neck/Custom collar';
export const CUSTOM_COLLAR_BODY_ID = 'tshirtTest/Body/Body Custom collar';
export const CUSTOM_COLLAR_NECK_PREFIX = 'tshirtTest/Neck/custom:';
export const CUSTOM_COLLAR_BODY_PREFIX = 'tshirtTest/Body/custom:';
export const CUSTOM_COLLAR_NECK_NAME = 'Custom collar';
export const CUSTOM_COLLAR_BODY_NAME = 'Body Custom collar';

export interface CustomCollarSvgs {
  id?: string;
  neckSvg: string;
  bodySvg: string;
  fileName?: string;
  source?: string;
  kind?: 'vneck' | 'crew' | 'mock';
  displayName?: string;
}

export function newCustomCollarId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function uniqueCustomCollarName(base: string, existing: string[]): string {
  const cleaned = (base || 'Uploaded collar').trim() || 'Uploaded collar';
  const taken = new Set(existing.map((name) => name.toLowerCase()));
  if (!taken.has(cleaned.toLowerCase())) return cleaned;
  let n = 2;
  while (taken.has(`${cleaned} ${n}`.toLowerCase())) n += 1;
  return `${cleaned} ${n}`;
}

export function customCollarNeckId(id: string): string {
  return `${CUSTOM_COLLAR_NECK_PREFIX}${id}`;
}

export function customCollarBodyId(id: string): string {
  return `${CUSTOM_COLLAR_BODY_PREFIX}${id}`;
}

export function customCollarPairId(assetId?: string): string | undefined {
  if (!assetId) return undefined;
  if (assetId.startsWith(CUSTOM_COLLAR_NECK_PREFIX)) {
    return assetId.slice(CUSTOM_COLLAR_NECK_PREFIX.length);
  }
  if (assetId.startsWith(CUSTOM_COLLAR_BODY_PREFIX)) {
    return assetId.slice(CUSTOM_COLLAR_BODY_PREFIX.length);
  }
  if (assetId === CUSTOM_COLLAR_NECK_ID || assetId === CUSTOM_COLLAR_BODY_ID) {
    return 'legacy';
  }
  return undefined;
}

export function isCustomCollarNeckId(id?: string): boolean {
  return !!id && (id === CUSTOM_COLLAR_NECK_ID || id.startsWith(CUSTOM_COLLAR_NECK_PREFIX));
}

export function isCustomCollarBodyId(id?: string): boolean {
  return !!id && (id === CUSTOM_COLLAR_BODY_ID || id.startsWith(CUSTOM_COLLAR_BODY_PREFIX));
}

export function isCustomCollarAssetId(id?: string): boolean {
  return isCustomCollarNeckId(id) || isCustomCollarBodyId(id);
}

export function listCustomCollars(
  custom?: CustomCollarSvgs | CustomCollarSvgs[] | null,
  extra?: CustomCollarSvgs[] | null,
): CustomCollarSvgs[] {
  const list: CustomCollarSvgs[] = [];
  const push = (entry?: CustomCollarSvgs | null) => {
    if (!entry) return;
    const id = entry.id || 'legacy';
    if (list.some((item) => (item.id || 'legacy') === id)) return;
    list.push({ ...entry, id });
  };
  if (Array.isArray(custom)) custom.forEach(push);
  else push(custom);
  extra?.forEach(push);
  return list;
}

function virtualCustomAsset(
  assetId: string,
  custom?: CustomCollarSvgs | CustomCollarSvgs[] | null,
): GarmentAsset | undefined {
  const list = listCustomCollars(custom);
  if (list.length === 0) return undefined;
  const pair = customCollarPairId(assetId);
  const found =
    (pair ? list.find((entry) => (entry.id || 'legacy') === pair) : undefined) ??
    (pair === 'legacy' ? list[0] : undefined);
  if (!found) return undefined;
  if (isCustomCollarNeckId(assetId)) {
    return {
      id: assetId,
      category: 'Neck',
      fileName: `${found.displayName || CUSTOM_COLLAR_NECK_NAME}.svg`,
      displayName: found.displayName || CUSTOM_COLLAR_NECK_NAME,
      svgRaw: found.neckSvg,
      garmentType: 'tshirtTest',
    };
  }
  if (isCustomCollarBodyId(assetId)) {
    return {
      id: assetId,
      category: 'Body',
      fileName: `Body ${found.displayName || CUSTOM_COLLAR_BODY_NAME}.svg`,
      displayName: found.displayName ? `Body ${found.displayName}` : CUSTOM_COLLAR_BODY_NAME,
      svgRaw: found.bodySvg,
      garmentType: 'tshirtTest',
    };
  }
  return undefined;
}

export interface ResolvedGarmentLayer {
  id: string;
  category: string;
  assetId: string;
  displayName: string;
  svgRaw: string;
  kind: 'solid' | 'detail';
  tint?: string;
  zIndex: number;
}

export interface ResolveGarmentLayersInput {
  garmentType: GarmentSvgGarmentType;
  selection: GarmentAssetSelection;
  neckTrimColor?: string;
  sleeveTrimColor?: string;
  cuffTrimColor?: string;
  pocketTrimColor?: string;
  /** Thread colour for the dashed topstitch layer. */
  stitchingColor?: string;
  /** Per-layer colour, keyed by layer id. Overrides the fabric colour and trim bindings. */
  partColors?: Partial<Record<string, string>>;
  tshirtHemStyles?: TshirtHemStyles;
  /** Pack fit, so neck→body links stay on the slim or boxy cut. */
  fit?: string;
  /** Photo-traced collar + matching body cut, used when Neck is a custom upload. */
  customCollar?: CustomCollarSvgs | null;
  customCollars?: CustomCollarSvgs[];
}

/**
 * Premium Cotton T-Shirt — slim, regular, boxy ringer, and oversized
 * drop-shoulder from the photo line art in `src/assets/studio-tshirt`.
 * Closed fills, construction outline on top, dashed cover-stitch separate.
 * Collar (front + back band) is one Neck colour. Inner back always follows a
 * lighter body colour. Fit swaps the matching cut; Neck is a user choice
 * (crew, thin crew, V, deep V, scoop, or polo) and pulls the matching body / inner / outline / stitch.
 */
const TSHIRT_CONFIG: GarmentSvgConfig = {
  assetRoot: 'studio-tshirt',
  categoryOrder: [
    'Sleeve length',
    'Body',
    'Left sleeve',
    'Right sleeve',
    'Body hem',
    'Left cuff',
    'Right cuff',
    'Inner back neck',
    'Neck',
    'Outline',
    'Stitching',
  ],
  optionalCategories: [],
  detailCategories: ['Stitching'],
  categoryLayerId: {
    Body: 'base',
    'Left sleeve': 'sleeveLeft',
    'Right sleeve': 'sleeveRight',
    'Body hem': 'bodyHem',
    'Left cuff': 'sleeveHemLeft',
    'Right cuff': 'sleeveHemRight',
    'Inner back neck': 'innerBackNeck',
    Neck: 'neck',
    Outline: 'outline',
    Stitching: 'stitching',
  },
  categoryZIndex: {
    Body: 20,
    'Left sleeve': 24,
    'Right sleeve': 24,
    'Body hem': 30,
    'Left cuff': 32,
    'Right cuff': 32,
    Neck: 45,
    'Inner back neck': 40,
    Outline: 70,
    Stitching: 80,
  },
  stepCategories: {
    2: ['Body'],
    3: ['Neck'],
    4: ['Sleeve length', 'Left sleeve', 'Right sleeve'],
    5: ['Body hem', 'Left cuff', 'Right cuff'],
    8: ['Stitching'],
  },
  trimBindings: {
    neck: ['Neck'],
    sleeve: ['Left sleeve', 'Right sleeve'],
    cuff: ['Left cuff', 'Right cuff'],
  },
  splitSleeves: false,
  splitSleeveHems: false,
  perPartColors: true,
  restrictStepsToPack: true,
  hiddenCategories: [
    'Body',
    'Left sleeve',
    'Right sleeve',
    'Body hem',
    'Left cuff',
    'Right cuff',
    'Inner back neck',
    'Outline',
    'Stitching',
  ],
  fits: [
    { id: 'slim', name: 'Slim' },
    { id: 'regular', name: 'Regular' },
    { id: 'boxy', name: 'Boxy' },
    { id: 'oversized', name: 'Oversized' },
  ],
  fitParts: {
    slim: {
      Body: 'Body',
      'Left sleeve': 'Left sleeve',
      'Right sleeve': 'Right sleeve',
      'Body hem': 'Body hem',
      'Left cuff': 'Left cuff',
      'Right cuff': 'Right cuff',
      'Inner back neck': 'Inner back neck',
      Outline: 'Outline',
      Stitching: 'Cover stitch',
    },
    regular: {
      Body: 'Body (regular)',
      'Left sleeve': 'Left sleeve (regular)',
      'Right sleeve': 'Right sleeve (regular)',
      'Body hem': 'Body hem (regular)',
      'Left cuff': 'Left cuff (regular)',
      'Right cuff': 'Right cuff (regular)',
      'Inner back neck': 'Inner back neck (regular)',
      Outline: 'Outline (regular)',
      Stitching: 'Cover stitch (regular)',
    },
    boxy: {
      Body: 'Body (boxy)',
      'Left sleeve': 'Left sleeve (boxy)',
      'Right sleeve': 'Right sleeve (boxy)',
      'Body hem': 'Body hem (boxy)',
      'Left cuff': 'Left cuff (boxy)',
      'Right cuff': 'Right cuff (boxy)',
      'Inner back neck': 'Inner back neck (boxy)',
      Outline: 'Outline (boxy)',
      Stitching: 'Cover stitch (boxy)',
    },
    oversized: {
      Body: 'Body (oversized)',
      'Left sleeve': 'Left sleeve (oversized)',
      'Right sleeve': 'Right sleeve (oversized)',
      'Body hem': 'Body hem (oversized)',
      'Left cuff': 'Left cuff (oversized)',
      'Right cuff': 'Right cuff (oversized)',
      'Inner back neck': 'Inner back neck (oversized)',
      Outline: 'Outline (oversized)',
      Stitching: 'Cover stitch (oversized)',
    },
  },
  fitPreferred: {
    slim: { Neck: 'V-neck', 'Sleeve length': 'Short sleeve (slim)' },
    regular: { Neck: 'Crew neck (regular)', 'Sleeve length': 'Short sleeve (regular)' },
    boxy: { Neck: 'Crew neck (boxy)', 'Sleeve length': 'Short sleeve (boxy)' },
    oversized: { Neck: 'Crew neck (oversized)', 'Sleeve length': 'Short sleeve (oversized)' },
  },
  selectionLinks: [
    {
      from: 'Neck',
      to: 'Body',
      map: {
        'V-neck': 'Body',
        'Crew neck': 'Body crew',
        'Crew neck (regular)': 'Body (regular)',
        'V-neck (regular)': 'Body V-neck (regular)',
        'Crew neck (boxy)': 'Body (boxy)',
        'V-neck (boxy)': 'Body V-neck (boxy)',
        'Crew neck (oversized)': 'Body (oversized)',
        'V-neck (oversized)': 'Body V-neck (oversized)',
        'Scoop neck': 'Body scoop',
        'Scoop neck (regular)': 'Body Scoop neck (regular)',
        'Scoop neck (boxy)': 'Body Scoop neck (boxy)',
        'Scoop neck (oversized)': 'Body Scoop neck (oversized)',
        'Deep V-neck': 'Body deep V-neck',
        'Deep V-neck (regular)': 'Body Deep V-neck (regular)',
        'Deep V-neck (boxy)': 'Body Deep V-neck (boxy)',
        'Deep V-neck (oversized)': 'Body Deep V-neck (oversized)',
        'Polo collar': 'Body polo collar',
        'Polo collar (regular)': 'Body Polo collar (regular)',
        'Polo collar (boxy)': 'Body Polo collar (boxy)',
        'Polo collar (oversized)': 'Body Polo collar (oversized)',
        'Thin crew neck': 'Body thin crew',
        'Thin crew neck (regular)': 'Body Thin crew neck (regular)',
        'Thin crew neck (boxy)': 'Body Thin crew neck (boxy)',
        'Thin crew neck (oversized)': 'Body Thin crew neck (oversized)',
      },
    },
    {
      from: 'Neck',
      to: 'Inner back neck',
      map: {
        'V-neck': 'Inner back neck',
        'Crew neck': 'Inner back neck crew',
        'Crew neck (regular)': 'Inner back neck (regular)',
        'V-neck (regular)': 'Inner back neck V-neck (regular)',
        'Crew neck (boxy)': 'Inner back neck (boxy)',
        'V-neck (boxy)': 'Inner back neck V-neck (boxy)',
        'Crew neck (oversized)': 'Inner back neck (oversized)',
        'V-neck (oversized)': 'Inner back neck V-neck (oversized)',
        'Scoop neck': 'Inner back neck scoop',
        'Scoop neck (regular)': 'Inner back neck Scoop neck (regular)',
        'Scoop neck (boxy)': 'Inner back neck Scoop neck (boxy)',
        'Scoop neck (oversized)': 'Inner back neck Scoop neck (oversized)',
        'Deep V-neck': 'Inner back neck deep V-neck',
        'Deep V-neck (regular)': 'Inner back neck Deep V-neck (regular)',
        'Deep V-neck (boxy)': 'Inner back neck Deep V-neck (boxy)',
        'Deep V-neck (oversized)': 'Inner back neck Deep V-neck (oversized)',
        'Polo collar': 'Inner back neck polo collar',
        'Polo collar (regular)': 'Inner back neck Polo collar (regular)',
        'Polo collar (boxy)': 'Inner back neck Polo collar (boxy)',
        'Polo collar (oversized)': 'Inner back neck Polo collar (oversized)',
        'Thin crew neck': 'Inner back neck thin crew',
        'Thin crew neck (regular)': 'Inner back neck Thin crew neck (regular)',
        'Thin crew neck (boxy)': 'Inner back neck Thin crew neck (boxy)',
        'Thin crew neck (oversized)': 'Inner back neck Thin crew neck (oversized)',
      },
    },
    {
      from: 'Neck',
      to: 'Outline',
      map: {
        'V-neck': 'Outline',
        'Crew neck': 'Outline crew',
        'Crew neck (regular)': 'Outline (regular)',
        'V-neck (regular)': 'Outline V-neck (regular)',
        'Crew neck (boxy)': 'Outline (boxy)',
        'V-neck (boxy)': 'Outline V-neck (boxy)',
        'Crew neck (oversized)': 'Outline (oversized)',
        'V-neck (oversized)': 'Outline V-neck (oversized)',
        'Scoop neck': 'Outline scoop',
        'Scoop neck (regular)': 'Outline Scoop neck (regular)',
        'Scoop neck (boxy)': 'Outline Scoop neck (boxy)',
        'Scoop neck (oversized)': 'Outline Scoop neck (oversized)',
        'Deep V-neck': 'Outline deep V-neck',
        'Deep V-neck (regular)': 'Outline Deep V-neck (regular)',
        'Deep V-neck (boxy)': 'Outline Deep V-neck (boxy)',
        'Deep V-neck (oversized)': 'Outline Deep V-neck (oversized)',
        'Polo collar': 'Outline polo collar',
        'Polo collar (regular)': 'Outline Polo collar (regular)',
        'Polo collar (boxy)': 'Outline Polo collar (boxy)',
        'Polo collar (oversized)': 'Outline Polo collar (oversized)',
        'Thin crew neck': 'Outline thin crew',
        'Thin crew neck (regular)': 'Outline Thin crew neck (regular)',
        'Thin crew neck (boxy)': 'Outline Thin crew neck (boxy)',
        'Thin crew neck (oversized)': 'Outline Thin crew neck (oversized)',
      },
    },
    {
      from: 'Neck',
      to: 'Stitching',
      map: {
        'V-neck': 'Cover stitch',
        'Crew neck': 'Cover stitch crew',
        'Crew neck (regular)': 'Cover stitch (regular)',
        'V-neck (regular)': 'Cover stitch V-neck (regular)',
        'Crew neck (boxy)': 'Cover stitch (boxy)',
        'V-neck (boxy)': 'Cover stitch V-neck (boxy)',
        'Crew neck (oversized)': 'Cover stitch (oversized)',
        'V-neck (oversized)': 'Cover stitch V-neck (oversized)',
        'Scoop neck': 'Cover stitch scoop',
        'Scoop neck (regular)': 'Cover stitch Scoop neck (regular)',
        'Scoop neck (boxy)': 'Cover stitch Scoop neck (boxy)',
        'Scoop neck (oversized)': 'Cover stitch Scoop neck (oversized)',
        'Deep V-neck': 'Cover stitch deep V-neck',
        'Deep V-neck (regular)': 'Cover stitch Deep V-neck (regular)',
        'Deep V-neck (boxy)': 'Cover stitch Deep V-neck (boxy)',
        'Deep V-neck (oversized)': 'Cover stitch Deep V-neck (oversized)',
        'Polo collar': 'Cover stitch polo collar',
        'Polo collar (regular)': 'Cover stitch Polo collar (regular)',
        'Polo collar (boxy)': 'Cover stitch Polo collar (boxy)',
        'Polo collar (oversized)': 'Cover stitch Polo collar (oversized)',
        'Thin crew neck': 'Cover stitch thin crew',
        'Thin crew neck (regular)': 'Cover stitch Thin crew neck (regular)',
        'Thin crew neck (boxy)': 'Cover stitch Thin crew neck (boxy)',
        'Thin crew neck (oversized)': 'Cover stitch Thin crew neck (oversized)',
      },
    },
  ],
  previewStepMax: 8,
  layerLabels: {
    fill: 'Fill',
    base: 'Body',
    sleeveLeft: 'Left sleeve',
    sleeveRight: 'Right sleeve',
    bodyHem: 'Bottom hem',
    sleeveHemLeft: 'Left cuff',
    sleeveHemRight: 'Right cuff',
    underlayerHemLeft: 'Left underlayer sleeve hem',
    underlayerHemRight: 'Right underlayer sleeve hem',
    innerBackNeck: 'Inner back',
    neck: 'Neck',
    outline: 'Outline',
    stitching: 'Stitching',
  },
};

const HOODIE_CONFIG: GarmentSvgConfig = {
  assetRoot: 'hoodie',
  categoryOrder: [
    'base',
    'sleeves',
    'Neckline',
    'hood',
    'pockets',
    'drawstrings',
    'zips',
    'zip pull',
    'fading',
    'stitching',
  ],
  optionalCategories: [
    'pockets',
    'drawstrings',
    'zips',
    'zip pull',
    'fading',
    'stitching',
  ],
  detailCategories: ['zips', 'zip pull'],
  categoryLayerId: {
    base: 'base',
    sleeves: 'sleeves',
    Neckline: 'neck',
    hood: 'hood',
    pockets: 'pocket',
    drawstrings: 'drawstring',
    zips: 'zip',
    'zip pull': 'zipPull',
    fading: 'fading',
    stitching: 'stitching',
  },
  categoryZIndex: {
    sleeves: 0,
    base: 20,
    Neckline: 28,
    hood: 32,
    fading: 38,
    pockets: 52,
    drawstrings: 56,
    zips: 60,
    'zip pull': 70,
    stitching: 75,
  },
  stepCategories: {
    2: ['base'],
    3: ['Neckline', 'hood'],
    4: ['sleeves'],
    6: ['pockets', 'zips', 'zip pull', 'drawstrings'],
    7: ['fading'],
    8: ['stitching'],
  },
  trimBindings: {
    neck: ['Neckline', 'hood'],
    pocket: ['pockets', 'zips', 'zip pull', 'drawstrings'],
  },
  splitSleeves: true,
  splitSleeveHems: false,
  sleeveCategory: 'sleeves',
  previewStepMax: 8,
  layerLabels: {
    fill: 'Fill',
    base: 'Base',
    sleeves: 'Sleeves',
    sleeveLeft: 'Left sleeve',
    sleeveRight: 'Right sleeve',
    neck: 'Neckline',
    hood: 'Hood',
    pocket: 'Pocket',
    drawstring: 'Drawstring',
    zip: 'Zip',
    zipPull: 'Zip pull',
    fading: 'Fading',
    stitching: 'Stitching',
  },
};

const TROUSER_CONFIG: GarmentSvgConfig = {
  assetRoot: 'trousers',
  categoryOrder: [
    'trouser base',
    'trouser fits',
    'trouser fabrics',
    'trouser bottom hem',
    'Trouser hem',
    'trouser pockets',
    'trouser drawstring',
    'trouser fading',
  ],
  optionalCategories: ['trouser fabrics', 'trouser pockets', 'trouser drawstring', 'trouser fading'],
  detailCategories: ['trouser drawstring'],
  categoryLayerId: {
    'trouser base': 'base',
    'trouser fits': 'fit',
    'trouser fabrics': 'fabric',
    'trouser bottom hem': 'bodyHem',
    'Trouser hem': 'trouserHem',
    'trouser pockets': 'pocket',
    'trouser drawstring': 'drawstring',
    'trouser fading': 'fading',
  },
  categoryZIndex: {
    'trouser base': 20,
    'trouser fits': 22,
    'trouser fabrics': 24,
    'trouser bottom hem': 50,
    'Trouser hem': 52,
    'trouser pockets': 55,
    'trouser drawstring': 58,
    'trouser fading': 65,
  },
  stepCategories: {
    2: ['trouser base', 'trouser fits'],
    5: ['trouser bottom hem', 'Trouser hem'],
    6: ['trouser pockets', 'trouser drawstring'],
    7: ['trouser fading'],
  },
  trimBindings: {
    pocket: ['trouser pockets', 'trouser drawstring'],
  },
  splitSleeves: false,
  splitSleeveHems: false,
  previewStepMax: 7,
  layerLabels: {
    fill: 'Fill',
    base: 'Base',
    fit: 'Fit',
    fabric: 'Fabric',
    bodyHem: 'Bottom hem',
    trouserHem: 'Leg hem',
    pocket: 'Pocket',
    drawstring: 'Drawstring',
    fading: 'Fading',
  },
};

/**
 * Test pack traced from the slim crew photo in `src/assets/tshirt-test`.
 *
 * Every part is a closed fill region with no construction ink on the fabric.
 * Dashed cover-stitch is a separate colourable layer. Boxy and V-neck cuts
 * were removed when this pack was rebuilt from the TallSlim reference.
 */
const TSHIRT_TEST_CONFIG: GarmentSvgConfig = {
  assetRoot: 'tshirt-test',
  categoryOrder: [
    'Body',
    'Left sleeve',
    'Right sleeve',
    'Body hem',
    'Left cuff',
    'Right cuff',
    'Neck',
    'Stitching',
  ],
  optionalCategories: [],
  detailCategories: ['Stitching'],
  categoryLayerId: {
    Body: 'base',
    'Left sleeve': 'sleeveLeft',
    'Right sleeve': 'sleeveRight',
    'Body hem': 'bodyHem',
    'Left cuff': 'sleeveHemLeft',
    'Right cuff': 'sleeveHemRight',
    Neck: 'neck',
    Stitching: 'stitching',
  },
  categoryZIndex: {
    Body: 20,
    'Left sleeve': 24,
    'Right sleeve': 24,
    'Body hem': 30,
    'Left cuff': 32,
    'Right cuff': 32,
    Neck: 40,
    Stitching: 80,
  },
  stepCategories: {
    2: ['Body'],
    3: ['Neck'],
    4: ['Left sleeve', 'Right sleeve'],
    5: ['Body hem', 'Left cuff', 'Right cuff'],
    8: ['Stitching'],
  },
  trimBindings: {
    neck: ['Neck'],
    sleeve: ['Left sleeve', 'Right sleeve'],
    cuff: ['Left cuff', 'Right cuff'],
  },
  splitSleeves: false,
  splitSleeveHems: false,
  perPartColors: true,
  restrictStepsToPack: true,
  hiddenCategories: [
    'Body',
    'Left sleeve',
    'Right sleeve',
    'Body hem',
    'Left cuff',
    'Right cuff',
    'Stitching',
  ],
  fits: [{ id: 'slim', name: 'Slim' }],
  fitParts: {
    slim: {
      Body: 'Body',
      Neck: 'Crew neck',
      'Left sleeve': 'Left sleeve',
      'Right sleeve': 'Right sleeve',
      'Body hem': 'Body hem',
      'Left cuff': 'Left cuff',
      'Right cuff': 'Right cuff',
      Stitching: 'Cover stitch',
    },
  },
  selectionLinks: [
    {
      from: 'Neck',
      to: 'Body',
      whenFit: 'slim',
      map: {
        'Crew neck': 'Body',
        'Custom collar': 'Body Custom collar',
      },
    },
  ],
  previewStepMax: 8,
  layerLabels: {
    fill: 'Fill',
    base: 'Body',
    sleeveLeft: 'Left sleeve',
    sleeveRight: 'Right sleeve',
    bodyHem: 'Bottom hem',
    sleeveHemLeft: 'Left cuff',
    sleeveHemRight: 'Right cuff',
    neck: 'Neck',
    stitching: 'Stitching',
  },
};

const GARMENT_CONFIGS: Record<GarmentSvgGarmentType, GarmentSvgConfig> = {
  tshirt: TSHIRT_CONFIG,
  hoodie: HOODIE_CONFIG,
  trousers: TROUSER_CONFIG,
  tshirtTest: TSHIRT_TEST_CONFIG,
};

const svgModules = {
  ...import.meta.glob('../../assets/tshirts/**/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../assets/studio-tshirt/**/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../assets/hoodie/**/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../assets/trousers/**/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../assets/tshirt-test/**/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
} as Record<string, string>;

function fileNameToDisplayName(fileName: string): string {
  return fileName.replace(/\.svg$/i, '');
}

function parseGlobPath(
  globPath: string,
  garmentType: GarmentSvgGarmentType,
): { category: string; fileName: string } | null {
  const config = GARMENT_CONFIGS[garmentType];
  const normalized = globPath.replace(/\\/g, '/');
  const match = normalized.match(
    new RegExp(`/assets/${config.assetRoot}/([^/]+)/([^/]+\\.svg)$`, 'i'),
  );
  if (!match) return null;
  return { category: match[1], fileName: match[2] };
}

const ALL_ASSETS: GarmentAsset[] = (Object.keys(GARMENT_CONFIGS) as GarmentSvgGarmentType[]).flatMap(
  (garmentType) => {
    const config = GARMENT_CONFIGS[garmentType];
    return Object.entries(svgModules)
      .map(([path, svgRaw]) => {
        const parsed = parseGlobPath(path, garmentType);
        if (!parsed) return null;
        const { category, fileName } = parsed;
        if (!config.categoryOrder.includes(category)) return null;
        return {
          id: `${garmentType}/${category}/${fileNameToDisplayName(fileName)}`,
          category,
          fileName,
          displayName: fileNameToDisplayName(fileName),
          svgRaw,
          garmentType,
        };
      })
      .filter((asset): asset is GarmentAsset => asset !== null);
  },
);

const assetsByGarmentAndCategory = new Map<string, GarmentAsset[]>();
for (const garmentType of Object.keys(GARMENT_CONFIGS) as GarmentSvgGarmentType[]) {
  for (const category of GARMENT_CONFIGS[garmentType].categoryOrder) {
    assetsByGarmentAndCategory.set(`${garmentType}:${category}`, []);
  }
}
for (const asset of ALL_ASSETS) {
  const list = assetsByGarmentAndCategory.get(`${asset.garmentType}:${asset.category}`);
  if (list) list.push(asset);
}
for (const list of assetsByGarmentAndCategory.values()) {
  list.sort((a, b) =>
    a.category === 'Sleeve length'
      ? Number(b.displayName.startsWith('Short sleeve')) - Number(a.displayName.startsWith('Short sleeve')) || a.displayName.localeCompare(b.displayName)
      : a.displayName.localeCompare(b.displayName, undefined, { numeric: true }),
  );
}

const layerStepMaps = new Map<GarmentSvgGarmentType, Record<string, number>>();
for (const garmentType of Object.keys(GARMENT_CONFIGS) as GarmentSvgGarmentType[]) {
  const config = GARMENT_CONFIGS[garmentType];
  const map: Record<string, number> = { fill: 2 };
  for (const [stepKey, categories] of Object.entries(config.stepCategories)) {
    const step = Number(stepKey);
    for (const category of categories ?? []) {
      const layerId = config.categoryLayerId[category];
      if (layerId) map[layerId] = step;
    }
  }
  if (config.splitSleeves) {
    map.sleeveLeft = map.sleeves ?? 4;
    map.sleeveRight = map.sleeves ?? 4;
  }
  if (config.splitSleeveHems) {
    map.sleeveHemLeft = map.sleeveHem ?? 5;
    map.sleeveHemRight = map.sleeveHem ?? 5;
  }
  if (garmentType === 'tshirt') {
    map.underlayerHemLeft = 5;
    map.underlayerHemRight = 5;
  }
  layerStepMaps.set(garmentType, map);
}

/**
 * Resolve catalog garment types onto an SVG asset pack.
 * Shorts share the trousers / joggers asset folders under `src/assets/trousers`.
 */
export function resolveGarmentSvgType(garmentType: GarmentType): GarmentSvgGarmentType | null {
  if (garmentType === 'tshirt' || garmentType === 'hoodie' || garmentType === 'trousers') {
    return garmentType;
  }
  if (garmentType === 'shorts') return 'trousers';
  return null;
}

/** A product can pin itself to a specific SVG pack instead of the one its garment type implies. */
export function resolveProductSvgType(
  garmentType: GarmentType,
  svgPack?: GarmentSvgGarmentType,
): GarmentSvgGarmentType | null {
  return svgPack ?? resolveGarmentSvgType(garmentType);
}

export function isGarmentSvgGarmentType(garmentType: GarmentType): boolean {
  return resolveGarmentSvgType(garmentType) !== null;
}

export function supportsGarmentSvgPreview(garmentType: GarmentType): boolean {
  return resolveGarmentSvgType(garmentType) !== null;
}

export function getGarmentSvgConfig(garmentType: GarmentSvgGarmentType): GarmentSvgConfig {
  return GARMENT_CONFIGS[garmentType];
}

export function getGarmentAssets(
  garmentType: GarmentSvgGarmentType,
  category: string,
): GarmentAsset[] {
  return assetsByGarmentAndCategory.get(`${garmentType}:${category}`) ?? [];
}

export function getGarmentPackFits(garmentType: GarmentSvgGarmentType) {
  return GARMENT_CONFIGS[garmentType].fits ?? [];
}

export function resolveGarmentPackFit(
  garmentType: GarmentSvgGarmentType,
  fit?: string,
): string | undefined {
  const fits = GARMENT_CONFIGS[garmentType].fits;
  if (!fits?.length) return undefined;
  if (fit && fits.some((option) => option.id === fit)) return fit;
  return fits[0].id;
}

function inferAssetFitId(displayName: string): string {
  const tagged = displayName.match(/\(([^)]+)\)\s*$/);
  return tagged ? tagged[1].toLowerCase() : 'slim';
}

const PACK_FIT_TAG = /\s+\((slim|regular|boxy|oversized)\)\s*$/i;

/** Strip the trailing `(boxy)` fit tag so the neck grid can say "V-neck". */
export function garmentChoiceLabel(displayName: string): string {
  return displayName.replace(PACK_FIT_TAG, '');
}

function neckStyleKey(
  displayName: string,
): 'vneck' | 'deepvneck' | 'crew' | 'thincrew' | 'scoop' | 'polo' | 'other' {
  const name = displayName.toLowerCase();
  if (/\bdeep\s+v-?neck\b/.test(name)) return 'deepvneck';
  if (/\bpolo\b/.test(name)) return 'polo';
  if (/\bv-?neck\b/.test(name)) return 'vneck';
  if (/\bscoop\b/.test(name)) return 'scoop';
  if (/\bthin\s+crew\b/.test(name)) return 'thincrew';
  if (/\bcrew\b/.test(name)) return 'crew';
  return 'other';
}

function pickFitFallbackAsset(
  allowed: GarmentAsset[],
  currentDisplayName?: string,
  preferredDisplayName?: string,
): GarmentAsset {
  if (currentDisplayName) {
    const sameChoice = allowed.find(asset => garmentChoiceLabel(asset.displayName) === garmentChoiceLabel(currentDisplayName));
    if (sameChoice) return sameChoice;
    const style = neckStyleKey(currentDisplayName);
    if (style !== 'other') {
      const match = allowed.find((asset) => neckStyleKey(asset.displayName) === style);
      if (match) return match;
    }
  }
  if (preferredDisplayName) {
    const preferred = allowed.find((asset) => asset.displayName === preferredDisplayName);
    if (preferred) return preferred;
  }
  return allowed[0];
}

export function isAssetAvailableForFit(
  garmentType: GarmentSvgGarmentType,
  asset: GarmentAsset,
  fit: string,
): boolean {
  const config = GARMENT_CONFIGS[garmentType];
  if (!config.fits?.length) return true;
  if (inferAssetFitId(asset.displayName) === fit) return true;
  return config.assetAlsoInFits?.[asset.displayName]?.includes(fit) ?? false;
}

export function getGarmentAssetsForFit(
  garmentType: GarmentSvgGarmentType,
  category: string,
  fit?: string,
): GarmentAsset[] {
  const assets = getGarmentAssets(garmentType, category);
  const resolvedFit = resolveGarmentPackFit(garmentType, fit);
  if (!resolvedFit) return assets;
  return assets.filter((asset) => isAssetAvailableForFit(garmentType, asset, resolvedFit));
}

export function getGarmentAsset(assetId: string): GarmentAsset | undefined {
  return ALL_ASSETS.find((asset) => asset.id === assetId);
}

export function getDefaultGarmentSelection(
  garmentType: GarmentSvgGarmentType,
  fit?: string,
): GarmentAssetSelection {
  const config = GARMENT_CONFIGS[garmentType];
  const resolvedFit = resolveGarmentPackFit(garmentType, fit);
  const selection: GarmentAssetSelection = {};
  for (const category of config.categoryOrder) {
    const assets = getGarmentAssetsForFit(garmentType, category, resolvedFit);
    selection[category] = config.optionalCategories.includes(category)
      ? GARMENT_NONE
      : assets[0]?.id ?? GARMENT_NONE;
  }
  const preferred = resolvedFit ? config.fitPreferred?.[resolvedFit] : undefined;
  if (preferred) {
    for (const [category, displayName] of Object.entries(preferred)) {
      const asset = getGarmentAssetsForFit(garmentType, category, resolvedFit).find(
        (candidate) => candidate.displayName === displayName,
      );
      if (asset) selection[category] = asset.id;
    }
  }
  return applyGarmentSelectionLinks(garmentType, selection, resolvedFit);
}

export function getGarmentCategoriesForStep(
  garmentType: GarmentSvgGarmentType,
  step: number,
): string[] {
  return [...(GARMENT_CONFIGS[garmentType].stepCategories[step] ?? [])];
}

/** The step's categories minus the ones another category chooses on the user's behalf. */
export function getGarmentChoiceCategoriesForStep(
  garmentType: GarmentSvgGarmentType,
  step: number,
): string[] {
  const hidden = GARMENT_CONFIGS[garmentType].hiddenCategories ?? [];
  return getGarmentCategoriesForStep(garmentType, step).filter(
    (category) => !hidden.includes(category),
  );
}

/**
 * Bring linked categories in line with what drives them, so a body cut for a
 * crew neck can never be left showing under a V-neck.
 */
export function applyGarmentSelectionLinks(
  garmentType: GarmentSvgGarmentType,
  selection: GarmentAssetSelection,
  fit?: string,
): GarmentAssetSelection {
  const links = GARMENT_CONFIGS[garmentType].selectionLinks;
  const resolvedFit = fit ? resolveGarmentPackFit(garmentType, fit) : undefined;
  let next = selection;
  if (isCustomCollarNeckId(selection.Neck) && resolvedFit === 'slim') {
    const pair = customCollarPairId(selection.Neck);
    next = {
      ...next,
      Body: pair === 'legacy' || !pair ? CUSTOM_COLLAR_BODY_ID : customCollarBodyId(pair),
    };
  }
  if (!links?.length) return next;
  for (const link of links) {
    if (link.whenFit && link.whenFit !== resolvedFit) continue;
    const source = getGarmentAsset(selection[link.from] ?? '');
    const wanted = source && link.map[source.displayName];
    if (!wanted) continue;

    const target = getGarmentAssets(garmentType, link.to).find(
      (asset) => asset.displayName === wanted,
    );
    if (!target || next[link.to] === target.id) continue;
    next = { ...next, [link.to]: target.id };
  }
  return next;
}

/**
 * Lock the parts the current fit owns, drop any choice that fit does not offer,
 * then apply neck→body cut links so a V-neck never sits on a crew body.
 */
export function applyGarmentFitAndLinks(
  garmentType: GarmentSvgGarmentType,
  selection: GarmentAssetSelection,
  fit?: string,
): GarmentAssetSelection {
  const config = GARMENT_CONFIGS[garmentType];
  const resolvedFit = resolveGarmentPackFit(garmentType, fit);
  let next = { ...selection };

  if (resolvedFit && config.fitParts?.[resolvedFit]) {
    for (const [category, displayName] of Object.entries(config.fitParts[resolvedFit])) {
      const asset = getGarmentAssets(garmentType, category).find(
        (candidate) => candidate.displayName === displayName,
      );
      if (asset) next[category] = asset.id;
    }
  }

  if (resolvedFit) {
    for (const category of config.categoryOrder) {
      const allowed = getGarmentAssetsForFit(garmentType, category, resolvedFit);
      const current = next[category];
      const keepCustom =
        resolvedFit === 'slim' &&
        ((category === 'Neck' && isCustomCollarNeckId(current)) ||
          (category === 'Body' && isCustomCollarBodyId(current)));
      if (
        allowed.length &&
        !allowed.some((asset) => asset.id === current) &&
        !keepCustom
      ) {
        next[category] = pickFitFallbackAsset(
          allowed,
          ['Neck', 'Sleeve length'].includes(category) ? getGarmentAsset(current ?? '')?.displayName : undefined,
          config.fitPreferred?.[resolvedFit]?.[category],
        ).id;
      }
    }
  }

  return applyGarmentSelectionLinks(garmentType, next, resolvedFit);
}

export function garmentLayerForBuilderStep(
  garmentType: GarmentSvgGarmentType,
  step: number,
): string | null {
  const categories = getGarmentCategoriesForStep(garmentType, step);
  const first = categories[0];
  if (!first) return null;
  return GARMENT_CONFIGS[garmentType].categoryLayerId[first] ?? null;
}

export function garmentBuilderStepForLayerId(
  garmentType: GarmentSvgGarmentType,
  layerId: string,
): number | null {
  return layerStepMaps.get(garmentType)?.[layerId] ?? null;
}

export function garmentLayerLabel(layerId: string, garmentType?: GarmentSvgGarmentType): string {
  if (garmentType) {
    return GARMENT_CONFIGS[garmentType].layerLabels[layerId] ?? layerId;
  }
  for (const config of Object.values(GARMENT_CONFIGS)) {
    if (config.layerLabels[layerId]) return config.layerLabels[layerId];
  }
  return layerId;
}

export function garmentSourceLayerId(garmentType: GarmentSvgGarmentType, layerId: string): string {
  const config = GARMENT_CONFIGS[garmentType];
  if (config.splitSleeves && (layerId === 'sleeveLeft' || layerId === 'sleeveRight')) {
    return 'sleeves';
  }
  if (config.splitSleeveHems && (layerId === 'sleeveHemLeft' || layerId === 'sleeveHemRight')) {
    return 'sleeveHem';
  }
  return layerId;
}

export function garmentTransformStorageId(layerId: string): string {
  return layerId;
}

export function isGarmentCategoryOptional(
  garmentType: GarmentSvgGarmentType,
  category: string,
): boolean {
  return GARMENT_CONFIGS[garmentType].optionalCategories.includes(category);
}

export function getGarmentSelectionLabel(
  garmentType: GarmentSvgGarmentType,
  selection: GarmentAssetSelection,
  category: string,
): string {
  const id = selection[category];
  if (!id || id === GARMENT_NONE) return 'None';
  if (isCustomCollarNeckId(id)) return CUSTOM_COLLAR_NECK_NAME;
  if (isCustomCollarBodyId(id)) return CUSTOM_COLLAR_BODY_NAME;
  const name = getGarmentAsset(id)?.displayName ?? id.split('/').pop() ?? 'None';
  return garmentChoiceLabel(name);
}

export function getGarmentSpecRows(
  garmentType: GarmentSvgGarmentType,
  selection: GarmentAssetSelection,
): Array<{ label: string; value: string }> {
  const config = GARMENT_CONFIGS[garmentType];
  const hidden = config.hiddenCategories ?? [];
  return config.categoryOrder
    .filter(
      (category) =>
        !hidden.includes(category) &&
        config.stepCategories &&
        Object.values(config.stepCategories).flat().includes(category),
    )
    .map((category) => ({
      label: category,
      value: getGarmentSelectionLabel(garmentType, selection, category),
    }));
}

function trimForCategory(
  garmentType: GarmentSvgGarmentType,
  category: string,
  input: ResolveGarmentLayersInput,
): string | undefined {
  const { trimBindings } = GARMENT_CONFIGS[garmentType];
  if (trimBindings.neck?.includes(category)) return input.neckTrimColor;
  if (trimBindings.sleeve?.includes(category)) return input.sleeveTrimColor;
  if (trimBindings.cuff?.includes(category)) return input.cuffTrimColor;
  if (trimBindings.pocket?.includes(category)) return input.pocketTrimColor;
  return undefined;
}

export function resolveGarmentLayers(input: ResolveGarmentLayersInput): ResolvedGarmentLayer[] {
  const config = GARMENT_CONFIGS[input.garmentType];
  const selection = applyGarmentSelectionLinks(
    input.garmentType,
    input.selection,
    input.fit,
  );
  const layers: ResolvedGarmentLayer[] = [];

  for (const category of config.categoryOrder) {
    const assetId = selection[category];
    if (!assetId || assetId === GARMENT_NONE) continue;

    const asset =
      getGarmentAsset(assetId) ??
      virtualCustomAsset(assetId, listCustomCollars(input.customCollar, input.customCollars));
    if (!asset) continue;

    const layerId = config.categoryLayerId[category];
    if (!layerId) continue;

    layers.push({
      id: layerId,
      category,
      assetId: asset.id,
      displayName: asset.displayName,
      svgRaw: asset.svgRaw,
      kind: config.detailCategories.includes(category) ? 'detail' : 'solid',
      tint:
        input.partColors?.[layerId] ??
        (layerId === 'stitching' ? input.stitchingColor : undefined) ??
        trimForCategory(input.garmentType, category, input),
      zIndex: config.categoryZIndex[category] ?? 0,
    });
  }

  const sleeveChoice = getGarmentAsset(selection['Sleeve length'] ?? '');
  const fit = resolveGarmentPackFit(input.garmentType, input.fit) ?? 'slim';
  const layered = sleeveChoice?.displayName.startsWith('Layered Long Sleeve');
  const sleeveVariant = sleeveChoice?.displayName.startsWith('Cap Sleeve')
    ? 'cap' : sleeveChoice?.displayName.startsWith('Longer short sleeve')
    ? 'longer-short' : sleeveChoice?.displayName.startsWith('Long sleeve') ? 'long' : undefined;
  let resolved = input.garmentType === 'tshirt' && layered
    ? withLayeredLongSleeves(layers, fit, input.partColors)
    : input.garmentType === 'tshirt' && sleeveVariant
    ? withLongSleeves(layers, fit, sleeveVariant)
    : layers;
  if (input.garmentType === 'tshirt') {
    resolved = withTshirtHemStyles(resolved, fit, layered ? 'layered-long' : sleeveVariant ?? 'short', input.tshirtHemStyles);
  }
  return resolved.sort((a, b) => a.zIndex - b.zIndex);
}
