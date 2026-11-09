import { contours } from 'd3-contour';
import simplify from 'simplify-js';
import type { DesignElement } from '../components/builder/PrintStudioEditor';
import { fitPenPath, mapShapePath, shapeWorldPath } from './artworkPathOperations';
import { fitVectorContour } from './cleanSketchCurves';
import { shapePathData, type ShapePath } from './shapeGeometry';

export function canDetectArtworkRegions(element: DesignElement) {
  return element.type === 'shape' && Boolean(element.shapePath) &&
    !element.shapeFilled && (element.borderWidth ?? 4) > 0 &&
    !element.locked && !element.hidden && !element.warp && !element.perspective &&
    !element.eraseContours?.length && !element.shapeBrush && !element.svgPrecision &&
    !element.clipToArtworkId && !element.clipToArtworkIds?.length &&
    !element.artworkClipPaths?.length &&
    (!element.shapeStrokeStyle || element.shapeStrokeStyle === 'solid');
}

type Cell = { id: number; area: number; left: number; right: number; top: number; bottom: number };

function traceRegions(alpha: Uint8ClampedArray, width: number, height: number) {
  const labels = new Int32Array(width * height);
  for (let i = 0; i < labels.length; i++) if (alpha[i * 4 + 3] >= 96) labels[i] = -1;
  const queue = new Int32Array(labels.length);
  let head = 0, tail = 0;
  const visit = (index: number, callback: (next: number) => void) => {
    const x = index % width;
    if (x > 0) callback(index - 1);
    if (x + 1 < width) callback(index + 1);
    if (index >= width) callback(index - width);
    if (index + width < labels.length) callback(index + width);
  };
  const cells: Cell[] = [];
  let id = 0;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] !== 0) continue;
    head = tail = 0;
    const label = ++id;
    const enqueue = (index: number) => {
      if (labels[index] !== 0) return;
      labels[index] = label;
      queue[tail++] = index;
    };
    enqueue(i);
    while (head < tail) visit(queue[head++], enqueue);
    // The padded exterior is visited first. Ignore tiny pockets at sketch crossings.
    if (label === 1 || tail < 25) {
      if (label !== 1) for (let j = 0; j < tail; j++) labels[queue[j]] = 1;
    } else cells.push({ id: label, area: tail, left: width, right: 0, top: height, bottom: 0 });
  }
  if (!cells.length) return [];
  if (cells.length > 64) throw new Error('Select fewer outlines at once to make fillable regions.');

  // Extend fills to the centre of the original outlines instead of leaving a halo
  // the width of the detection stroke. Exterior owns the other half at outer edges.
  head = tail = 0;
  for (let i = 0; i < labels.length; i++) if (labels[i] > 0) queue[tail++] = i;
  while (head < tail) {
    const i = queue[head++];
    visit(i, next => {
      if (labels[next] !== -1) return;
      labels[next] = labels[i];
      queue[tail++] = next;
    });
  }

  const byId = new Map(cells.map(cell => [cell.id, cell]));
  for (let i = 0; i < labels.length; i++) {
    const cell = byId.get(labels[i]);
    if (!cell) continue;
    const x = i % width, y = Math.floor(i / width);
    cell.left = Math.min(cell.left, x);
    cell.right = Math.max(cell.right, x);
    cell.top = Math.min(cell.top, y);
    cell.bottom = Math.max(cell.bottom, y);
  }
  return cells.sort((a, b) => a.area - b.area).flatMap(cell => {
    const w = cell.right - cell.left + 3, h = cell.bottom - cell.top + 3;
    const mask = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        mask[y * w + x] = Number(labels[(cell.top + y - 1) * width + cell.left + x - 1] === cell.id);
      }
    }
    const rings = contours().size([w, h]).thresholds([.5])(mask)[0].coordinates.flat();
    const paths = rings.flatMap(ring => {
      const points = simplify(ring.map(([x, y]) => ({ x: x + cell.left - 1, y: y + cell.top - 1 })), .7, true).slice(0, -1);
      return points.length >= 3 ? [fitVectorContour(points, true, .55, .95, 22)] : [];
    });
    return paths.length ? [{ ...paths[0], subpaths: paths.slice(1) }] : [];
  });
}

/** Use a temporary stencil to find faces, then save only editable vector paths. */
export function detectArtworkRegions(outlines: DesignElement[]): ShapePath[] {
  if (!outlines.length || !outlines.every(canDetectArtworkRegions)) return [];
  const paths = outlines.map(shapeWorldPath);
  const { x, y, width, height } = fitPenPath({ closed: false, nodes: [], subpaths: paths });
  const span = Math.max(width, height);
  if (!Number.isFinite(span) || span <= 1) return [];
  const scale = 700 / span, pad = 12;
  const left = x - width / 2, top = y - height / 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale) + pad * 2;
  canvas.height = Math.ceil(height * scale) + pad * 2;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  const stencil = paths.map(path => new Path2D(shapePathData(mapShapePath(path, p => ({
    x: (p.x - left) * scale + pad, y: (p.y - top) * scale + pad,
  })))));
  ctx.lineCap = ctx.lineJoin = 'round';
  const read = (minimumWidth: number) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    stencil.forEach((path, i) => {
      ctx.lineWidth = Math.max(minimumWidth, Math.min(16, (outlines[i].borderWidth ?? 4) * scale));
      ctx.stroke(path);
    });
    return traceRegions(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
  };
  const exact = read(2);
  const bridged = read(16);
  return (bridged.length > exact.length ? bridged : exact).map(path => mapShapePath(path, p => ({
    x: left + (p.x - pad) / scale, y: top + (p.y - pad) / scale,
  })));
}

const regionColours = ['#F1D29C', '#D0DAE4', '#C9D9CD', '#DFCAD6'];

export function makeArtworkRegionLayers(outlines: DesignElement[]): DesignElement[] {
  return detectArtworkRegions(outlines).map((path, index) => {
    const base = outlines[0], colour = regionColours[index % regionColours.length];
    return {
      ...fitPenPath(path), id: crypto.randomUUID(), type: 'shape', content: 'custom-path',
      layerName: `Fill region ${index + 1}`, rotation: 0, color: colour, opacity: 100,
      shapeGeometry: 'bounds', shapeFilled: true, shapeFillColor: colour, shapeFillRule: 'evenodd',
      borderWidth: 0, side: base.side, behindTrims: base.behindTrims, frameId: base.frameId,
      printMethod: base.printMethod,
    };
  });
}

export function insertArtworkRegionLayers(elements: DesignElement[], outlines: DesignElement[]) {
  if (!outlines.length || !outlines.every(element => (element.side ?? 'front') === (outlines[0].side ?? 'front') &&
    element.frameId === outlines[0].frameId && Boolean(element.behindTrims) === Boolean(outlines[0].behindTrims))) {
    throw new Error('Select outlines on the same surface and trim level.');
  }
  const fills = makeArtworkRegionLayers(outlines);
  if (!fills.length) throw new Error('No enclosed areas found. Close the outline, or select all the strokes that form the area.');
  const selected = new Set(outlines.map(element => element.id));
  const index = elements.findIndex(element => selected.has(element.id));
  return { elements: [...elements.slice(0, index), ...fills, ...elements.slice(index)], firstId: fills[0].id };
}
