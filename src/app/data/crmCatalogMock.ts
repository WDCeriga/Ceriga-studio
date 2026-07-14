import {
  builderSteps,
  cuffOptions,
  fadingOptions,
  fitOptions,
  hemOptions,
  neckOptions,
  pocketOptions,
  printMethodOptions,
  sleeveLengthOptions,
  sleeveTypeOptions,
  stitchingOptions,
  zipOptions,
  type GarmentType,
  type StepOption,
} from './builderSteps';
import { products, type Product } from './products';

/** The three garment foundations Ceriga supports in CRM. */
export type GarmentBaseId = 'tshirt' | 'hoodie' | 'trousers';

export type GarmentBase = {
  id: GarmentBaseId;
  name: string;
  description: string;
  accent: string;
  allComponentIds: number[];
};

export type BaseOptionGroup = {
  key: string;
  label: string;
  options: StepOption[];
};

export type BaseComponent = {
  stepId: number;
  stepName: string;
  title: string;
  description: string;
  groups: BaseOptionGroup[];
};

export type CatalogProductConfig = Product & {
  baseId: GarmentBaseId;
  enabledComponentIds: number[];
  enabledOptions: Record<string, string[]>;
  published: boolean;
};

/** Per-base defaults — new products inherit this; products cannot exceed it. */
export type GarmentBaseConfig = {
  baseId: GarmentBaseId;
  description: string;
  enabledComponentIds: number[];
  enabledOptions: Record<string, string[]>;
  /** Spec-only labels (no builder vectors until added in code) */
  customOptions: Record<string, StepOption[]>;
};

/** Map legacy catalog garment types onto one of the three bases. */
export function resolveBaseId(garmentType: GarmentType): GarmentBaseId {
  if (garmentType === 'tshirt' || garmentType === 'dress') return 'tshirt';
  if (garmentType === 'hoodie' || garmentType === 'sweatshirt' || garmentType === 'jacket') {
    return 'hoodie';
  }
  return 'trousers';
}

export function stepsForBase(baseId: GarmentBaseId): number[] {
  return builderSteps
    .filter((s) => !s.skipForGarmentTypes?.includes(baseId))
    .map((s) => s.id);
}

export const GARMENT_BASES: GarmentBase[] = [
  {
    id: 'tshirt',
    name: 'T-Shirt base',
    description:
      'Every measurement, neckline, sleeve, hem, print, and finish option a tee can take — crew, v-neck, raglan, oversized fits, and more.',
    accent: '#3B82F6',
    allComponentIds: stepsForBase('tshirt'),
  },
  {
    id: 'hoodie',
    name: 'Hoodie base',
    description:
      'Full hoodie matrix — single/double hood, half-zip, full-zip, kangaroo pockets, rib cuffs, prints, labels, and packaging.',
    accent: '#A855F7',
    allComponentIds: stepsForBase('hoodie'),
  },
  {
    id: 'trousers',
    name: 'Trousers base',
    description:
      'Jogger and trouser specs — fit, fabric, hem, pockets, zips, fading, stitching, and export without top-only steps.',
    accent: '#06B6D4',
    allComponentIds: stepsForBase('trousers'),
  },
];

export function garmentBaseById(id: GarmentBaseId): GarmentBase {
  return GARMENT_BASES.find((b) => b.id === id)!;
}

export function baseComponentsForBase(baseId: GarmentBaseId): BaseComponent[] {
  const groupMap: Partial<Record<string, BaseOptionGroup[]>> = {
    measurements: [{ key: 'measurements.fit', label: 'Fit', options: fitOptions }],
    neck: [{ key: 'neck.styles', label: 'Style', options: neckOptions[baseId] }],
    sleeves: [
      { key: 'sleeves.type', label: 'Type', options: sleeveTypeOptions },
      { key: 'sleeves.length', label: 'Length', options: sleeveLengthOptions },
    ],
    hem: [
      { key: 'hem.style', label: 'Hem', options: hemOptions },
      { key: 'hem.cuff', label: 'Cuffs', options: cuffOptions },
    ],
    pockets: [
      { key: 'pockets.style', label: 'Pockets', options: pocketOptions },
      { key: 'pockets.zip', label: 'Zips', options: zipOptions },
    ],
    fading: [{ key: 'fading.treatment', label: 'Treatment', options: fadingOptions }],
    stitching: [{ key: 'stitching.type', label: 'Stitch', options: stitchingOptions }],
    prints: [{ key: 'prints.method', label: 'Method', options: printMethodOptions }],
  };

  return builderSteps
    .filter((s) => !s.skipForGarmentTypes?.includes(baseId))
    .map((step) => ({
      stepId: step.id,
      stepName: step.name,
      title: step.title,
      description: step.description,
      groups: groupMap[step.name] ?? [],
    }));
}

/** Steps where ops can add product-specific option chips (garment construction only). */
const CUSTOM_OPTION_STEPS = new Set(['neck', 'sleeves', 'hem', 'pockets']);

export function stepAllowsCustomOptions(stepName: string): boolean {
  return CUSTOM_OPTION_STEPS.has(stepName);
}

export function getMergedGroupOptions(
  group: BaseOptionGroup,
  customOptions: Record<string, StepOption[]>,
): StepOption[] {
  return [...group.options, ...(customOptions[group.key] ?? [])];
}

export function optionIdFromLabel(name: string, groupKey: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `custom-${groupKey.split('.')[0]}-${slug || 'item'}-${suffix}`;
}

export function isCustomOptionId(
  optionId: string,
  groupKey: string,
  customOptions: Record<string, StepOption[]>,
): boolean {
  return (customOptions[groupKey] ?? []).some((o) => o.id === optionId);
}

export function defaultEnabledOptions(baseId: GarmentBaseId): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const comp of baseComponentsForBase(baseId)) {
    for (const group of comp.groups) {
      result[group.key] = group.options.map((o) => o.id);
    }
  }
  return result;
}

export function defaultCustomOptions(): Record<string, StepOption[]> {
  return {};
}

export function defaultBaseConfig(baseId: GarmentBaseId): GarmentBaseConfig {
  const meta = garmentBaseById(baseId);
  return {
    baseId,
    description: meta.description,
    enabledComponentIds: defaultEnabledComponentIds(baseId),
    enabledOptions: defaultEnabledOptions(baseId),
    customOptions: defaultCustomOptions(),
  };
}

const initialBaseStore = (): Record<GarmentBaseId, GarmentBaseConfig> => ({
  tshirt: defaultBaseConfig('tshirt'),
  hoodie: defaultBaseConfig('hoodie'),
  trousers: defaultBaseConfig('trousers'),
});

let baseStore: Record<GarmentBaseId, GarmentBaseConfig> = initialBaseStore();

export function getBaseConfig(baseId: GarmentBaseId): GarmentBaseConfig {
  return normalizeBaseConfig(baseStore[baseId] ?? defaultBaseConfig(baseId));
}

export function upsertBaseConfig(config: GarmentBaseConfig): void {
  baseStore = { ...baseStore, [config.baseId]: normalizeBaseConfig(config) };
}

export function normalizeBaseConfig(config: GarmentBaseConfig): GarmentBaseConfig {
  const baseId = config.baseId;
  const components = baseComponentsForBase(baseId);
  const customOptions = { ...defaultCustomOptions(), ...config.customOptions };
  const enabledOptions = { ...defaultEnabledOptions(baseId), ...config.enabledOptions };

  for (const comp of components) {
    for (const group of comp.groups) {
      const allowed = new Set(
        getMergedGroupOptions(group, customOptions).map((o) => o.id),
      );
      enabledOptions[group.key] = (enabledOptions[group.key] ?? []).filter((id) =>
        allowed.has(id),
      );
    }
  }

  const prunedCustom: Record<string, StepOption[]> = {};
  for (const comp of components) {
    if (!stepAllowsCustomOptions(comp.stepName)) continue;
    for (const group of comp.groups) {
      if (customOptions[group.key]?.length) {
        prunedCustom[group.key] = customOptions[group.key];
      }
    }
  }

  return {
    baseId,
    description: config.description || garmentBaseById(baseId).description,
    customOptions: prunedCustom,
    enabledComponentIds: (config.enabledComponentIds ?? defaultEnabledComponentIds(baseId))
      .filter((id) => stepsForBase(baseId).includes(id))
      .sort((a, b) => a - b),
    enabledOptions,
  };
}

export function getBaseConstraints(baseId: GarmentBaseId) {
  const base = getBaseConfig(baseId);
  return {
    allowedComponentIds: base.enabledComponentIds,
    allowedOptionsByGroup: base.enabledOptions,
    customOptions: base.customOptions,
  };
}

export function countEnabledForBase(config: GarmentBaseConfig): number {
  const normalized = normalizeBaseConfig(config);
  const components = baseComponentsForBase(normalized.baseId);
  let count = 0;
  for (const comp of components) {
    if (!normalized.enabledComponentIds.includes(comp.stepId)) continue;
    if (comp.groups.length === 0) {
      count += 1;
      continue;
    }
    for (const group of comp.groups) {
      count += (normalized.enabledOptions[group.key] ?? []).length;
    }
  }
  return count;
}

export function defaultEnabledComponentIds(baseId: GarmentBaseId): number[] {
  return stepsForBase(baseId);
}

export function defaultConfigForBase(baseId: GarmentBaseId): Pick<
  CatalogProductConfig,
  'baseId' | 'garmentType' | 'enabledComponentIds' | 'enabledOptions'
> {
  const base = getBaseConfig(baseId);
  return {
    baseId,
    garmentType: baseId,
    enabledComponentIds: [...base.enabledComponentIds],
    enabledOptions: { ...base.enabledOptions },
  };
}

export function defaultProductConfig(product: Product): CatalogProductConfig {
  const baseId = resolveBaseId(product.garmentType);
  return {
    ...product,
    garmentType: baseId,
    baseId,
    enabledComponentIds: defaultConfigForBase(baseId).enabledComponentIds,
    enabledOptions: defaultConfigForBase(baseId).enabledOptions,
    published: true,
  };
}

export function isComponentEnabled(config: CatalogProductConfig, stepId: number): boolean {
  return config.enabledComponentIds.includes(stepId);
}

export function normalizeProductConfig(config: CatalogProductConfig): CatalogProductConfig {
  const baseId = config.baseId ?? resolveBaseId(config.garmentType);
  const base = getBaseConfig(baseId);
  const allowedComponents = new Set(base.enabledComponentIds);
  const components = baseComponentsForBase(baseId);
  const enabledOptions = { ...config.enabledOptions };

  for (const comp of components) {
    for (const group of comp.groups) {
      const allowed = new Set(base.enabledOptions[group.key] ?? []);
      enabledOptions[group.key] = (config.enabledOptions[group.key] ?? []).filter((id) =>
        allowed.has(id),
      );
    }
  }

  return {
    ...config,
    baseId,
    garmentType: baseId,
    enabledComponentIds: (
      config.enabledComponentIds ??
      (config as { enabledStepIds?: number[] }).enabledStepIds ??
      base.enabledComponentIds
    )
      .filter((id) => allowedComponents.has(id))
      .sort((a, b) => a - b),
    enabledOptions,
  };
}

export function countSelectableForProduct(config: CatalogProductConfig): number {
  const base = getBaseConfig(config.baseId ?? resolveBaseId(config.garmentType));
  const components = baseComponentsForBase(base.baseId);
  let count = 0;
  for (const comp of components) {
    if (comp.groups.length === 0) {
      if (base.enabledComponentIds.includes(comp.stepId)) count += 1;
      continue;
    }
    for (const group of comp.groups) {
      count += (base.enabledOptions[group.key] ?? []).length;
    }
  }
  return count;
}

export function countSelectableForBase(baseId: GarmentBaseId): number {
  const components = baseComponentsForBase(baseId);
  const optionCount = components.reduce(
    (n, c) => n + c.groups.reduce((g, grp) => g + grp.options.length, 0),
    0,
  );
  const simpleComponents = components.filter((c) => c.groups.length === 0).length;
  return optionCount + simpleComponents;
}

export function countEnabledForProduct(config: CatalogProductConfig): number {
  const normalized = normalizeProductConfig(config);
  const components = baseComponentsForBase(normalized.baseId);
  let count = 0;

  for (const comp of components) {
    if (!isComponentEnabled(normalized, comp.stepId)) continue;
    if (comp.groups.length === 0) {
      count += 1;
      continue;
    }
    for (const group of comp.groups) {
      count += (normalized.enabledOptions[group.key] ?? []).length;
    }
  }

  return count;
}

/** Mock CRM catalog — sync with `products` and wire to API in production. */
export const INITIAL_CATALOG_CONFIG: CatalogProductConfig[] = products.map((p) =>
  defaultProductConfig(p),
);

let catalogStore: CatalogProductConfig[] = [...INITIAL_CATALOG_CONFIG];

export function getCatalogStore(): CatalogProductConfig[] {
  return catalogStore;
}

export function setCatalogStore(next: CatalogProductConfig[]): void {
  catalogStore = next;
}

export function getProductConfig(id: string): CatalogProductConfig | undefined {
  const product = catalogStore.find((p) => p.id === id);
  return product ? normalizeProductConfig(product) : undefined;
}

export function upsertProductConfig(product: CatalogProductConfig): void {
  const normalized = normalizeProductConfig(product);
  const idx = catalogStore.findIndex((p) => p.id === normalized.id);
  if (idx >= 0) {
    catalogStore = catalogStore.map((p) => (p.id === normalized.id ? normalized : p));
  } else {
    catalogStore = [...catalogStore, normalized];
  }
}

export function slugFromName(name: string): string {
  const prefix = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${prefix || 'product'}-${suffix}`;
}
