import {textileCamouflage} from './textileCamouflage';
import type { PatternMotif, PatternPrimitive, PatternReplica } from './generatedPatterns';
import { patternDefaultColors, patternDefinition } from './patternCatalog';
import type { PatternSettings } from './patternGeometry';

export interface FashionTile {
  tileWidth: number;
  tileHeight: number;
  colors: string[];
  background: number;
  motifs: PatternMotif[];
  replicas: PatternReplica[];
}

type Pt = [number, number];

const clamp = (value: number | undefined, fallback: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Number.isFinite(value) ? value! : fallback));
const f = (value: number) => Math.round(value * 10) / 10;
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let word = Math.imul(state ^ state >>> 15, state | 1);
    word ^= word + Math.imul(word ^ word >>> 7, word | 61);
    return ((word ^ word >>> 14) >>> 0) / 4294967296;
  };
}

/** Geometry-only settings; rotation, opacity, offset and position are applied outside the cached tile. */
const cache = new Map<string, FashionTile>();
const CACHE_LIMIT = 48;

export function isFashionPattern(kind: string) {
  return patternDefinition(kind)?.fashion === true;
}

export function fashionPatternPalette(settings: PatternSettings, kind: string): string[] {
  const definition = patternDefinition(kind);
  const defaults = patternDefaultColors(kind);
  const min = definition?.minColors ?? 2;
  const max = definition?.maxColors ?? defaults.length;
  const wanted = settings.patternColors?.length ?? definition?.colors?.length ?? defaults.length;
  const length = Math.max(min, Math.min(max, wanted));
  return Array.from({ length }, (_, index) => settings.patternColors?.[index] ?? defaults[index] ?? defaults[index % defaults.length] ?? '#888888');
}

export function fashionPatternTile(settings: PatternSettings, kind: string, ref: number): FashionTile {
  const definition = patternDefinition(kind)!;
  const options: Record<string, number | string> = {};
  for (const option of definition.options ?? []) options[option.key] = clamp(Number(settings.patternOptions?.[option.key]), option.value, option.min, option.max);
  for (const choice of definition.choices ?? []) {
    const value = settings.patternOptions?.[choice.key];
    options[choice.key] = choice.options.some(item => item.value === value) ? String(value) : choice.value;
  }
  // Plaid stripe-group widths and positions are open-ended, so they are read directly.
  if (kind === 'plaid') for (const [key, value] of Object.entries(settings.patternOptions ?? {})) if (/^g\d+[wp]$/.test(key)) options[key] = clamp(Number(value), 0, 0, 100);
  const colors = fashionPatternPalette(settings, kind);
  const count = Math.round(clamp(settings.patternCount, definition.defaultCount ?? 5, 1, 32));
  const scale = clamp(settings.patternScale, 100, 10, 400) / 100;
  const spacingX = clamp(settings.patternSpacingX ?? settings.patternSpacing, 0, 0, 200);
  const spacingY = clamp(settings.patternSpacingY ?? settings.patternSpacing, 0, 0, 200);
  const seed = clamp(settings.patternSeed, 1, 0, 0xffffffff);
  const thickness = Number.isFinite(settings.patternThickness) ? clamp(settings.patternThickness, 1, .1, 1000) : undefined;
  const key = JSON.stringify([kind, options, colors.length, count, scale, spacingX, spacingY, seed, thickness, Math.round(ref)]);
  const hit = cache.get(key);
  if (hit) { cache.delete(key); cache.set(key, hit); return withColors(hit, colors); }
  const tile = build(kind, options, colors, { count, scale, spacingX, spacingY, seed, thickness, ref });
  cache.set(key, tile);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return withColors(tile, colors);
}

/** Colours are paint indices, so a colour change never invalidates the cached geometry. */
const withColors = (tile: FashionTile, colors: string[]): FashionTile => ({ ...tile, colors });

interface Context { count: number; scale: number; spacingX: number; spacingY: number; seed: number; thickness?: number; ref: number }

function motifTile(width: number, height: number, primitives: PatternPrimitive[], colors: string[]): FashionTile {
  const motif: PatternMotif = { id: 0, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, radius: 0, primitives };
  return { tileWidth: width, tileHeight: height, colors, background: 0, motifs: [motif], replicas: [{ motif: 0, dx: 0, dy: 0 }] };
}

function build(kind: string, o: Record<string, number | string>, colors: string[], c: Context): FashionTile {
  const n = (key: string) => Number(o[key]);
  if (kind === 'plaid') return plaid(o, colors, c);
  if (kind === 'gingham') return gingham(n('checkSize'), n('hSpacing'), n('vSpacing'), colors, c);
  if (kind === 'windowpane') return windowpane(n('hSpacing'), n('vSpacing'), colors, c);
  if (kind === 'topographic') return topographic(String(o.style), n('terrain'), n('elevation'), n('smoothness'), n('spacing'), colors, c);
  return camouflage(kind, o, colors, c);
}

const rect = (x: number, y: number, width: number, height: number, fill: number, opacity = 1): PatternPrimitive =>
  ({ tag: 'rect', x: f(x), y: f(y), width: f(width), height: f(height), fill, opacity });

/** Wraps a band around the tile edge so repeats join without a seam. */
function bands(primitives: PatternPrimitive[], horizontal: boolean, start: number, size: number, period: number, across: number, fill: number, opacity: number) {
  const place = (offset: number) => primitives.push(horizontal ? rect(0, start + offset, across, size, fill, opacity) : rect(start + offset, 0, size, across, fill, opacity));
  place(0);
  if (start < 0) place(period);
  if (start + size > period) place(-period);
}

function plaid(o: Record<string, number | string>, colors: string[], c: Context): FashionTile {
  const S = Math.max(8, c.ref / c.count * c.scale);
  const width = S * Number(o.vSpacing) / 100 + c.spacingX;
  const height = S * Number(o.hSpacing) / 100 + c.spacingY;
  const defaultWidth = [18, 8, 2, 4, 3, 3, 2];
  const defaultPos = [20, 55, 80, 38, 10, 68, 92];
  const primitives: PatternPrimitive[] = [];
  for (let group = 0; group < colors.length - 1; group++) {
    const w = Number(o[`g${group + 1}w`] ?? defaultWidth[group]) / 100;
    const p = Number(o[`g${group + 1}p`] ?? defaultPos[group]) / 100;
    const hSize = Math.max(.5, S * w * Number(o.hWidth) / 100);
    const vSize = Math.max(.5, S * w * Number(o.vWidth) / 100);
    // Semi-transparent crossing bands darken where they intersect, giving the woven twill look.
    const opacity = w > .1 ? .68 : .92;
    bands(primitives, true, p * height - hSize / 2, hSize, height, width, group + 1, opacity);
    bands(primitives, false, p * width - vSize / 2, vSize, width, height, group + 1, opacity);
  }
  return motifTile(width, height, primitives, colors);
}

function gingham(checkSize: number, hSpacing: number, vSpacing: number, colors: string[], c: Context): FashionTile {
  const S = Math.max(4, c.ref / c.count * c.scale);
  const width = S * vSpacing / 100 + c.spacingX;
  const height = S * hSpacing / 100 + c.spacingY;
  const bw = width * checkSize / 100;
  const bh = height * checkSize / 100;
  // Two half-opaque bands: background, single band, and darker intersection.
  return motifTile(width, height, [rect(0, 0, width, bh, 1, .5), rect(0, 0, bw, height, 1, .5)], colors);
}

function windowpane(hSpacing: number, vSpacing: number, colors: string[], c: Context): FashionTile {
  const S = Math.max(8, c.ref / c.count * c.scale);
  const width = S * vSpacing / 100 + c.spacingX;
  const height = S * hSpacing / 100 + c.spacingY;
  const line = Math.max(.4, (c.thickness ?? Math.max(.8, c.ref * .012)) * c.scale);
  return motifTile(width, height, [rect(width / 2 - line / 2, 0, line, height, 1), rect(0, height / 2 - line / 2, width, line, 1)], colors);
}

function smoothClosed(points: Pt[]): string {
  const mid = (a: Pt, b: Pt) => `${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)}`;
  const last = points.length - 1;
  return `M${mid(points[last], points[0])}${points.map((p, i) => `Q${f(p[0])} ${f(p[1])} ${mid(p, points[(i + 1) % points.length])}`).join('')}Z`;
}

function camouflage(kind: string, o: Record<string, number | string>, colors: string[], c: Context): FashionTile {
  const T = Math.max(40, c.ref * 3.2 * c.scale);
  return motifTile(T,T,textileCamouflage(kind,o,colors.length,c.count,c.seed,T),colors);
}

function topographic(style: string, terrain: number, elevation: number, smoothness: number, spacing: number, colors: string[], c: Context): FashionTile {
  const abstract = style === 'abstract';
  const T = Math.max(60, c.ref * 1.5 * c.scale);
  const G = abstract ? 72 : 56;
  const random = seeded(c.seed ^ 0x70b0);
  const terms = 2 + Math.round(terrain / 100 * 6);
  const waves = Array.from({ length: terms }, (_, k) => {
    const reach = abstract ? 2 + k : 1 + Math.floor(k / 2);
    const decay = Math.pow(k + 1, -(2 - 1.5 * elevation / 100));
    return { fx: Math.floor(random() * (reach * 2 + 1)) - reach || 1, fy: Math.floor(random() * (reach * 2 + 1)) - reach || 1, phase: random() * Math.PI * 2, amplitude: decay };
  });
  const warp = abstract ? { fx: 1 + Math.floor(random() * 2), p: random() * Math.PI * 2, a: .09 + .06 * random() } : { fx: 1, p: 0, a: 0 };
  const field = new Float32Array((G + 1) * (G + 1));
  let low = Infinity, high = -Infinity;
  for (let j = 0; j <= G; j++) for (let i = 0; i <= G; i++) {
    const u = i / G + warp.a * Math.sin(2 * Math.PI * warp.fx * j / G + warp.p);
    const v = j / G + warp.a * Math.sin(2 * Math.PI * warp.fx * i / G + warp.p * 1.7);
    let h = 0;
    for (const w of waves) h += w.amplitude * Math.sin(2 * Math.PI * (w.fx * u + w.fy * v) + w.phase);
    field[j * (G + 1) + i] = h;
    low = Math.min(low, h); high = Math.max(high, h);
  }
  const gamma = .6 + (1 - elevation / 100) * .2 + (abstract ? .3 : 0);
  for (let k = 0; k < field.length; k++) field[k] = Math.pow((field[k] - low) / (high - low || 1), gamma);
  const levels = Math.round(4 + c.count * 1.3);
  const bias = .6 + spacing / 100 * 1.2;
  const cell = T / G;
  const passes = smoothness > 66 ? 2 : smoothness > 33 ? 1 : 0;
  const strokeWidth = f(Math.max(.4, (c.thickness ?? Math.max(.8, c.ref * .01)) * c.scale));
  const primitives: PatternPrimitive[] = [];
  for (let level = 1; level <= levels; level++) {
    const lvl = Math.pow(level / (levels + 1), bias);
    const edges = contourSegments(field, G, lvl, cell);
    for (const chain of chainSegments(edges)) {
      const points = refine(chain.points, passes, chain.closed);
      if (points.length < 2) continue;
      primitives.push({ tag: 'path', d: chain.closed ? smoothClosed(points) : openPath(points, smoothness > 33), fill: 'none', stroke: 1, strokeWidth });
    }
  }
  return motifTile(T, T, primitives, colors);
}

interface Segment { a: string; b: string; pa: Pt; pb: Pt }

function contourSegments(field: Float32Array, G: number, level: number, cell: number): Segment[] {
  const segments: Segment[] = [];
  const at = (i: number, j: number) => field[j * (G + 1) + i];
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const tl = at(i, j), tr = at(i + 1, j), br = at(i + 1, j + 1), bl = at(i, j + 1);
    const code = (tl > level ? 1 : 0) | (tr > level ? 2 : 0) | (br > level ? 4 : 0) | (bl > level ? 8 : 0);
    if (code === 0 || code === 15) continue;
    const lerp = (v0: number, v1: number) => (level - v0) / (v1 - v0 || 1e-6);
    const edge = {
      T: { id: `h${i},${j}`, p: [(i + lerp(tl, tr)) * cell, j * cell] as Pt },
      B: { id: `h${i},${j + 1}`, p: [(i + lerp(bl, br)) * cell, (j + 1) * cell] as Pt },
      L: { id: `v${i},${j}`, p: [i * cell, (j + lerp(tl, bl)) * cell] as Pt },
      R: { id: `v${i + 1},${j}`, p: [(i + 1) * cell, (j + lerp(tr, br)) * cell] as Pt },
    };
    const center = (tl + tr + br + bl) / 4 > level;
    const pairs: [keyof typeof edge, keyof typeof edge][] = ({
      1: [['L', 'T']], 2: [['T', 'R']], 3: [['L', 'R']], 4: [['R', 'B']],
      5: center ? [['T', 'R'], ['L', 'B']] : [['L', 'T'], ['R', 'B']],
      6: [['T', 'B']], 7: [['L', 'B']], 8: [['L', 'B']], 9: [['T', 'B']],
      10: center ? [['L', 'T'], ['R', 'B']] : [['T', 'R'], ['L', 'B']],
      11: [['R', 'B']], 12: [['L', 'R']], 13: [['T', 'R']], 14: [['L', 'T']],
    } as Record<number, [keyof typeof edge, keyof typeof edge][]>)[code];
    for (const [a, b] of pairs) segments.push({ a: edge[a].id, b: edge[b].id, pa: edge[a].p, pb: edge[b].p });
  }
  return segments;
}

function chainSegments(segments: Segment[]): { points: Pt[]; closed: boolean }[] {
  const byKey = new Map<string, number[]>();
  segments.forEach((s, index) => { for (const key of [s.a, s.b]) (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(index); });
  const used = new Array<boolean>(segments.length).fill(false);
  const next = (key: string) => byKey.get(key)?.find(index => !used[index]);
  const chains: { points: Pt[]; closed: boolean }[] = [];
  for (let start = 0; start < segments.length; start++) {
    if (used[start]) continue;
    used[start] = true;
    const first = segments[start];
    const points: Pt[] = [first.pa, first.pb];
    let head = first.b;
    for (let index = next(head); index !== undefined; index = next(head)) {
      used[index] = true;
      const s = segments[index];
      if (s.a === head) { points.push(s.pb); head = s.b; } else { points.push(s.pa); head = s.a; }
    }
    let tail = first.a;
    for (let index = next(tail); index !== undefined; index = next(tail)) {
      used[index] = true;
      const s = segments[index];
      if (s.a === tail) { points.unshift(s.pb); tail = s.b; } else { points.unshift(s.pa); tail = s.a; }
    }
    const closed = head === tail;
    if (closed) points.pop();
    chains.push({ points, closed });
  }
  return chains;
}

function refine(points: Pt[], passes: number, closed: boolean): Pt[] {
  let current = points;
  for (let pass = 0; pass < passes && current.length > 2; pass++) {
    const out: Pt[] = closed ? [] : [current[0]];
    const last = closed ? current.length : current.length - 1;
    for (let i = 0; i < last; i++) {
      const a = current[i], b = current[(i + 1) % current.length];
      out.push([a[0] * .75 + b[0] * .25, a[1] * .75 + b[1] * .25], [a[0] * .25 + b[0] * .75, a[1] * .25 + b[1] * .75]);
    }
    if (!closed) out.push(current[current.length - 1]);
    current = out;
  }
  return current;
}

function openPath(points: Pt[], curved: boolean): string {
  if (!curved || points.length < 3) return `M${points.map(p => `${f(p[0])} ${f(p[1])}`).join('L')}`;
  const mid = (a: Pt, b: Pt) => `${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)}`;
  let d = `M${f(points[0][0])} ${f(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) d += `Q${f(points[i][0])} ${f(points[i][1])} ${mid(points[i], points[i + 1])}`;
  return `${d}L${f(points[points.length - 1][0])} ${f(points[points.length - 1][1])}`;
}
