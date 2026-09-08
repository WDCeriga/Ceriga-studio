/**
 * Tech pack data extraction.
 *
 * Turns a saved Builder state (the JSON stored on the `projects` row) into a
 * structured TechPackData model that the PDF renderer consumes. Everything on
 * the PDF is filled from real customization-step data; nothing is mocked.
 */
import { getProductById } from '../data/products';
import type { BuilderState } from '../pages/Builder';
import {
  cuffOptions,
  fadingOptions,
  hemOptions,
  neckOptions,
  pocketOptions,
  sleeveLengthOptions,
  sleeveTypeOptions,
  stitchingOptions,
  zipOptions,
  type GarmentType,
} from '../data/builderSteps';
import { ORDER_SIZE_KEYS, type OrderSizeKey } from '../data/builderSteps';
import { FABRIC_OPTIONS_FALLBACK, optionLabel } from './techPackLabels';
import {
  resolveMeasurementGuides,
  type ResolvedMeasurementGuide,
} from '../components/builder/measurementGuides';
import { resolveGarmentSvgType } from '../data/tshirtLayerAssets';
import type { GarmentAssetSelection } from '../data/garmentSvgCatalog';
import type { DesignElement } from '../components/builder/PrintsDesignStep';
import type { MeasurementUnit } from './measurements';

export type TechPackOptionRow = {
  label: string;
  value: string;
  note?: string;
};

export type TechPackPrintRow = {
  id: string;
  kind: 'image' | 'text';
  /** Data URL for images, raw text for text layers. */
  content: string;
  name: string;
  printMethod: string;
  /** Position within the builder print zone (px, design space). */
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color?: string;
  fontFamily?: string;
  fontSize?: number;
  textAlign?: string;
  fontStyle?: string;
  textTransform?: string;
};

export type TechPackQuantityLine = {
  label: string;
  bySize: Record<OrderSizeKey, number>;
  total: number;
  tierTotal?: number;
};

export type TechPackData = {
  /** Human project / product name shown on the cover. */
  title: string;
  styleNumber: string;
  productBlueprint: string;
  garmentType: GarmentType;
  fit: string;
  measurementUnit: MeasurementUnit;
  sizeRange: string;
  sampleSizeLabel: string;
  /** Measurement rows keyed by guide id with per-size values (cm stored). */
  measurements: ResolvedMeasurementGuide[];
  measurementValues: Record<string, Record<string, string>>;
  extraDetails: Partial<
    Record<
      | 'measurements'
      | 'fabric'
      | 'neck'
      | 'sleeves'
      | 'hem'
      | 'pockets'
      | 'labels'
      | 'packaging'
      | 'fading'
      | 'stitching'
      | 'referenceUploadNotes',
      string
    >
  >;
  fabricRows: TechPackOptionRow[];
  colors: Array<{ hex: string; pantone: string }>;
  constructionRows: TechPackOptionRow[];
  neck: string;
  sleeves: string;
  hem: string;
  pockets: string;
  zip: string;
  fading: string;
  stitching: string;
  stitchingColor?: string;
  trims: { neckTrimColor?: string; sleeveTrimColor?: string; cuffTrimColor?: string; pocketTrimColor?: string };
  prints: TechPackPrintRow[];
  labelType: string;
  packagingType: string;
  labelPrints: TechPackPrintRow[];
  packagingPrints: TechPackPrintRow[];
  labelColor?: string;
  packagingColor?: string;
  quantities: TechPackQuantityLine[];
  referenceUploadFileNames?: string;
  /**
   * Full visual state (colours, trims, asset selection, layer transforms,
   * raw print/label/packaging elements). The PDF rasterizer uses this to
   * embed the garment composite and artwork exactly as the builder shows it.
   */
  visual?: TechPackVisualState;
};

/** Everything the rasterizer needs, kept as raw builder types. */
export type TechPackVisualState = {
  garmentType: string;
  baseColor?: string;
  colors: Array<{ hex: string; pantone: string }>;
  tshirtAssetSelection?: GarmentAssetSelection;
  neckTrimColor?: string;
  sleeveTrimColor?: string;
  cuffTrimColor?: string;
  pocketTrimColor?: string;
  tshirtLayerTransforms?: BuilderState['tshirtLayerTransforms'];
  prints: DesignElement[];
  labels: DesignElement[];
  packaging: DesignElement[];
  labelType?: string;
  packagingType?: string;
  labelColor?: string;
  packagingColor?: string;
  /** Print-zone size (px) when coordinates were last edited — the normalization reference. */
  printZoneWidth?: number;
  printZoneHeight?: number;
};

/** BuilderState is structurally compatible; keep this local so imports stay light. */
type BuilderStateLike = Omit<BuilderState, never>;

function labelForOption(list: { id: string; name: string }[], id: string | undefined, fallback: string): string {
  if (!id) return fallback;
  return optionLabel(list, id) ?? fallback;
}

export function garmentTypeLabel(garmentType: string): string {
  switch (garmentType) {
    case 'tshirt':
      return 'T-Shirt';
    case 'hoodie':
      return 'Hoodie';
    case 'sweatshirt':
      return 'Sweatshirt';
    case 'trousers':
      return 'Trousers';
    case 'shorts':
      return 'Shorts';
    case 'jacket':
      return 'Jacket';
    case 'dress':
      return 'Dress';
    case 'skirt':
      return 'Skirt';
    default:
      return garmentType;
  }
}

function fabricLabel(value: string | undefined): string {
  if (!value) return 'Not set';
  return optionLabel(FABRIC_OPTIONS_FALLBACK, value) ?? value;
}

function toPrintRows(elements: DesignElement[] | undefined, prefix: string): TechPackPrintRow[] {
  if (!elements?.length) return [];
  return elements
    .filter((el) => (el.type === 'text' ? el.content.trim().length > 0 : Boolean(el.content)))
    .map((el, i) => ({
      id: el.id || `${prefix}-${i + 1}`,
      kind: el.type,
      content: el.content,
      name:
        el.type === 'text'
          ? `“${el.content.trim().slice(0, 32)}”`
          : `Artwork ${i + 1}`,
      printMethod: el.printMethod ?? 'DTG',
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      rotation: el.rotation ?? 0,
      color: el.color,
      fontFamily: el.fontFamily,
      fontSize: el.fontSize,
      textAlign: el.textAlign,
      fontStyle: el.fontStyle,
      textTransform: el.textTransform,
    }));
}

function quantityLines(state: BuilderStateLike): TechPackQuantityLine[] {
  const toNum = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  };
  const sum = (bySize: Partial<Record<OrderSizeKey, unknown>>) =>
    ORDER_SIZE_KEYS.reduce((acc, k) => acc + toNum(bySize[k]), 0);
  const lines: TechPackQuantityLine[] = [];
  const sampleBySize = Object.fromEntries(
    ORDER_SIZE_KEYS.map((k) => [k, toNum(state.orderQuantities.sample.bySize[k])]),
  ) as Record<OrderSizeKey, number>;
  lines.push({
    label: 'Sample',
    bySize: sampleBySize,
    total: sum(state.orderQuantities.sample.bySize),
    tierTotal: state.orderQuantities.sample.targetTotal,
  });
  state.orderQuantities.bulkRuns.forEach((run, i) => {
    const bySize = Object.fromEntries(
      ORDER_SIZE_KEYS.map((k) => [k, toNum(run.bySize[k])]),
    ) as Record<OrderSizeKey, number>;
    lines.push({
      label:
        run.targetTotal && run.targetTotal !== sum(run.bySize)
          ? `Bulk ${i + 1} (tier ${run.targetTotal})`
          : `Bulk ${i + 1}`,
      bySize,
      total: sum(run.bySize),
      tierTotal: run.targetTotal,
    });
  });
  return lines;
}

/** Build the full model from a builder state (as persisted on the project row). */
export function buildTechPackData(
  state: BuilderStateLike,
  opts: { projectName: string; styleNumber?: string },
): TechPackData {
  const product = getProductById(state.productId);
  const garmentLabel = garmentTypeLabel(state.garmentType);
  const necks = neckOptions[state.garmentType as GarmentType] ?? [];
  const neckSkip = necks.length === 0;
  const sleeveSkip = ['trousers', 'shorts', 'skirt'].includes(state.garmentType);

  const fabricRows: TechPackOptionRow[] = [
    { label: 'Fabric type', value: fabricLabel(state.fabricType) },
    { label: 'Fabric weight', value: state.gsm ? `${state.gsm} GSM` : 'Not set' },
    ...(product ? [{ label: 'Blueprint product', value: product.name }] : []),
    ...(state.fit ? [{ label: 'Fit', value: optionLabel([{ id: 'slim', name: 'Slim' }, { id: 'regular', name: 'Regular' }, { id: 'relaxed', name: 'Relaxed' }, { id: 'oversized', name: 'Oversized' }, { id: 'custom', name: 'Custom' }], state.fit) ?? state.fit }] : []),
  ];

  const constructionRows: TechPackOptionRow[] = [];
  constructionRows.push({
    label: 'Neck / collar',
    value: neckSkip ? '—' : labelForOption(necks, state.neckType, 'Not set'),
    note: state.extraDetails.neck || undefined,
  });
  constructionRows.push({
    label: 'Sleeves',
    value: sleeveSkip
      ? '—'
      : [
          labelForOption(sleeveTypeOptions, state.sleeveType, 'Not set'),
          labelForOption(sleeveLengthOptions, state.sleeveLength, ''),
        ]
          .filter(Boolean)
          .join(' · '),
    note: state.extraDetails.sleeves || undefined,
  });
  constructionRows.push({
    label: 'Hem',
    value: labelForOption(hemOptions, state.hemType, 'Not set'),
    note: state.extraDetails.hem || undefined,
  });
  constructionRows.push({
    label: 'Cuffs',
    value: labelForOption(cuffOptions, state.cuffType, sleeveSkip ? '—' : 'Not set'),
  });
  constructionRows.push({
    label: 'Pockets',
    value: labelForOption(pocketOptions, state.pocketType, 'Not set'),
    note: state.extraDetails.pockets || undefined,
  });
  constructionRows.push({
    label: 'Zip',
    value: labelForOption(zipOptions, state.zipType, 'None'),
  });
  constructionRows.push({
    label: 'Fading / wash',
    value: labelForOption(fadingOptions, state.fadingType, 'None'),
    note: state.extraDetails.fading || undefined,
  });
  constructionRows.push({
    label: 'Stitching',
    value: labelForOption(stitchingOptions, state.stitchingType, 'Not set'),
    note: state.extraDetails.stitching || undefined,
  });

  const svgType = resolveGarmentSvgType(state.garmentType);
  const measurements = svgType
    ? resolveMeasurementGuides(svgType, state.tshirtAssetSelection)
    : [];

  const styleNumber =
    opts.styleNumber ??
    `CS-${(state.productId || 'spec').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}`;

  return {
    title: opts.projectName || product?.name || 'Untitled style',
    styleNumber,
    productBlueprint: product?.name ?? 'Spec-only build',
    garmentType: state.garmentType,
    fit: state.fit ?? 'regular',
    measurementUnit: state.measurementUnit,
    sizeRange: 'XS — XXL',
    sampleSizeLabel: 'M',
    measurements,
    measurementValues: state.measurements ?? {},
    extraDetails: (state.extraDetails ?? {}) as TechPackData['extraDetails'],
    fabricRows,
    colors: state.colors ?? [],
    constructionRows,
    neck: neckSkip ? '—' : labelForOption(necks, state.neckType, 'Not set'),
    sleeves: sleeveSkip
      ? '—'
      : [
          labelForOption(sleeveTypeOptions, state.sleeveType, 'Not set'),
          labelForOption(sleeveLengthOptions, state.sleeveLength, ''),
        ]
          .filter(Boolean)
          .join(' · '),
    hem: labelForOption(hemOptions, state.hemType, 'Not set'),
    pockets: labelForOption(pocketOptions, state.pocketType, 'Not set'),
    zip: labelForOption(zipOptions, state.zipType, 'None'),
    fading: labelForOption(fadingOptions, state.fadingType, 'None'),
    stitching: labelForOption(stitchingOptions, state.stitchingType, 'Not set'),
    stitchingColor: state.stitchingColor,
    trims: {
      neckTrimColor: state.neckTrimColor,
      sleeveTrimColor: state.sleeveTrimColor,
      cuffTrimColor: state.cuffTrimColor,
      pocketTrimColor: state.pocketTrimColor,
    },
    prints: toPrintRows(state.prints, 'print'),
    labelType: state.labelType ?? 'none',
    packagingType: state.packagingType ?? 'none',
    labelPrints: toPrintRows(state.labels, 'label'),
    packagingPrints: toPrintRows(state.packaging, 'packaging'),
    labelColor: state.labelColor,
    packagingColor: state.packagingColor,
    quantities: quantityLines(state),
    referenceUploadFileNames: state.referenceUploadFileNames,
    visual: {
      garmentType: state.garmentType,
      baseColor: state.colors[0]?.hex,
      colors: state.colors ?? [],
      tshirtAssetSelection: state.tshirtAssetSelection,
      neckTrimColor: state.neckTrimColor,
      sleeveTrimColor: state.sleeveTrimColor,
      cuffTrimColor: state.cuffTrimColor,
      pocketTrimColor: state.pocketTrimColor,
      tshirtLayerTransforms: state.tshirtLayerTransforms,
      prints: state.prints ?? [],
      labels: state.labels ?? [],
      packaging: state.packaging ?? [],
      labelType: state.labelType,
      packagingType: state.packagingType,
      labelColor: state.labelColor,
      packagingColor: state.packagingColor,
      printZoneWidth: state.printZoneWidth,
      printZoneHeight: state.printZoneHeight,
    },
  };
}

/** Minimal fallback model for orders placed without a full builder state. */
export function buildFallbackTechPackData(input: {
  productName: string;
  garmentType?: string;
  specifications?: {
    fit?: string;
    color?: string;
    colorName?: string;
    neckType?: string;
    sleeveType?: string;
    sleeveLength?: string;
    fabricType?: string;
    gsm?: number;
  };
  orderQuantities?: {
    sample?: { bySize: Partial<Record<OrderSizeKey, number>> };
    bulkRuns?: Array<{ targetTotal?: number; bySize: Partial<Record<OrderSizeKey, number>> }>;
  };
}): TechPackData {
  const specs = input.specifications ?? {};
  const sample = input.orderQuantities?.sample?.bySize ?? {};
  const sampleBySize = Object.fromEntries(
    ORDER_SIZE_KEYS.map((k) => [k, sample[k] ?? 0]),
  ) as Record<OrderSizeKey, number>;
  const sampleTotal = Object.values(sampleBySize).reduce((a, b) => a + b, 0);
  const quantities: TechPackQuantityLine[] = [
    { label: 'Sample', bySize: sampleBySize, total: sampleTotal },
  ];
  (input.orderQuantities?.bulkRuns ?? []).forEach((run, i) => {
    const bySize = Object.fromEntries(
      ORDER_SIZE_KEYS.map((k) => [k, run.bySize[k] ?? 0]),
    ) as Record<OrderSizeKey, number>;
    const total = Object.values(bySize).reduce((a, b) => a + b, 0);
    quantities.push({
      label: run.targetTotal && run.targetTotal !== total ? `Bulk ${i + 1} (tier ${run.targetTotal})` : `Bulk ${i + 1}`,
      bySize,
      total,
      tierTotal: run.targetTotal,
    });
  });

  const colors = specs.color
    ? [{ hex: specs.color, pantone: specs.colorName ?? '' }]
    : [];

  return {
    title: input.productName,
    styleNumber: 'CS-ORDER',
    productBlueprint: input.productName,
    garmentType: 'tshirt',
    fit: specs.fit ?? 'regular',
    measurementUnit: 'cm',
    sizeRange: 'XS — XXL',
    sampleSizeLabel: 'M',
    measurements: [],
    measurementValues: {},
    extraDetails: {},
    fabricRows: [
      { label: 'Fabric type', value: specs.fabricType ?? 'Not set' },
      ...(specs.gsm ? [{ label: 'Fabric weight', value: `${specs.gsm} GSM` }] : []),
    ],
    colors,
    constructionRows: [
      { label: 'Neck / collar', value: specs.neckType ?? '—' },
      { label: 'Sleeves', value: [specs.sleeveType, specs.sleeveLength].filter(Boolean).join(' · ') || '—' },
    ],
    neck: specs.neckType ?? '—',
    sleeves: [specs.sleeveType, specs.sleeveLength].filter(Boolean).join(' · ') || '—',
    hem: '—',
    pockets: '—',
    zip: 'None',
    fading: 'None',
    stitching: 'Not set',
    trims: {},
    prints: [],
    labelType: 'none',
    packagingType: 'none',
    labelPrints: [],
    packagingPrints: [],
    quantities,
    visual: {
      garmentType: 'tshirt',
      colors: colors,
      prints: [],
      labels: [],
      packaging: [],
    },
  };
}
