import type { PatternChoice, PatternDefinition, PatternOption } from './patternCatalog';
import type { PatternPrimitive } from './generatedPatterns';

/**
 * Textile-grade repeats. Every pattern is seeded, seamless, vector and fully recolourable.
 * Organic looks come from periodic noise fields traced to filled shapes, so the left edge always meets the right.
 */
const opt = (key: string, label: string, value: number, min = 0, max = 100, suffix = '%'): PatternOption => ({ key, label, min, max, value, suffix });
type Spec = { id: string; label: string; category: string; colors: string[]; palette: string[]; options: PatternOption[]; choices?: PatternChoice[]; background?: number; span: number; count?: number; minColors?: number; maxColors?: number };
export type PatternWord = { text: string; font: string; d: string; width: number; height: number };
export type TartanSett = { stripes: { color: number; width: number }[]; mirror: boolean; twill?: boolean };
export const DEFAULT_SETT: TartanSett = { mirror: true, twill: true, stripes: [{ color: 0, width: 24 }, { color: 1, width: 4 }, { color: 0, width: 6 }, { color: 2, width: 18 }, { color: 3, width: 2 }, { color: 2, width: 6 }, { color: 4, width: 10 }, { color: 5, width: 2 }] };
export const SETT_PRESETS: { id: string; label: string; colors: string[]; sett: TartanSett }[] = [
  { id: 'highland', label: 'Highland', colors: ['#A3202B', '#15233F', '#1F4D36', '#E9C85A', '#F2EDE1', '#141414'], sett: DEFAULT_SETT },
  { id: 'forest', label: 'Forest', colors: ['#1E3B2C', '#141414', '#2F4F73', '#C9A94E', '#6E7F4A', '#E8E2D0'], sett: { mirror: true, twill: true, stripes: [{ color: 0, width: 30 }, { color: 1, width: 12 }, { color: 2, width: 18 }, { color: 3, width: 2 }, { color: 2, width: 4 }, { color: 4, width: 8 }] } },
  { id: 'harbour', label: 'Harbour', colors: ['#16294B', '#F1ECE0', '#7E96B5', '#B3312F', '#23395F', '#0F1A30'], sett: { mirror: true, twill: true, stripes: [{ color: 0, width: 26 }, { color: 2, width: 10 }, { color: 1, width: 2 }, { color: 4, width: 14 }, { color: 3, width: 3 }, { color: 5, width: 8 }] } },
  { id: 'mono', label: 'Mono', colors: ['#161616', '#F2EFE7', '#6E6E6C', '#B8B5AD', '#2E2E2E', '#8E8C86'], sett: { mirror: true, twill: true, stripes: [{ color: 0, width: 22 }, { color: 3, width: 3 }, { color: 2, width: 14 }, { color: 1, width: 2 }, { color: 4, width: 10 }] } },
];
/** A mirrored sett runs forward then back, pivoting on its first and last stripe. */
export function expandSett(sett: TartanSett) { return sett.mirror && sett.stripes.length > 2 ? [...sett.stripes, ...sett.stripes.slice(1, -1).reverse()] : sett.stripes; }
const DEFAULT_WORD: PatternWord = { text: 'TYPE', font: '', width: 282, height: 100, d: 'M0 0H60V18H39V100H21V18H0ZM68 0H88L103 38L118 0H138L112 58V100H94V58ZM146 0H188A32 32 0 0 1 188 64H164V100H146ZM164 18V46H187A14 14 0 0 0 187 18ZM228 0H282V18H246V40H276V58H246V82H282V100H228Z' };
const ANIMAL = 'Animal', WASH = 'Tie-dye & wash', ORNAMENT = 'Floral & ornament', GRAPHIC = 'Streetwear graphic', TEXTURE = 'Texture', CAMO = 'Fashion & Camo';
const SPECS: Spec[] = [
  { id: 'zebra', label: 'Zebra', category: ANIMAL, colors: ['Stripe', 'Ground'], palette: ['#171717', '#F5F0E3'], background: 1, span: 4, count: 4, options: [opt('stripes', 'Stripes', 5, 2, 12, ''), opt('flow', 'Flow', 55), opt('irregularity', 'Irregularity', 55), opt('weight', 'Stripe weight', 50)] },
  { id: 'giraffe', label: 'Giraffe', category: ANIMAL, colors: ['Patch', 'Ground'], palette: ['#8A4F24', '#EBD9B4'], background: 1, span: 4, count: 4, options: [opt('patches', 'Patches', 20, 6, 48, ''), opt('gap', 'Line width', 34), opt('round', 'Corner softness', 55), opt('irregularity', 'Irregularity', 70)] },
  { id: 'cheetah', label: 'Cheetah', category: ANIMAL, colors: ['Spot', 'Ground'], palette: ['#1D1711', '#DDB36C'], background: 1, span: 4, count: 4, options: [opt('spots', 'Spots', 70, 20, 180, ''), opt('size', 'Spot size', 50), opt('variation', 'Size variation', 55), opt('ragged', 'Ragged edge', 40)] },
  { id: 'snake', label: 'Snake', category: ANIMAL, colors: ['Scale edge', 'Ground', 'Scale'], palette: ['#2A3020', '#B5B687', '#6E7B52'], background: 1, span: 4, count: 4, options: [opt('rows', 'Scale rows', 14, 6, 30, ''), opt('blotch', 'Markings', 55), opt('blotchSize', 'Marking size', 45), opt('edge', 'Edge weight', 30)] },
  { id: 'digital-camo', label: 'Digital Camo', category: CAMO, colors: ['Primary pixel', 'Ground', 'Light pixel', 'Dark pixel'], palette: ['#617049', '#B9B293', '#888B64', '#343D30'], background: 1, span: 4, count: 4, options: [opt('pixels', 'Pixel density', 56, 24, 96, ''), opt('cluster', 'Cluster size', 50), opt('balance', 'Colour balance', 50), opt('breakup', 'Breakup', 35)] },
  { id: 'tie-dye-spiral', label: 'Spiral Tie-dye', category: WASH, colors: ['Colour 1', 'Colour 2', 'Colour 3', 'Colour 4', 'Colour 5'], palette: ['#1E2A78', '#E5266E', '#F7B32B', '#19B5A5', '#F3EFE6'], background: 0, span: 4, count: 3, options: [opt('arms', 'Arms', 3, 1, 8, ''), opt('twist', 'Twist', 55), opt('bleed', 'Bleed', 45), opt('softness', 'Band balance', 50)] },
  { id: 'tie-dye-crumple', label: 'Crumple Dye', category: WASH, colors: ['Colour 1', 'Colour 2', 'Colour 3', 'Colour 4'], palette: ['#27316B', '#6A4FB3', '#D65DB1', '#F4E9D8'], background: 0, span: 4, count: 3, options: [opt('folds', 'Fold size', 45), opt('contrast', 'Contrast', 55), opt('flow', 'Flow', 50)] },
  { id: 'acid-wash', label: 'Acid Wash', category: WASH, colors: ['Denim', 'Mid wash', 'Bleach'], palette: ['#2F4A6B', '#6F8CA8', '#D6DEE4'], background: 0, span: 4, count: 3, options: [opt('veins', 'Vein size', 45), opt('bleach', 'Bleach amount', 50), opt('sharpness', 'Vein sharpness', 55)] },
  { id: 'bleach-splatter', label: 'Bleach Splatter', category: WASH, colors: ['Fabric', 'Bleach', 'Halo'], palette: ['#1B1C20', '#F1ECDF', '#8B8A86'], background: 0, span: 4, count: 3, options: [opt('amount', 'Splats', 12, 3, 32, ''), opt('size', 'Splat size', 50), opt('droplets', 'Droplets', 60), opt('halo', 'Halo', 45)] },
  { id: 'marble', label: 'Marble', category: WASH, colors: ['Base', 'Vein', 'Fine vein'], palette: ['#F0ECE4', '#3A3A40', '#A6A29A'], background: 0, span: 4, count: 3, options: [opt('veins', 'Veins', 4, 1, 10, ''), opt('turbulence', 'Turbulence', 60), opt('weight', 'Vein weight', 35)] },
  { id: 'paisley', label: 'Paisley', category: ORNAMENT, colors: ['Ground', 'Paisley', 'Inner', 'Accent'], palette: ['#1F2F52', '#E8C77D', '#B5433C', '#F4EFE3'], background: 0, span: 2, count: 3, options: [opt('size', 'Motif size', 60, 30, 100), opt('fill', 'Filler detail', 60), opt('tilt', 'Tilt', 25, -60, 60, '°')] },
  { id: 'bandana', label: 'Bandana', category: ORNAMENT, colors: ['Ground', 'Ornament', 'Accent'], palette: ['#B3202A', '#F7F2E8', '#141414'], background: 0, span: 1, count: 2, options: [opt('size', 'Motif size', 62, 35, 100), opt('dots', 'Dot border', 60), opt('petals', 'Petals', 8, 5, 12, '')] },
  { id: 'ditsy-floral', label: 'Ditsy Floral', category: ORNAMENT, colors: ['Ground', 'Flower', 'Flower 2', 'Centre', 'Leaf'], palette: ['#22324A', '#F2A7B5', '#F4EDE0', '#E9B949', '#6D9273'], background: 0, span: 4, count: 3, options: [opt('flowers', 'Flowers', 34, 8, 90, ''), opt('size', 'Flower size', 45), opt('leaves', 'Leaves', 60), opt('variation', 'Size variation', 45)] },
  { id: 'seigaiha', label: 'Wave Scales', category: ORNAMENT, colors: ['Ground', 'Wave', 'Inner'], palette: ['#17335C', '#EFE8D8', '#3E6C9E'], background: 0, span: 4, count: 6, options: [opt('rings', 'Rings', 4, 2, 7, ''), opt('weight', 'Ring weight', 45), opt('overlap', 'Overlap', 50)] },
  { id: 'warped-check', label: 'Warped Check', category: GRAPHIC, colors: ['Check', 'Ground'], palette: ['#141414', '#F3EFE6'], background: 1, span: 4, count: 3, options: [opt('checks', 'Checks', 6, 2, 16, ''), opt('warp', 'Warp', 55), opt('swirl', 'Wave size', 40)] },
  { id: 'racing-check', label: 'Racing Flag', category: GRAPHIC, colors: ['Check', 'Ground'], palette: ['#101010', '#F7F5EF'], background: 1, span: 4, count: 3, options: [opt('checks', 'Checks', 10, 4, 24, ''), opt('wave', 'Flag wave', 45), opt('ripples', 'Ripples', 2, 1, 5, '')] },
  { id: 'herringbone', label: 'Herringbone', category: GRAPHIC, colors: ['Weave', 'Ground'], palette: ['#2B2B2E', '#CFC8B8'], background: 1, span: 2, count: 6, options: [opt('rows', 'Bars', 6, 3, 14, ''), opt('gap', 'Gap', 30), opt('slant', 'Slant', 70, 25, 100)] },
  { id: 'memphis', label: 'Memphis', category: GRAPHIC, colors: ['Ground', 'Colour 1', 'Colour 2', 'Colour 3', 'Colour 4'], palette: ['#F6F1E5', '#141414', '#EF476F', '#118AB2', '#FFD166'], background: 0, span: 4, count: 3, options: [opt('shapes', 'Shapes', 30, 8, 70, ''), opt('size', 'Shape size', 50), opt('line', 'Line weight', 40)] },
  { id: 'bauhaus', label: 'Bauhaus', category: GRAPHIC, colors: ['Ground', 'Colour 1', 'Colour 2', 'Colour 3'], palette: ['#EFE6D2', '#1B1B1B', '#C8362B', '#2B5C9E'], background: 0, span: 4, count: 3, options: [opt('cells', 'Grid', 5, 2, 10, ''), opt('fill', 'Fill', 85), opt('variety', 'Variety', 70)] },
  { id: 'terrazzo', label: 'Terrazzo', category: GRAPHIC, colors: ['Ground', 'Chip 1', 'Chip 2', 'Chip 3', 'Chip 4'], palette: ['#EEE8DC', '#2E2E30', '#C96F4A', '#7D9A8C', '#D9B44A'], background: 0, span: 4, count: 3, options: [opt('chips', 'Chips', 80, 20, 180, ''), opt('size', 'Chip size', 45), opt('variation', 'Size variation', 65)] },
  { id: 'flames', label: 'Hot Rod Flames', category: GRAPHIC, colors: ['Outer flame', 'Inner flame', 'Ground'], palette: ['#F45B27', '#FFD35C', '#141414'], background: 2, span: 2, count: 3, options: [opt('licks', 'Licks', 5, 2, 10, ''), opt('height', 'Flame height', 70, 35, 95), opt('curl', 'Curl', 55), opt('inner', 'Inner flame', 60)] },
  { id: 'word-repeat', label: 'Word Repeat', category: GRAPHIC, colors: ['Ink', 'Ground'], palette: ['#141414', '#F3EFE6'], background: 1, span: 1, count: 6, options: [opt('size', 'Word size', 72, 25, 100), opt('gap', 'Word gap', 22), opt('stagger', 'Row shift', 50), opt('line', 'Outline weight', 25)], choices: [{ key: 'style', label: 'Word style', value: 'alternate', options: [{ value: 'alternate', label: 'Solid + outline' }, { value: 'solid', label: 'Solid' }, { value: 'outline', label: 'Outline' }] }] },
  { id: 'tartan-builder', label: 'Tartan Builder', category: 'Textile & Animal', colors: ['Colour 1', 'Colour 2', 'Colour 3', 'Colour 4', 'Colour 5', 'Colour 6'], palette: SETT_PRESETS[0].colors, span: 1, count: 2, minColors: 2, maxColors: 8, options: [opt('weave', 'Weave size', 30), opt('cover', 'Weave balance', 50, 25, 75), opt('offset', 'Sett start', 0, 0, 99)] },
  { id: 'cracked', label: 'Cracked', category: TEXTURE, colors: ['Ink'], palette: ['#292929'], span: 4, count: 3, options: [opt('cells', 'Cracks', 40, 8, 110, ''), opt('width', 'Crack width', 30), opt('irregularity', 'Irregularity', 70)] },
  { id: 'distressed', label: 'Distressed', category: TEXTURE, colors: ['Ink'], palette: ['#292929'], span: 4, count: 3, options: [opt('amount', 'Wear', 40), opt('size', 'Wear size', 40), opt('sharpness', 'Rough detail', 60)] },
  { id: 'noise', label: 'Noise', category: TEXTURE, colors: ['Ink'], palette: ['#292929'], span: 4, count: 3, options: [opt('density', 'Density', 45), opt('size', 'Speck size', 30), opt('variation', 'Size variation', 60)] },
  { id: 'grain', label: 'Grain', category: TEXTURE, colors: ['Ink'], palette: ['#292929'], span: 4, count: 3, options: [opt('density', 'Density', 50), opt('length', 'Fibre length', 35), opt('direction', 'Direction', 80, -90, 90, '°'), opt('spread', 'Direction spread', 25)] },
];
const byId = new Map(SPECS.map(spec => [spec.id, spec]));
export const isProPattern = (id: string) => byId.has(id);
export const PRO_PATTERN_PALETTES = Object.fromEntries(SPECS.map(spec => [spec.id, spec.palette]));
/** Fixed layouts have nothing to reshuffle, so they do not offer Randomise. */
const FIXED_LAYOUT = new Set(['paisley', 'bandana', 'seigaiha', 'racing-check', 'herringbone', 'word-repeat', 'tartan-builder']);
export const PRO_PATTERN_DEFINITIONS: PatternDefinition[] = SPECS.map(spec => ({ id: spec.id, label: spec.label, category: spec.category, fashion: true, pro: true, colors: spec.colors, minColors: spec.minColors ?? spec.colors.length, maxColors: spec.maxColors ?? spec.colors.length, choices: spec.choices, randomise: !FIXED_LAYOUT.has(spec.id), noSpacing: true, amountLabel: 'Repeat frequency', defaultCount: spec.count ?? 4, options: spec.options }));

const f = (v: number) => Math.round(v * 10) / 10;
const TAU = Math.PI * 2;
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const mod = (v: number, m: number) => ((v % m) + m) % m;
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => { state += 0x6D2B79F5; let word = Math.imul(state ^ state >>> 15, state | 1); word ^= word + Math.imul(word ^ word >>> 7, word | 61); return ((word ^ word >>> 14) >>> 0) / 4294967296; };
}
function latticeHash(x: number, y: number, seed: number) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
/** Value noise that repeats exactly every `cells` cells across a 0–1 tile. */
function periodic(u: number, v: number, cells: number, seed: number) {
  const x = mod(u, 1) * cells, y = mod(v, 1) * cells, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), g = (a: number, b: number) => latticeHash(mod(a, cells), mod(b, cells), seed);
  return (g(ix, iy) * (1 - sx) + g(ix + 1, iy) * sx) * (1 - sy) + (g(ix, iy + 1) * (1 - sx) + g(ix + 1, iy + 1) * sx) * sy;
}
function fbm(u: number, v: number, cells: number, octaves: number, seed: number) {
  let sum = 0, amp = .5, total = 0, c = Math.max(1, Math.round(cells));
  for (let i = 0; i < octaves; i++) { sum += periodic(u, v, c, seed + i * 17) * amp; total += amp; amp *= .5; c *= 2; }
  return sum / total;
}

type Field = (u: number, v: number) => number;
/** Trace the area where a field is above a level into one filled path. */
function isoPath(field: Field | Float32Array, res: number, size: number, level: number) {
  const values = field instanceof Float32Array ? field : sampleField(field, res), at = (x: number, y: number) => values[(y % res) * res + (x % res)], k = size / res, parts: string[] = [];
  for (let y = 0; y < res; y++) {
    let run = -1;
    const flush = (end: number) => { if (run >= 0) { parts.push(`M${f(run * k)} ${f(y * k)}H${f(end * k)}V${f((y + 1) * k)}H${f(run * k)}Z`); run = -1; } };
    for (let x = 0; x < res; x++) {
      const a = at(x, y), b = at(x + 1, y), c = at(x + 1, y + 1), d = at(x, y + 1), ia = a > level, ib = b > level, ic = c > level, id = d > level;
      if (ia && ib && ic && id) { if (run < 0) run = x; continue; }
      flush(x);
      if (!ia && !ib && !ic && !id) continue;
      const cut = (p: number, q: number) => clamp((level - p) / ((q - p) || 1e-6)), pts: [number, number][] = [];
      if (ia) pts.push([x, y]); if (ia !== ib) pts.push([x + cut(a, b), y]);
      if (ib) pts.push([x + 1, y]); if (ib !== ic) pts.push([x + 1, y + cut(b, c)]);
      if (ic) pts.push([x + 1, y + 1]); if (ic !== id) pts.push([x + 1 - cut(c, d), y + 1]);
      if (id) pts.push([x, y + 1]); if (id !== ia) pts.push([x, y + 1 - cut(d, a)]);
      if (pts.length > 2) parts.push('M' + pts.map(([px, py]) => `${f(px * k)} ${f(py * k)}`).join('L') + 'Z');
    }
    flush(res);
  }
  return parts.join('');
}
function sampleField(field: Field, res: number) {
  const out = new Float32Array(res * res);
  for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) out[y * res + x] = field(x / res, y / res);
  return out;
}
const shape = (d: string, fill: number, extra: Partial<Extract<PatternPrimitive, { tag: 'path' }>> = {}): PatternPrimitive => ({ tag: 'path', d, fill, ...extra });

/** Evenly spread points on a tile that wraps. */
export function spread(count: number, size: number, random: () => number) {
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    let best: [number, number] = [random() * size, random() * size], score = -1;
    for (let c = 0; c < 6; c++) {
      const p: [number, number] = [random() * size, random() * size]; let near = Infinity;
      for (const q of out) { const dx = Math.min(Math.abs(p[0] - q[0]), size - Math.abs(p[0] - q[0])), dy = Math.min(Math.abs(p[1] - q[1]), size - Math.abs(p[1] - q[1])); near = Math.min(near, dx * dx + dy * dy); }
      if (near > score) { score = near; best = p; }
    }
    out.push(best);
  }
  return out;
}
function blobPath(random: () => number, radius: number, rough: number, stretch = 1, points = 10) {
  const row = Array.from({ length: points }, (_, i) => { const a = i / points * TAU, r = radius * (1 - rough * .5 + random() * rough); return [Math.cos(a) * r * stretch, Math.sin(a) * r] as [number, number]; });
  return smoothLoop(row);
}
function smoothLoop(row: [number, number][]) {
  const mid = (a: [number, number], b: [number, number]) => `${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)}`;
  return `M${mid(row[row.length - 1], row[0])}` + row.map((p, i) => `Q${f(p[0])} ${f(p[1])} ${mid(p, row[(i + 1) % row.length])}`).join('') + 'Z';
}
/** Toroidal Voronoi cells, inset so neighbours keep an even gap. */
function voronoi(sites: [number, number][], size: number, gap: number) {
  const cells: [number, number][][] = [];
  for (const site of sites) {
    let poly: [number, number][] = [[site[0] - size, site[1] - size], [site[0] + size, site[1] - size], [site[0] + size, site[1] + size], [site[0] - size, site[1] + size]];
    for (const other of sites) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      if (other === site && !ox && !oy) continue;
      const qx = other[0] + ox * size, qy = other[1] + oy * size, dx = qx - site[0], dy = qy - site[1], len = Math.hypot(dx, dy);
      if (!len || len > size * 1.5) continue;
      const nx = dx / len, ny = dy / len, limit = len / 2 - gap / 2, side = (p: [number, number]) => (p[0] - site[0]) * nx + (p[1] - site[1]) * ny - limit, next: [number, number][] = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
        if (sa <= 0) next.push(a);
        if ((sa < 0 && sb > 0) || (sa > 0 && sb < 0)) { const t = sa / (sa - sb); next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      poly = next;
      if (poly.length < 3) break;
    }
    if (poly.length >= 3) cells.push(poly);
  }
  return cells;
}
function roundedPolygon(poly: [number, number][], radius: number) {
  const n = poly.length, parts: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = poly[i], a = poly[(i - 1 + n) % n], b = poly[(i + 1) % n], la = Math.hypot(a[0] - p[0], a[1] - p[1]) || 1, lb = Math.hypot(b[0] - p[0], b[1] - p[1]) || 1, ra = Math.min(radius, la * .48), rb = Math.min(radius, lb * .48);
    const s = [p[0] + (a[0] - p[0]) / la * ra, p[1] + (a[1] - p[1]) / la * ra], e = [p[0] + (b[0] - p[0]) / lb * rb, p[1] + (b[1] - p[1]) / lb * rb];
    parts.push(`${i ? 'L' : 'M'}${f(s[0])} ${f(s[1])}Q${f(p[0])} ${f(p[1])} ${f(e[0])} ${f(e[1])}`);
  }
  return parts.join('') + 'Z';
}
const circlePath = (x: number, y: number, r: number) => `M${f(x - r)} ${f(y)}a${f(r)} ${f(r)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-r * 2)} 0Z`;
const PAISLEY = 'M0 -1C.55 -.85 .85 -.2 .62 .35C.45 .78 -.05 .95 -.42 .72C-.82 .46 -.62 -.1 -.2 -.25C.05 -.35 .12 -.7 0 -1Z';

export function proPatternTile(kind: string, o: Record<string, number | string>, colors: string[], c: { count: number; scale: number; seed: number; ref: number; word?: PatternWord; sett?: TartanSett }) {
  const spec = byId.get(kind)!, size = Math.max(24, c.ref / c.count * c.scale * spec.span), n = (key: string) => Number(o[key]), p = (key: string) => n(key) / 100, seed = c.seed | 0, random = seeded(c.seed), out: PatternPrimitive[] = [];
  /** Place a shape, repeating it across any tile edge it touches. */
  const put = (d: string, fill: number, x: number, y: number, reach: number, rotate = 0, scale = 1, extra: Partial<Extract<PatternPrimitive, { tag: 'path' }>> = {}) => {
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const px = x + ox * size, py = y + oy * size, margin = reach * 1.2 + size * .012;
      if (px + margin < 0 || px - margin > size || py + margin < 0 || py - margin > size) continue;
      out.push(shape(d, fill, { ...extra, transform: `translate(${f(px)} ${f(py)})${rotate ? ` rotate(${f(rotate)})` : ''}${scale !== 1 ? ` scale(${Math.round(scale * 1000) / 1000})` : ''}` }));
    }
  };
  const res = Math.min(150, Math.max(72, Math.round(size / 2.4)));
  let tileWidth = size, tileHeight = size;
  switch (kind) {
    case 'word-repeat': {
      const word = c.word ?? DEFAULT_WORD, row = size, s = row * p('size') / word.height, wide = word.width * s, cell = wide + row * (.04 + p('gap') * 1.1), line = row * (.006 + p('line') * .05) / s, style = String(o.style), shift = p('stagger');
      tileWidth = cell; tileHeight = row * 2;
      for (let r = 0; r < 2; r++) {
        const outlined = style === 'outline' || (style === 'alternate' && r === 1), x0 = (r ? shift * cell : 0) + (cell - wide) / 2, y = (r + .5) * row - word.height * s / 2;
        for (let k = -1; k <= 1; k++) { const x = x0 + k * cell; if (x + wide < -row * .1 || x > cell + row * .1) continue; out.push({ ...shape(word.d, outlined ? 'none' as unknown as number : 0, { ...(outlined ? { stroke: 0, strokeWidth: line } : {}), transform: `translate(${f(x)} ${f(y)}) scale(${Math.round(s * 10000) / 10000})` }), fillRule: 'evenodd' } as unknown as PatternPrimitive); }
      }
      break;
    }
    case 'tartan-builder': {
      const sett = c.sett?.stripes.length ? c.sett : DEFAULT_SETT, row = expandSett(sett), total = row.reduce((sum, stripe) => sum + Math.max(1, stripe.width), 0), unit = size / total, shift = p('offset') * size, twill = sett.twill !== false, cover = p('cover'), count = Math.max(10, Math.round(size / (size * (.012 + p('weave') * .05)))), period = size / count, bands = new Map<number, [number, number][]>();
      let at = 0;
      for (const stripe of row) { const start = mod(at * unit + shift, size), width = Math.max(1, stripe.width) * unit, ink = stripe.color % colors.length, list = bands.get(ink) ?? []; list.push([start, Math.min(size, start + width)]); if (start + width > size) list.push([0, start + width - size]); bands.set(ink, list); at += Math.max(1, stripe.width); }
      for (const [ink, list] of bands) out.push(shape(list.map(([a, b]) => `M0 ${f(a)}H${f(size)}V${f(b)}H0Z`).join(''), ink));
      for (const [ink, list] of bands) {
        if (!twill) { out.push(shape(list.map(([a, b]) => `M${f(a)} 0H${f(b)}V${f(size)}H${f(a)}Z`).join(''), ink, { opacity: cover })); continue; }
        const parts: string[] = [], tall = period * cover;
        for (const [a, b] of list) { const w = b - a; for (let k = Math.floor((-w - tall - a) / period); k <= Math.ceil((size - a) / period); k++) { const y = k * period + a; parts.push(`M${f(a)} ${f(y)}L${f(b)} ${f(y + w)}V${f(y + w + tall)}L${f(a)} ${f(y + tall)}Z`); } }
        out.push(shape(parts.join(''), ink));
      }
      break;
    }
    case 'zebra': {
      const k = Math.round(n('stripes')), flow = p('flow'), rough = p('irregularity'), weight = p('weight');
      out.push(shape(isoPath((u, v) => Math.sin(TAU * (k * u + (fbm(u, v, 2, 3, seed) - .5) * (1 + flow * 3.2) + Math.sin(TAU * v) * flow * .18)) - (.25 - weight * .9) - (periodic(u, v, 4, seed + 7) - .5) * rough * 1.2, res, size, 0), 0));
      break;
    }
    case 'giraffe': {
      const count = Math.round(n('patches')), jitter = p('irregularity'), base = spread(count, size, random), cell = size / Math.sqrt(count);
      const sites = base.map(([x, y], i) => [x, y + 0 * i] as [number, number]).map(([x, y]) => [mod(x + (random() - .5) * cell * .3 * jitter, size), mod(y + (random() - .5) * cell * .3 * jitter, size)] as [number, number]);
      for (const poly of voronoi(sites, size, cell * (.05 + p('gap') * .3))) {
        const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length, cy = poly.reduce((s, q) => s + q[1], 0) / poly.length, reach = Math.max(...poly.map(q => Math.hypot(q[0] - cx, q[1] - cy)));
        put(roundedPolygon(poly.map(q => [q[0] - cx, q[1] - cy] as [number, number]), cell * (.04 + p('round') * .26)), 0, cx, cy, reach);
      }
      break;
    }
    case 'cheetah': {
      const count = Math.round(n('spots')), base = size / Math.sqrt(count) * (.14 + p('size') * .36);
      for (const [x, y] of spread(count, size, random)) { const r = base * (1 - p('variation') * .45 + random() * p('variation') * .9); put(blobPath(random, r, .25 + p('ragged') * .6, .9 + random() * .35, 8), 0, x, y, r * 1.8, random() * 180); }
      break;
    }
    case 'snake': {
      let rows = Math.round(n('rows')); if (rows % 2) rows++;
      const h = size / rows, w = h * 1.5, columns = Math.max(1, Math.round(size / w)), wide = size / columns, edge = h * (.04 + p('edge') * .22), scale = `M0 ${f(-h * .92)}Q${f(wide * .44)} ${f(-h * .5)} ${f(wide * .5)} 0Q${f(wide * .36)} ${f(h * .52)} 0 ${f(h * .95)}Q${f(-wide * .36)} ${f(h * .52)} ${f(-wide * .5)} 0Q${f(-wide * .44)} ${f(-h * .5)} 0 ${f(-h * .92)}Z`, marks = Math.max(2, Math.round(2 + (1 - p('blotchSize')) * 5));
      for (let row = -1; row <= rows; row++) for (let col = 0; col < columns; col++) {
        const x = (col + (mod(row, 2) ? .5 : 0)) * wide, y = (row + .5) * h, value = fbm(x / size, y / size, marks, 2, seed), marked = value > .76 - p('blotch') * .26;
        out.push(shape(scale, marked ? 0 : 2, { stroke: 0, strokeWidth: edge, transform: `translate(${f(x)} ${f(y)})` }));
        if (x < wide * .6) out.push(shape(scale, marked ? 0 : 2, { stroke: 0, strokeWidth: edge, transform: `translate(${f(x + size)} ${f(y)})` }));
      }
      break;
    }
    case 'digital-camo': {
      const cells = Math.round(n('pixels') / 2) * 2, px = size / cells, feature = Math.max(2, Math.round(9 - p('cluster') * 6)), balance = p('balance') * .24 - .12, breakup = p('breakup');
      const pick = (x: number, y: number) => { const u = x / cells, v = y / cells, a = fbm(u, v, feature, 2, seed) + (latticeHash(x, y, seed + 3) - .5) * breakup * .22, b = fbm(u, v, feature + 1, 2, seed + 31) + (latticeHash(x, y, seed + 5) - .5) * breakup * .22; return a > .56 + balance ? 3 : a < .44 - balance ? 0 : b > .54 ? 2 : -1; };
      const runs: Record<number, string[]> = { 0: [], 2: [], 3: [] };
      for (let y = 0; y < cells; y++) { let x = 0; while (x < cells) { const value = pick(x, y); let end = x + 1; while (end < cells && pick(end, y) === value) end++; if (value >= 0) runs[value].push(`M${f(x * px)} ${f(y * px)}H${f(end * px)}V${f((y + 1) * px)}H${f(x * px)}Z`); x = end; } }
      for (const value of [0, 2, 3]) if (runs[value].length) out.push(shape(runs[value].join(''), value));
      break;
    }
    case 'tie-dye-spiral': {
      // A true spiral from the tile centre that melts into shared noise before the edge, so tiles join invisibly.
      const arms = Math.round(n('arms')), twist = 1.2 + p('twist') * 3.6, bleed = p('bleed') * .16, bias = .75 + p('softness') * .6;
      const band = sampleField((u, v) => {
        const x = u - .5, y = v - .5, r = Math.hypot(x, y) * 2, a = Math.atan2(y, x), wobble = (fbm(u, v, 5, 3, seed) - .5) * bleed * 4, tri = Math.abs(fract(arms * a / TAU + r * twist + wobble) * 2 - 1), fade = clamp((r - .68) / .3), edge = fade * fade * (3 - 2 * fade), outer = Math.abs(fract(fbm(u, v, 2, 3, seed + 11) * 3.2) * 2 - 1);
        return (tri * (1 - edge) + outer * edge) ** bias;
      }, res);
      for (let k = 1; k < colors.length; k++) out.push(shape(isoPath(band, res, size, k / colors.length), k));
      break;
    }
    case 'tie-dye-crumple': {
      const cells = Math.max(2, Math.round(8 - p('folds') * 6)), flow = p('flow'), contrast = .6 + p('contrast') * 1.5;
      const band = sampleField((u, v) => { const wx = u + (fbm(u, v, 2, 2, seed + 3) - .5) * flow * .5, wy = v + (fbm(u, v, 2, 2, seed + 9) - .5) * flow * .5, ridge = 1 - Math.abs(fbm(wx, wy, cells, 4, seed) * 2 - 1); return clamp((ridge - .74) * contrast * 2.6 + .5); }, res);
      for (let k = 1; k < colors.length; k++) out.push(shape(isoPath(band, res, size, k / colors.length), k));
      break;
    }
    case 'acid-wash': {
      const cells = Math.max(2, Math.round(9 - p('veins') * 6)), sharp = 1 + p('sharpness') * 3;
      const band = sampleField((u, v) => (1 - Math.abs(fbm(u, v, cells, 5, seed) * 2 - 1)) ** sharp, res), cut = .62 - p('bleach') * .4;
      out.push(shape(isoPath(band, res, size, cut), 1), shape(isoPath(band, res, size, cut + (1 - cut) * .42), 2));
      break;
    }
    case 'bleach-splatter': {
      const amount = Math.round(n('amount')), base = size / Math.sqrt(amount) * (.1 + p('size') * .34);
      for (const [x, y] of spread(amount, size, random)) {
        const r = base * (.5 + random() * 1.1), body = blobPath(random, r, .75, .85 + random() * .3, 13), rotate = random() * 360;
        if (p('halo') > 0) put(body, 2, x, y, r * 2.2, rotate, 1 + p('halo') * .45, { opacity: .55 });
        put(body, 1, x, y, r * 1.7, rotate);
        const drops = Math.round(p('droplets') * 16);
        for (let i = 0; i < drops; i++) { const a = random() * TAU, dist = r * (1.3 + random() ** 2 * 3.1), s = Math.max(size * .002, r * (.03 + random() ** 3 * .22)); put(circlePath(0, 0, s), 1, x + Math.cos(a) * dist, y + Math.sin(a) * dist, s); }
      }
      break;
    }
    case 'marble': {
      const k = Math.round(n('veins')), turbulence = p('turbulence') * 2.2, weight = .05 + p('weight') * .3;
      const line = sampleField((u, v) => 1 - Math.abs(Math.sin(Math.PI * (k * (u + v) + (fbm(u, v, 3, 4, seed) - .5) * turbulence * 1.5))), 150), fine = sampleField((u, v) => 1 - Math.abs(Math.sin(Math.PI * (k * 2 * (u - v) + (fbm(u, v, 4, 3, seed + 13) - .5) * turbulence * 2))), 150);
      out.push(shape(isoPath(fine, 150, size, 1 - weight * .34), 2), shape(isoPath(line, 150, size, 1 - weight * .62), 1));
      break;
    }
    case 'paisley': {
      const r = size / 2 * p('size') * .78, tilt = n('tilt');
      [[.25, .25, tilt], [.75, .75, tilt + 180]].forEach(([u, v, angle]) => {
        const x = u * size, y = v * size;
        put(PAISLEY, 1, x, y, r * 1.2, angle, r); put(PAISLEY, 0, x, y, r, angle, r * .82); put(PAISLEY, 2, x, y, r, angle, r * .66); put(PAISLEY, 3, x, y, r, angle, r * .34);
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + angle * Math.PI / 180, d = r * (1.14 + .08 * Math.sin(a * 2)); put(circlePath(0, 0, r * .045), 3, x + Math.cos(a) * d, y + Math.sin(a) * d * 1.02, r * .05); }
      });
      if (p('fill') > 0) [[.75, .25], [.25, .75]].forEach(([u, v]) => { const x = u * size, y = v * size, s = size * .11 * (.5 + p('fill') * .7); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; put(circlePath(0, 0, s * .34), 1, x + Math.cos(a) * s * .62, y + Math.sin(a) * s * .62, s * .36); } put(circlePath(0, 0, s * .3), 2, x, y, s * .3); });
      break;
    }
    case 'bandana': {
      const r = size * .17 * (.6 + p('size')), petals = Math.round(n('petals')), mid = size / 2;
      for (let i = 0; i < 4; i++) { const a = (i / 4 * TAU) + Math.PI / 4, x = mid + Math.cos(a) * size * .25, y = mid + Math.sin(a) * size * .25; put(PAISLEY, 1, x, y, r * 1.2, i * 90 + 135, r); put(PAISLEY, 0, x, y, r, i * 90 + 135, r * .72); put(PAISLEY, 1, x, y, r, i * 90 + 135, r * .42); }
      for (let i = 0; i < petals; i++) { const a = i / petals * 360; put('M0 0C.34 -.3 .3 -.78 0 -1C-.3 -.78 -.34 -.3 0 0Z', 1, mid, mid, r * 1.05, a, r * .95); }
      put(circlePath(0, 0, r * .24), 2, mid, mid, r * .24); put(circlePath(0, 0, r * .12), 1, mid, mid, r * .12);
      for (let i = 0; i < petals; i++) { const a = i / petals * 360 + 180 / petals; put('M0 0C.26 -.2 .22 -.6 0 -.8C-.22 -.6 -.26 -.2 0 0Z', 1, 0, 0, r * .9, a, r * .8); }
      put(circlePath(0, 0, r * .2), 2, 0, 0, r * .2);
      const dots = Math.max(0, Math.round(p('dots') * 26));
      for (let i = 0; i < dots; i++) { const t = (i + .5) / dots; for (const [x, y] of [[t * size, 0], [0, t * size]] as const) if (Math.min(t, 1 - t) > .16) put(circlePath(0, 0, size * .009), 1, x, y, size * .01); }
      break;
    }
    case 'ditsy-floral': {
      const count = Math.round(n('flowers')), base = size / Math.sqrt(count) * (.14 + p('size') * .34);
      for (const [x, y] of spread(count, size, random)) {
        const r = base * (1 - p('variation') * .35 + random() * p('variation') * .7), petals = 5 + Math.floor(random() * 2), rotate = random() * 360, ink = random() < .6 ? 1 : 2;
        if (random() < p('leaves')) for (let l = 0; l < 2; l++) put('M0 0C.5 -.34 1.2 -.3 1.75 0C1.2 .3 .5 .34 0 0Z', 4, x, y, r * 2.1, rotate + 40 + l * (120 + random() * 70), r);
        for (let i = 0; i < petals; i++) { const a = i / petals * TAU + rotate * Math.PI / 180; put(circlePath(0, 0, r * .48), ink, x + Math.cos(a) * r * .62, y + Math.sin(a) * r * .62, r * .5); }
        put(circlePath(0, 0, r * .34), 3, x, y, r * .35);
      }
      break;
    }
    case 'seigaiha': {
      const rows = 8, r = size / 4, stepY = size / rows, rings = Math.round(n('rings')), weight = .25 + p('weight') * .6, spacing = r * (.72 + p('overlap') * .32);
      for (let row = -2; row <= rows + 2; row++) for (let col = -1; col <= 4; col++) {
        const x = (col + (mod(row, 2) ? .5 : 0)) * (size / 4) * 1, y = row * stepY;
        for (let ring = 0; ring < rings; ring++) { const radius = spacing * (1 - ring / rings); out.push({ tag: 'circle', cx: f(x), cy: f(y), r: f(radius), fill: ring % 2 ? 2 : 1 }); out.push({ tag: 'circle', cx: f(x), cy: f(y), r: f(radius * (1 - weight / rings)), fill: ring % 2 ? 1 : 0 }); }
      }
      break;
    }
    case 'warped-check': {
      const k = Math.round(n('checks')), warp = p('warp') * .15 / Math.max(1, k / 5), waves = Math.max(1, Math.round(1 + (1 - p('swirl')) * 3));
      out.push(shape(isoPath((u, v) => Math.sin(TAU * k * (u + Math.sin(TAU * waves * v + seed) * warp + (fbm(u, v, 2, 1, seed) - .5) * warp * .25)) * Math.sin(TAU * k * (v + Math.sin(TAU * waves * u + seed * .7) * warp + (fbm(u, v, 2, 1, seed + 7) - .5) * warp * .25)), Math.min(190, res + 40), size, 0), 0));
      break;
    }
    case 'racing-check': {
      const k = Math.round(n('checks')), wave = p('wave') * .09, ripples = Math.round(n('ripples'));
      out.push(shape(isoPath((u, v) => Math.sin(TAU * k * (u + Math.sin(TAU * ripples * v) * wave * .6)) * Math.sin(TAU * k * (v + Math.sin(TAU * ripples * u) * wave)), Math.min(190, res + 40), size, 0), 0));
      break;
    }
    case 'herringbone': {
      const bars = Math.round(n('rows')), h = size / bars, columns = 4, w = size / columns, rise = w * p('slant'), gap = h * p('gap') * .55, parts: string[] = [];
      for (let col = 0; col < columns; col++) for (let row = -3; row <= bars + 3; row++) {
        const x = col * w, dir = col % 2 ? -1 : 1, y = row * h + (col % 2 ? rise : 0), top = y + gap / 2, bottom = y + h - gap / 2;
        parts.push(`M${f(x)} ${f(top)}L${f(x + w)} ${f(top + rise * dir)}L${f(x + w)} ${f(bottom + rise * dir)}L${f(x)} ${f(bottom)}Z`);
      }
      out.push(shape(parts.join(''), 0));
      break;
    }
    case 'memphis': {
      const count = Math.round(n('shapes')), base = size / Math.sqrt(count) * (.2 + p('size') * .42), line = base * (.1 + p('line') * .28);
      spread(count, size, random).forEach(([x, y], index) => {
        const type = Math.floor(random() * 6), ink = 1 + index % (colors.length - 1), r = base * (.7 + random() * .6), rotate = random() * 360;
        const stroked = { stroke: ink, strokeWidth: line };
        if (type === 0) put(`M0 ${f(-r)}L${f(r * .9)} ${f(r * .7)}L${f(-r * .9)} ${f(r * .7)}Z`, ink, x, y, r * 1.2, rotate);
        else if (type === 1) put(circlePath(0, 0, r * .72), 'none' as unknown as number, x, y, r, 0, 1, stroked);
        else if (type === 2) put(`M${f(-r * 1.3)} 0Q${f(-r * .9)} ${f(-r)} ${f(-r * .45)} 0T${f(r * .45)} 0T${f(r * 1.3)} 0`, 'none' as unknown as number, x, y, r * 1.6, rotate, 1, stroked);
        else if (type === 3) put(`M${f(-r * 1.2)} ${f(r * .3)}L${f(-r * .6)} ${f(-r * .3)}L0 ${f(r * .3)}L${f(r * .6)} ${f(-r * .3)}L${f(r * 1.2)} ${f(r * .3)}`, 'none' as unknown as number, x, y, r * 1.5, rotate, 1, stroked);
        else if (type === 4) put(`M${f(-r)} 0A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0Z`, ink, x, y, r * 1.1, rotate);
        else { const parts: string[] = []; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) parts.push(circlePath(a * r * .62, b * r * .62, r * .15)); put(parts.join(''), ink, x, y, r * 1.1, rotate); }
      });
      break;
    }
    case 'bauhaus': {
      const cells = Math.round(n('cells')), w = size / cells, variety = p('variety');
      for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
        if (random() > p('fill')) continue;
        const px = x * w, py = y * w, type = Math.floor(random() * (2 + variety * 4.99)), turn = Math.floor(random() * 4) * 90, ink = 1 + Math.floor(random() * (colors.length - 1)), back = 1 + Math.floor(random() * (colors.length - 1));
        const t = `translate(${f(px + w / 2)} ${f(py + w / 2)}) rotate(${turn})`, h = f(w / 2), H = f(w);
        if (random() < .45 && back !== ink) out.push({ tag: 'rect', x: f(px), y: f(py), width: f(w + .3), height: f(w + .3), fill: back });
        const paths = [`M${-h} ${-h}H${h}A${H} ${H} 0 0 1 ${-h} ${h}Z`, circlePath(0, 0, w * .42), `M${-h} 0A${h} ${h} 0 0 1 ${h} 0Z`, `M${-h} ${-h}H${h}L${-h} ${h}Z`, `M${-h} ${-h}H${h}V${f(-w / 6)}H${-h}ZM${-h} ${f(w / 6)}H${h}V${h}H${-h}Z`, `M${-h} 0A${h} ${h} 0 0 1 0 ${-h}V0ZM0 ${h}A${h} ${h} 0 0 1 ${h} 0V${h}Z`];
        out.push(shape(paths[type], ink, { transform: t }));
      }
      break;
    }
    case 'terrazzo': {
      const count = Math.round(n('chips')), base = size / Math.sqrt(count) * (.14 + p('size') * .4);
      spread(count, size, random).forEach(([x, y]) => {
        const r = base * (1 - p('variation') * .55 + random() ** 2 * p('variation') * 1.5), sides = 4 + Math.floor(random() * 4), offset = random() * TAU, poly = Array.from({ length: sides }, (_, i) => { const a = offset + i / sides * TAU + (random() - .5) * .5, reach = r * (.55 + random() * .6); return `${i ? 'L' : 'M'}${f(Math.cos(a) * reach)} ${f(Math.sin(a) * reach * (.7 + random() * .3))}`; }).join('') + 'Z';
        put(poly, 1 + Math.floor(random() * (colors.length - 1)), x, y, r * 1.3);
      });
      break;
    }
    case 'flames': {
      // Classic hot-rod licks with a wavy tail, so rows never end on a straight line at the tile edge.
      const licks = Math.round(n('licks')), w = size / licks, height = size * p('height') * .82, curl = .3 + p('curl') * .7, base = size * .86, tongues = Array.from({ length: licks }, () => ({ h: .7 + random() * .3, reach: .82 + random() * .3, tail: .05 + random() * .07 }));
      const body = (scaleH: number, pinch: number, tailScale: number) => {
        let d = `M0 ${f(base)}`;
        tongues.forEach((tongue, i) => {
          const x = i * w, tall = height * tongue.h * scaleH, px = (a: number) => f(x + w * (pinch + a * (1 - pinch * 2))), py = (a: number) => f(base - tall * a), tip = .5 + curl * tongue.reach * .62;
          d += `L${px(0)} ${f(base)}C${px(.16)} ${py(.3)} ${px(.56)} ${py(.42)} ${px(.42)} ${py(.68)}`;
          d += `C${px(.36)} ${py(.84)} ${px(tip - .16)} ${py(.97)} ${px(tip + .3)} ${py(1)}`;
          d += `C${px(tip * .95)} ${py(.92)} ${px(.68)} ${py(.76)} ${px(.8)} ${py(.56)}`;
          d += `C${px(.9)} ${py(.4)} ${px(1)} ${py(.2)} ${px(1)} ${f(base)}`;
        });
        d += `L${f(size)} ${f(base)}`;
        for (let i = licks - 1; i >= 0; i--) d += `Q${f((i + .5) * w)} ${f(base + size * tongues[i].tail * 1.6 * tailScale)} ${f(i * w)} ${f(base)}`;
        return d + 'Z';
      };
      out.push(shape(body(1, 0, 1), 0), shape(body(.28 + p('inner') * .52, .13, .45), 1));
      break;
    }
    case 'cracked': {
      const count = Math.round(n('cells')), cell = size / Math.sqrt(count), sites = spread(count, size, random).map(([x, y]) => [mod(x + (random() - .5) * cell * p('irregularity'), size), mod(y + (random() - .5) * cell * p('irregularity'), size)] as [number, number]), parts = [`M0 0H${f(size)}V${f(size)}H0Z`];
      for (const poly of voronoi(sites, size, Math.max(size * .002, cell * (.012 + p('width') * .09)))) for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const moved = poly.map(q => [q[0] + ox * size, q[1] + oy * size] as [number, number]);
        if (moved.every(q => q[0] < 0) || moved.every(q => q[0] > size) || moved.every(q => q[1] < 0) || moved.every(q => q[1] > size)) continue;
        parts.push(`M${moved.map(q => `${f(q[0])} ${f(q[1])}`).join('L')}Z`);
      }
      out.push({ ...shape(parts.join(''), 0), fillRule: 'evenodd' } as unknown as PatternPrimitive);
      break;
    }
    case 'distressed': {
      const cells = Math.max(3, Math.round(16 - p('size') * 11)), rough = p('sharpness');
      out.push(shape(isoPath((u, v) => fbm(u, v, cells, 2, seed) * (1 - rough * .55) + periodic(u, v, cells * 7, seed + 5) * rough * .55, 150, size, .72 - p('amount') * .3), 0));
      break;
    }
    case 'noise': {
      const count = Math.round(180 + p('density') * 1300), base = size * (.0012 + p('size') * .006), parts: string[] = [];
      for (let i = 0; i < count; i++) { const r = base * (1 - p('variation') * .6 + random() ** 2.4 * p('variation') * 3); parts.push(circlePath(random() * size, random() * size, r)); }
      out.push(shape(parts.join(''), 0));
      break;
    }
    case 'grain': {
      const count = Math.round(160 + p('density') * 1100), length = size * (.006 + p('length') * .05), width = Math.max(size * .001, length * .1), angle = n('direction') * Math.PI / 180, parts: string[] = [];
      for (let i = 0; i < count; i++) {
        const a = angle + (random() - .5) * p('spread') * Math.PI, l = length * (.4 + random()), x = random() * size, y = random() * size, dx = Math.cos(a) * l / 2, dy = Math.sin(a) * l / 2, nx = -Math.sin(a) * width / 2, ny = Math.cos(a) * width / 2;
        parts.push(`M${f(x - dx)} ${f(y - dy)}L${f(x + nx)} ${f(y + ny)}L${f(x + dx)} ${f(y + dy)}L${f(x - nx)} ${f(y - ny)}Z`);
      }
      out.push(shape(parts.join(''), 0));
      break;
    }
  }
  const motif = { id: 0, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, radius: 0, primitives: out };
  return { tileWidth, tileHeight, colors, background: spec.background, motifs: [motif], replicas: [{ motif: 0, dx: 0, dy: 0 }] };
}
const fract = (v: number) => v - Math.floor(v);
