import { getGarmentSvgConfig } from '../../data/garmentSvgCatalog';
import { canvasToPotrace } from './coords';
import { densifySmoothPath } from './strokeSmooth';
import type { CerigaAssetExportBundle, DrawableAssetDocument, DrawnPoint, DrawnStroke } from './types';

const POTRACE_GROUP_TRANSFORM =
  'translate(0.000000,2048.000000) scale(0.100000,-0.100000)';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function strokeToExportPoints(stroke: DrawnStroke): DrawnPoint[] {
  if (stroke.smooth && stroke.points.length > 2) {
    return densifySmoothPath(stroke.points, stroke.closed, 120);
  }
  return stroke.points;
}

function pointsToPotracePathD(points: DrawnPoint[], closed: boolean): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  const start = canvasToPotrace(first.x, first.y);
  let d = `M${Math.round(start.px)} ${Math.round(start.py)}`;
  for (const point of rest) {
    const local = canvasToPotrace(point.x, point.y);
    d += ` L${Math.round(local.px)} ${Math.round(local.py)}`;
  }
  if (closed) d += ' z';
  return d;
}

export function documentToBuilderSvg(doc: DrawableAssetDocument): string {
  const { width, height } = doc.canvas;
  const metadataJson = JSON.stringify(
    {
      version: doc.version,
      meta: doc.meta,
      anchors: doc.anchors,
      connections: doc.connections,
      placement: doc.placement,
    },
    null,
    2,
  );

  const pathMarkup = doc.strokes
    .map((stroke) => {
      const exportPoints = strokeToExportPoints(stroke);
      const d = pointsToPotracePathD(exportPoints, stroke.closed);
      if (!d) return '';
      const strokeAttrs = stroke.closed
        ? 'fill="#000000" stroke="none"'
        : `fill="none" stroke="#000000" stroke-width="${stroke.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"`;
      return `<path data-ceriga-stroke-id="${escapeXml(stroke.id)}" d="${d}" ${strokeAttrs} />`;
    })
    .filter(Boolean)
    .join('\n');

  const anchorMarkup = doc.anchors
    .map((anchor) => {
      const local = canvasToPotrace(anchor.x, anchor.y);
      return `<circle data-ceriga-anchor="${escapeXml(anchor.name)}" data-ceriga-role="${anchor.role}" cx="${local.px}" cy="${local.py}" r="0" fill="none" stroke="none" />`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="${width}.000000pt" height="${height}.000000pt" viewBox="0 0 ${width} ${height}"
 preserveAspectRatio="xMidYMid meet">
<metadata>
Created by Ceriga Asset Drawing Lab
<ceriga-asset><![CDATA[${metadataJson}]]></ceriga-asset>
</metadata>
<g transform="${POTRACE_GROUP_TRANSFORM}" fill="#000000" stroke="none">
${pathMarkup}
${anchorMarkup}
</g>
</svg>`;
}

export function buildExportBundle(doc: DrawableAssetDocument): CerigaAssetExportBundle {
  const config = getGarmentSvgConfig(doc.meta.garmentType);
  const fileName = doc.meta.fileName.endsWith('.svg')
    ? doc.meta.fileName
    : `${doc.meta.fileName}.svg`;

  return {
    document: doc,
    svgRaw: documentToBuilderSvg(doc),
    importPath: `src/assets/${config.assetRoot}/${doc.meta.category}/${fileName}`,
  };
}

export function downloadTextFile(contents: string, fileName: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportDrawableAsset(doc: DrawableAssetDocument): CerigaAssetExportBundle {
  const bundle = buildExportBundle(doc);
  const svgName = bundle.importPath.split('/').pop() ?? 'asset.svg';

  // Builder consumes SVG — one file drop-in is the primary workflow.
  downloadTextFile(bundle.svgRaw, svgName, 'image/svg+xml');
  return bundle;
}

/** Optional editor backup — not required for the builder. */
export function exportDrawableAssetWithJsonBackup(doc: DrawableAssetDocument): CerigaAssetExportBundle {
  const bundle = exportDrawableAsset(doc);
  const jsonName = `${doc.meta.fileName.replace(/\.svg$/i, '')}.ceriga-asset.json`;
  downloadTextFile(JSON.stringify(bundle.document, null, 2), jsonName, 'application/json');
  return bundle;
}
