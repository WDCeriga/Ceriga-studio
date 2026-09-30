export type CoreHoodStyleId = 'regular' | 'scuba' | 'oversized-deep';
export type HoodStyleId = CoreHoodStyleId | `custom:${string}`;
export interface HoodSelection {
  hoodStyle: HoodStyleId;
  frontConstruction: HoodFrontConstruction;
}
export type HoodFitId = 'boxy' | 'cropped' | 'baggy' | 'regular' | 'slim' | 'oversized';
export type HoodLayerConstruction = 'single-layer' | 'double-layer';
export type HoodDrawstringState = 'drawstring' | 'no-drawstring';

export interface HoodBundleVariant {
  id: string;
  optionId: string;
  fit: HoodFitId;
  construction: {
    layers: HoodLayerConstruction | 'as-authored';
    drawstrings: HoodDrawstringState | 'as-authored';
  };
  views: { front: { assetId: string }; back: { assetId: string; socketId: string } | null };
  socket: {
    id: string;
    view: 'front';
    referenceAssetId: string;
    profile: readonly { x: number; y: number }[] | null;
    bodyPolicy: 'unchanged';
    compatibleConstructions: readonly ('set-in' | 'raglan' | 'dropped-shoulder')[];
  };
  registration: {
    placement: 'baked-full-canvas';
    canvas: readonly [2048, 2048];
    referenceAssetId: string;
    referenceSource: 'asset' | 'previous-scuba';
    defaultTransform: { x: number; y: number; scale: number; rotation: number };
  };
  frontConstruction: HoodFrontConstruction;
  approval: { status: 'existing' | 'pending' } | { status: 'approved'; referenceIds: readonly string[] };
}

export interface HoodBundle {
  schemaVersion: 2;
  id: string;
  styleId: HoodStyleId;
  label: string;
  status: 'available' | 'awaiting-reference';
  source: { kind: 'existing-ceriga-assets' | 'user-reference'; referenceIds: readonly string[] };
  constructionOptions: {
    frontConstruction: readonly HoodFrontConstruction[];
    layers: readonly HoodLayerConstruction[];
    drawstrings: readonly HoodDrawstringState[];
  };
  storage: { selectionCategory: 'Hood'; transformKey: 'hood'; colorKey: 'hood' };
  color: { mode: 'existing-fabric-tint'; ink: 'preserve-svg' };
  variants: readonly HoodBundleVariant[];
}

export type HoodFrontConstruction = 'standard' | 'crossover';

const existingFits = ['boxy', 'cropped', 'baggy', 'regular', 'slim'] as const;

function existingVariants(style: 'regular' | 'scuba'): HoodBundleVariant[] {
  return existingFits.map(fit => {
    const suffix = fit === 'boxy' ? '' : ` (${fit})`;
    const assetId = `hoodie/Hood/${style === 'regular' ? 'Hood' : 'Scuba hood'}${suffix}`;
    return {
      id: `ceriga/hood/${style}/original/${fit}`,
      optionId: 'original',
      fit,
      construction: { layers: 'as-authored', drawstrings: 'as-authored' },
      views: { front: { assetId }, back: null },
      socket: {
        id: `hoodie/${fit}/neckline-v1`,
        view: 'front',
        referenceAssetId: `hoodie/Hood/Hood${suffix}`,
        profile: null,
        bodyPolicy: 'unchanged',
        compatibleConstructions: ['set-in', 'raglan', 'dropped-shoulder'],
      },
      registration: {
        placement: 'baked-full-canvas',
        canvas: [2048, 2048],
        referenceAssetId: assetId,
        referenceSource: style === 'scuba' ? 'previous-scuba' : 'asset',
        defaultTransform: { x: 0, y: 0, scale: 1, rotation: 0 },
      },
      frontConstruction: 'standard',
      approval: { status: 'existing' },
    };
  });
}

function defineBundle(styleId: CoreHoodStyleId, label: string, variants: readonly HoodBundleVariant[]): HoodBundle {
  return {
    schemaVersion: 2,
    id: `ceriga/hood/${styleId}`,
    styleId,
    label,
    status: variants.length ? 'available' : 'awaiting-reference',
    source: { kind: variants.length ? 'existing-ceriga-assets' : 'user-reference', referenceIds: [] },
    constructionOptions: {
      frontConstruction: styleId === 'scuba' ? ['standard'] : ['standard', 'crossover'],
      layers: ['single-layer', 'double-layer'],
      drawstrings: ['drawstring', 'no-drawstring'],
    },
    storage: { selectionCategory: 'Hood', transformKey: 'hood', colorKey: 'hood' },
    color: { mode: 'existing-fabric-tint', ink: 'preserve-svg' },
    variants,
  };
}

const deepReferenceBundle: HoodBundle = {
  ...defineBundle('oversized-deep', 'Oversized / Deep Hood', existingVariants('regular').map(variant => {
    const assetId = `hoodie/Hood/Oversized Deep Hood${variant.fit === 'boxy' ? '' : ` (${variant.fit})`}`;
    return {
      ...variant,
      id: `ceriga/hood/oversized-deep/reference-v3/${variant.fit}`,
      optionId: 'reference-v3',
      construction: { layers: 'as-authored', drawstrings: 'drawstring' },
      views: { front: { assetId }, back: null },
      socket: { ...variant.socket, compatibleConstructions: ['set-in'] },
      registration: { ...variant.registration, referenceAssetId: assetId },
    };
  })),
  source: { kind: 'user-reference', referenceIds: ['studio-hoodie/hoods/deep-reference-v3/shape.json'] },
};

function withCrossover(bundle: HoodBundle): HoodBundle {
  const referenceIds = ['studio-hoodie/hoods/crossover-reference-v1/construction.json'];
  return {
    ...bundle,
    variants: [...bundle.variants, ...bundle.variants.map((variant): HoodBundleVariant => {
      const name = bundle.styleId === 'regular' ? 'Regular Crossover Hood' : 'Deep Crossover Hood';
      const assetId = `hoodie/Hood/${name}${variant.fit === 'boxy' ? '' : ` (${variant.fit})`}`;
      return {
        ...variant,
        id: `ceriga/hood/${bundle.styleId}/crossover-v1/${variant.fit}`,
        optionId: 'crossover-v1',
        views: { front: { assetId }, back: null },
        registration: { ...variant.registration },
        frontConstruction: 'crossover',
        approval: { status: 'approved', referenceIds },
      };
    })],
  };
}

export const HOOD_BUNDLES: readonly HoodBundle[] = [
  withCrossover(defineBundle('regular', 'Regular Hood', existingVariants('regular'))),
  defineBundle('scuba', 'Scuba Hood', existingVariants('scuba')),
  withCrossover(deepReferenceBundle),
];

export function isHoodVariantSelectable(bundle: HoodBundle, variant: HoodBundleVariant): boolean {
  return bundle.status === 'available'
    && bundle.constructionOptions.frontConstruction.includes(variant.frontConstruction)
    && Boolean(variant.views.front.assetId)
    && (variant.approval.status === 'approved'
      ? variant.approval.referenceIds.length > 0
      : variant.approval.status === 'existing' && variant.frontConstruction === 'standard');
}

export function getHoodFrontConstructionOptions(hoodStyle: HoodStyleId, fit: string) {
  const bundle = HOOD_BUNDLES.find(candidate => candidate.styleId === hoodStyle);
  return bundle?.constructionOptions.frontConstruction.map(frontConstruction => {
    const variant = bundle.variants.find(candidate => candidate.fit === fit
      && candidate.frontConstruction === frontConstruction && isHoodVariantSelectable(bundle, candidate));
    return {
      hoodStyle,
      frontConstruction,
      label: frontConstruction === 'standard' ? 'Standard' : 'Crossover',
      selectable: Boolean(variant),
      variant,
    };
  }) ?? [];
}

export function getHoodBundleAsset(assetId: string | undefined) {
  if (!assetId) return undefined;
  for (const bundle of HOOD_BUNDLES) {
    if (bundle.status !== 'available') continue;
    const variant = bundle.variants.find(candidate => candidate.views.front.assetId === assetId
      && isHoodVariantSelectable(bundle, candidate));
    if (variant) return { bundle, variant };
  }
  return undefined;
}

export function getHoodBundleVariantForFit(assetId: string, fit: string) {
  const current = getHoodBundleAsset(assetId);
  return current?.bundle.variants.find(variant => variant.fit === fit
    && isHoodVariantSelectable(current.bundle, variant)
    && variant.frontConstruction === current.variant.frontConstruction
    && variant.optionId === current.variant.optionId
    && variant.construction.layers === current.variant.construction.layers
    && variant.construction.drawstrings === current.variant.construction.drawstrings);
}

export function getHoodBundleConstructionVariant(
  styleId: HoodStyleId,
  fit: HoodFitId,
  layers: HoodLayerConstruction,
  drawstrings: HoodDrawstringState,
  frontConstruction: HoodFrontConstruction = 'standard',
) {
  const bundle = HOOD_BUNDLES.find(candidate => candidate.styleId === styleId);
  return bundle?.variants.find(variant => variant.fit === fit
      && variant.frontConstruction === frontConstruction && isHoodVariantSelectable(bundle, variant)
      && variant.construction.layers === layers && variant.construction.drawstrings === drawstrings);
}