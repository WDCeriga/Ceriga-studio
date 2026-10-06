export interface PatternSettings {
  type?: string;
  content?: string;
  customAreaPattern?: string;
  width: number;
  height: number;
  patternCount?: number;
  patternScale?: number;
  patternSpacing?: number;
  patternSpacingX?: number;
  patternSpacingY?: number;
  color?: string;
  patternColors?: string[];
  patternRoughness?: number;
  patternVariation?: number;
  patternSource?: string;
  patternSourceName?: string;
  patternSourceWidth?: number;
  patternSourceHeight?: number;
  patternRepeat?: 'grid' | 'brick' | 'half-drop' | 'mirror' | 'random';
  patternRandomPosition?: number;
  patternRandomRotation?: number;
  patternMinScale?: number;
  patternMaxScale?: number;
  patternRotation?: number;
  patternThickness?: number;
  patternRandomise?: boolean;
  patternSeed?: number;
}

export interface PatternDot { x: number; y: number; radius: number }
export interface PatternRect { x: number; y: number; width: number; height: number }

const bounded = (value: number | undefined, fallback: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value! : fallback));

export function patternKind(element: PatternSettings) {
  return element.type === 'customArea' ? element.customAreaPattern ?? 'stripes' : element.content ?? 'stripes';
}

/** Repeat geometry is in artwork pixels, with one uniform scale for both axes. */
export function patternMetrics(element: PatternSettings) {
  const kind = patternKind(element);
  const width = bounded(element.width, 80, 1, 100000);
  const height = bounded(element.height, 80, 1, 100000);
  const defaultCount = kind === 'checks' || kind === 'dots' ? 4 : 5;
  const count = Math.round(bounded(element.patternCount, defaultCount, 1, 32));
  const scale = bounded(element.patternScale, 100, 10, 400) / 100;
  const spacing = bounded(element.patternSpacing, 0, 0, 200);
  const reference = kind === 'stripes' ? width : kind === 'stripes-h' ? height : Math.min(width, height);
  const legacyCell = kind === 'checks' ? 12 : kind === 'diagonal' ? 24 / Math.SQRT2 : 24;
  const baseCell = element.type === 'customArea' ? legacyCell * defaultCount / count : reference / count;
  const cell = baseCell * scale;
  const pitch = cell + spacing;
  const defaultThickness = kind === 'dots' ? baseCell * (element.type === 'customArea' ? .25 : .44)
    : kind === 'diagonal' ? (element.type === 'customArea' ? 3 : Math.min(width, height) * 7 / 80)
      : baseCell * (element.type === 'customArea' ? .25 : .45);
  const thickness = bounded(element.patternThickness, defaultThickness, .1, 1000) * scale;
  // Horizontal lines are rotated as an infinite repeat, never clipped to individual diagonal segments.
  const angle = (kind === 'diagonal' ? 45 : kind === 'stripes' ? -90 : 0)
    + bounded(element.patternRotation, 0, -360, 360);
  return { kind, width, height, count, scale, spacing, cell, pitch, angle, thickness, defaultThickness };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** One jittered sample per stratum: stable, evenly covered, and periodic at tile boundaries. */
export function patternGeometry(element: PatternSettings) {
  const metrics = patternMetrics(element);
  const { kind, cell, pitch, spacing, thickness } = metrics;
  const randomised = kind === 'dots' && element.patternRandomise === true;
  const divisions = randomised ? 8 : kind === 'checks' ? 2 : 1;
  const tileSize = pitch * divisions;
  const rectangles: PatternRect[] = [];
  const dots: PatternDot[] = [];
  if (kind === 'checks') {
    rectangles.push({ x: spacing / 2, y: spacing / 2, width: cell, height: cell },
      { x: pitch + spacing / 2, y: pitch + spacing / 2, width: cell, height: cell });
  } else if (kind === 'dots') {
    const random = seededRandom(bounded(element.patternSeed, 1, 0, 0xffffffff));
    for (let row = 0; row < divisions; row += 1) {
      for (let column = 0; column < divisions; column += 1) {
        const radius = Math.min(cell * .48, thickness / 2 * (randomised ? .8 + random() * .4 : 1));
        const jitter = randomised ? Math.min(pitch * .32, pitch / 2 - radius) : 0;
        dots.push({ x: (column + .5) * pitch + (random() * 2 - 1) * jitter,
          y: (row + .5) * pitch + (random() * 2 - 1) * jitter, radius });
      }
    }
  } else {
    rectangles.push({ x: 0, y: 0, width: tileSize, height: Math.min(cell, thickness) });
  }
  return { ...metrics, tileSize, rectangles, dots };
}

/** Generate once on a user action; never call from a renderer. */
export function newPatternSeed() {
  const words = new Uint32Array(1);
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(words)[0]!;
  return Math.floor(Math.random() * 0x100000000);
}
