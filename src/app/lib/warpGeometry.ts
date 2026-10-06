export type WarpPreset = 'arc' | 'arc-lower' | 'arc-upper' | 'arch' | 'bulge' | 'squeeze' | 'wave' | 'flag' | 'fish' | 'rise';

export interface WarpControlPoint {
  x: number;
  y: number;
}

export interface WarpSettings {
  mode: 'preset' | 'freeform';
  preset: WarpPreset;
  bend: number;
  horizontalDistortion: number;
  verticalDistortion: number;
  gridSize: 2 | 3 | 4;
  points: WarpControlPoint[];
}

export function createWarpSettings(): WarpSettings {
  return {
    mode: 'preset',
    preset: 'arc',
    bend: 50,
    horizontalDistortion: 0,
    verticalDistortion: 0,
    gridSize: 3,
    points: Array.from({ length: 9 }, (_, index) => ({ x: (index % 3) / 2, y: Math.floor(index / 3) / 2 })),
  };
}

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

export function warpGrid(settings: WarpSettings): WarpControlPoint[] {
  if (settings.mode === 'freeform') return settings.points;
  const points: WarpControlPoint[] = [];
  const bend = settings.bend / 100;
  const horizontal = settings.horizontalDistortion / 100;
  const vertical = settings.verticalDistortion / 100;
  const size = 3;
  for (let row = 0; row < size; row += 1) {
    const y = row / (size - 1);
    for (let column = 0; column < size; column += 1) {
      const x = column / (size - 1);
      const arch = Math.sin(Math.PI * x);
      let bendY = 0;
      let bendX = 0;
      switch (settings.preset) {
        case 'arc': bendY = -bend * 0.24 * arch; break;
        case 'arc-lower': bendY = bend * 0.24 * arch; break;
        case 'arc-upper': bendY = -bend * 0.14 * arch; break;
        case 'arch': bendY = -bend * 0.2 * Math.sin(Math.PI * x) * (0.55 + 0.45 * Math.cos(Math.PI * y)); break;
        case 'bulge': bendY = -bend * 0.2 * arch * Math.sin(Math.PI * y); break;
        case 'squeeze': bendX = -bend * 0.22 * (x - 0.5) * Math.sin(Math.PI * y); break;
        case 'wave': bendY = bend * 0.12 * Math.sin(2 * Math.PI * x + Math.PI * y); break;
        case 'flag': bendY = bend * 0.2 * x * (0.35 + 0.65 * y); break;
        case 'fish': bendY = bend * 0.16 * arch * Math.cos(Math.PI * y); break;
        case 'rise': bendY = -bend * 0.2 * (1 - x) * Math.sin(Math.PI * y); break;
      }
      points.push({
        x: clampUnit(x + bendX + horizontal * 0.1 * (x - 0.5) * (2 * y - 1)),
        y: clampUnit(y + bendY + vertical * 0.1 * (y - 0.5) * (2 * x - 1)),
      });
    }
  }
  return points;
}

export function interpolateWarpGrid(points: WarpControlPoint[], size: number, x: number, y: number): WarpControlPoint {
  const gx = clampUnit(x) * (size - 1);
  const gy = clampUnit(y) * (size - 1);
  const column = Math.min(size - 2, Math.floor(gx));
  const row = Math.min(size - 2, Math.floor(gy));
  const tx = gx - column;
  const ty = gy - row;
  const topLeft = points[row * size + column] ?? { x, y };
  const topRight = points[row * size + column + 1] ?? { x, y };
  const bottomLeft = points[(row + 1) * size + column] ?? { x, y };
  const bottomRight = points[(row + 1) * size + column + 1] ?? { x, y };
  const mix = (first: number, second: number, amount: number) => first + (second - first) * amount;
  return {
    x: mix(mix(topLeft.x, topRight.x, tx), mix(bottomLeft.x, bottomRight.x, tx), ty),
    y: mix(mix(topLeft.y, topRight.y, tx), mix(bottomLeft.y, bottomRight.y, tx), ty),
  };
}

export function resizeWarpGrid(settings: WarpSettings, gridSize: 2 | 3 | 4): WarpControlPoint[] {
  if (gridSize === settings.gridSize && settings.points.length === gridSize * gridSize) return settings.points;
  const previous = settings.mode === 'freeform' ? settings.points : warpGrid({ ...settings, mode: 'preset' });
  return Array.from({ length: gridSize * gridSize }, (_, index) =>
    interpolateWarpGrid(previous, settings.gridSize, (index % gridSize) / (gridSize - 1), Math.floor(index / gridSize) / (gridSize - 1)),
  );
}