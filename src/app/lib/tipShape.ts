import { contours } from 'd3-contour';
import { tipAlphaFromPixels } from './brushTips';

type Point = [number, number];
const TIP_WIDTH = 9, TIP_HEIGHT = 16, GRID = 120;

function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const [ax, ay] = points[0], [bx, by] = points[points.length - 1], length = Math.hypot(bx - ax, by - ay) || 1;
  let far = 0, index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i], distance = Math.abs((by - ay) * px - (bx - ax) * py + bx * ay - by * ax) / length;
    if (distance > far) { far = distance; index = i; }
  }
  if (far <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}
const area = (ring: Point[]) => Math.abs(ring.reduce((sum, [x, y], i) => { const [nx, ny] = ring[(i + 1) % ring.length]; return sum + x * ny - nx * y; }, 0) / 2);

/**
 * Turns a mask into a drawstring tip outline: the largest solid shape, smoothed a little,
 * centred on the cord and scaled to fit the tip area with its top where the cord enters.
 */
export function tipOutlineFromAlpha(alpha: ArrayLike<number>, width: number, height: number) {
  const values = Array.from({ length: width * height }, (_, i) => alpha[i] / 255);
  const rings = contours().size([width, height]).thresholds([.5])(values)[0]?.coordinates.map(polygon => polygon[0] as Point[]) ?? [];
  const ring = rings.sort((a, b) => area(b) - area(a))[0];
  if (!ring || area(ring) < width * height * .01) return null;
  // Split the closed ring at the point farthest from its start, so neither half begins and ends at the same place.
  const open = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring, tolerance = Math.max(width, height) / 160;
  let split = 0, farthest = -1; open.forEach(([x, y], i) => { const d = Math.hypot(x - open[0][0], y - open[0][1]); if (d > farthest) { farthest = d; split = i; } });
  const smooth = [...simplify(open.slice(0, split + 1), tolerance).slice(0, -1), ...simplify([...open.slice(split), open[0]], tolerance).slice(0, -1)];
  const xs = smooth.map(p => p[0]), ys = smooth.map(p => p[1]), left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  const scale = Math.min(TIP_WIDTH / Math.max(1e-6, right - left), TIP_HEIGHT / Math.max(1e-6, bottom - top)), middle = (left + right) / 2;
  const n = (value: number) => Number(value.toFixed(2));
  return smooth.map(([x, y], i) => `${i ? 'L' : 'M'}${n((x - middle) * scale)} ${n((y - top) * scale)}`).join('') + 'Z';
}

/** Reads a PNG, JPG, WebP or SVG and returns its silhouette as a tip outline. */
export async function tipOutlineFromFile(file: File) {
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) throw new Error('Use a PNG, JPG, WebP or SVG.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Use an image under 20 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const sourceWidth = image.naturalWidth || GRID, sourceHeight = image.naturalHeight || GRID, fit = GRID / Math.max(sourceWidth, sourceHeight);
    const width = Math.max(8, Math.round(sourceWidth * fit)), height = Math.max(8, Math.round(sourceHeight * fit));
    const canvas = document.createElement('canvas'); canvas.width = width + 4; canvas.height = height + 4;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 2, 2, width, height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (!Array.from({ length: canvas.width * canvas.height }, (_, i) => pixels.data[i * 4 + 3]).some(value => value < 250)) {
      // Solid image: paint a border in the edge colour so the background reads as empty.
      const flat = document.createElement('canvas'); flat.width = canvas.width; flat.height = canvas.height;
      const f = flat.getContext('2d', { willReadFrequently: true })!; f.fillStyle = `rgb(${pixels.data[(2 * canvas.width + 2) * 4]},${pixels.data[(2 * canvas.width + 2) * 4 + 1]},${pixels.data[(2 * canvas.width + 2) * 4 + 2]})`; f.fillRect(0, 0, flat.width, flat.height); f.drawImage(image, 2, 2, width, height);
      const alpha = tipAlphaFromPixels(f.getImageData(0, 0, flat.width, flat.height).data, flat.width, flat.height);
      const outline = tipOutlineFromAlpha(Array.from(alpha, value => value > 90 ? 255 : 0), flat.width, flat.height);
      if (!outline) throw new Error('Could not find a shape in this image.');
      return outline;
    }
    const outline = tipOutlineFromAlpha(Array.from({ length: canvas.width * canvas.height }, (_, i) => pixels.data[i * 4 + 3] > 90 ? 255 : 0), canvas.width, canvas.height);
    if (!outline) throw new Error('Could not find a shape in this image.');
    return outline;
  } finally { URL.revokeObjectURL(url); }
}
