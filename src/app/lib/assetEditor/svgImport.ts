import type { GarmentAsset } from '../../data/garmentSvgCatalog';
import { potraceToCanvas } from './coords';
import { createEmptyDocument } from './document';
import {
  ASSET_EDITOR_CANVAS,
  CERIGA_ASSET_VERSION,
  type AnchorRole,
  type DrawableAssetDocument,
  type DrawnPoint,
} from './types';

function parseCerigaMetadata(svgRaw: string): Partial<DrawableAssetDocument> | null {
  const cdataMatch = svgRaw.match(/<ceriga-asset><!\[CDATA\[([\s\S]*?)\]\]><\/ceriga-asset>/i);
  const jsonText = cdataMatch?.[1]?.trim();
  if (!jsonText) return null;

  try {
    const parsed = JSON.parse(jsonText) as Partial<DrawableAssetDocument>;
    return parsed;
  } catch {
    return null;
  }
}

function parseSubpathPoints(d: string): DrawnPoint[] {
  const tokens = d.match(/[MLZmlz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens || tokens.length === 0) return [];

  const points: DrawnPoint[] = [];
  let i = 0;
  let command = '';

  while (i < tokens.length) {
    const token = tokens[i];
    if (/^[MLZmlz]$/.test(token)) {
      command = token.toUpperCase();
      i += 1;
      continue;
    }

    if (command === 'M' || command === 'L') {
      const px = parseFloat(tokens[i]);
      const py = parseFloat(tokens[i + 1]);
      if (!Number.isFinite(px) || !Number.isFinite(py)) break;
      points.push(potraceToCanvas(px, py));
      i += 2;
      continue;
    }

    i += 1;
  }

  return points;
}

function importFromPotraceSvg(svgRaw: string, base: DrawableAssetDocument): DrawableAssetDocument {
  if (typeof DOMParser === 'undefined') return base;

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgRaw, 'image/svg+xml');
  const paths = Array.from(doc.querySelectorAll('path'));
  const strokes = paths
    .map((path, index) => {
      const d = path.getAttribute('d') ?? '';
      const points = parseSubpathPoints(d);
      if (points.length < 2) return null;
      const closed = /z/i.test(d.trim().slice(-1));
      return {
        id: path.getAttribute('data-ceriga-stroke-id') ?? `imported-stroke-${index + 1}`,
        label: `Imported ${index + 1}`,
        points,
        closed,
        strokeWidth: closed ? 12 : Number(path.getAttribute('stroke-width') ?? 12),
      };
    })
    .filter((stroke): stroke is NonNullable<typeof stroke> => stroke != null);

  const anchors = Array.from(doc.querySelectorAll('[data-ceriga-anchor]')).map((node, index) => {
    const cx = Number(node.getAttribute('cx') ?? node.getAttribute('data-x'));
    const cy = Number(node.getAttribute('cy') ?? node.getAttribute('data-y'));
    const point = Number.isFinite(cx) && Number.isFinite(cy)
      ? potraceToCanvas(cx, cy)
      : { x: ASSET_EDITOR_CANVAS / 2, y: ASSET_EDITOR_CANVAS / 2 };

    return {
      id: `imported-anchor-${index + 1}`,
      name: node.getAttribute('data-ceriga-anchor') ?? `anchor-${index + 1}`,
      role: (node.getAttribute('data-ceriga-role') as AnchorRole | null) ?? 'custom',
      x: point.x,
      y: point.y,
    };
  });

  return {
    ...base,
    strokes: strokes.length > 0 ? strokes : base.strokes,
    anchors: anchors.length > 0 ? anchors : base.anchors,
  };
}

export function parseDrawableAssetJson(raw: string): DrawableAssetDocument {
  const parsed = JSON.parse(raw) as DrawableAssetDocument;
  if (parsed.version !== CERIGA_ASSET_VERSION) {
    throw new Error(`Unsupported asset version: ${parsed.version}`);
  }
  return parsed;
}

export function importDrawableAssetFromJson(raw: string): DrawableAssetDocument {
  return parseDrawableAssetJson(raw);
}

export function importDrawableAssetFromSvg(svgRaw: string): DrawableAssetDocument {
  const metadata = parseCerigaMetadata(svgRaw);
  const base = metadata?.meta
    ? createEmptyDocument(metadata.meta.garmentType, metadata.meta.category)
    : createEmptyDocument();

  const merged: DrawableAssetDocument = {
    ...base,
    ...metadata,
    version: CERIGA_ASSET_VERSION,
    meta: { ...base.meta, ...metadata?.meta },
    canvas: metadata?.canvas ?? base.canvas,
    strokes: metadata?.strokes ?? [],
    anchors: metadata?.anchors ?? [],
    connections: metadata?.connections ?? [],
    placement: metadata?.placement ?? base.placement,
  };

  return importFromPotraceSvg(svgRaw, merged);
}

export function importDrawableAssetFromCatalogAsset(asset: GarmentAsset): DrawableAssetDocument {
  const base = createEmptyDocument(asset.garmentType, asset.category);
  return importFromPotraceSvg(asset.svgRaw, {
    ...base,
    meta: {
      ...base.meta,
      name: asset.displayName,
      garmentType: asset.garmentType,
      category: asset.category,
      fileName: asset.fileName,
    },
  });
}
