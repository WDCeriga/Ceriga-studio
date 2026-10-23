export type TextEffectId =
  | 'distressed' | 'grunge' | 'cracked' | 'faded' | 'vintage-print' | 'grain'
  | 'halftone' | 'noise' | 'photocopy' | 'screen-print' | 'spray-paint' | 'ink-bleed'
  | 'embroidery' | 'puff-print' | 'chrome' | 'metallic' | 'foil' | 'gloss'
  | 'extrude' | 'bevel' | 'inner-shadow' | 'glow' | 'neon' | 'long-shadow'
  | 'offset-print' | 'rgb-split' | 'glitch' | 'pixelated' | 'blur' | 'motion-blur'
  | 'gradient' | 'duotone' | 'texture-fill' | 'image-fill'
  | 'rough-edges' | 'shadow' | 'inner-glow';

export interface TextEffect {
  id: string;
  type: TextEffectId;
  enabled: boolean;
  intensity: number;
  seed: number;
  settings: Record<string, number | string>;
  stops?: Array<{ color: string; position: number }>;
  source?: string;
}
export type TextEffectControl =
  | { key: string; label: string; type: 'range'; min: number; max: number; step: number; default: number }
  | { key: string; label: string; type: 'color'; default: string }
  | { key: string; label: string; type: 'select'; options: Array<{ value: string; label: string }>; default: string };
export interface TextEffectAsset { data: Uint8ClampedArray; width: number; height: number }
export const TEXT_EFFECT_PADDING = 64;
export const TEXT_EFFECTS: Array<{ id: TextEffectId; label: string }> = [
  { id: 'distressed', label: 'Distressed' }, { id: 'grunge', label: 'Grunge' },
  { id: 'cracked', label: 'Cracked' }, { id: 'faded', label: 'Faded' },
  { id: 'vintage-print', label: 'Vintage Print' }, { id: 'grain', label: 'Grain' },
  { id: 'halftone', label: 'Halftone' }, { id: 'noise', label: 'Noise' },
  { id: 'photocopy', label: 'Photocopy' }, { id: 'screen-print', label: 'Screen Print' },
  { id: 'spray-paint', label: 'Spray Paint' }, { id: 'ink-bleed', label: 'Ink Bleed' },
  { id: 'embroidery', label: 'Embroidery' }, { id: 'puff-print', label: 'Puff Print' },
  { id: 'chrome', label: 'Chrome' }, { id: 'metallic', label: 'Metallic' },
  { id: 'foil', label: 'Foil' }, { id: 'gloss', label: 'Gloss' },
  { id: 'extrude', label: '3D / Extrude' }, { id: 'bevel', label: 'Bevel' },
  { id: 'inner-shadow', label: 'Inner Shadow' }, { id: 'glow', label: 'Glow' },
  { id: 'neon', label: 'Neon' }, { id: 'long-shadow', label: 'Long Shadow' },
  { id: 'offset-print', label: 'Offset Print' }, { id: 'rgb-split', label: 'RGB Split' },
  { id: 'glitch', label: 'Glitch' }, { id: 'pixelated', label: 'Pixelated' },
  { id: 'blur', label: 'Blur' }, { id: 'motion-blur', label: 'Motion Blur' },
  { id: 'gradient', label: 'Gradient' }, { id: 'duotone', label: 'Duotone' },
  { id: 'texture-fill', label: 'Texture Fill' }, { id: 'image-fill', label: 'Image Fill' },
];
export const SHAPE_EFFECTS: Array<{ id: TextEffectId; label: string }> = [
  'distressed', 'grunge', 'rough-edges', 'grain', 'noise', 'halftone', 'screen-print', 'spray-paint',
  'photocopy', 'cracked', 'blur', 'shadow', 'inner-shadow', 'glow', 'inner-glow', 'long-shadow',
  'extrude', 'bevel', 'chrome', 'metallic', 'texture-fill', 'image-fill', 'offset-print', 'rgb-split', 'glitch', 'gradient',
].map(id => ({ id: id as TextEffectId, label: TEXT_EFFECTS.find(item => item.id === id)?.label
  ?? ({ 'rough-edges': 'Rough Edges', shadow: 'Shadow', 'inner-glow': 'Inner Glow' } as Record<string, string>)[id] }));

const range = (key: string, label: string, value: number, min = 0, max = 100, step = 1): TextEffectControl =>
  ({ key, label, type: 'range', min, max, step, default: value });
const color = (key: string, label: string, value: string): TextEffectControl => ({ key, label, type: 'color', default: value });
const direction = () => range('direction', 'Direction', 45, 0, 360);
const amount = (value = 55) => range('amount', 'Amount', value);
const density = () => range('density', 'Density', 65);
const roughness = () => range('roughness', 'Roughness', 45);
const opacity = () => range('opacity', 'Opacity', 85);
const assetControls = (defaultScale = 100): TextEffectControl[] => [
  range('scale', 'Scale', defaultScale, 10, 400), range('offsetX', 'Offset X', 0, -100, 100),
  range('offsetY', 'Offset Y', 0, -100, 100), range('rotation', 'Rotation', 0, -180, 180), opacity(),
];
/** Spatial controls use CSS pixels; fill offsets and crop rectangles use percentages of glyph/source bounds. */
export function textEffectControls(type: TextEffectId): TextEffectControl[] {
  const labels: Partial<Record<TextEffectId, Record<string, string>>> = {
    distressed: { size: 'Distress Size' }, grunge: { scale: 'Texture Scale' },
    cracked: { amount: 'Crack Amount', thickness: 'Crack Thickness' }, faded: { amount: 'Fade Amount' },
    grain: { size: 'Grain Size' }, 'screen-print': { imperfection: 'Print Imperfection' },
    'spray-paint': { amount: 'Spray Amount' }, 'ink-bleed': { amount: 'Bleed Amount' },
    embroidery: { density: 'Stitch Density', direction: 'Thread Direction', detail: 'Thread Detail' },
    'puff-print': { amount: 'Puff Amount', softness: 'Edge Softness' },
    chrome: { metallic: 'Metallic Amount', direction: 'Light Direction' },
    metallic: { metallic: 'Metallic Amount', direction: 'Light Direction' },
    gloss: { amount: 'Gloss Amount', size: 'Highlight Size', position: 'Highlight Position' },
    extrude: { color: 'Extrusion Colour', direction: 'Direction / Angle' }, bevel: { direction: 'Light Direction' },
    glow: { amount: 'Glow Intensity' }, neon: { amount: 'Glow Amount', size: 'Glow Size' },
    glitch: { displacement: 'Horizontal Displacement' }, blur: { amount: 'Blur Amount' },
  };
  return effectControls(type).map(control => ({ ...control, label: labels[type]?.[control.key] ?? control.label }));
}

export function shapeEffectControls(type: TextEffectId): TextEffectControl[] {
  const controls = textEffectControls(type);
  if (type === 'spray-paint') return [...controls, range('density', 'Spray Density', 100)];
  if (type === 'glitch') return [...controls.map(control => control.key === 'displacement' ? { ...control, label: 'Displacement' } : control), range('direction', 'Direction', 0, 0, 360)];
  if (type === 'gradient') return [...controls, range('positionX', 'Position X', 50), range('positionY', 'Position Y', 50)];
  if (type === 'texture-fill') return [...controls, ...textEffectControls('image-fill').filter(control => control.key.startsWith('crop'))];
  return controls;
}

export function createShapeEffect(type: TextEffectId): TextEffect {
  return { ...createTextEffect(type), settings: Object.fromEntries(shapeEffectControls(type).map(control => [control.key, control.default])) };
}

function effectControls(type: TextEffectId): TextEffectControl[] {
  switch (type) {
    case 'rough-edges': return [amount(80), range('size', 'Edge Depth', 6, 0, 24), roughness(), range('frequency', 'Frequency', 20, 1, 100)];
    case 'shadow': return [color('color', 'Shadow Colour', '#202030'), range('offsetX', 'Offset X', 10, -32, 32), range('offsetY', 'Offset Y', 10, -32, 32), range('softness', 'Softness', 8, 0, 24), opacity()];
    case 'inner-glow': return [color('color', 'Glow Colour', '#ffdb91'), range('size', 'Size', 12, 0, 32), amount(80), range('softness', 'Softness', 60)];
    case 'distressed': return [amount(), range('size', 'Size', 4, 1, 24), roughness(), density()];
    case 'grunge': return [amount(65), range('scale', 'Scale', 14, 2, 48), roughness(), density()];
    case 'cracked': return [amount(85), range('size', 'Crack Size', 20, 4, 60), range('thickness', 'Thickness', 1.2, 0.2, 5, 0.1)];
    case 'faded': return [amount(), range('variation', 'Variation', 65), opacity()];
    case 'vintage-print': return [range('age', 'Age', 60), range('grain', 'Grain', 35), range('edgeWear', 'Edge Wear', 45), range('fade', 'Fade', 30)];
    case 'grain': return [amount(), range('size', 'Size', 1.5, 0.5, 12, 0.5), density(), opacity()];
    case 'halftone': return [range('dotSize', 'Dot Size', 3, 0.5, 12, 0.5), range('spacing', 'Spacing', 7, 2, 24), range('angle', 'Angle', 30, 0, 180), density()];
    case 'noise': return [amount(), range('scale', 'Scale', 2, 0.5, 16, 0.5), density()];
    case 'photocopy': return [range('contrast', 'Contrast', 65), roughness(), range('noise', 'Noise', 40), range('threshold', 'Threshold', 50, 5, 95)];
    case 'screen-print': return [range('inkAmount', 'Ink Amount', 85), roughness(), range('imperfection', 'Imperfection', 45), range('edgeWear', 'Edge Wear', 35)];
    case 'spray-paint': return [amount(70), range('scatter', 'Scatter', 14, 0, 32), range('particleSize', 'Particle Size', 1.5, 0.5, 6, 0.5), range('edgeRoughness', 'Edge Roughness', 60)];
    case 'ink-bleed': return [amount(65), range('softness', 'Softness', 3, 0, 12), range('irregularity', 'Irregularity', 65)];
    case 'embroidery': return [range('stitchSize', 'Stitch Size', 7, 2, 24), density(), range('thickness', 'Thread Thickness', 1.2, 0.3, 4, 0.1), direction(), range('detail', 'Detail', 75)];
    case 'puff-print': return [amount(80), range('depth', 'Depth', 6, 1, 24), range('softness', 'Softness', 55), range('highlight', 'Highlight', 65), range('shadow', 'Shadow', 60)];
    case 'chrome': return [range('reflection', 'Reflection', 80), range('contrast', 'Contrast', 70), range('highlight', 'Highlight', 80), range('metallic', 'Metallic', 90), direction()];
    case 'metallic': return [range('metallic', 'Metallic', 75), range('highlight', 'Highlight', 70), range('contrast', 'Contrast', 60), direction()];
    case 'foil': return [range('reflection', 'Reflection', 75), range('texture', 'Texture', 55), range('highlight', 'Highlight', 75), roughness()];
    case 'gloss': return [amount(75), range('size', 'Size', 30, 1, 100), range('position', 'Position', 35), range('softness', 'Softness', 55)];
    case 'extrude': return [range('depth', 'Depth', 18, 0, 48), direction(), color('color', 'Side Colour', '#432b70'), range('perspective', 'Perspective', 20, 0, 80)];
    case 'bevel': return [amount(80), range('depth', 'Depth', 4, 0.5, 20, 0.5), range('softness', 'Softness', 40), direction(), { key: 'mode', label: 'Edge Style', type: 'select', options: [{ value: 'raised', label: 'Raised' }, { value: 'recessed', label: 'Recessed' }], default: 'raised' }];
    case 'inner-shadow': return [color('color', 'Shadow Colour', '#101020'), opacity(), range('offsetX', 'Offset X', 4, -24, 24), range('offsetY', 'Offset Y', 4, -24, 24), range('softness', 'Softness', 4, 0, 16)];
    case 'glow': return [color('color', 'Glow Colour', '#ff62d0'), range('size', 'Size', 14, 0, 32), amount(80), range('softness', 'Softness', 60)];
    case 'neon': return [color('color', 'Neon Colour', '#ff2cba'), range('brightness', 'Brightness', 85), amount(85), range('size', 'Size', 12, 1, 28)];
    case 'long-shadow': return [range('length', 'Length', 36, 0, 64), range('angle', 'Angle', 45, 0, 360), color('color', 'Shadow Colour', '#28233e'), opacity()];
    case 'offset-print': return [range('offsetX', 'Offset X', 6, -32, 32), range('offsetY', 'Offset Y', 4, -32, 32), color('color', 'Secondary Colour', '#ff3b89'), amount(75), color('tertiaryColor', 'Tertiary Colour', '#19c8ed'), range('tertiaryAmount', 'Tertiary Amount', 0)];
    case 'rgb-split': return [range('separation', 'Separation', 6, 0, 32), direction(), amount(80)];
    case 'glitch': return [amount(65), range('sliceSize', 'Slice Size', 6, 1, 32), range('displacement', 'Displacement', 16, 0, 40), range('rgbSplit', 'RGB Split', 5, 0, 16)];
    case 'pixelated': return [range('size', 'Pixel Size', 6, 1, 32), amount(100)];
    case 'blur': return [range('amount', 'Blur Radius', 5, 0, 20)];
    case 'motion-blur': return [amount(75), direction(), range('distance', 'Distance', 20, 0, 48)];
    case 'gradient': return [{ key: 'type', label: 'Gradient Type', type: 'select', default: 'linear', options: [{ value: 'linear', label: 'Linear' }, { value: 'radial', label: 'Radial' }, { value: 'conic', label: 'Conic' }] }, range('angle', 'Angle', 0, 0, 360)];
    case 'duotone': return [color('color1', 'Shadow Colour', '#35225b'), color('color2', 'Highlight Colour', '#ffca76'), range('balance', 'Balance', 50)];
    case 'texture-fill': return assetControls(50);
    case 'image-fill': return [...assetControls(), range('cropX', 'Crop X', 0, 0, 99), range('cropY', 'Crop Y', 0, 0, 99), range('cropWidth', 'Crop Width', 100, 1, 100), range('cropHeight', 'Crop Height', 100, 1, 100)];
    default: return [];
  }
}
let nextId = 0;
export function createTextEffect(type: TextEffectId): TextEffect {
  return {
    id: `text-effect-${Date.now().toString(36)}-${++nextId}`, type, enabled: true, intensity: 100,
    seed: Math.floor(Math.random() * 0x7fffffff),
    settings: Object.fromEntries(textEffectControls(type).map(c => [c.key, c.default])),
    ...(type === 'gradient' ? { stops: [{ color: '#8b5cf6', position: 0 }, { color: '#f472b6', position: 100 }] } : {}),
  };
}
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const finite = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const fract = (v: number) => v - Math.floor(v);
const radians = (v: number) => v * Math.PI / 180;
type RGB = [number, number, number];
function parseColor(value: unknown, fallback = '#000000'): RGB {
  const text = typeof value === 'string' ? value : fallback;
  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(text);
  if (!match) return text === fallback ? [0, 0, 0] : parseColor(fallback);
  const hex = match[1].length === 3 ? [...match[1]].map(c => c + c).join('') : match[1];
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}
function hash(x: number, y: number, seed: number): number {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, size: number, seed: number): number {
  x /= Math.max(0.1, size); y /= Math.max(0.1, size);
  const ix = Math.floor(x), iy = Math.floor(y), fx = fract(x), fy = fract(y);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (hash(ix, iy, seed) * (1 - u) + hash(ix + 1, iy, seed) * u) * (1 - v)
    + (hash(ix, iy + 1, seed) * (1 - u) + hash(ix + 1, iy + 1, seed) * u) * v;
}
function alphaOf(data: Uint8ClampedArray): Float32Array {
  const a = new Float32Array(data.length / 4);
  for (let i = 0; i < a.length; i++) a[i] = data[i * 4 + 3] / 255;
  return a;
}
/** Two linear-time box passes, with transparent (not clamped) canvas edges. */
function blurField(source: Float32Array, w: number, h: number, radius: number): Float32Array {
  const r = Math.max(0, Math.ceil(radius));
  if (!r) return source.slice();
  const horizontal = new Float32Array(source.length), out = new Float32Array(source.length), divisor = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) sum += source[y * w + x];
    for (let x = 0; x < w; x++) {
      horizontal[y * w + x] = sum / divisor;
      if (x - r >= 0) sum -= source[y * w + x - r];
      if (x + r + 1 < w) sum += source[y * w + x + r + 1];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) sum += horizontal[y * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / divisor;
      if (y - r >= 0) sum -= horizontal[(y - r) * w + x];
      if (y + r + 1 < h) sum += horizontal[(y + r + 1) * w + x];
    }
  }
  return out;
}
function fieldAt(a: Float32Array, w: number, h: number, x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const at = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : a[yy * w + xx];
  return at(ix, iy) * (1 - fx) * (1 - fy) + at(ix + 1, iy) * fx * (1 - fy)
    + at(ix, iy + 1) * (1 - fx) * fy + at(ix + 1, iy + 1) * fx * fy;
}
interface Geometry { inside: Float32Array; outside: Float32Array; nearest: Int32Array }
/** Chamfer distance and nearest foreground ownership retain holes, contours and thin strokes. */
function geometry(a: Float32Array, w: number, h: number): Geometry {
  const inside = new Float32Array(a.length), outside = new Float32Array(a.length), nearest = new Int32Array(a.length);
  const far = w + h + 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    inside[i] = a[i] > 0 ? Math.min(x + 1, y + 1, w - x, h - y, far) : 0;
    outside[i] = a[i] > 0 ? 0 : far; nearest[i] = a[i] > 0 ? i : -1;
  }
  for (let pass = 0; pass < 2; pass++) {
    const step = pass === 0 ? 1 : -1;
    for (let y = pass === 0 ? 0 : h - 1; y >= 0 && y < h; y += step) {
      for (let x = pass === 0 ? 0 : w - 1; x >= 0 && x < w; x += step) {
        const i = y * w + x;
        for (const [dx, dy, cost] of [[-step, 0, 1], [0, -step, 1], [-step, -step, Math.SQRT2], [step, -step, Math.SQRT2]]) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          inside[i] = Math.min(inside[i], inside[j] + cost);
          if (outside[j] + cost < outside[i]) { outside[i] = outside[j] + cost; nearest[i] = nearest[j]; }
        }
      }
    }
  }
  return { inside, outside, nearest };
}
function glyphBounds(a: Float32Array, w: number, h: number) {
  let left = w, top = h, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[y * w + x] > 0) {
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return { left, top, width: Math.max(1, right - left + 1), height: Math.max(1, bottom - top + 1), empty: right < 0 };
}
/** Interpolating premultiplied channels avoids hidden RGB fringes when alpha changes. */
function mixPixels(source: Uint8ClampedArray, result: Uint8ClampedArray, t: number): Uint8ClampedArray {
  if (t <= 0) return source.slice();
  if (t >= 1) return result;
  const out = new Uint8ClampedArray(source.length);
  for (let i = 0; i < out.length; i += 4) {
    const a = source[i + 3] / 255, b = result[i + 3] / 255, alpha = a * (1 - t) + b * t;
    for (let c = 0; c < 3; c++) out[i + c] = alpha > 0 ? (source[i + c] * a * (1 - t) + result[i + c] * b * t) / alpha : source[i + c];
    out[i + 3] = alpha * 255;
  }
  return out;
}
function behind(out: Uint8ClampedArray, i: number, rgb: RGB, alpha: number) {
  const front = out[i + 3] / 255, back = clamp(alpha) * (1 - front), total = front + back;
  if (total <= 0) return;
  for (let c = 0; c < 3; c++) out[i + c] = (out[i + c] * front + rgb[c] * back) / total;
  out[i + 3] = total * 255;
}
function tint(out: Uint8ClampedArray, i: number, rgb: RGB, t: number) {
  t = clamp(t);
  for (let c = 0; c < 3; c++) out[i + c] += (rgb[c] - out[i + c]) * t;
}
function shade(out: Uint8ClampedArray, i: number, light: number) {
  tint(out, i, light > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(light));
}
function sample(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: Uint8ClampedArray, index: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  let a = 0, r = 0, g = 0, b = 0;
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const xx = ix + dx, yy = iy + dy;
    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
    const j = (yy * w + xx) * 4, weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * data[j + 3] / 255;
    a += weight; r += data[j] * weight; g += data[j + 1] * weight; b += data[j + 2] * weight;
  }
  out[index] = a ? r / a : 0; out[index + 1] = a ? g / a : 0; out[index + 2] = a ? b / a : 0; out[index + 3] = a * 255;
}
function blurPixels(data: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  if (radius <= 0) return data.slice();
  const alpha = blurField(alphaOf(data), w, h, radius), out = new Uint8ClampedArray(data.length);
  for (let c = 0; c < 3; c++) {
    const channel = new Float32Array(w * h);
    for (let i = 0; i < channel.length; i++) channel[i] = data[i * 4 + c] * data[i * 4 + 3] / 255;
    const blurred = blurField(channel, w, h, radius);
    for (let i = 0; i < channel.length; i++) out[i * 4 + c] = alpha[i] > 0 ? blurred[i] / alpha[i] : 0;
  }
  for (let i = 0; i < alpha.length; i++) out[i * 4 + 3] = alpha[i] * 255;
  return out;
}
function gradientStops(effect: TextEffect) {
  const stops = (effect.stops?.length ? effect.stops : [{ color: '#8b5cf6', position: 0 }, { color: '#f472b6', position: 100 }])
    .map(s => ({ color: parseColor(s.color, '#8b5cf6'), position: clamp(finite(s.position, 0), 0, 100) / 100 }))
    .sort((a, b) => a.position - b.position);
  return stops;
}
function gradientColor(stops: ReturnType<typeof gradientStops>, t: number): RGB {
  if (t <= stops[0].position) return stops[0].color;
  for (let j = 1; j < stops.length; j++) if (t <= stops[j].position) {
    const a = stops[j - 1], b = stops[j], f = clamp((t - a.position) / Math.max(0.00001, b.position - a.position));
    return a.color.map((c, i) => c + (b.color[i] - c) * f) as RGB;
  }
  return stops[stops.length - 1].color;
}

function applyOne(data: Uint8ClampedArray, w: number, h: number, effect: TextEffect, assets: Record<string, TextEffectAsset>, scale: number): Uint8ClampedArray {
  const settings: Record<string, number | string> = {};
  for (const c of shapeEffectControls(effect.type)) {
    const value = effect.settings?.[c.key];
    settings[c.key] = c.type === 'range' ? clamp(finite(value, c.default), c.min, c.max)
      : c.type === 'select' ? c.options.some(o => o.value === value) ? value! : c.default
      : typeof value === 'string' ? value : c.default;
  }
  const n = (key: string) => settings[key] as number;
  const p = (key: string) => n(key) / 100;
  const col = (key: string) => parseColor(settings[key], String(textEffectControls(effect.type).find(c => c.key === key)?.default ?? '#000000'));
  const seed = finite(effect.seed, 0) | 0;
  const alpha = alphaOf(data), bounds = glyphBounds(alpha, w, h), out = data.slice();
  if (bounds.empty) return out;
  const type = effect.type;
  if (type === 'blur') return blurPixels(data, w, h, n('amount') * scale);
  const needsGeometry = ['rough-edges', 'inner-glow', 'vintage-print', 'screen-print', 'spray-paint', 'ink-bleed', 'embroidery', 'puff-print', 'chrome', 'metallic', 'foil', 'bevel', 'neon'].includes(type);
  const geo = needsGeometry ? geometry(alpha, w, h) : undefined;
  let blurred: Float32Array | undefined;
  if (type === 'inner-shadow' || type === 'shadow') blurred = blurField(alpha, w, h, n('softness') * scale);
  if (type === 'glow' || type === 'neon') {
    const radius = n('size') * scale;
    // Radius is split between two passes so support never exceeds the requested size (+2 rounding pixels).
    blurred = blurField(blurField(alpha, w, h, radius * 0.5), w, h, radius * 0.5);
  }
  if (type === 'ink-bleed' && geo) {
    const expanded = new Float32Array(alpha.length);
    for (let i = 0; i < expanded.length; i++) {
      const x = (i % w) / scale, y = Math.floor(i / w) / scale;
      const radius = p('amount') * 10 * (1 - p('irregularity') * 0.8 + noise(x, y, 4, seed) * p('irregularity'));
      expanded[i] = Math.max(alpha[i], clamp(radius + 1 - geo.outside[i] / scale));
    }
    blurred = blurField(expanded, w, h, n('softness') * scale);
  }
  const theta = radians(n('direction') || n('angle') || 0), dx = Math.cos(theta), dy = Math.sin(theta);
  const primary = 'color' in settings ? col('color') : [0, 0, 0] as RGB;
  const secondary = type === 'duotone' ? col('color2') : type === 'offset-print' ? col('tertiaryColor') : primary;
  const duotoneLow = type === 'duotone' ? col('color1') : primary;
  const stops = type === 'gradient' ? gradientStops(effect) : [];
  const asset = effect.source ? assets[effect.source] : undefined;
  const validAsset = asset && Number.isInteger(asset.width) && Number.isInteger(asset.height) && asset.width > 0 && asset.height > 0 && asset.data.length === asset.width * asset.height * 4;
  if ((type === 'texture-fill' || type === 'image-fill') && !validAsset) return out;
  const tmp = new Uint8ClampedArray(4), tmp2 = new Uint8ClampedArray(4), tmp3 = new Uint8ClampedArray(4);
  const frontCenterX = bounds.left + (bounds.width - 1) / 2, frontCenterY = bounds.top + (bounds.height - 1) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = y * w + x, i = j * 4, a = alpha[j], xx = x / scale, yy = y / scale;
    const u = (x - bounds.left + 0.5) / bounds.width, v = (y - bounds.top + 0.5) / bounds.height;
    const inside = geo ? geo.inside[j] / scale : 0, outside = geo ? geo.outside[j] / scale : 0;
    switch (type) {
      case 'rough-edges': {
        if (!a || !n('size')) break;
        const cloud = noise(xx, yy, 100 / n('frequency'), seed);
        const detail = hash(Math.floor(xx), Math.floor(yy), seed + 9);
        const depth = n('size') * (cloud * (1 - p('roughness')) + detail * p('roughness'));
        const removal = clamp((depth - inside) * scale + 0.5) * p('amount');
        out[i + 3] *= 1 - removal;
        break;
      }
      case 'shadow': {
        if (!blurred) break;
        const coverage = fieldAt(blurred, w, h, x - n('offsetX') * scale, y - n('offsetY') * scale);
        behind(out, i, primary, coverage * p('opacity'));
        break;
      }
      case 'inner-glow': {
        if (!a || !n('size')) break;
        const edge = clamp(1 - Math.max(0, inside - 0.5 / scale) / n('size'));
        const falloff = edge ** (0.2 + p('softness') * 3);
        tint(out, i, primary, falloff * p('amount'));
        break;
      }
      case 'distressed': {
        if (!a) break;
        const fine = hash(Math.floor(xx), Math.floor(yy), seed + 1);
        const wear = noise(xx, yy, n('size'), seed) * (1 - p('roughness') * 0.6) + fine * p('roughness') * 0.6;
        const removal = clamp((p('density') * 0.9 - wear) * 5) * p('amount');
        out[i + 3] *= 1 - removal;
        break;
      }
      case 'grunge': {
        if (!a) break;
        const cloud = noise(xx, yy, n('scale'), seed), pits = noise(xx, yy, Math.max(0.5, n('scale') / 5), seed + 7);
        const dirt = clamp((p('density') - cloud * 0.8 - pits * 0.2) * 3);
        out[i + 3] *= 1 - dirt * p('amount') * (0.4 + p('roughness') * 0.6);
        shade(out, i, -p('amount') * cloud * p('roughness') * 0.65);
        break;
      }
      case 'cracked': {
        if (!a) break;
        // Warped cellular boundaries form connected cracks instead of independent scratches.
        const size = n('size'), gx = xx / size + (noise(xx, yy, size / 3, seed + 1) - 0.5) * 0.5;
        const gy = yy / size + (noise(xx, yy, size / 3, seed + 2) - 0.5) * 0.5;
        const ix = Math.floor(gx), iy = Math.floor(gy);
        let first = Infinity, second = Infinity;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const px = ix + ox + hash(ix + ox, iy + oy, seed), py = iy + oy + hash(ix + ox, iy + oy, seed + 19);
          const d = Math.hypot(gx - px, gy - py);
          if (d < first) { second = first; first = d; } else if (d < second) second = d;
        }
        const crack = clamp((n('thickness') - (second - first) * size * 0.6) * scale + 0.5);
        out[i + 3] *= 1 - crack * p('amount');
        break;
      }
      case 'faded': {
        if (!a) break;
        const variation = noise(xx, yy, 24, seed) * p('variation') + (1 - p('variation')) * 0.5;
        out[i + 3] *= p('opacity') * (1 - p('amount') * (0.3 + variation * 0.7));
        tint(out, i, [238, 224, 200], p('amount') * variation * 0.25);
        break;
      }
      case 'vintage-print': {
        if (!a) break;
        const fine = hash(Math.floor(xx), Math.floor(yy), seed), cloud = noise(xx, yy, 9, seed);
        tint(out, i, [163, 116, 61], p('age') * 0.45);
        shade(out, i, (fine - 0.5) * p('grain') * 0.7);
        const edge = Math.exp(-inside / 3) * p('edgeWear') * (0.3 + cloud * 0.7);
        out[i + 3] *= (1 - edge) * (1 - p('fade') * (0.4 + cloud * 0.3)) * (1 - p('grain') * fine * 0.12);
        break;
      }
      case 'grain': {
        if (!a) break;
        const grain = hash(Math.floor(xx / n('size')), Math.floor(yy / n('size')), seed);
        if (grain < p('density')) {
          shade(out, i, (grain / Math.max(0.01, p('density')) - 0.5) * p('amount') * p('opacity') * 1.5);
          out[i + 3] *= 1 - p('amount') * p('opacity') * (1 - grain) * 0.45;
        }
        break;
      }
      case 'halftone': {
        if (!a) break;
        const angle = radians(n('angle')), cs = Math.cos(angle), sn = Math.sin(angle), spacing = n('spacing');
        const tx = (xx * cs + yy * sn) / spacing, ty = (-xx * sn + yy * cs) / spacing;
        const distance = Math.hypot(fract(tx) - 0.5, fract(ty) - 0.5) * spacing;
        const radius = n('dotSize') * (0.1 + p('density') * 0.9);
        out[i + 3] *= clamp((radius - distance) * scale + 0.5);
        break;
      }
      case 'noise': {
        if (!a) break;
        const value = hash(Math.floor(xx / n('scale')), Math.floor(yy / n('scale')), seed);
        const active = hash(Math.floor(xx / n('scale')), Math.floor(yy / n('scale')), seed + 4) < p('density');
        if (active) { shade(out, i, (value - 0.5) * p('amount') * 1.8); out[i + 3] *= 1 - (1 - value) * p('amount') * 0.3; }
        break;
      }
      case 'photocopy': {
        if (!a) break;
        const rough = noise(xx, yy, 5, seed), fine = hash(Math.floor(xx), Math.floor(yy), seed + 9);
        const luminance = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
        const ink = clamp((luminance - 0.5) * (1 + p('contrast') * 4) + 0.5 + (rough - 0.5) * p('roughness') + (fine - 0.5) * p('noise'));
        const value = clamp((ink - p('threshold')) * 15 + 0.5) * 255;
        out[i] = out[i + 1] = out[i + 2] = value;
        out[i + 3] *= 1 - clamp((fine - 0.5) * 2) * p('noise') * (0.2 + p('roughness') * 0.5);
        break;
      }
      case 'screen-print': {
        if (!a) break;
        const mesh = (Math.sin(xx * Math.PI) * Math.sin(yy * Math.PI * 0.93) + 1) / 2;
        const rough = noise(xx, yy, 3, seed), holes = hash(Math.floor(xx), Math.floor(yy), seed + 3);
        const edge = Math.exp(-inside / 2) * p('edgeWear') * rough;
        out[i + 3] *= p('inkAmount') * (1 - edge) * (1 - p('imperfection') * holes * mesh * 0.65);
        shade(out, i, -p('roughness') * (0.1 + rough * 0.35));
        break;
      }
      case 'spray-paint': {
        if (!geo) break;
        const particle = hash(Math.floor(xx / n('particleSize')), Math.floor(yy / n('particleSize')), seed);
        const edgeNoise = noise(xx, yy, 4, seed + 8);
        if (a) out[i + 3] *= (1 - p('amount') * (particle * 0.45 + Math.exp(-inside / 3) * p('edgeRoughness') * edgeNoise * 0.55)) * (1 - p('amount') * (1 - p('density')));
        else if (outside <= n('scatter') && n('scatter') > 0 && geo.nearest[j] >= 0) {
          const coverage = (1 - outside / n('scatter')) ** 2 * p('amount') * (0.5 + edgeNoise * p('edgeRoughness'));
          if (particle < coverage * 0.55 * p('density')) {
            const k = geo.nearest[j] * 4;
            out[i] = data[k]; out[i + 1] = data[k + 1]; out[i + 2] = data[k + 2]; out[i + 3] = 255 * coverage * (0.4 + particle);
          }
        }
        break;
      }
      case 'ink-bleed': {
        if (!geo || !blurred) break;
        const nearest = geo.nearest[j];
        if (nearest >= 0 && outside <= 26) {
          const k = nearest * 4;
          behind(out, i, [data[k], data[k + 1], data[k + 2]], blurred[j] * p('amount') * 0.9);
          if (a) shade(out, i, -Math.exp(-inside / (1 + n('softness'))) * p('amount') * 0.18);
        }
        break;
      }
      case 'embroidery': {
        if (!a || !geo) break;
        const left = geo.inside[y * w + Math.max(0, x - 1)], right = geo.inside[y * w + Math.min(w - 1, x + 1)];
        const up = geo.inside[Math.max(0, y - 1) * w + x], down = geo.inside[Math.min(h - 1, y + 1) * w + x];
        const nx = right - left, ny = down - up;
        const contour = Math.atan2(ny, nx) + Math.PI / 2;
        const follow = p('detail') * Math.exp(-inside / (n('stitchSize') * 1.5));
        const vx = dx * (1 - follow) + Math.cos(contour) * follow, vy = dy * (1 - follow) + Math.sin(contour) * follow;
        const norm = Math.hypot(vx, vy) || 1, tx = vx / norm, ty = vy / norm;
        const spacing = n('thickness') + (1 - p('density')) * 3 + 0.3;
        const across = (-xx * ty + yy * tx + inside * p('detail') * 0.6) / spacing;
        const along = (xx * tx + yy * ty) / n('stitchSize') + Math.floor(across) * 0.5;
        const threadDistance = Math.abs(fract(across) - 0.5) * spacing;
        const thread = clamp((n('thickness') * 0.5 - threadDistance) * scale + 0.5);
        const end = Math.sin(Math.PI * fract(along));
        const crest = Math.cos(clamp(threadDistance / Math.max(0.1, n('thickness') * 0.5)) * Math.PI / 2);
        const twist = Math.sin((xx * tx + yy * ty) * 5 + across * 2) * p('detail') * 0.12;
        shade(out, i, thread * end * (0.35 + crest * 0.35) - (1 - thread) * 0.65 - (1 - end) * 0.25 + twist);
        out[i + 3] *= 0.48 + 0.52 * clamp(thread * (0.6 + end * 0.4) + p('density') * 0.3);
        break;
      }
      case 'puff-print':
      case 'bevel':
      case 'chrome':
      case 'metallic':
      case 'foil': {
        if (!a || !geo) break;
        const depth = type === 'puff-print' || type === 'bevel' ? n('depth') : 5;
        const softness = type === 'puff-print' || type === 'bevel' ? p('softness') : 0.4;
        const heightAt = (sx: number, sy: number) => {
          const d = geo.inside[clamp(sy, 0, h - 1) * w + clamp(sx, 0, w - 1)] / scale;
          return 1 - Math.exp(-d / Math.max(0.1, depth * (0.3 + softness)));
        };
        const nx = (heightAt(x - 1, y) - heightAt(x + 1, y)) * depth * scale / 2;
        const ny = (heightAt(x, y - 1) - heightAt(x, y + 1)) * depth * scale / 2;
        const norm = Math.sqrt(nx * nx + ny * ny + 1), light = (-nx * dx - ny * dy + 0.65) / norm;
        const relief = (-nx * dx - ny * dy) / norm;
        if (type === 'puff-print') {
          const dome = heightAt(x, y);
          const lighting = relief > 0 ? relief * p('highlight') : relief * p('shadow');
          shade(out, i, p('amount') * (lighting + dome * p('highlight') * 0.16 - (1 - dome) * p('shadow') * 0.15));
        } else if (type === 'bevel') {
          const edge = clamp(1 - inside / (depth * 2));
          shade(out, i, relief * edge * p('amount') * (1.3 - softness * 0.5) * (settings.mode === 'recessed' ? -1 : 1));
        } else if (type === 'chrome') {
          const reflected = Math.sin((u * dx + v * dy) * Math.PI * 5 + relief * 5);
          const band = clamp(0.5 + reflected * (0.2 + p('contrast') * 0.8));
          const chrome: RGB = [45 + band * 190, 55 + band * 190, 75 + band * 180];
          tint(out, i, chrome, p('metallic'));
          shade(out, i, (band - 0.5) * p('reflection') * 0.8 + Math.max(0, light) ** 10 * p('highlight') * 0.8);
        } else if (type === 'metallic') {
          const brush = noise(xx * dx + yy * dy, -xx * dy + yy * dx, 1.2, seed);
          const luminance = (data[i] + data[i + 1] + data[i + 2]) / 3;
          tint(out, i, [luminance * 0.9 + 20, luminance * 0.94 + 22, luminance + 25], p('metallic') * 0.55);
          shade(out, i, relief * p('contrast') * 0.8 + Math.max(0, light) ** 5 * p('highlight') * 0.55 + (brush - 0.5) * p('metallic') * 0.25);
        } else {
          const fold = noise(xx, yy, 5, seed), fine = hash(Math.floor(xx), Math.floor(yy), seed + 1);
          const reflection = Math.sin(fold * 12 + relief * 4 + v * 3);
          tint(out, i, [231, 178, 61], 0.55);
          shade(out, i, reflection * p('reflection') * 0.5 + (fine - 0.5) * p('texture') * 0.65
            + Math.max(0, light + (fold - 0.5) * p('roughness')) ** 4 * p('highlight') * 0.5 - p('roughness') * fold * 0.2);
        }
        break;
      }
      case 'gloss': {
        if (!a) break;
        const distance = Math.abs(v * 100 - n('position')) / Math.max(0.5, n('size') / 2);
        const falloff = Math.pow(clamp(1 - distance), 0.15 + p('softness') * 3);
        shade(out, i, falloff * p('amount') * 0.85);
        break;
      }
      case 'extrude':
      case 'long-shadow': {
        const length = type === 'extrude' ? n('depth') : n('length');
        if (length <= 0 || a === 1) break;
        const steps = Math.max(1, Math.min(32, Math.ceil(length * scale)));
        let coverage = 0, layer = 0;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps, shrink = type === 'extrude' ? 1 - p('perspective') * t * 0.65 : 1;
          const sx = frontCenterX + (x - frontCenterX - dx * length * scale * t) / shrink;
          const sy = frontCenterY + (y - frontCenterY - dy * length * scale * t) / shrink;
          const value = fieldAt(alpha, w, h, sx, sy);
          if (value > coverage) { coverage = value; layer = t; }
        }
        const side = type === 'extrude' ? primary.map(c => c * (0.7 + layer * 0.25)) as RGB : primary;
        behind(out, i, side, coverage * (type === 'long-shadow' ? p('opacity') : 1));
        break;
      }
      case 'inner-shadow': {
        if (!a || !blurred) break;
        const mask = 1 - fieldAt(blurred, w, h, x - n('offsetX') * scale, y - n('offsetY') * scale);
        tint(out, i, primary, mask * p('opacity'));
        break;
      }
      case 'glow': {
        if (!blurred) break;
        const strength = blurred[j] * (1 + (1 - p('softness')) * 3);
        behind(out, i, primary, strength * p('amount'));
        if (a) tint(out, i, primary, p('amount') * (1 - p('softness')) * 0.12);
        break;
      }
      case 'neon': {
        if (!blurred) break;
        if (a) {
          tint(out, i, primary, p('amount'));
          const core = Math.exp(-(((inside - 1.5) / 1.8) ** 2));
          shade(out, i, p('brightness') * p('amount') * (0.3 + core * 0.65));
        }
        behind(out, i, primary, blurred[j] * p('amount') * (0.5 + p('brightness') * 2));
        break;
      }
      case 'offset-print': {
        const sx = n('offsetX') * scale, sy = n('offsetY') * scale;
        const second = fieldAt(alpha, w, h, x - sx, y - sy), third = fieldAt(alpha, w, h, x + sx, y + sy);
        // Translucent overprinted inks are visible inside the front as well as outside it.
        if (a) { tint(out, i, primary, second * p('amount') * 0.28); tint(out, i, secondary, third * p('tertiaryAmount') * 0.28); }
        behind(out, i, primary, second * p('amount'));
        behind(out, i, secondary, third * p('tertiaryAmount'));
        break;
      }
      case 'rgb-split': {
        const distance = n('separation') * scale;
        sample(data, w, h, x - dx * distance, y - dy * distance, tmp, 0);
        sample(data, w, h, x + dx * distance, y + dy * distance, tmp2, 0);
        const ar = tmp[3] / 255, ab = tmp2[3] / 255, union = Math.max(ar, a, ab);
        out[i] = union ? tmp[0] * ar / union : 0;
        out[i + 1] = union ? data[i + 1] * a / union : 0;
        out[i + 2] = union ? tmp2[2] * ab / union : 0;
        out[i + 3] = union * 255;
        break;
      }
      case 'glitch': {
        const row = Math.floor((-xx * dy + yy * dx) / n('sliceSize')), gate = hash(row, 0, seed);
        const shift = gate < p('amount') ? (hash(row, 1, seed) * 2 - 1) * n('displacement') * scale : 0;
        const split = n('rgbSplit') * scale * (0.25 + gate * 0.75);
        sample(data, w, h, x - dx * shift, y - dy * shift, tmp, 0);
        sample(data, w, h, x - dx * (shift + split), y - dy * (shift + split), tmp2, 0);
        sample(data, w, h, x - dx * (shift - split), y - dy * (shift - split), tmp3, 0);
        const ar = tmp2[3] / 255, ag = tmp[3] / 255, ab = tmp3[3] / 255, union = Math.max(ar, ag, ab);
        out[i] = union ? tmp2[0] * ar / union : 0; out[i + 1] = union ? tmp[1] * ag / union : 0;
        out[i + 2] = union ? tmp3[2] * ab / union : 0; out[i + 3] = union * 255;
        break;
      }
      case 'pixelated': {
        const size = Math.max(1, n('size') * scale);
        const sx = bounds.left + (Math.floor((x - bounds.left) / size) + 0.5) * size - 0.5;
        const sy = bounds.top + (Math.floor((y - bounds.top) / size) + 0.5) * size - 0.5;
        sample(data, w, h, sx, sy, out, i);
        break;
      }
      case 'motion-blur': {
        const distance = n('distance') * scale;
        if (!distance) break;
        const steps = Math.max(2, Math.min(32, Math.ceil(distance) + 1));
        let red = 0, green = 0, blue = 0, coverage = 0;
        for (let s = 0; s < steps; s++) {
          const t = s / (steps - 1);
          sample(data, w, h, x - dx * distance * t, y - dy * distance * t, tmp, 0);
          const weight = tmp[3] / 255;
          red += tmp[0] * weight; green += tmp[1] * weight; blue += tmp[2] * weight; coverage += weight;
        }
        out[i] = coverage ? red / coverage : 0; out[i + 1] = coverage ? green / coverage : 0;
        out[i + 2] = coverage ? blue / coverage : 0; out[i + 3] = coverage / steps * 255;
        break;
      }
      case 'gradient': {
        if (!a) break;
        const angle = radians(n('angle')), cs = Math.cos(angle), sn = Math.sin(angle);
        // Rotating an off-centre radial focus makes the angle control useful for radial fills too.
        const cx = p('positionX'), cy = p('positionY');
        const t = settings.type === 'radial' ? Math.hypot(u - (cx - cs * 0.2), v - (cy - sn * 0.2)) / 0.8
          : settings.type === 'conic' ? fract((Math.atan2(v - cy, u - cx) - angle) / (2 * Math.PI))
          : 0.5 + ((u - cx) * cs + (v - cy) * sn) / Math.max(0.001, Math.abs(cs) + Math.abs(sn));
        const rgb = gradientColor(stops, clamp(t));
        out[i] = rgb[0]; out[i + 1] = rgb[1]; out[i + 2] = rgb[2];
        break;
      }
      case 'duotone': {
        if (!a) break;
        const luminance = (data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722) / 255;
        const t = clamp(luminance + (p('balance') - 0.5) * 1.5);
        for (let c = 0; c < 3; c++) out[i + c] = duotoneLow[c] + (secondary[c] - duotoneLow[c]) * t;
        break;
      }
      case 'texture-fill':
      case 'image-fill': {
        if (!a || !asset || !validAsset) break;
        const rotation = radians(n('rotation')), cs = Math.cos(rotation), sn = Math.sin(rotation);
        const ux = u - 0.5 - p('offsetX'), vy = v - 0.5 - p('offsetY');
        // Inverse transform in glyph-normalized coordinates; transparent source pixels stay clipped.
        let su = (ux * cs + vy * sn) / p('scale') + 0.5, sv = (-ux * sn + vy * cs) / p('scale') + 0.5;
        if (type === 'texture-fill') { su = fract(su); sv = fract(sv); }
        if (type === 'image-fill' && (su < 0 || su > 1 || sv < 0 || sv > 1)) tmp.fill(0);
        else {
          const cropX = p('cropX'), cropY = p('cropY');
          const cropW = Math.min(p('cropWidth'), 1 - cropX);
          const cropH = Math.min(p('cropHeight'), 1 - cropY);
          su = clamp(cropX + su * cropW); sv = clamp(cropY + sv * cropH);
          sample(asset.data, asset.width, asset.height, su * (asset.width - 1), sv * (asset.height - 1), tmp, 0);
        }
        out[i] = tmp[0]; out[i + 1] = tmp[1]; out[i + 2] = tmp[2]; out[i + 3] = tmp[3] * a;
        break;
      }
    }
  }
  if (['rgb-split', 'pixelated', 'motion-blur'].includes(type)) return mixPixels(data, out, p('amount'));
  if (type === 'texture-fill' || type === 'image-fill') return mixPixels(data, out, p('opacity'));
  return out;
}

/** Pure ordered typography stack. Assets are decoded upstream and keyed by effect.source.
 * Intensity interpolates premultiplied RGBA, not straight RGB. Zero and disabled effects are exact identities.
 * Each effect's maximum extension fits the 64 CSS-pixel render gutter; multiple effects may accumulate.
 */
export function applyTextEffects(
  data: Uint8ClampedArray, width: number, height: number, effects: TextEffect[],
  assets: Record<string, TextEffectAsset> = {}, scale = 1,
): Uint8ClampedArray {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 0 || height < 0
    || !Number.isSafeInteger(width * height * 4) || data.length !== width * height * 4) throw new RangeError('Invalid text effect pixel dimensions');
  scale = Math.max(0.01, finite(scale, 1));
  let result = data.slice();
  if (!width || !height) return result;
  for (const effect of effects) {
    if (!effect.enabled || ![...TEXT_EFFECTS, ...SHAPE_EFFECTS].some(item => item.id === effect.type)) continue;
    const intensity = clamp(finite(effect.intensity, 100), 0, 100) / 100;
    if (!intensity) continue;
    result = mixPixels(result, applyOne(result, width, height, effect, assets, scale), intensity);
  }
  return result;
}
