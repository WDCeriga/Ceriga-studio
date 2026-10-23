/** Pure RGBA filters. Distances use a 600px longest-edge reference; angles use degrees.
 * Intensity is 0–100 (default 100). Alpha and fully transparent RGB are never changed.
 * Outputs are independent copies, suitable for caching at intensity 100 and blending later.
 */
export const IMAGE_FILTERS = [
  { id: 'none', label: 'Original / None' },
  { id: 'bw', label: 'B&W' },
  { id: 'high-contrast-bw', label: 'High Contrast B&W' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'washed', label: 'Washed' },
  { id: 'faded', label: 'Faded' },
  { id: 'film', label: 'Film' },
  { id: 'disposable', label: 'Disposable' },
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'cold', label: 'Cold' },
  { id: 'warm', label: 'Warm' },
  { id: 'muted', label: 'Muted' },
  { id: 'vibrant', label: 'Vibrant' },
  { id: 'dark', label: 'Dark' },
  { id: 'soft', label: 'Soft' },
  { id: 'dreamy', label: 'Dreamy' },
  { id: 'retro', label: 'Retro' },
  { id: 'y2k', label: 'Y2K' },
  { id: 'posterize', label: 'Posterize' },
  { id: 'duotone', label: 'Duotone' },
  { id: 'tritone', label: 'Tritone' },
  { id: 'threshold', label: 'Threshold' },
  { id: 'invert', label: 'Invert' },
  { id: 'halftone', label: 'Halftone' },
  { id: 'comic', label: 'Comic' },
  { id: 'photocopy', label: 'Photocopy' },
  { id: 'newsprint', label: 'Newsprint' },
  { id: 'pixelate', label: 'Pixelate' },
  { id: 'glitch', label: 'Glitch' },
  { id: 'chromatic', label: 'Chromatic' },
  { id: 'thermal', label: 'Thermal' },
  { id: 'emboss', label: 'Emboss' },
  { id: 'screen-print', label: 'Screen Print' },
] as const;

export type ImageFilterId = (typeof IMAGE_FILTERS)[number]['id'];
export type ImageFilterSettings = {
  id: ImageFilterId;
  intensity?: number;
  dotSize?: number;
  spacing?: number;
  angle?: number;
  shadowColor?: string;
  midtoneColor?: string;
  highlightColor?: string;
  threshold?: number;
  pixelSize?: number;
  amount?: number;
  separation?: number;
  direction?: number;
  colors?: number;
  contrast?: number;
  detail?: number;
  grain?: number;
  fade?: number;
  saturation?: number;
  seed?: number;
};
export type ImageFilterControl =
  | { key: string; label: string; type: 'range'; min: number; max: number; step: number; default: number; suffix?: string }
  | { key: string; label: string; type: 'color'; default: string };

type SettingKey = Exclude<keyof ImageFilterSettings, 'id'>;
const range = (key: SettingKey, label: string, min: number, max: number, value: number, suffix?: string): ImageFilterControl =>
  ({ key, label, type: 'range', min, max, step: 1, default: value, ...(suffix ? { suffix } : {}) });
const color = (key: SettingKey, label: string, value: string): ImageFilterControl => ({ key, label, type: 'color', default: value });
const inks = (shadow = '#182344', highlight = '#ffe6b0'): ImageFilterControl[] => [
  color('shadowColor', 'Shadow Colour', shadow), color('highlightColor', 'Highlight Colour', highlight),
];
const dots = (): ImageFilterControl[] => [
  range('dotSize', 'Dot size', 1, 40, 12, 'px'), range('spacing', 'Spacing', 2, 60, 12, 'px'),
  range('angle', 'Angle', -180, 180, 45, '°'),
];
const texture = (grain: number, fade: number): ImageFilterControl[] => [
  range('grain', 'Grain', 0, 100, grain, '%'), range('fade', 'Fade', 0, 100, fade, '%'),
];
const CONTROLS: Partial<Record<ImageFilterId, ImageFilterControl[]>> = {
  bw: [range('contrast', 'Contrast', 0, 100, 20)],
  'high-contrast-bw': [range('contrast', 'Contrast', 0, 100, 70)],
  vintage: texture(18, 22), washed: texture(0, 38), faded: texture(0, 48),
  film: [...texture(25, 10), range('contrast', 'Contrast', 0, 100, 22)],
  disposable: texture(42, 16), polaroid: texture(12, 18), retro: texture(12, 12),
  muted: [range('saturation', 'Saturation', 0, 200, 45, '%')],
  vibrant: [range('saturation', 'Saturation', 0, 200, 155, '%')],
  cold: [range('amount', 'Cooling', 0, 100, 55, '%')], warm: [range('amount', 'Warmth', 0, 100, 55, '%')],
  dark: [range('amount', 'Darkening', 0, 100, 40, '%')],
  soft: [range('amount', 'Softness', 0, 100, 45, '%')],
  dreamy: [range('amount', 'Glow', 0, 100, 60, '%')],
  y2k: [range('saturation', 'Saturation', 0, 200, 140, '%')],
  posterize: [range('colors', 'Levels per channel', 2, 16, 5)],
  duotone: inks(), tritone: [...inks(), color('midtoneColor', 'Midtone Colour', '#ce597d')],
  threshold: [range('threshold', 'Threshold', 0, 255, 128)],
  halftone: [...dots(), ...inks('#141414', '#ffffff')],
  newsprint: [...dots(), range('grain', 'Paper grain', 0, 100, 20, '%'), ...inks('#24221e', '#f4eddb')],
  comic: [range('colors', 'Levels per channel', 2, 12, 5), range('contrast', 'Contrast', 0, 100, 25), range('detail', 'Ink detail', 0, 100, 55)],
  photocopy: [range('threshold', 'Threshold', 0, 255, 145), range('contrast', 'Contrast', 0, 100, 55), range('grain', 'Grain', 0, 100, 30, '%'), range('detail', 'Detail', 0, 100, 45)],
  pixelate: [range('pixelSize', 'Pixel size', 1, 100, 18, 'px')],
  glitch: [range('amount', 'Amount', 0, 100, 45, '%'), range('separation', 'RGB separation', 0, 50, 8, 'px'), range('direction', 'Direction', -180, 180, 0, '°')],
  chromatic: [range('separation', 'RGB separation', 0, 50, 6, 'px'), range('direction', 'Direction', -180, 180, 0, '°')],
  emboss: [range('amount', 'Depth', 0, 100, 50, '%'), range('direction', 'Light direction', -180, 180, 135, '°')],
  'screen-print': [range('colors', 'Number of Colours', 2, 12, 4), range('contrast', 'Contrast', 0, 100, 40), range('detail', 'Detail', 0, 100, 50), ...inks('#142d3b', '#fff0cd')],
};

/** Fresh descriptors on every call; changing UI state cannot mutate engine defaults. */
export function imageFilterControls(id: ImageFilterId): ImageFilterControl[] {
  return (CONTROLS[id] ?? []).map(control => ({ ...control }));
}

const clamp = (n: number, min = 0, max = 255): number => Math.min(max, Math.max(min, n));
const luma = (r: number, g: number, b: number): number => r * 0.2126 + g * 0.7152 + b * 0.0722;
const quantize = (value: number, levels: number): number => Math.round(clamp(value) * (levels - 1) / 255) * 255 / (levels - 1);
type RGB = [number, number, number];
function parseColor(value: unknown, fallback: string): RGB {
  const text = typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value) ? value : fallback;
  const hex = text.length === 4 ? text.slice(1).split('').map(c => c + c).join('') : text.slice(1);
  const n = Number.parseInt(hex, 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function noise(x: number, y: number, seed: number): number {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ (seed | 0);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

/** Separable alpha-weighted box blur, O(width * height), independent of radius. */
function blur(data: Uint8ClampedArray, width: number, height: number, radius: number): Float32Array {
  const horizontal = new Float32Array(data.length);
  const result = new Float32Array(data.length);
  for (let y = 0; y < height; y++) {
    const sums = [0, 0, 0, 0];
    const add = (x: number, sign: number) => {
      if (x < 0 || x >= width) return;
      const i = (y * width + x) * 4, a = data[i + 3] / 255;
      for (let c = 0; c < 3; c++) sums[c] += sign * data[i + c] * a;
      sums[3] += sign * a;
    };
    for (let x = 0; x <= Math.min(radius, width - 1); x++) add(x, 1);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) horizontal[i + c] = sums[c];
      add(x - radius, -1); add(x + radius + 1, 1);
    }
  }
  for (let x = 0; x < width; x++) {
    const sums = [0, 0, 0, 0];
    const add = (y: number, sign: number) => {
      if (y < 0 || y >= height) return;
      const i = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) sums[c] += sign * horizontal[i + c];
    };
    for (let y = 0; y <= Math.min(radius, height - 1); y++) add(y, 1);
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) result[i + c] = sums[3] > 1e-6 ? sums[c] / sums[3] : data[i + c];
      add(y - radius, -1); add(y + radius + 1, 1);
    }
  }
  return result;
}

type Profile = { saturation?: number; contrast?: number; exposure?: number; tint?: RGB; fade?: number; grain?: number };
const PROFILES: Partial<Record<ImageFilterId, Profile>> = {
  bw: { saturation: 0, contrast: 20 }, 'high-contrast-bw': { saturation: 0, contrast: 70 }, grayscale: { saturation: 0 },
  vintage: { saturation: 72, contrast: 8, tint: [17, 5, -19], fade: 22, grain: 18 },
  washed: { saturation: 62, contrast: -20, exposure: 1.06, fade: 38 },
  faded: { saturation: 82, contrast: -10, fade: 48 },
  film: { saturation: 90, contrast: 22, tint: [5, 7, -6], fade: 10, grain: 25 },
  disposable: { saturation: 115, contrast: 32, tint: [8, 13, -10], fade: 16, grain: 42 },
  polaroid: { saturation: 78, contrast: 12, tint: [16, 5, -8], fade: 18, grain: 12 },
  cold: { tint: [-12, 3, 22] }, warm: { tint: [23, 6, -17] },
  muted: { saturation: 45 }, vibrant: { saturation: 155, contrast: 8 }, dark: { saturation: 90 },
  soft: { saturation: 92, contrast: -12, exposure: 1.03 }, dreamy: { saturation: 85, contrast: -10, tint: [9, 1, 10] },
  retro: { saturation: 125, contrast: 20, tint: [22, 9, -23], fade: 12, grain: 12 },
  y2k: { saturation: 140, contrast: 22, tint: [14, -8, 24] },
};
const THERMAL: RGB[] = [[8, 0, 38], [32, 24, 170], [0, 182, 219], [48, 224, 82], [255, 222, 0], [248, 35, 12], [255, 245, 233]];

/** Invalid geometry throws RangeError. Non-finite options use defaults; ranges clamp.
 * Colors accept #RGB / #RRGGBB. Unknown runtime IDs safely return an independent copy.
 * Seed defaults to 1337; textures are stable in reference coordinates at every resolution.
 */
export function applyImageFilter(data: Uint8ClampedArray, width: number, height: number, settings: ImageFilterSettings): Uint8ClampedArray {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 0 || height < 0 ||
      !Number.isSafeInteger(width * height * 4) || data.length !== width * height * 4) {
    throw new RangeError('Image dimensions must be nonnegative integers matching the RGBA buffer.');
  }
  const output = new Uint8ClampedArray(data);
  const id = settings.id;
  const intensity = (Number.isFinite(settings.intensity) ? clamp(settings.intensity!, 0, 100) : 100) / 100;
  if (!data.length || id === 'none' || intensity === 0 || !IMAGE_FILTERS.some(filter => filter.id === id)) return output;
  const controls = CONTROLS[id] ?? [];
  const number = (key: SettingKey, fallback: number, min: number, max: number): number => {
    const control = controls.find(c => c.key === key && c.type === 'range');
    const value = settings[key];
    return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) :
      control?.type === 'range' ? control.default : fallback;
  };
  const ink = (key: 'shadowColor' | 'midtoneColor' | 'highlightColor', fallback: string): RGB => {
    const control = controls.find(c => c.key === key && c.type === 'color');
    return parseColor(settings[key], control?.type === 'color' ? control.default : fallback);
  };
  const shadow = ink('shadowColor', '#182344'), midtone = ink('midtoneColor', '#ce597d'), highlight = ink('highlightColor', '#ffe6b0');
  const scale = Math.max(width, height) / 600;
  const seed = number('seed', 1337, -2147483648, 2147483647);
  const grain = number('grain', 0, 0, 100);
  const fade = number('fade', 0, 0, 100) / 100;
  const amount = number('amount', 50, 0, 100) / 100;
  const contrast = number('contrast', PROFILES[id]?.contrast ?? 0, 0, 100);
  const contrastFactor = 1 + contrast / 40;
  const detail = number('detail', 50, 0, 100) / 100;
  const levels = Math.round(number('colors', 5, 2, id === 'posterize' ? 16 : 12));
  const threshold = number('threshold', 128, 0, 255);
  const direction = number('direction', 0, -180, 180) * Math.PI / 180;
  const dx = Math.cos(direction), dy = Math.sin(direction);
  const separation = number('separation', 6, 0, 50) * scale;

  // Quantize before blending so cached full-effect blending is byte-for-byte equivalent.
  const pixel = new Uint8ClampedArray(3);
  const write = (i: number, r: number, g: number, b: number) => {
    if (!data[i + 3]) return;
    pixel[0] = r; pixel[1] = g; pixel[2] = b;
    for (let c = 0; c < 3; c++) output[i + c] = data[i + c] + (pixel[c] - data[i + c]) * intensity;
  };
  const palette = (i: number, t: number, a = shadow, b = highlight) => {
    t = clamp(t, 0, 1);
    write(i, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
  };
  // Bilinear, alpha-weighted samples avoid fringes from hidden RGB at transparent edges.
  const sample = (x: number, y: number, c: number, fallback: number): number => {
    x = clamp(x, 0, width - 1); y = clamp(y, 0, height - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(width - 1, x0 + 1), y1 = Math.min(height - 1, y0 + 1);
    const fx = x - x0, fy = y - y0;
    let sum = 0, weight = 0;
    for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
      const j = ((yy ? y1 : y0) * width + (xx ? x1 : x0)) * 4;
      const w = (xx ? fx : 1 - fx) * (yy ? fy : 1 - fy) * data[j + 3] / 255;
      sum += data[j + c] * w; weight += w;
    }
    return weight > 1e-6 ? sum / weight : fallback;
  };
  const lum = (x: number, y: number, fallback: number): number => {
    x = clamp(x, 0, width - 1); y = clamp(y, 0, height - 1);
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    let value = 0;
    for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
      const i = (Math.min(height - 1, y0 + yy) * width + Math.min(width - 1, x0 + xx)) * 4;
      const a = data[i + 3] / 255;
      value += (luma(data[i], data[i + 1], data[i + 2]) * a + fallback * (1 - a)) * (xx ? fx : 1 - fx) * (yy ? fy : 1 - fy);
    }
    return value;
  };
  const edgeStep = scale * 1.5;
  const edge = (x: number, y: number, center: number): number => {
    const s = edgeStep;
    const tl = lum(x - s, y - s, center), tc = lum(x, y - s, center), tr = lum(x + s, y - s, center);
    const ml = lum(x - s, y, center), mr = lum(x + s, y, center);
    const bl = lum(x - s, y + s, center), bc = lum(x, y + s, center), br = lum(x + s, y + s, center);
    return Math.hypot(-tl - 2 * ml - bl + tr + 2 * mr + br, -tl - 2 * tc - tr + bl + 2 * bc + br) / 4;
  };

  if (id === 'pixelate') {
    const size = Math.max(1, number('pixelSize', 18, 1, 100) * scale);
    // Reference-space boundaries retain the same block count in thumbnails and originals.
    for (let by = 0; by < Math.ceil(height / size); by++) for (let bx = 0; bx < Math.ceil(width / size); bx++) {
      const x0 = Math.round(bx * size), x1 = Math.min(width, Math.round((bx + 1) * size));
      const y0 = Math.round(by * size), y1 = Math.min(height, Math.round((by + 1) * size));
      let r = 0, g = 0, b = 0, weight = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4, a = data[i + 3];
        r += data[i] * a; g += data[i + 1] * a; b += data[i + 2] * a; weight += a;
      }
      if (weight) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) write((y * width + x) * 4, r / weight, g / weight, b / weight);
    }
    return output;
  }

  if (id === 'halftone' || id === 'newsprint') {
    const spacing = number('spacing', 12, 2, 60);
    const dotSize = number('dotSize', 12, 1, 40);
    const angle = number('angle', 45, -180, 180) * Math.PI / 180;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const cells = new Map<number, { sum: number; weight: number }>();
    // Rotated coordinates lie within +/-849 at this reference size; integer keys are unique.
    const key = (u: number, v: number) => (Math.floor(u / spacing) + 1024) * 2048 + Math.floor(v / spacing) + 1024;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!data[i + 3]) continue;
      const u = ((x + 0.5) * cos + (y + 0.5) * sin) / scale;
      const v = (-(x + 0.5) * sin + (y + 0.5) * cos) / scale;
      const k = key(u, v), cell = cells.get(k) ?? { sum: 0, weight: 0 };
      cell.sum += luma(data[i], data[i + 1], data[i + 2]) * data[i + 3]; cell.weight += data[i + 3];
      cells.set(k, cell);
    }
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!data[i + 3]) continue;
      const u = ((x + 0.5) * cos + (y + 0.5) * sin) / scale;
      const v = (-(x + 0.5) * sin + (y + 0.5) * cos) / scale;
      const cell = cells.get(key(u, v))!;
      const darkness = 1 - cell.sum / cell.weight / 255;
      const radius = spacing * Math.sqrt(darkness / Math.PI) * dotSize / spacing;
      const distance = Math.hypot(u - (Math.floor(u / spacing) + 0.5) * spacing, v - (Math.floor(v / spacing) + 0.5) * spacing);
      const coverage = darkness <= 0 ? 0 : clamp((radius - distance) * scale + 0.5, 0, 1);
      const paperGrain = id === 'newsprint' ? (noise(Math.floor((x + 0.5) / scale), Math.floor((y + 0.5) / scale), seed) - 0.5) * grain / 500 : 0;
      palette(i, 1 - coverage - paperGrain);
    }
    return output;
  }

  const blurDistance = scale * (id === 'dreamy' ? 7 : 3);
  const blurRadius = Math.max(1, Math.ceil(blurDistance));
  const blurred = id === 'soft' || id === 'dreamy' ? blur(data, width, height, blurRadius) : undefined;
  const profile = PROFILES[id];
  const saturation = number('saturation', profile?.saturation ?? 100, 0, 200) / 100;
  const profileContrast = settings.contrast === undefined || !Number.isFinite(settings.contrast) ? profile?.contrast ?? 0 : contrast;
  const toneFactor = 1 + profileContrast / 100;
  const tint = profile?.tint ?? [0, 0, 0];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (!data[i + 3]) continue;
    let r = data[i], g = data[i + 1], b = data[i + 2];
    const light = luma(r, g, b);
    const rx = (x + 0.5) / scale, ry = (y + 0.5) / scale;
    const random = noise(Math.floor(rx), Math.floor(ry), seed) - 0.5;
    if (profile) {
      r = light + (r - light) * saturation; g = light + (g - light) * saturation; b = light + (b - light) * saturation;
      const exposure = id === 'dark' ? 1 - amount * 0.85 : profile.exposure ?? 1;
      const tintStrength = id === 'cold' || id === 'warm' ? amount / 0.55 : 1;
      const tone = (v: number, c: number) => (((v - 127.5) * toneFactor + 127.5) * exposure + tint[c] * tintStrength) * (1 - fade * 0.6) + fade * 65 + random * grain * 0.65;
      r = tone(r, 0); g = tone(g, 1); b = tone(b, 2);
      if (blurred) {
        const mix = amount * 0.65;
        const glow = (v: number, c: number) => {
          const softened = data[i + c] + (blurred[i + c] - data[i + c]) * blurDistance / blurRadius;
          return id === 'dreamy' ? v + (255 - v) * softened / 255 * mix : v * (1 - mix) + softened * mix;
        };
        r = glow(r, 0); g = glow(g, 1); b = glow(b, 2);
      }
      if (id === 'disposable' || id === 'polaroid') {
        const nx = (x + 0.5 - width / 2) / Math.max(width, height), ny = (y + 0.5 - height / 2) / Math.max(width, height);
        const vignette = 1 - (nx * nx + ny * ny) * (id === 'disposable' ? 0.75 : 0.4);
        r *= vignette; g *= vignette; b *= vignette;
      }
    } else switch (id) {
      case 'sepia':
        r = data[i] * 0.393 + data[i + 1] * 0.769 + data[i + 2] * 0.189;
        g = data[i] * 0.349 + data[i + 1] * 0.686 + data[i + 2] * 0.168;
        b = data[i] * 0.272 + data[i + 1] * 0.534 + data[i + 2] * 0.131;
        break;
      case 'invert': r = 255 - r; g = 255 - g; b = 255 - b; break;
      case 'threshold': r = g = b = light >= threshold ? 255 : 0; break;
      case 'posterize': r = quantize(r, levels); g = quantize(g, levels); b = quantize(b, levels); break;
      case 'duotone': palette(i, light / 255); continue;
      case 'tritone':
        if (light <= 127.5) palette(i, light / 127.5, shadow, midtone);
        else palette(i, (light - 127.5) / 127.5, midtone, highlight);
        continue;
      case 'thermal': {
        const t = light / 255 * (THERMAL.length - 1), index = Math.min(THERMAL.length - 2, Math.floor(t));
        palette(i, t - index, THERMAL[index], THERMAL[index + 1]); continue;
      }
      case 'comic': {
        const e = edge(x, y, light);
        const inkStrength = detail === 0 ? 0 : clamp((e - (85 - detail * 70)) / 30, 0, 1);
        r = quantize((r - 127.5) * contrastFactor + 127.5, levels) * (1 - inkStrength);
        g = quantize((g - 127.5) * contrastFactor + 127.5, levels) * (1 - inkStrength);
        b = quantize((b - 127.5) * contrastFactor + 127.5, levels) * (1 - inkStrength);
        break;
      }
      case 'photocopy':
        r = g = b = (light - 127.5) * contrastFactor + 127.5 - edge(x, y, light) * detail + random * grain * 1.5 >= threshold ? 255 : 0;
        break;
      case 'screen-print': {
        const neighbor = (lum(x - edgeStep, y, light) + lum(x + edgeStep, y, light) + lum(x, y - edgeStep, light) + lum(x, y + edgeStep, light)) / 4;
        const tone = (light - 127.5) * contrastFactor + 127.5 + (light - neighbor) * detail * 4;
        palette(i, quantize(tone, levels) / 255); continue;
      }
      case 'emboss': {
        const distance = scale * 2;
        const difference = lum(x + dx * distance, y + dy * distance, light) - lum(x - dx * distance, y - dy * distance, light);
        r = g = b = 128 + difference * amount * 4; break;
      }
      case 'chromatic':
      case 'glitch': {
        let shift = 0;
        if (id === 'glitch') {
          const strip = Math.floor(ry / 9);
          if (noise(strip, 71, seed) < 0.65) shift = (noise(strip, 29, seed) - 0.5) * amount * 100 * scale;
        }
        const sx = x + dx * shift, sy = y + dy * shift;
        r = sample(sx + dx * separation, sy + dy * separation, 0, r);
        g = sample(sx, sy, 1, g);
        b = sample(sx - dx * separation, sy - dy * separation, 2, b);
        break;
      }
    }
    write(i, r, g, b);
  }
  return output;
}
