import type { GarmentType } from './builderSteps';

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

/** Keep uploaded names intact; simplify only built-in hoodie hood labels. */
export function getGarmentAssetOptionLabel(
  asset: Pick<GarmentAsset, 'id' | 'displayName'>,
): string {
  if (!asset.id.startsWith('hoodie/Hood/')) return asset.displayName;
  const name = asset.displayName.replace(/\s*\((boxy|cropped|baggy|regular|slim)\)\s*$/i, '');
  return name === 'Hood' ? 'Regular Hood' : name === 'Scuba hood' ? 'Scuba Hood'
    : name === 'Funnel-hood hybrid' ? 'Funnel Hybrid Hood' : name;
}

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
  /** Per-layer colour, keyed by layer id. Overrides the fabric colour and trim bindings. */
  partColors?: Partial<Record<string, string>>;
  /** Pack fit, so neck→body links stay on the slim or boxy cut. */
  fit?: string;
  /** Photo-traced collar + matching body cut, used when Neck is a custom upload. */
  customCollar?: CustomCollarSvgs | null;
  customCollars?: CustomCollarSvgs[];
}

const TSHIRT_CONFIG: GarmentSvgConfig = {
  assetRoot: 'tshirts',
  categoryOrder: [
    'T-shirt Base',
    'T-shirt sleeves',
    'neckline',
    'T-shirt sleeve hem',
    'T-shirt bottom sleeve',
    'T-shirt pockets',
    'T-shirts plackets & opening',
    'T-shirt zips',
    'T-shirt zip pulls',
  ],
  optionalCategories: [
    'T-shirt pockets',
    'T-shirt zips',
    'T-shirt zip pulls',
    'T-shirts plackets & opening',
  ],
  detailCategories: ['T-shirt zips', 'T-shirt zip pulls'],
  categoryLayerId: {
    'T-shirt Base': 'base',
    'T-shirt sleeves': 'sleeves',
    neckline: 'neck',
    'T-shirt sleeve hem': 'sleeveHem',
    'T-shirt bottom sleeve': 'bodyHem',
    'T-shirt pockets': 'pocket',
    'T-shirts plackets & opening': 'placket',
    'T-shirt zips': 'zip',
    'T-shirt zip pulls': 'zipPull',
  },
  categoryZIndex: {
    'T-shirt sleeves': 0,
    'T-shirt Base': 20,
    neckline: 30,
    'T-shirt sleeve hem': 40,
    'T-shirt bottom sleeve': 50,
    'T-shirt pockets': 52,
    'T-shirts plackets & opening': 55,
    'T-shirt zips': 60,
    'T-shirt zip pulls': 70,
  },
  stepCategories: {
    2: ['T-shirt Base'],
    3: ['neckline'],
    4: ['T-shirt sleeves'],
    5: ['T-shirt bottom sleeve', 'T-shirt sleeve hem'],
    6: ['T-shirt pockets', 'T-shirt zips', 'T-shirt zip pulls', 'T-shirts plackets & opening'],
  },
  trimBindings: {
    neck: ['neckline'],
    sleeve: ['T-shirt sleeves'],
    cuff: ['T-shirt sleeve hem'],
    pocket: [
      'T-shirt pockets',
      'T-shirt zips',
      'T-shirt zip pulls',
      'T-shirts plackets & opening',
    ],
  },
  splitSleeves: true,
  splitSleeveHems: true,
  sleeveCategory: 'T-shirt sleeves',
  sleeveHemCategory: 'T-shirt sleeve hem',
  previewStepMax: 6,
  layerLabels: {
    fill: 'Fill',
    base: 'Base',
    sleeves: 'Sleeves',
    sleeveLeft: 'Left sleeve',
    sleeveRight: 'Right sleeve',
    neck: 'Neckline',
    sleeveHem: 'Sleeve hem',
    sleeveHemLeft: 'Left cuff',
    sleeveHemRight: 'Right cuff',
    bodyHem: 'Body hem',
    pocket: 'Pocket',
    placket: 'Placket',
    zip: 'Zip',
    zipPull: 'Zip pull',
  },
};

/**
 * Classic pullover hoodie traced from the boxy line art in `src/assets/hoodie-test`.
 * Same pattern as the test T-shirt: every seam-bounded panel is a closed fill
 * with that panel's construction ink baked in, so each one takes a colour on its own.
 */
const HOODIE_CONFIG: GarmentSvgConfig = {
  assetRoot: 'hoodie-test',
  categoryOrder: [
    'Body',
    'Left sleeve',
    'Right sleeve',
    'Rib hem',
    'Left cuff',
    'Right cuff',
    'Hood',
    'Kangaroo pocket',
  ],
  optionalCategories: [],
  detailCategories: [],
  categoryLayerId: {
    Body: 'base',
    'Left sleeve': 'sleeveLeft',
    'Right sleeve': 'sleeveRight',
    'Rib hem': 'bodyHem',
    'Left cuff': 'sleeveHemLeft',
    'Right cuff': 'sleeveHemRight',
    Hood: 'hood',
    'Kangaroo pocket': 'pocket',
  },
  categoryZIndex: {
    'Left sleeve': 10,
    'Right sleeve': 10,
    Body: 20,
    'Rib hem': 28,
    'Left cuff': 32,
    'Right cuff': 32,
    Hood: 40,
    'Kangaroo pocket': 52,
  },
  stepCategories: {
    2: ['Body'],
    3: ['Hood'],
    4: ['Left sleeve', 'Right sleeve'],
    5: ['Rib hem', 'Left cuff', 'Right cuff'],
    6: ['Kangaroo pocket'],
  },
  trimBindings: {},
  splitSleeves: false,
  splitSleeveHems: false,
  perPartColors: true,
  restrictStepsToPack: true,
  hiddenCategories: [
    'Body',
    'Left sleeve',
    'Right sleeve',
    'Rib hem',
    'Left cuff',
    'Right cuff',
    'Kangaroo pocket',
  ],
  previewStepMax: 6,
  layerLabels: {
    fill: 'Fill',
    base: 'Body',
    sleeveLeft: 'Left sleeve',
    sleeveRight: 'Right sleeve',
    bodyHem: 'Rib hem',
    sleeveHemLeft: 'Left cuff',
    sleeveHemRight: 'Right cuff',
    hood: 'Hood',
    pocket: 'Kangaroo pocket',
  },
  fits: [
    { id: 'boxy', name: 'Boxy' },
    { id: 'cropped', name: 'Cropped' },
    { id: 'baggy', name: 'Baggy' },
    { id: 'regular', name: 'Regular' },
    { id: 'slim', name: 'Slim' },
  ],
  /**
   * Untagged hoodie-test files are the live Boxy pack. Other fits use
   * `Name (fit).svg` in the same category folders once traced.
   */
  fitParts: {
    boxy: {
      Body: 'Body',
      'Left sleeve': 'Left sleeve',
      'Right sleeve': 'Right sleeve',
      'Rib hem': 'Rib hem',
      'Left cuff': 'Left cuff',
      'Right cuff': 'Right cuff',
      'Kangaroo pocket': 'Kangaroo pocket',
    },
    cropped: {
      Body: 'Body (cropped)',
      'Left sleeve': 'Left sleeve (cropped)',
      'Right sleeve': 'Right sleeve (cropped)',
      'Rib hem': 'Rib hem (cropped)',
      'Left cuff': 'Left cuff (cropped)',
      'Right cuff': 'Right cuff (cropped)',
      'Kangaroo pocket': 'Kangaroo pocket (cropped)',
    },
    baggy: {
      Body: 'Body (baggy)',
      'Left sleeve': 'Left sleeve (baggy)',
      'Right sleeve': 'Right sleeve (baggy)',
      'Rib hem': 'Rib hem (baggy)',
      'Left cuff': 'Left cuff (baggy)',
      'Right cuff': 'Right cuff (baggy)',
      'Kangaroo pocket': 'Kangaroo pocket (baggy)',
    },
    regular: {
      Body: 'Body (regular)',
      'Left sleeve': 'Left sleeve (regular)',
      'Right sleeve': 'Right sleeve (regular)',
      'Rib hem': 'Rib hem (regular)',
      'Left cuff': 'Left cuff (regular)',
      'Right cuff': 'Right cuff (regular)',
      'Kangaroo pocket': 'Kangaroo pocket (regular)',
    },
    slim: {
      Body: 'Body (slim)',
      'Left sleeve': 'Left sleeve (slim)',
      'Right sleeve': 'Right sleeve (slim)',
      'Rib hem': 'Rib hem (slim)',
      'Left cuff': 'Left cuff (slim)',
      'Right cuff': 'Right cuff (slim)',
      'Kangaroo pocket': 'Kangaroo pocket (slim)',
    },
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
 * Test pack traced from the Ceriga line art in `src/assets/tshirt-test`.
 *
 * Unlike the production packs, every part is a closed fill region with its own ink
 * on top, so each one takes a colour on its own and the seven together cover the
 * whole garment. Slim vs Boxy owns the body, sleeves, hem, cuffs and neckline:
 * Slim offers crew and V-neck; Boxy offers the boxy crew.
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
  ],
  optionalCategories: [],
  detailCategories: [],
  categoryLayerId: {
    Body: 'base',
    'Left sleeve': 'sleeveLeft',
    'Right sleeve': 'sleeveRight',
    'Body hem': 'bodyHem',
    'Left cuff': 'sleeveHemLeft',
    'Right cuff': 'sleeveHemRight',
    Neck: 'neck',
  },
  categoryZIndex: {
    Body: 20,
    'Left sleeve': 24,
    'Right sleeve': 24,
    'Body hem': 30,
    'Left cuff': 32,
    'Right cuff': 32,
    Neck: 40,
  },
  stepCategories: {
    2: ['Body', 'Body hem'],
    3: ['Neck'],
    4: ['Left sleeve', 'Right sleeve'],
    5: ['Body hem', 'Left cuff', 'Right cuff'],
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
  ],
  fits: [
    { id: 'slim', name: 'Slim' },
    { id: 'boxy', name: 'Boxy' },
  ],
  fitParts: {
    slim: {
      Body: 'Body',
      'Left sleeve': 'Left sleeve',
      'Right sleeve': 'Right sleeve',
      'Body hem': 'Body hem',
      'Left cuff': 'Left cuff',
      'Right cuff': 'Right cuff',
    },
    boxy: {
      Body: 'Body (boxy)',
      Neck: 'Crew neck (boxy)',
      'Left sleeve': 'Left sleeve (boxy)',
      'Right sleeve': 'Right sleeve (boxy)',
      'Body hem': 'Body hem (boxy)',
      'Left cuff': 'Left cuff (boxy)',
      'Right cuff': 'Right cuff (boxy)',
    },
  },
  selectionLinks: [
    {
      from: 'Neck',
      to: 'Body',
      whenFit: 'slim',
      map: {
        'Crew neck': 'Body',
        'V-neck': 'Body V-neck',
        'Custom collar': 'Body Custom collar',
      },
    },
    {
      from: 'Neck',
      to: 'Body',
      whenFit: 'boxy',
      map: { 'Crew neck (boxy)': 'Body (boxy)' },
    },
  ],
  previewStepMax: 5,
  layerLabels: {
    fill: 'Fill',
    base: 'Body',
    sleeveLeft: 'Left sleeve',
    sleeveRight: 'Right sleeve',
    bodyHem: 'Bottom hem',
    sleeveHemLeft: 'Left cuff',
    sleeveHemRight: 'Right cuff',
    neck: 'Neck',
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
  ...import.meta.glob('../../assets/hoodie-test/**/*.svg', {
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
    a.displayName.localeCompare(b.displayName, undefined, { numeric: true }),
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

function isFitPacked(garmentType: GarmentSvgGarmentType, fitId: string): boolean {
  const parts = GARMENT_CONFIGS[garmentType].fitParts?.[fitId];
  if (!parts) return true;
  return Object.entries(parts).every(([category, displayName]) =>
    getGarmentAssets(garmentType, category).some((asset) => asset.displayName === displayName),
  );
}

export function getGarmentPackFits(garmentType: GarmentSvgGarmentType) {
  const fits = GARMENT_CONFIGS[garmentType].fits ?? [];
  return fits.filter((fit) => isFitPacked(garmentType, fit.id));
}

export function resolveGarmentPackFit(
  garmentType: GarmentSvgGarmentType,
  fit?: string,
): string | undefined {
  const fits = getGarmentPackFits(garmentType);
  if (!fits.length) return undefined;
  if (fit && fits.some((option) => option.id === fit)) return fit;
  return fits[0].id;
}

function inferAssetFitId(displayName: string, garmentType: GarmentSvgGarmentType): string {
  const tagged = displayName.match(/\(([^)]+)\)\s*$/);
  if (tagged) return tagged[1].toLowerCase();
  return GARMENT_CONFIGS[garmentType].fits?.[0]?.id ?? 'slim';
}

export function isAssetAvailableForFit(
  garmentType: GarmentSvgGarmentType,
  asset: GarmentAsset,
  fit: string,
): boolean {
  const config = GARMENT_CONFIGS[garmentType];
  if (!config.fits?.length) return true;
  if (inferAssetFitId(asset.displayName, garmentType) === fit) return true;
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
  const available = assets.filter((asset) => isAssetAvailableForFit(garmentType, asset, resolvedFit));
  // Keep legacy IDs (saved designs) and put the unchanged regular hood first.
  if (garmentType === 'hoodie' && category === 'Hood') {
    return available.sort((a, b) => {
      const rank = (asset: GarmentAsset) =>
        /^Hood(?:\s*\([^)]+\))?$/.test(asset.displayName) ? 0 :
          /^Scuba hood(?:\s*\([^)]+\))?$/.test(asset.displayName) ? 1 : 2;
      return rank(a) - rank(b);
    });
  }
  return available;
}

export function getGarmentAsset(assetId: string): GarmentAsset | undefined {
  return ALL_ASSETS.find((asset) => asset.id === assetId);
}

export function getDefaultGarmentSelection(
  garmentType: GarmentSvgGarmentType,
  fit?: string,
): GarmentAssetSelection {
  const config = GARMENT_CONFIGS[garmentType];
  const selection: GarmentAssetSelection = {};
  for (const category of config.categoryOrder) {
    const assets = getGarmentAssetsForFit(garmentType, category, fit);
    selection[category] = config.optionalCategories.includes(category)
      ? GARMENT_NONE
      : assets[0]?.id ?? GARMENT_NONE;
  }
  return selection;
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
  if (isCustomCollarNeckId(selection.Neck) && resolvedFit !== 'boxy') {
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
      if (config.hiddenCategories?.includes(category)) continue;
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
        const previous = getGarmentAsset(current ?? '');
        const matchingHood = garmentType === 'hoodie' && category === 'Hood' && previous
          ? allowed.find((asset) => getGarmentAssetOptionLabel(asset) === getGarmentAssetOptionLabel(previous))
          : undefined;
        next[category] = (matchingHood ?? allowed[0]).id;
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
  const asset = getGarmentAsset(id);
  return asset ? getGarmentAssetOptionLabel(asset) : id.split('/').pop() ?? 'None';
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
      displayName: getGarmentAssetOptionLabel(asset),
      svgRaw: asset.svgRaw,
      kind: config.detailCategories.includes(category) ? 'detail' : 'solid',
      tint: input.partColors?.[layerId] ?? trimForCategory(input.garmentType, category, input),
      zIndex: config.categoryZIndex[category] ?? 0,
    });
  }

  return layers.sort((a, b) => a.zIndex - b.zIndex);
}
