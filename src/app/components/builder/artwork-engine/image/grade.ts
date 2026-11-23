/**
 * Non-destructive image grade: levels, curves, per-colour HSL, vibrance, clarity, noise reduction and gradient map.
 * The original file is never changed; every value stays editable and the grade can be switched off.
 */
export type CurvePoint = { x: number; y: number };
export type CurveChannel = 'rgb' | 'r' | 'g' | 'b';
export const HUE_BANDS = [
  { id: 'red', label: 'Red', hue: 0, swatch: '#e5383b' }, { id: 'orange', label: 'Orange', hue: 30, swatch: '#f48c2f' },
  { id: 'yellow', label: 'Yellow', hue: 58, swatch: '#f6d02f' }, { id: 'green', label: 'Green', hue: 120, swatch: '#3fae49' },
  { id: 'aqua', label: 'Aqua', hue: 180, swatch: '#2fc1c9' }, { id: 'blue', label: 'Blue', hue: 225, swatch: '#2f6fed' },
  { id: 'purple', label: 'Purple', hue: 275, swatch: '#8b4fe0' }, { id: 'magenta', label: 'Magenta', hue: 320, swatch: '#e03fa8' },
] as const;
export type HueBand = typeof HUE_BANDS[number]['id'];
export type BandShift = { h?: number; s?: number; l?: number };
export type GradientMap = { stops: { position: number; color: string }[]; amount: number };
export type ImageGrade = {
  enabled?: boolean;
  black?: number; mid?: number; white?: number;
  curves?: Partial<Record<CurveChannel, CurvePoint[]>>;
  hsl?: Partial<Record<HueBand, BandShift>>;
  vibrance?: number; clarity?: number; denoise?: number;
  map?: GradientMap;
};

export const GRADIENT_MAPS: { id: string; label: string; stops: GradientMap['stops'] }[] = [
  { id: 'ink', label: 'Ink', stops: [{ position: 0, color: '#10131c' }, { position: 100, color: '#f6f1e3' }] },
  { id: 'sunset', label: 'Sunset', stops: [{ position: 0, color: '#23104a' }, { position: 50, color: '#e8467c' }, { position: 100, color: '#ffd27a' }] },
  { id: 'ocean', label: 'Ocean', stops: [{ position: 0, color: '#04162e' }, { position: 55, color: '#1f7f9c' }, { position: 100, color: '#dff6ee' }] },
  { id: 'acid', label: 'Acid', stops: [{ position: 0, color: '#150a2e' }, { position: 50, color: '#16c47f' }, { position: 100, color: '#f3ff5a' }] },
  { id: 'rust', label: 'Rust', stops: [{ position: 0, color: '#1c0d08' }, { position: 55, color: '#b4471f' }, { position: 100, color: '#f7dfb8' }] },
  { id: 'chrome', label: 'Chrome', stops: [{ position: 0, color: '#12151b' }, { position: 45, color: '#8ea3bb' }, { position: 62, color: '#20262f' }, { position: 100, color: '#ffffff' }] },
];

const clamp = (v: number, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, v));
const isFlatCurve = (points?: CurvePoint[]) => !points || points.length < 2 || points.every(p => Math.abs(p.x - p.y) < .5);

export function gradeIsActive(grade?: ImageGrade): grade is ImageGrade {
  if (!grade || grade.enabled === false) return false;
  const shifted = Object.values(grade.hsl ?? {}).some(band => band && (band.h || band.s || band.l));
  return Boolean((grade.black ?? 0) > 0 || (grade.white ?? 255) < 255 || grade.mid !== undefined || Object.values(grade.curves ?? {}).some(c => !isFlatCurve(c)) || shifted || grade.vibrance || grade.clarity || grade.denoise || (grade.map && grade.map.amount > 0));
}

/** Monotone cubic through the points, so a curve never overshoots or folds back. */
export function curveTable(points: CurvePoint[]): Uint8ClampedArray {
  const row = [...points].sort((a, b) => a.x - b.x).filter((p, i, list) => !i || p.x > list[i - 1].x), table = new Uint8ClampedArray(256), n = row.length;
  if (n < 2) { for (let i = 0; i < 256; i++) table[i] = n ? row[0].y : i; return table; }
  const delta = row.slice(1).map((p, i) => (p.y - row[i].y) / (p.x - row[i].x)), slope = row.map((_, i) => !i ? delta[0] : i === n - 1 ? delta[n - 2] : delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2);
  for (let i = 0; i < n - 1; i++) {
    if (!delta[i]) { slope[i] = slope[i + 1] = 0; continue; }
    const a = slope[i] / delta[i], b = slope[i + 1] / delta[i], size = Math.hypot(a, b);
    if (size > 3) { slope[i] = 3 * a / size * delta[i]; slope[i + 1] = 3 * b / size * delta[i]; }
  }
  let span = 0;
  for (let x = 0; x < 256; x++) {
    if (x <= row[0].x) { table[x] = row[0].y; continue; }
    if (x >= row[n - 1].x) { table[x] = row[n - 1].y; continue; }
    while (x > row[span + 1].x) span++;
    const a = row[span], b = row[span + 1], h = b.x - a.x, t = (x - a.x) / h, t2 = t * t, t3 = t2 * t;
    table[x] = Math.round(clamp((2 * t3 - 3 * t2 + 1) * a.y + (t3 - 2 * t2 + t) * h * slope[span] + (-2 * t3 + 3 * t2) * b.y + (t3 - t2) * h * slope[span + 1]));
  }
  return table;
}

function levelsTable(grade: ImageGrade) {
  const black = clamp(grade.black ?? 0, 0, 253), white = clamp(grade.white ?? 255, black + 2, 255), span = white - black, table = new Uint8ClampedArray(256);
  const middle = grade.mid === undefined ? .5 : clamp((grade.mid - black) / span, .02, .98), gamma = grade.mid === undefined ? 1 : Math.log(.5) / Math.log(middle);
  for (let i = 0; i < 256; i++) table[i] = Math.round(255 * clamp((i - black) / span, 0, 1) ** gamma);
  return table;
}
const hexRgb = (value: string): [number, number, number] => /^#[\da-f]{6}$/i.test(value) ? [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)] : [0, 0, 0];
function mapTable(map: GradientMap) {
  const stops = [...map.stops].sort((a, b) => a.position - b.position).map(s => ({ t: s.position / 100, rgb: hexRgb(s.color) })), table = new Uint8ClampedArray(768);
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let k = 1;
    while (k < stops.length - 1 && t > stops[k].t) k++;
    const a = stops[Math.max(0, k - 1)], b = stops[Math.min(stops.length - 1, k)], f = b.t > a.t ? clamp((t - a.t) / (b.t - a.t), 0, 1) : 0;
    for (let c = 0; c < 3; c++) table[i * 3 + c] = a.rgb[c] + (b.rgb[c] - a.rgb[c]) * f;
  }
  return table;
}
function boxBlur(source: Float32Array, w: number, h: number, r: number) {
  const across = new Float32Array(source.length), out = new Float32Array(source.length);
  for (let y = 0; y < h; y++) {
    let sum = 0, count = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) { sum += source[y * w + x]; count++; }
    for (let x = 0; x < w; x++) {
      across[y * w + x] = sum / count;
      if (x - r >= 0) { sum -= source[y * w + x - r]; count--; }
      if (x + r + 1 < w) { sum += source[y * w + x + r + 1]; count++; }
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0, count = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) { sum += across[y * w + x]; count++; }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / count;
      if (y - r >= 0) { sum -= across[(y - r) * w + x]; count--; }
      if (y + r + 1 < h) { sum += across[(y + r + 1) * w + x]; count++; }
    }
  }
  return out;
}
const lumaOf = (d: Uint8ClampedArray, i: number) => d[i] * .2126 + d[i + 1] * .7152 + d[i + 2] * .0722;
function lumaField(data: Uint8ClampedArray, w: number, h: number) {
  const field = new Float32Array(w * h);
  for (let j = 0; j < field.length; j++) field[j] = lumaOf(data, j * 4);
  return field;
}
function toHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1) || 1), hue = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, s, l];
}
function fromHsl(h: number, s: number, l: number, out: Uint8ClampedArray, i: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2, k = Math.floor(((h % 360) + 360) % 360 / 60);
  const [r, g, b] = k === 0 ? [c, x, 0] : k === 1 ? [x, c, 0] : k === 2 ? [0, c, x] : k === 3 ? [0, x, c] : k === 4 ? [x, 0, c] : [c, 0, x];
  out[i] = (r + m) * 255; out[i + 1] = (g + m) * 255; out[i + 2] = (b + m) * 255;
}

export function applyImageGrade(data: Uint8ClampedArray, w: number, h: number, grade?: ImageGrade): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data);
  if (!gradeIsActive(grade) || !w || !h) return out;
  const reach = Math.max(w, h) / 600;
  if (grade.denoise) {
    const strength = clamp(grade.denoise, 0, 100) / 100, radius = Math.max(1, Math.round((1 + strength * 2) * reach)), sigma = 10 + strength * 42, channels = [0, 1, 2].map(c => { const f = new Float32Array(w * h); for (let j = 0; j < f.length; j++) f[j] = out[j * 4 + c]; return boxBlur(f, w, h, radius); });
    for (let j = 0; j < w * h; j++) {
      const i = j * 4, diff = Math.hypot(out[i] - channels[0][j], out[i + 1] - channels[1][j], out[i + 2] - channels[2][j]), keep = Math.exp(-(diff * diff) / (2 * sigma * sigma)) * strength;
      for (let c = 0; c < 3; c++) out[i + c] += (channels[c][j] - out[i + c]) * keep;
    }
  }
  const levels = (grade.black ?? 0) > 0 || (grade.white ?? 255) < 255 || grade.mid !== undefined ? levelsTable(grade) : null;
  const curve = (key: CurveChannel) => isFlatCurve(grade.curves?.[key]) ? null : curveTable(grade.curves![key]!), master = curve('rgb'), channelCurves = [curve('r'), curve('g'), curve('b')];
  if (levels || master || channelCurves.some(Boolean)) for (let i = 0; i < out.length; i += 4) for (let c = 0; c < 3; c++) {
    let v = out[i + c];
    if (levels) v = levels[v];
    if (master) v = master[v];
    const own = channelCurves[c];
    if (own) v = own[v];
    out[i + c] = v;
  }
  const bands = HUE_BANDS.map(band => ({ hue: band.hue as number, shift: grade.hsl?.[band.id] })).filter(b => b.shift && (b.shift.h || b.shift.s || b.shift.l)), vibrance = (grade.vibrance ?? 0) / 100;
  if (bands.length || vibrance) for (let i = 0; i < out.length; i += 4) {
    if (!out[i + 3]) continue;
    let [hue, sat, light] = toHsl(out[i], out[i + 1], out[i + 2]), dh = 0, ds = 0, dl = 0;
    for (const band of bands) {
      let distance = Math.abs(hue - band.hue); if (distance > 180) distance = 360 - distance;
      if (distance >= 45) continue;
      const t = 1 - distance / 45, weight = t * t * (3 - 2 * t);
      dh += (band.shift!.h ?? 0) * weight; ds += (band.shift!.s ?? 0) * weight; dl += (band.shift!.l ?? 0) * weight;
    }
    hue += dh;
    sat = clamp(sat * (1 + ds / 100), 0, 1);
    if (vibrance) sat = clamp(sat + (vibrance > 0 ? (1 - sat) * sat * vibrance * 1.4 : sat * vibrance), 0, 1);
    if (dl) light = clamp(light + dl / 100 * .5 * Math.min(1, sat * 3), 0, 1);
    fromHsl(hue, sat, light, out, i);
  }
  if (grade.clarity) {
    const amount = clamp(grade.clarity, -100, 100) / 100, luma = lumaField(out, w, h), soft = boxBlur(boxBlur(luma, w, h, Math.max(2, Math.round(10 * reach))), w, h, Math.max(1, Math.round(6 * reach)));
    for (let j = 0; j < w * h; j++) {
      const i = j * 4, mid = 1 - Math.abs(luma[j] / 127.5 - 1) ** 2, lift = (luma[j] - soft[j]) * amount * 1.6 * (.25 + mid * .75);
      for (let c = 0; c < 3; c++) out[i + c] = clamp(out[i + c] + lift);
    }
  }
  if (grade.map && grade.map.amount > 0 && grade.map.stops.length >= 2) {
    const table = mapTable(grade.map), amount = clamp(grade.map.amount, 0, 100) / 100;
    for (let i = 0; i < out.length; i += 4) {
      const v = Math.round(lumaOf(out, i)) * 3;
      for (let c = 0; c < 3; c++) out[i + c] += (table[v + c] - out[i + c]) * amount;
    }
  }
  for (let i = 3; i < out.length; i += 4) out[i] = data[i];
  return out;
}

export function imageHistogram(data: Uint8ClampedArray) {
  const counts = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] > 8) counts[Math.round(lumaOf(data, i))]++;
  return counts;
}
/** Sets black and white from the image itself, ignoring the outer 0.5% of pixels. */
export function autoLevels(counts: Uint32Array) {
  const total = counts.reduce((sum, value) => sum + value, 0), clip = total * .005;
  let black = 0, white = 255, seen = 0;
  while (black < 254 && seen + counts[black] <= clip) seen += counts[black++];
  seen = 0;
  while (white > black + 1 && seen + counts[white] <= clip) seen += counts[white--];
  return { black, white };
}
