import polygonClipping, { type MultiPolygon, type Pair } from 'polygon-clipping';
import { contours } from 'd3-contour';
import type { ConstructionRegions } from '../data/importedConstructionRegions';

export type BrushPoint = [number, number];
const pathFor = (geometry: MultiPolygon) => geometry.map(polygon => polygon.map(ring => `M${ring.map(([x, y]) => `${x},${y}`).join('L')}Z`).join('')).join('');

export function constructionBrushPath(points: BrushPoint[], diameter: number): string {
  if (!points.length || points.length > 4096 || !Number.isFinite(diameter) || diameter < 2 || diameter > 200 ||
    points.some(point => point.some(value => !Number.isFinite(value)))) throw new Error('Invalid brush stroke.');
  const radius = diameter / 2;
  const pieces: MultiPolygon[] = points.map(([x, y]) => {
    const ring: Pair[] = Array.from({ length: 16 }, (_, i) => [x + radius * Math.cos(i * Math.PI / 8), y + radius * Math.sin(i * Math.PI / 8)]);
    ring.push(ring[0]);
    return [[ring]];
  });
  points.slice(1).forEach((point, i) => {
    const previous = points[i], dx = point[0] - previous[0], dy = point[1] - previous[1], length = Math.hypot(dx, dy);
    if (!length) return;
    const x = -dy / length * radius, y = dx / length * radius;
    const ring: Pair[] = [[previous[0] + x, previous[1] + y], [point[0] + x, point[1] + y],
      [point[0] - x, point[1] - y], [previous[0] - x, previous[1] - y], [previous[0] + x, previous[1] + y]];
    pieces.push([[ring]]);
  });
  // Union in batches keeps long pointer strokes within polygon-clipping's queue limits.
  let geometry = pieces[0];
  for (let index = 1; index < pieces.length; index += 32) geometry = polygonClipping.union(geometry, ...pieces.slice(index, index + 32));
  return pathFor(geometry);
}

export function enclosedConstructionArea(blocked: Uint8Array, size: number, point: BrushPoint): string {
  if (!Number.isInteger(size) || size < 2 || blocked.length !== size * size || point.some(value => !Number.isFinite(value) || value < 0 || value >= 2048)) throw new Error('Click inside the drawing.');
  const x = Math.floor(point[0] * size / 2048), y = Math.floor(point[1] * size / 2048), seed = y * size + x;
  if (blocked[seed]) throw new Error('Click a white, unassigned fabric area, not a region or construction line.');
  const visited = new Uint8Array(blocked.length), queue = new Int32Array(blocked.length);
  let head = 0, tail = 1;
  queue[0] = seed; visited[seed] = 1;
  while (head < tail) {
    const index = queue[head++], px = index % size, py = Math.floor(index / size);
    if (px === 0 || py === 0 || px === size - 1 || py === size - 1) throw new Error('This area opens into the background. Use Paint with a small brush instead.');
    for (const next of [index - 1, index + 1, index - size, index + size]) {
      if (!blocked[next] && !visited[next]) { visited[next] = 1; queue[tail++] = next; }
    }
  }
  if (tail < 3) throw new Error('This area is too small to select. Use Paint instead.');
  const geometry = contours().size([size, size]).smooth(false).thresholds([.5])(visited)[0].coordinates;
  const scale = 2048 / size;
  return pathFor(geometry.map(polygon => polygon.map(ring => ring.map(([px, py]) => [px * scale, py * scale] as Pair))));
}

export async function selectUnassignedConstructionArea(data: ConstructionRegions, point: BrushPoint): Promise<string> {
  const size = 1024, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Area selection is unavailable. Use Paint instead.');
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Construction lines could not load. Use Paint instead.'));
    image.src = `data:image/svg+xml,${encodeURIComponent(data.constructionInk)}`;
  });
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const blocked = new Uint8Array(size * size);
  for (let i = 0; i < blocked.length; i++) blocked[i] = pixels[i * 4 + 3] > 32 && Math.min(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]) < 220 ? 1 : 0;
  context.clearRect(0, 0, size, size);
  context.scale(size / 2048, size / 2048);
  context.fillStyle = '#000';
  for (const region of data.regions) context.fill(new Path2D(region.path), 'evenodd');
  const assigned = context.getImageData(0, 0, size, size).data;
  for (let i = 0; i < blocked.length; i++) if (assigned[i * 4 + 3] > 32) blocked[i] = 1;
  return enclosedConstructionArea(blocked, size, point);
}
