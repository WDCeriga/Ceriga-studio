import type { GarmentAsset } from '../../data/garmentSvgCatalog';
import { createEmptyDocument } from './document';
import { traceSvgToStrokes } from './pathTrace';
import { processTracedStrokes, traceOptionsFromFidelity, type TraceFidelityConfig, type TraceFidelityPreset, resolveTraceFidelity } from './traceFidelity';
import { suggestAnchorsForCategory } from './suggestAnchors';
import { smoothStrokePoints } from './strokeSmooth';
import type { DrawableAssetDocument, DrawnStroke } from './types';

export function mergeTracedStrokes(
  doc: DrawableAssetDocument,
  strokes: DrawnStroke[],
  mode: 'replace' | 'append' = 'replace',
): DrawableAssetDocument {
  return {
    ...doc,
    strokes: mode === 'append' ? [...doc.strokes, ...strokes] : strokes,
  };
}

export function traceSvgIntoDocument(
  doc: DrawableAssetDocument,
  svgRaw: string,
  mode: 'replace' | 'append' = 'replace',
): DrawableAssetDocument {
  const strokes = traceSvgToStrokes(svgRaw);
  return mergeTracedStrokes(doc, strokes, mode);
}

export function smoothAllStrokes(doc: DrawableAssetDocument): DrawableAssetDocument {
  return {
    ...doc,
    strokes: doc.strokes.map((stroke) => ({
      ...stroke,
      smooth: true,
      points: smoothStrokePoints(stroke.points, stroke.closed),
    })),
  };
}

export function enableSmoothOnAllStrokes(doc: DrawableAssetDocument): DrawableAssetDocument {
  return {
    ...doc,
    strokes: doc.strokes.map((stroke) => ({ ...stroke, smooth: true })),
  };
}

export function simplifyAllStrokes(doc: DrawableAssetDocument): DrawableAssetDocument {
  return {
    ...doc,
    strokes: doc.strokes.map((stroke) => ({
      ...stroke,
      points: smoothStrokePoints(stroke.points, stroke.closed),
    })),
  };
}

export function relabelStrokes(strokes: DrawnStroke[], prefix: string): DrawnStroke[] {
  return strokes.map((stroke, index) => ({
    ...stroke,
    id: stroke.id || `stroke-${index + 1}`,
    label: `${prefix} ${index + 1}`,
  }));
}

/**
 * Recommended workflow: clone a catalog SVG into an editable part with
 * simplified curves + auto anchors. Geometry source of truth remains SVG on export.
 */
export function buildAssetFromCatalog(
  asset: GarmentAsset,
  fidelity: TraceFidelityPreset | TraceFidelityConfig = 'full',
): DrawableAssetDocument {
  const fidelityConfig = typeof fidelity === 'string' ? resolveTraceFidelity(fidelity) : fidelity;
  const base = createEmptyDocument(asset.garmentType, asset.category);
  const traced = relabelStrokes(
    traceSvgToStrokes(asset.svgRaw, traceOptionsFromFidelity(fidelityConfig)),
    asset.displayName,
  );
  const strokes = processTracedStrokes(traced, fidelityConfig);
  const anchors = suggestAnchorsForCategory(asset.category, strokes);

  return {
    ...base,
    meta: {
      ...base.meta,
      name: asset.displayName,
      garmentType: asset.garmentType,
      category: asset.category,
      fileName: asset.fileName.replace(/\.svg$/i, ''),
      notes: 'Created from catalog via Quick Add',
    },
    strokes,
    anchors,
    connections: [],
  };
}
