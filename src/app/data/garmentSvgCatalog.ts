import type { GarmentType } from './builderSteps';

export const GARMENT_NONE = '__none__';

export type GarmentSvgGarmentType = 'tshirt' | 'hoodie' | 'trousers';

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

const GARMENT_CONFIGS: Record<GarmentSvgGarmentType, GarmentSvgConfig> = {
  tshirt: TSHIRT_CONFIG,
  hoodie: HOODIE_CONFIG,
  trousers: TROUSER_CONFIG,
};

const svgModules = {
  ...import.meta.glob('../../assets/tshirts/**/*.svg', {
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

export function isGarmentSvgGarmentType(garmentType: GarmentType): garmentType is GarmentSvgGarmentType {
  return garmentType === 'tshirt' || garmentType === 'hoodie' || garmentType === 'trousers';
}

export function supportsGarmentSvgPreview(garmentType: GarmentType): boolean {
  return isGarmentSvgGarmentType(garmentType);
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

export function getGarmentAsset(assetId: string): GarmentAsset | undefined {
  return ALL_ASSETS.find((asset) => asset.id === assetId);
}

export function getDefaultGarmentSelection(
  garmentType: GarmentSvgGarmentType,
): GarmentAssetSelection {
  const config = GARMENT_CONFIGS[garmentType];
  const selection: GarmentAssetSelection = {};
  for (const category of config.categoryOrder) {
    const assets = getGarmentAssets(garmentType, category);
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
  return getGarmentAsset(id)?.displayName ?? id.split('/').pop() ?? 'None';
}

export function getGarmentSpecRows(
  garmentType: GarmentSvgGarmentType,
  selection: GarmentAssetSelection,
): Array<{ label: string; value: string }> {
  const config = GARMENT_CONFIGS[garmentType];
  return config.categoryOrder
    .filter((category) => config.stepCategories && Object.values(config.stepCategories).flat().includes(category))
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
  const layers: ResolvedGarmentLayer[] = [];

  for (const category of config.categoryOrder) {
    const assetId = input.selection[category];
    if (!assetId || assetId === GARMENT_NONE) continue;

    const asset = getGarmentAsset(assetId);
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
      tint: trimForCategory(input.garmentType, category, input),
      zIndex: config.categoryZIndex[category] ?? 0,
    });
  }

  return layers.sort((a, b) => a.zIndex - b.zIndex);
}
