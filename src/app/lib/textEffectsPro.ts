import type { TextEffectControl, TextEffectId } from './textEffects';

/**
 * Print-quality effects (Artwork Phase 3). Each is seeded, keeps the artwork's own ink colour unless a colour
 * is a control, and exposes every value. Tone-driven looks read a directional ramp, so flat ink still gets shading.
 */
type RGB = [number, number, number];
type Geo = { inside: Float32Array; outside: Float32Array; nearest: Int32Array };
export type ProKit = {
  alpha: Float32Array;
  bounds: { left: number; top: number; width: number; height: number };
  geometry: (alpha: Float32Array, w: number, h: number) => Geo;
  blurField: (source: Float32Array, w: number, h: number, radius: number) => Float32Array;
  noise: (x: number, y: number, size: number, seed: number) => number;
  hash: (x: number, y: number, seed: number) => number;
};
export type ProValues = { n: (key: string) => number; p: (key: string) => number; col: (key: string) => RGB; text: (key: string) => string };

const range = (key: string, label: string, value: number, min = 0, max = 100, step = 1): TextEffectControl => ({ key, label, type: 'range', min, max, step, default: value });
const color = (key: string, label: string, value: string): TextEffectControl => ({ key, label, type: 'color', default: value });
const select = (key: string, label: string, value: string, options: [string, string][]): TextEffectControl => ({ key, label, type: 'select', default: value, options: options.map(([v, l]) => ({ value: v, label: l })) });
const toneControls = (coverage = 64, fade = 36) => [range('coverage', 'Coverage', coverage), range('fade', 'Fade', fade), range('fadeDirection', 'Fade direction', 90, 0, 360)];

const CONTROLS: Partial<Record<TextEffectId, TextEffectControl[]>> = {
  halftone: [select('shape', 'Dot shape', 'dot', [['dot', 'Dot'], ['line', 'Line'], ['cross', 'Cross'], ['diamond', 'Diamond']]), range('spacing', 'Spacing', 6, 2, 24, .5), range('angle', 'Screen angle', 45, 0, 180), ...toneControls()],
  chrome: [range('depth', 'Bevel depth', 6, 1, 20, .5), range('reflection', 'Reflection', 75), range('contrast', 'Contrast', 75), range('highlight', 'Highlight', 80), range('metallic', 'Metallic', 100), range('direction', 'Direction', 90, 0, 360)],
  foil: [select('tone', 'Foil', 'gold', [['gold', 'Gold'], ['silver', 'Silver'], ['rose', 'Rose'], ['copper', 'Copper'], ['holo', 'Holographic']]), range('depth', 'Bevel depth', 3, .5, 16, .5), range('reflection', 'Reflection', 60), range('texture', 'Texture', 25), range('highlight', 'Highlight', 70), range('roughness', 'Creases', 30), range('direction', 'Direction', 70, 0, 360)],
  embroidery: [range('stitchSize', 'Stitch length', 8, 2, 24), range('thickness', 'Thread width', 1.3, .4, 4, .1), range('density', 'Density', 85), range('direction', 'Thread direction', 35, 0, 360), range('border', 'Satin border', 3, 0, 12, .5), range('detail', 'Sheen', 70)],
  photocopy: [range('contrast', 'Toner', 65), range('roughness', 'Roughness', 45), range('noise', 'Speckle', 40), range('threshold', 'Wear', 62, 0, 95), range('streaks', 'Streaks', 30)],
  'ink-bleed': [range('amount', 'Spread', 45), range('irregularity', 'Irregularity', 65), range('softness', 'Feather', 3, 0, 12), range('pooling', 'Ink pooling', 40)],
  'screen-print': [range('inkAmount', 'Ink', 96), range('imperfection', 'Pinholes', 60), range('roughness', 'Dry patches', 50), range('edgeWear', 'Edge wear', 30), range('mesh', 'Mesh size', 2, 1, 6, .5)],
  duotone: [color('color1', 'Shadow colour', '#35225b'), color('color2', 'Highlight colour', '#ffca76'), range('balance', 'Balance', 50), range('ramp', 'Ramp', 80), range('direction', 'Direction', 90, 0, 360)],
  riso: [color('color', 'Second ink', '#2f6fed'), range('offsetX', 'Offset X', 3, -24, 24, .5), range('offsetY', 'Offset Y', 2, -24, 24, .5), range('grain', 'Grain', 24), range('size', 'Grain size', 1, .5, 5, .5), range('coverage', 'Ink coverage', 90)],
  stipple: [range('size', 'Dot size', 1.2, .4, 6, .1), range('spacing', 'Spacing', 2.5, 1.5, 14, .5), ...toneControls(70, 30)],
  engraving: [range('spacing', 'Line spacing', 4, 1.5, 16, .5), range('angle', 'Line angle', 25, 0, 180), range('wobble', 'Hand wobble', 20), range('follow', 'Follow form', 30), ...toneControls(66, 32)],
  stamp: [range('amount', 'Wear', 42), range('size', 'Texture size', 5, 1, 24, .5), range('edge', 'Inked rim', 60), range('pressure', 'Uneven pressure', 45)],
  dither: [select('matrix', 'Pattern', '4', [['2', 'Coarse'], ['4', 'Classic'], ['8', 'Fine']]), range('size', 'Pixel size', 2, 1, 10, .5), ...toneControls(62, 36)],
  inline: [range('inset', 'Inset', 4, .5, 24, .5), range('width', 'Line width', 1.5, .3, 10, .1), range('gap', 'Line gap', 2.5, .5, 12, .5), range('count', 'Lines', 1, 1, 5), select('mode', 'Line', 'cut', [['cut', 'Cut out'], ['colour', 'Colour']]), color('color', 'Line colour', '#ffffff')],
  contour: [color('color', 'Line colour', '#d9412f'), range('count', 'Lines', 3, 1, 8), range('distance', 'Distance', 5, 1.5, 14, .5), range('width', 'Line width', 1.2, .3, 6, .1), range('fade', 'Fade out', 50)],
  sticker: [color('color', 'Border colour', '#ffffff'), range('size', 'Border', 7, 1, 24, .5), range('shadow', 'Shadow', 35), range('softness', 'Shadow softness', 4, 0, 16, .5), range('offsetY', 'Shadow drop', 3, 0, 16, .5)],
  rhinestone: [range('size', 'Stone size', 2, 1, 10, .25), range('spacing', 'Spacing', 4.5, 2.5, 20, .5), range('sparkle', 'Sparkle', 70), range('facets', 'Facets', 8, 4, 12), range('tint', 'Crystal tint', 35)],
  glitter: [range('size', 'Flake size', 1.2, .5, 6, .1), range('sparkle', 'Sparkle', 70), range('contrast', 'Depth', 60), range('flare', 'Flares', 25), range('direction', 'Light', 45, 0, 360)],
};

export const NEW_PRO_EFFECTS: { id: TextEffectId; label: string }[] = [
  { id: 'riso', label: 'Riso' }, { id: 'stipple', label: 'Stipple' }, { id: 'engraving', label: 'Engraving' }, { id: 'stamp', label: 'Rubber Stamp' }, { id: 'dither', label: 'Dither' },
  { id: 'inline', label: 'Inline' }, { id: 'contour', label: 'Contour Lines' }, { id: 'sticker', label: 'Sticker' }, { id: 'rhinestone', label: 'Rhinestone' }, { id: 'glitter', label: 'Glitter' },
];
export const proEffectControls = (type: TextEffectId) => CONTROLS[type];
export const isProEffect = (type: TextEffectId) => Boolean(CONTROLS[type]);

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const fract = (v: number) => v - Math.floor(v);
const rad = (v: number) => v * Math.PI / 180;
const hex = (value: string): RGB => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
function ramp(stops: [number, RGB][], t: number): RGB {
  t = clamp(t);
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], f = smooth((t - a) / Math.max(1e-5, b - a));
    return [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f];
  }
  return stops[stops.length - 1][1];
}
const CHROME: [number, RGB][] = [[0, hex('#f8fbff')], [.3, hex('#b9cde4')], [.47, hex('#5d7696')], [.5, hex('#10141c')], [.53, hex('#f4ecdf')], [.72, hex('#9a8878')], [.88, hex('#4b4440')], [1, hex('#f2f2f2')]];
const metal = (values: string[]): [number, RGB][] => values.map((value, i) => [i / (values.length - 1), hex(value)]);
const FOILS: Record<string, [number, RGB][]> = {
  gold: metal(['#5e3c10', '#b5822c', '#f4d477', '#fff7d6', '#d6a548']), silver: metal(['#4a4f58', '#9aa1ac', '#dfe3e8', '#ffffff', '#aeb4bd']),
  rose: metal(['#6b3238', '#c07f7c', '#f3c8bd', '#fff0ea', '#d39a92']), copper: metal(['#4f2412', '#a85a2c', '#ea9e62', '#ffe2c4', '#bd7040']),
};
function hue(h: number): RGB {
  const f = (k: number) => { const m = (k + h * 6) % 6; return 255 * (.86 - .34 * Math.max(0, Math.min(m, 4 - m, 1))); };
  return [f(5), f(3), f(1)];
}
const BAYER: Record<string, number[]> = { '2': [0, 2, 3, 1], '4': [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], '8': [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21] };

const mixTo = (out: Uint8ClampedArray, i: number, rgb: RGB, t: number) => { t = clamp(t); for (let c = 0; c < 3; c++) out[i + c] += (rgb[c] - out[i + c]) * t; };
const shade = (out: Uint8ClampedArray, i: number, light: number) => mixTo(out, i, light > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(light));
function behind(out: Uint8ClampedArray, i: number, rgb: RGB, alpha: number) {
  const front = out[i + 3] / 255, back = clamp(alpha) * (1 - front), total = front + back;
  if (total <= 0) return;
  for (let c = 0; c < 3; c++) out[i + c] = (out[i + c] * front + rgb[c] * back) / total;
  out[i + 3] = total * 255;
}
const at = (field: Float32Array, w: number, h: number, x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, g = (a: number, b: number) => a < 0 || b < 0 || a >= w || b >= h ? 0 : field[b * w + a];
  return g(ix, iy) * (1 - fx) * (1 - fy) + g(ix + 1, iy) * fx * (1 - fy) + g(ix, iy + 1) * (1 - fx) * fy + g(ix + 1, iy + 1) * fx * fy;
};
/** A smooth dome from the distance field; blurring removes the chamfer facets. */
function reliefField(kit: ProKit, geo: Geo, w: number, h: number, depth: number, scale: number) {
  const field = new Float32Array(w * h), reach = Math.max(.5, depth * scale);
  for (let i = 0; i < field.length; i++) field[i] = 1 - Math.exp(-geo.inside[i] / reach);
  return kit.blurField(kit.blurField(field, w, h, Math.max(1, Math.round(scale * .75))), w, h, Math.max(1, Math.round(scale * .5)));
}

export function applyProEffect(type: TextEffectId, data: Uint8ClampedArray, w: number, h: number, scale: number, seed: number, { n, p, col, text }: ProValues, kit: ProKit): Uint8ClampedArray {
  const { alpha, bounds, noise, hash } = kit, out = data.slice();
  const usesGeometry = ['chrome', 'foil', 'embroidery', 'ink-bleed', 'screen-print', 'stamp', 'inline', 'contour', 'sticker', 'engraving', 'photocopy'].includes(type);
  const geo = usesGeometry ? kit.geometry(alpha, w, h) : undefined;
  const relief = (type === 'chrome' || type === 'foil') && geo ? reliefField(kit, geo, w, h, n('depth'), scale) : undefined;
  const toneAngle = rad(['halftone', 'stipple', 'engraving', 'dither'].includes(type) ? n('fadeDirection') : type === 'duotone' || type === 'chrome' || type === 'foil' || type === 'glitter' ? n('direction') : 90);
  const toneX = Math.cos(toneAngle), toneY = Math.sin(toneAngle), toneNorm = Math.max(.001, Math.abs(toneX) + Math.abs(toneY));
  const position = (x: number, y: number) => .5 + (((x - bounds.left + .5) / bounds.width - .5) * toneX + ((y - bounds.top + .5) / bounds.height - .5) * toneY) / toneNorm;
  const tone = (x: number, y: number) => clamp(p('coverage') + (position(x, y) - .5) * p('fade') * 2);

  let shadowField: Float32Array | undefined;
  if (type === 'sticker' && geo) {
    const mask = new Float32Array(w * h), size = n('size') * scale;
    for (let i = 0; i < mask.length; i++) mask[i] = clamp(size + .5 - geo.outside[i]);
    shadowField = kit.blurField(mask, w, h, n('softness') * scale);
  }
  const angle = rad(type === 'halftone' || type === 'engraving' ? n('angle') : type === 'embroidery' ? n('direction') : 0), cs = Math.cos(angle), sn = Math.sin(angle);
  const matrix = type === 'dither' ? BAYER[text('matrix')] ?? BAYER['4'] : [], order = Math.round(Math.sqrt(matrix.length));
  const foil = type === 'foil' ? FOILS[text('tone')] : undefined;
  const satinAngle = angle + rad(72), satinX = Math.cos(satinAngle), satinY = Math.sin(satinAngle);

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = y * w + x, i = j * 4, a = alpha[j], xx = x / scale, yy = y / scale;
    const inside = geo ? geo.inside[j] / scale : 0, outside = geo ? geo.outside[j] / scale : 0;
    switch (type) {
      case 'halftone': {
        if (!a) break;
        const spacing = n('spacing'), tx = (xx * cs + yy * sn) / spacing, ty = (-xx * sn + yy * cs) / spacing, fx = Math.abs(fract(tx) - .5), fy = Math.abs(fract(ty) - .5), ink = tone(x, y), shape = text('shape');
        const [value, reach] = shape === 'line' ? [fy * 2, ink] : shape === 'cross' ? [Math.min(fx, fy) * 2, 1 - Math.sqrt(1 - ink)] : shape === 'diamond' ? [fx + fy, Math.sqrt(ink)] : [Math.hypot(fx, fy) / Math.SQRT1_2, Math.sqrt(ink)];
        out[i + 3] *= ink >= 1 ? 1 : ink <= 0 ? 0 : clamp((reach - value) * spacing * scale * .7 + .5);
        break;
      }
      case 'chrome': {
        if (!a || !relief) break;
        const nx = (at(relief, w, h, x - 1, y) - at(relief, w, h, x + 1, y)) * n('depth') * scale * .5, ny = (at(relief, w, h, x, y - 1) - at(relief, w, h, x, y + 1)) * n('depth') * scale * .5, norm = Math.hypot(nx, ny, 1);
        const reflected = .5 + (position(x, y) - .5) * .92 + (nx * toneX + ny * toneY) / norm * p('reflection') * .6, base = ramp(CHROME, reflected), grey = (base[0] + base[1] + base[2]) / 3, k = .35 + p('contrast') * .65;
        const toned: RGB = [grey + (base[0] - grey) + (base[0] - 128) * (k - .7), grey + (base[1] - grey) + (base[1] - 128) * (k - .7), grey + (base[2] - grey) + (base[2] - 128) * (k - .7)];
        mixTo(out, i, toned, p('metallic'));
        shade(out, i, Math.max(0, (-nx * .6 - ny * .8 + .55) / norm) ** 14 * p('highlight'));
        break;
      }
      case 'foil': {
        if (!a || !relief) break;
        const nx = (at(relief, w, h, x - 1, y) - at(relief, w, h, x + 1, y)) * n('depth') * scale * .5, ny = (at(relief, w, h, x, y - 1) - at(relief, w, h, x, y + 1)) * n('depth') * scale * .5, norm = Math.hypot(nx, ny, 1);
        const crease = noise(xx, yy, 34, seed) * .7 + noise(xx, yy, 11, seed + 3) * .3, phase = position(x, y) * 1.5 + (nx * toneX + ny * toneY) / norm * p('reflection') * .7 + (crease - .5) * p('roughness') * 1.6, wave = Math.abs(fract(phase) * 2 - 1);
        const rgb = foil ? ramp(foil, wave) : hue(fract(phase * .9 + crease * .25));
        out[i] = rgb[0]; out[i + 1] = rgb[1]; out[i + 2] = rgb[2];
        shade(out, i, (hash(Math.floor(xx * 2), Math.floor(yy * 2), seed + 1) - .5) * p('texture') * .22);
        shade(out, i, Math.max(0, (-nx * .6 - ny * .8 + .5) / norm) ** 10 * p('highlight') * .8);
        break;
      }
      case 'embroidery': {
        if (!a) break;
        const border = n('border'), satin = border > 0 && inside < border, tx = satin ? satinX : cs, ty = satin ? satinY : sn, spacing = n('thickness') * (1.55 - p('density') * .55);
        const across = (-xx * ty + yy * tx) / spacing, row = Math.floor(across), crest = Math.sin(Math.PI * fract(across)) ** .7;
        let notch = 1;
        if (!satin) { const along = fract((xx * tx + yy * ty) / n('stitchSize') + row * .37); notch = clamp(Math.min(along, 1 - along) * n('stitchSize') / .7); }
        const sheen = Math.sin(((xx * tx + yy * ty) / 14 + (hash(row, 3, seed) - .5) * 1.4) * Math.PI) * p('detail') * .12, light = (crest * notch) * .52 - .3 + sheen + (hash(row, 7, seed) - .5) * .07;
        shade(out, i, light);
        if (border > 0 && Math.abs(inside - border) < .4) shade(out, i, -.28);
        if (inside < .7) shade(out, i, -.18);
        break;
      }
      case 'photocopy': {
        if (!a) break;
        const cloud = noise(xx, yy, 16, seed) * .6 + noise(xx, yy, 4, seed + 2) * .4, fine = hash(Math.floor(xx * 1.5), Math.floor(yy * 1.5), seed + 9), streak = noise(0, yy, 2.4, seed + 5), edge = Math.exp(-inside / 1.6) * p('roughness') * .35;
        const wear = cloud * .55 + fine * p('noise') * .6 + edge + (streak > .74 ? (streak - .74) * 2.6 * p('streaks') : 0);
        out[i + 3] *= 1 - smooth((wear - (1.02 - p('threshold') * .62)) * 9);
        shade(out, i, -p('contrast') * .22);
        break;
      }
      case 'ink-bleed': {
        if (!geo) break;
        const wobble = noise(xx, yy, 7, seed) * .6 + noise(xx, yy, 2.2, seed + 4) * .4, spread = p('amount') * 5 * (1 - p('irregularity') * .75 + wobble * p('irregularity') * 1.5), k = geo.nearest[j] * 4;
        if (!a && geo.nearest[j] >= 0 && outside < 20) {
          const rgb: RGB = [data[k], data[k + 1], data[k + 2]], core = clamp(spread + .5 - outside) , feather = n('softness') > 0 ? Math.exp(-Math.max(0, outside - spread) / (n('softness') * .55)) * .22 * p('amount') * 1.5 : 0;
          behind(out, i, rgb, Math.max(core, feather));
        } else if (a) shade(out, i, -Math.exp(-inside / 2) * p('pooling') * .3);
        break;
      }
      case 'screen-print': {
        if (!a) break;
        const mesh = n('mesh'), cx = Math.abs(fract(xx / mesh) - .5), cy = Math.abs(fract(yy / mesh) - .5), weave = 1 - clamp(Math.hypot(cx, cy) * 2.4), dry = noise(xx, yy, 22, seed) * .7 + noise(xx, yy, 6, seed + 2) * .3;
        const starved = smooth((dry - (.9 - p('roughness') * .42)) * 7), pin = hash(Math.floor(xx / mesh), Math.floor(yy / mesh), seed + 3) < p('imperfection') * .11 ? weave : 0, edge = Math.exp(-inside / 1.1) * p('edgeWear') * smooth((noise(xx, yy, 2, seed + 6) - .45) * 5);
        out[i + 3] *= p('inkAmount') * (1 - clamp(pin * 1.4)) * (1 - starved * (.35 + weave * .65)) * (1 - edge);
        break;
      }
      case 'duotone': {
        if (!a) break;
        const lum = (data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722) / 255, t = clamp(lum * (1 - p('ramp')) + (1 - position(x, y)) * p('ramp') + (p('balance') - .5) * 1.2), low = col('color1'), high = col('color2');
        for (let c = 0; c < 3; c++) out[i + c] = low[c] + (high[c] - low[c]) * t;
        break;
      }
      case 'riso': {
        const dx = n('offsetX') * scale, dy = n('offsetY') * scale, second = at(alpha, w, h, x - dx, y - dy);
        if (!a && !second) break;
        const size = n('size'), g1 = hash(Math.floor(xx / size), Math.floor(yy / size), seed), g2 = hash(Math.floor(xx / size), Math.floor(yy / size), seed + 11), low = noise(xx, yy, 18, seed + 2) * .35;
        const a1 = a * p('coverage') * (g1 < p('grain') * (.55 + low) ? .25 : 1), a2 = second * p('coverage') * (g2 < p('grain') * (.55 + low) ? .25 : 1), ink = col('color'), total = 1 - (1 - a1) * (1 - a2);
        if (total <= 0) { out[i + 3] = 0; break; }
        for (let c = 0; c < 3; c++) out[i + c] = (data[i + c] * a1 * (1 - a2) + ink[c] * a2 * (1 - a1) + data[i + c] * ink[c] / 255 * a1 * a2) / total;
        out[i + 3] = total * 255;
        break;
      }
      case 'stipple': {
        if (!a) break;
        const cell = n('spacing'), gx = Math.floor(xx / cell), gy = Math.floor(yy / cell);
        let cover = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const cx = gx + ox, cy = gy + oy, px = (cx + hash(cx, cy, seed)) * cell, py = (cy + hash(cx, cy, seed + 13)) * cell;
          if (hash(cx, cy, seed + 29) > tone(px * scale, py * scale)) continue;
          const radius = n('size') * (.7 + hash(cx, cy, seed + 31) * .6);
          cover = Math.max(cover, clamp((radius - Math.hypot(xx - px, yy - py)) * scale + .5));
        }
        out[i + 3] *= cover;
        break;
      }
      case 'engraving': {
        if (!a) break;
        const spacing = n('spacing'), wobble = (noise(xx, yy, 26, seed) - .5) * p('wobble') * spacing * 2.4, bend = Math.min(inside, 18) * p('follow') * .9, across = (-xx * sn + yy * cs + wobble + bend) / spacing, value = Math.abs(fract(across) - .5) * 2, ink = tone(x, y);
        out[i + 3] *= ink >= 1 ? 1 : ink <= 0 ? 0 : clamp((ink - value) * spacing * scale * .5 + .5);
        break;
      }
      case 'stamp': {
        if (!a) break;
        const size = n('size'), texture = noise(xx, yy, size, seed) * .55 + noise(xx, yy, size / 3, seed + 3) * .3 + hash(Math.floor(xx), Math.floor(yy), seed + 7) * .15, press = noise(xx, yy, 60, seed + 9), rim = Math.exp(-inside / 1.8) * p('edge');
        const threshold = .78 - p('amount') * .42 + (press - .5) * p('pressure') * .45 + rim * .55;
        out[i + 3] *= smooth((threshold - texture) * 12 + .5);
        shade(out, i, -rim * .12);
        break;
      }
      case 'dither': {
        if (!a) break;
        const size = n('size'), mx = Math.floor((x - bounds.left) / scale / size) % order, my = Math.floor((y - bounds.top) / scale / size) % order, cx = bounds.left + (Math.floor((x - bounds.left) / scale / size) + .5) * size * scale, cy = bounds.top + (Math.floor((y - bounds.top) / scale / size) + .5) * size * scale;
        out[i + 3] *= tone(cx, cy) > (matrix[my * order + mx] + .5) / matrix.length ? 1 : 0;
        break;
      }
      case 'inline': {
        if (!a) break;
        let line = 0;
        for (let k = 0; k < n('count'); k++) line = Math.max(line, clamp((n('width') / 2 - Math.abs(inside - (n('inset') + k * (n('width') + n('gap'))))) * scale + .5));
        if (text('mode') === 'colour') mixTo(out, i, col('color'), line); else out[i + 3] *= 1 - line;
        break;
      }
      case 'contour': {
        if (a >= 1 || outside <= 0) break;
        let ring = 0, count = Math.round(n('count'));
        for (let k = 1; k <= count; k++) { const reach = k * n('distance'); if (reach > 58) break; ring = Math.max(ring, clamp((n('width') / 2 - Math.abs(outside - reach)) * scale + .5) * (1 - p('fade') * (k - 1) / Math.max(1, count - 1 || 1))); }
        behind(out, i, col('color'), ring);
        break;
      }
      case 'sticker': {
        if (!shadowField) break;
        behind(out, i, col('color'), clamp(n('size') + .5 / scale - outside) * (a ? 1 : 1));
        if (n('shadow') > 0) behind(out, i, [18, 18, 22], at(shadowField, w, h, x, y - n('offsetY') * scale) * p('shadow'));
        break;
      }
      case 'rhinestone': {
        const spacing = n('spacing'), rowH = spacing * .866, row = Math.round(yy / rowH), column = Math.round(xx / spacing - (row & 1) * .5), cx = (column + (row & 1) * .5) * spacing, cy = row * rowH, inStone = at(alpha, w, h, cx * scale, cy * scale) > .45, dist = Math.hypot(xx - cx, yy - cy), radius = n('size');
        if (!inStone || dist > radius + 1 / scale) { out[i + 3] = 0; break; }
        const sparkle = hash(column, row, seed), theta = Math.atan2(yy - cy, xx - cx), facet = Math.floor((theta + Math.PI) / (Math.PI * 2) * n('facets')), facetLight = hash(facet, column + row * 31, seed + 5), crown = dist < radius * .48, tintRgb: RGB = [data[i] || 230, data[i + 1] || 230, data[i + 2] || 240], base = (crown ? .82 : .35 + facetLight * .6) * (.75 + sparkle * .35);
        out[i] = 255 * base + (tintRgb[0] - 255 * base) * p('tint'); out[i + 1] = 255 * base + (tintRgb[1] - 255 * base) * p('tint'); out[i + 2] = 255 * base + (tintRgb[2] - 255 * base) * p('tint');
        if (sparkle > 1 - p('sparkle') * .22) shade(out, i, Math.max(0, 1 - Math.min(Math.abs(xx - cx), Math.abs(yy - cy)) * 2.4) * Math.max(0, 1 - dist / radius));
        out[i + 3] = 255 * clamp((radius - dist) * scale + .5) * (a > 0 ? 1 : at(alpha, w, h, cx * scale, cy * scale));
        break;
      }
      case 'glitter': {
        if (!a) break;
        const size = n('size'), gx = Math.floor(xx / size), gy = Math.floor(yy / size), facet = hash(gx, gy, seed) * Math.PI * 2, light = Math.max(0, Math.cos(facet - rad(n('direction')))), flake = light ** (2 + p('sparkle') * 10), value = flake * (.4 + p('sparkle') * .9) - (1 - light) * p('contrast') * .42;
        shade(out, i, clamp(value, -1, 1));
        if (hash(gx, gy, seed + 17) < p('flare') * .018) shade(out, i, .95);
        break;
      }
    }
  }
  return out;
}
