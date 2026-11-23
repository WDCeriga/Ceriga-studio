import { canvasPaint } from './studioPaint';
import { applyBrushDynamics, brushDynamicsActive } from './brushDynamics';

/**
 * 3D and contour brushes. Strokes become one height surface, lit by a movable light, so crossing strokes fuse
 * into a single form. The recorded points stay untouched, which is what makes a drawing restylable.
 */
export type VolumeCap = 'sharp' | 'round' | 'bulb';
export type VolumeSettings = {
  volumeDepth: number; volumeLight: number; volumeElevation: number; volumeGloss: number; volumeDetail: number;
  volumeOutline: number; volumeCreases: number; volumeShadow: number; volumePaper: string; volumePaperOn: boolean; volumeMerge: boolean;
  capStart: VolumeCap; capEnd: VolumeCap;
};
export const VOLUME_DEFAULTS: VolumeSettings = {
  volumeDepth: 100, volumeLight: 225, volumeElevation: 48, volumeGloss: 35, volumeDetail: 100, volumeOutline: 0, volumeCreases: 0,
  volumeShadow: 0, volumePaper: '#ffffff', volumePaperOn: true, volumeMerge: true, capStart: 'round', capEnd: 'round',
};
export const VOLUME_BRUSHES = [
  { id: 'inflate', label: 'Inflate', size: 34, settings: { volumeGloss: 28 } },
  { id: 'balloon', label: 'Balloon', size: 34, settings: { volumeGloss: 85, volumeElevation: 55, capStart: 'bulb', capEnd: 'bulb' } },
  { id: 'puffy-paint', label: 'Puffy Paint', size: 22, settings: { volumeDepth: 62, volumeGloss: 24, volumeDetail: 90, volumeShadow: 30 } },
  { id: 'clay', label: 'Clay', size: 32, settings: { volumeDepth: 85, volumeGloss: 12, volumeCreases: 30 } },
  { id: 'icing', label: 'Icing', size: 30, settings: { volumeDepth: 90, volumeGloss: 42, volumeShadow: 18 } },
  { id: 'yarn', label: 'Fuzzy Yarn', size: 28, settings: { volumeDepth: 80, volumeGloss: 0, volumeDetail: 90 } },
  { id: 'chrome-tube', label: 'Chrome Tube', size: 32, settings: { volumeGloss: 80 } },
  { id: 'gold-tube', label: 'Gold Tube', size: 32, settings: { volumeGloss: 70 } },
  { id: 'neon-tube', label: 'Neon Tube', size: 14, settings: { volumeShadow: 60, volumeGloss: 0 } },
  { id: 'glass-gel', label: 'Glass Gel', size: 32, settings: { volumeGloss: 90, volumeElevation: 58 } },
  { id: 'stipple-tube', label: 'Stipple Tube', size: 34, settings: { volumeOutline: 18, volumeDetail: 100, volumeElevation: 38 } },
  { id: 'halftone-tube', label: 'Halftone Tube', size: 34, settings: { volumeOutline: 10, volumeDetail: 120, volumeElevation: 40 } },
  { id: 'hatch-tube', label: 'Engraved Tube', size: 34, settings: { volumeOutline: 12, volumeDetail: 110, volumeElevation: 40 } },
  { id: 'halo-line', label: 'Halo Line', size: 26, settings: { volumeDepth: 90, volumeOutline: 12 } },
  { id: 'hairline', label: 'Hairline', size: 24, settings: { volumeOutline: 24, volumePaperOn: false } },
  { id: 'double-line', label: 'Double Line', size: 26, settings: { volumeOutline: 24, volumeDepth: 55, volumePaperOn: false } },
] as const satisfies readonly { id: string; label: string; size: number; settings: Partial<VolumeSettings> }[];
export type VolumeBrushId = typeof VOLUME_BRUSHES[number]['id'];
const IDS = new Set<string>(VOLUME_BRUSHES.map(item => item.id));
export const isVolumeBrush = (id: string): id is VolumeBrushId => IDS.has(id);
const INKED = new Set(['stipple-tube', 'halftone-tube', 'hatch-tube', 'halo-line', 'hairline', 'double-line']);
export const volumeUsesPaper = (id: string) => INKED.has(id);
export const volumeUsesLight = (id: string) => !['halo-line', 'hairline', 'double-line', 'neon-tube'].includes(id);

type Rgb = [number, number, number];
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const fract = (v: number) => v - Math.floor(v);
const num = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const hex = (value: unknown, fallback: Rgb = [0, 0, 0]): Rgb => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)] : fallback;
const metal = (values: string[]): [number, Rgb][] => values.map((value, i) => [i / (values.length - 1), hex(value)]);
const CHROME: [number, Rgb][] = [[0, hex('#fafdff')], [.3, hex('#b5cbe3')], [.46, hex('#4f6887')], [.5, hex('#0d1119')], [.54, hex('#f2e8da')], [.74, hex('#8f7e6e')], [.9, hex('#3f3935')], [1, hex('#ececec')]];
const GOLD = metal(['#3f2607', '#8d5f17', '#d9a53a', '#ffe9a3', '#fffbe6', '#c98f2c', '#6b440f']);
function ramp(stops: [number, Rgb][], t: number): Rgb {
  t = clamp(t);
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i], f = (t - a) / Math.max(1e-5, b - a), s = f * f * (3 - 2 * f);
    return [ca[0] + (cb[0] - ca[0]) * s, ca[1] + (cb[1] - ca[1]) * s, ca[2] + (cb[2] - ca[2]) * s];
  }
  return stops[stops.length - 1][1];
}
function hash(x: number, y: number, seed: number) {
  let n = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (hash(ix, iy, seed) * (1 - u) + hash(ix + 1, iy, seed) * u) * (1 - v) + (hash(ix, iy + 1, seed) * (1 - u) + hash(ix + 1, iy + 1, seed) * u) * v;
}
const fbm = (x: number, y: number, seed: number) => noise(x, y, seed) * .55 + noise(x * 2.1, y * 2.1, seed + 1) * .3 + noise(x * 4.3, y * 4.3, seed + 2) * .15;

/** Exact Euclidean distance to the nearest pixel outside the form. */
export function insideDistance(mask: Float32Array, w: number, h: number) {
  const BIG = 1e12, field = new Float64Array(w * h), size = Math.max(w, h), f = new Float64Array(size), d = new Float64Array(size), v = new Int32Array(size), z = new Float64Array(size + 1);
  for (let i = 0; i < field.length; i++) field[i] = mask[i] > .5 ? BIG : 0;
  const pass = (n: number) => {
    let k = 0; v[0] = 0; z[0] = -BIG; z[1] = BIG;
    for (let q = 1; q < n; q++) {
      let s = 0;
      while (true) { const p = v[k]; s = (f[q] + q * q - f[p] - p * p) / (2 * q - 2 * p); if (s <= z[k] && k > 0) k--; else break; }
      if (s <= z[k]) { v[k] = q; z[k + 1] = BIG; continue; }
      k++; v[k] = q; z[k] = s; z[k + 1] = BIG;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
  };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = field[y * w + x]; pass(h); for (let y = 0; y < h; y++) field[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = field[y * w + x]; pass(w); for (let x = 0; x < w; x++) field[y * w + x] = d[x]; }
  const out = new Float32Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = Math.sqrt(field[i]);
  return out;
}
function boxBlur(source: Float32Array, w: number, h: number, r: number) {
  if (r < 1) return source.slice();
  const across = new Float32Array(source.length), out = new Float32Array(source.length), span = 2 * r + 1;
  for (let y = 0; y < h; y++) { let sum = 0; for (let x = -r; x <= r; x++) sum += source[y * w + clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { across[y * w + x] = sum / span; sum += source[y * w + Math.min(w - 1, x + r + 1)] - source[y * w + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let sum = 0; for (let y = -r; y <= r; y++) sum += across[clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = sum / span; sum += across[Math.min(h - 1, y + r + 1) * w + x] - across[Math.max(0, y - r) * w + x]; } }
  return out;
}
/** Local tube radius: the largest inside distance nearby, so thin tapers stay as round as thick sections. */
function localRadius(distance: Float32Array, w: number, h: number, r: number) {
  const line = new Float32Array(Math.max(w, h)), queue = new Int32Array(Math.max(w, h)), a = new Float32Array(distance.length), out = new Float32Array(distance.length);
  const sweep = (n: number, read: (i: number) => number, write: (i: number, v: number) => void) => {
    for (let i = 0; i < n; i++) line[i] = read(i);
    let head = 0, tail = 0, next = 0;
    for (let i = 0; i < n; i++) {
      while (next < n && next <= i + r) { while (tail > head && line[queue[tail - 1]] <= line[next]) tail--; queue[tail++] = next++; }
      while (queue[head] < i - r) head++;
      write(i, line[queue[head]]);
    }
  };
  for (let y = 0; y < h; y++) sweep(w, x => distance[y * w + x], (x, v) => { a[y * w + x] = v; });
  for (let x = 0; x < w; x++) sweep(h, y => a[y * w + x], (y, v) => { out[y * w + x] = v; });
  return boxBlur(out, w, h, Math.max(1, Math.round(r * .3)));
}

export type VolumeOptions = VolumeSettings & { color?: string };
/** Shade a coverage mask into RGBA. `base` is one colour or an RGBA buffer the size of the mask. */
export function shadeVolume(style: VolumeBrushId, mask: Float32Array, w: number, h: number, radius: number, o: VolumeSettings, base: Rgb | Uint8ClampedArray, seed: number, scale: number) {
  const out = new Uint8ClampedArray(w * h * 4), distance = insideDistance(mask, w, h), reach = Math.max(1, Math.ceil(radius)), local = localRadius(distance, w, h, reach);
  const azimuth = num(o.volumeLight, 225) * Math.PI / 180, elevation = clamp(num(o.volumeElevation, 48), 5, 88) * Math.PI / 180, lx = Math.cos(azimuth) * Math.cos(elevation), ly = Math.sin(azimuth) * Math.cos(elevation), lz = Math.sin(elevation);
  const hl = Math.hypot(lx, ly, lz + 1), hx = lx / hl, hy = ly / hl, hz = (lz + 1) / hl, gloss = clamp(num(o.volumeGloss, 35) / 100), detail = Math.max(.2, num(o.volumeDetail, 100) / 100), depth = clamp(num(o.volumeDepth, 100), 5, 220) / 100, outline = clamp(num(o.volumeOutline, 0) / 100), creases = clamp(num(o.volumeCreases, 0) / 100), shadow = clamp(num(o.volumeShadow, 0) / 100);
  const unit = scale * detail, paper: Rgb | null = o.volumePaperOn === false ? null : hex(o.volumePaper, [255, 255, 255]), single = base instanceof Uint8ClampedArray ? null : base as Rgb, buffer = single ? null : base as Uint8ClampedArray;
  let surface = new Float32Array(w * h);
  for (let i = 0; i < surface.length; i++) {
    if (distance[i] <= 0) continue;
    const r = Math.max(.75, local[i]), t = clamp(distance[i] / r), x = i % w, y = (i - x) / w;
    let z = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))) * r * depth;
    if (creases) z += (fbm(x / (radius * 1.5), y / (radius * 1.5), seed + 40) - .5) * radius * creases * .75;
    if (style === 'puffy-paint') z += (fbm(x / (5.5 * unit), y / (5.5 * unit), seed) - .5) * 3.2 * scale * detail * Math.min(1, t * 2.4);
    else if (style === 'clay') z += ((fbm(x / (9 * unit), y / (9 * unit), seed) - .5) * 4.2 + Math.sin((x * .7 + y * .4 + noise(x / (14 * unit), y / (14 * unit), seed + 5) * 22 * unit) / (1.15 * unit)) * .16) * scale * detail;
    else if (style === 'icing') z += Math.sin(distance[i] / (2.5 * unit) * Math.PI) * 1.5 * scale * detail * Math.min(1, t * 3);
    else if (style === 'yarn') z += (hash(Math.floor(x / (1.1 * scale)), Math.floor(y / (1.1 * scale)), seed) - .5) * 2.5 * scale + (fbm(x / (2.4 * unit), y / (9 * unit), seed + 9) - .5) * 5 * scale;
    surface[i] = z;
  }
  const smoothing = ['puffy-paint', 'clay', 'icing', 'yarn'].includes(style) ? Math.max(1, Math.round(.5 * scale)) : Math.max(1, Math.round(radius * (style === 'chrome-tube' || style === 'gold-tube' ? .16 : .07)));
  surface = boxBlur(boxBlur(surface, w, h, smoothing), w, h, Math.max(1, Math.round(smoothing * .6)));
  const dot = 2 * unit, screen = 4.6 * unit, cos45 = Math.SQRT1_2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const j = y * w + x, m = mask[j];
    if (m <= 0) continue;
    const i = j * 4, d = distance[j], r = Math.max(.75, local[j]), rel = clamp(d / r);
    const zl = surface[y * w + Math.max(0, x - 1)], zr = surface[y * w + Math.min(w - 1, x + 1)], zu = surface[Math.max(0, y - 1) * w + x], zd = surface[Math.min(h - 1, y + 1) * w + x];
    let nx = (zl - zr) / 2, ny = (zu - zd) / 2, nz = 1;
    const size = Math.hypot(nx, ny, nz); nx /= size; ny /= size; nz /= size;
    const diffuse = Math.max(0, nx * lx + ny * ly + nz * lz), halfway = Math.max(0, nx * hx + ny * hy + nz * hz);
    const ink: Rgb = single ?? [buffer![i], buffer![i + 1], buffer![i + 2]];
    let cr = ink[0], cg = ink[1], cb = ink[2], alpha = m;
    const lit = (level: number) => { if (level <= 1) { cr *= level; cg *= level; cb *= level; } else { const t = clamp(level - 1); cr += (255 - cr) * t; cg += (255 - cg) * t; cb += (255 - cb) * t; } };
    const glow = (amount: number) => { const t = clamp(amount); cr += (255 - cr) * t; cg += (255 - cg) * t; cb += (255 - cb) * t; };
    const inked = (cover: number) => { if (paper) { cr = paper[0] + (ink[0] - paper[0]) * cover; cg = paper[1] + (ink[1] - paper[1]) * cover; cb = paper[2] + (ink[2] - paper[2]) * cover; } else alpha = m * cover; };
    switch (style) {
      case 'inflate': lit(.36 + diffuse * .84); glow(halfway ** 26 * gloss * .9); break;
      case 'balloon': lit(.46 + diffuse * .66); glow(halfway ** 90 * gloss * 1.25 + halfway ** 14 * gloss * .16 + (1 - nz) ** 3 * .28); break;
      case 'puffy-paint': lit(.56 + diffuse * .6); glow(halfway ** 16 * gloss * .55); break;
      case 'clay': lit(.5 + diffuse * .62); glow(halfway ** 10 * gloss * .4); break;
      case 'icing': lit(.54 + diffuse * .6); glow(halfway ** 34 * gloss * .8); break;
      case 'yarn': lit(.5 + diffuse * .66); alpha = m * clamp(rel * 5 + (hash(Math.floor(x / scale), Math.floor(y / scale), seed + 3) - .3) * 1.1); break;
      case 'chrome-tube': case 'gold-tube': {
        const rx = 2 * nz * nx, ry = 2 * nz * ny, tone = ramp(style === 'gold-tube' ? GOLD : CHROME, .5 + ry * .47 + rx * .08);
        cr = tone[0]; cg = tone[1]; cb = tone[2]; glow(halfway ** 60 * gloss); break;
      }
      case 'neon-tube': glow(rel ** 1.6 * .94); break;
      case 'glass-gel': {
        const edge = (1 - nz) ** 1.4; lit(.78 + diffuse * .34); alpha = m * clamp(.46 + edge * .72);
        const spark = halfway ** 120 * gloss * 1.4 + halfway ** 18 * gloss * .12; glow(spark); alpha = Math.max(alpha, m * clamp(spark)); break;
      }
      case 'stipple-tube': {
        const tone = Math.max(clamp((1 - diffuse) * 1.62 - .16) ** 1.15, (1 - nz) ** 1.15 * .92), gx = Math.floor(x / dot), gy = Math.floor(y / dot); let cover = 0;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const cx = gx + ox, cy = gy + oy; if (hash(cx, cy, seed + 29) > tone) continue; const px = (cx + hash(cx, cy, seed)) * dot, py = (cy + hash(cx, cy, seed + 13)) * dot; cover = Math.max(cover, clamp(dot * (.3 + hash(cx, cy, seed + 31) * .14) + .5 - Math.hypot(x - px, y - py))); }
        inked(Math.max(cover, d < outline * radius * .9 ? 1 : 0)); break;
      }
      case 'halftone-tube': {
        const tone = clamp((1 - diffuse) * 1.2 - .06), u = (x + y) * cos45 / screen, v = (y - x) * cos45 / screen, value = Math.hypot(fract(u) - .5, fract(v) - .5) / Math.SQRT1_2;
        inked(Math.max(clamp((Math.sqrt(tone) - value) * screen * .7 + .5), d < outline * radius * .9 ? 1 : 0)); break;
      }
      case 'hatch-tube': {
        const tone = clamp((1 - diffuse) * 1.22 - .08), across = (y * .94 + x * .34 + (noise(x / (28 * unit), y / (28 * unit), seed) - .5) * 5 * unit + d * .2) / (3.4 * unit), value = Math.abs(fract(across) - .5) * 2;
        inked(Math.max(clamp((tone - value) * 3.4 * unit * .5 + .5), d < outline * radius * .9 ? 1 : 0)); break;
      }
      case 'halo-line': {
        const core = clamp(1 - depth * .5, .05, .95), line = Math.max(.6 * scale, outline * radius * .45);
        inked(Math.max(clamp((rel - core) * r + .5), clamp(line + .5 - d))); break;
      }
      case 'hairline': { const line = Math.max(.6 * scale, outline * radius * .45); inked(clamp(line + .5 - d)); break; }
      case 'double-line': {
        const line = Math.max(.6 * scale, outline * radius * .35), inner = r * clamp(depth, .1, .95);
        inked(Math.max(clamp(line + .5 - d), clamp(line * .8 + .5 - Math.abs(d - inner)))); break;
      }
    }
    out[i] = cr; out[i + 1] = cg; out[i + 2] = cb; out[i + 3] = 255 * clamp(alpha);
  }
  if (shadow > 0) {
    const neon = style === 'neon-tube', blurRadius = Math.max(1, Math.round(radius * (neon ? .75 : .22))), soft = boxBlur(boxBlur(boxBlur(mask, w, h, blurRadius), w, h, blurRadius), w, h, Math.max(1, Math.round(blurRadius * .6)));
    const shiftX = neon ? 0 : Math.round(-lx * radius * .34), shiftY = neon ? 0 : Math.round(-ly * radius * .34);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sx = x - shiftX, sy = y - shiftY; if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const i = (y * w + x) * 4, front = out[i + 3] / 255, back = clamp(soft[sy * w + sx] * shadow * (neon ? 1.7 : .62)) * (1 - front), total = front + back;
      if (back <= 0 || total <= 0) continue;
      const tint: Rgb = neon ? (single ?? [buffer![i], buffer![i + 1], buffer![i + 2]]) : [14, 14, 18];
      for (let c = 0; c < 3; c++) out[i + c] = (out[i + c] * front + tint[c] * back) / total;
      out[i + 3] = 255 * total;
    }
  }
  return out;
}

type Point = { x: number; y: number; p: number };
export type VolumeStroke = { points: Point[]; settings: Record<string, unknown>; seed: number; mirrorAxis?: number; paintFrame?: { x: number; y: number; width: number; height: number } };

function strokeDiscs(points: Point[], settings: Record<string, unknown>, scale: number, push: (x: number, y: number, r: number) => void) {
  const full = Math.max(.75, num(settings.brushSize, 20) * scale / 2), pressure = settings.pressure !== false || brushDynamicsActive(settings), taperStart = num(settings.taperStart, 0), taperEnd = num(settings.taperEnd, 0), step = Math.max(.5, full * .16), arc = [0];
  for (let i = 1; i < points.length; i++) arc.push(arc[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = arc[arc.length - 1], capLength = full * 2.3;
  const capAt = (kind: unknown, along: number) => {
    if (kind === 'sharp') return Math.max(.05, clamp(along / capLength) ** .72);
    if (kind === 'bulb') return 1 + .36 * Math.exp(-((along / (full * 1.15)) ** 2));
    return 1;
  };
  const place = (x: number, y: number, p: number, d: number) => {
    const taper = Math.min(taperStart ? Math.max(.05, Math.min(1, d / Math.max(1, total * taperStart / 200))) : 1, taperEnd ? Math.max(.05, Math.min(1, (total - d) / Math.max(1, total * taperEnd / 200))) : 1);
    push(x, y, Math.max(.5, full * (pressure ? .58 + .42 * p : 1) * taper * capAt(settings.capStart, d) * capAt(settings.capEnd, total - d)));
  };
  if (points.length < 2 || !total) { place(points[0].x, points[0].y, points[0].p, 0); return; }
  let segment = 1;
  for (let d = 0; d <= total; d += step) {
    while (segment < points.length - 1 && arc[segment] < d) segment++;
    const a = points[segment - 1], b = points[segment], t = clamp((d - arc[segment - 1]) / Math.max(1e-6, arc[segment] - arc[segment - 1]));
    place(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.p + (b.p - a.p) * t, d);
  }
  const end = points[points.length - 1]; place(end.x, end.y, end.p, total);
}

/** Paint one or more strokes as a single form. Points are already in canvas pixels. */
export function renderVolumeStrokes(context: CanvasRenderingContext2D, strokes: VolumeStroke[], scale: number, draft = false) {
  if (!strokes.length || !strokes[0].points.length) return;
  const settings = strokes[0].settings, style = settings.brushPreset as VolumeBrushId, options = { ...VOLUME_DEFAULTS, ...settings } as VolumeSettings;
  const discs: { x: number; y: number; r: number }[] = [];
  for (const stroke of strokes) {
    const add = (x: number, y: number, r: number) => { discs.push({ x, y, r }); if (stroke.mirrorAxis !== undefined) discs.push({ x: stroke.mirrorAxis * scale * 2 - x, y, r }); };
    strokeDiscs(applyBrushDynamics(stroke.points, stroke.settings, scale, stroke.seed), stroke.settings, scale, add);
  }
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, maxR = 0;
  for (const c of discs) { left = Math.min(left, c.x - c.r); top = Math.min(top, c.y - c.r); right = Math.max(right, c.x + c.r); bottom = Math.max(bottom, c.y + c.r); maxR = Math.max(maxR, c.r); }
  const pad = Math.ceil(maxR * (style === 'neon-tube' ? 2.6 : options.volumeShadow > 0 ? 1.4 : .1) + 4), canvasW = context.canvas.width, canvasH = context.canvas.height;
  left = Math.max(0, Math.floor(left - pad)); top = Math.max(0, Math.floor(top - pad)); right = Math.min(canvasW, Math.ceil(right + pad)); bottom = Math.min(canvasH, Math.ceil(bottom + pad));
  if (right <= left || bottom <= top) return;
  const area = (right - left) * (bottom - top), k = draft ? Math.min(1, Math.sqrt(150000 / area)) : Math.min(1, Math.sqrt(9000000 / area)), w = Math.max(2, Math.ceil((right - left) * k)), h = Math.max(2, Math.ceil((bottom - top) * k)), mask = new Float32Array(w * h);
  for (const c of discs) {
    const cx = (c.x - left) * k, cy = (c.y - top) * k, r = c.r * k, y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
    for (let y = y0; y <= y1; y++) {
      const dy = y + .5 - cy, outer = (r + .5) ** 2 - dy * dy; if (outer <= 0) continue;
      const span = Math.sqrt(outer), inner = Math.sqrt(Math.max(0, (r - .5) ** 2 - dy * dy)), x0 = Math.max(0, Math.floor(cx - span)), x1 = Math.min(w - 1, Math.ceil(cx + span)), solidA = Math.ceil(cx - inner), solidB = Math.floor(cx + inner) - 1;
      if (solidB >= solidA) mask.fill(1, y * w + Math.max(0, solidA), y * w + Math.min(w, solidB + 1));
      for (let x = x0; x <= x1; x++) { if (x >= solidA && x <= solidB) continue; const v = clamp(r + .5 - Math.hypot(x + .5 - cx, dy)), j = y * w + x; if (v > mask[j]) mask[j] = v; }
    }
  }
  const tile = document.createElement('canvas'); tile.width = w; tile.height = h;
  const paint = tile.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D, color = String(settings.color ?? '#171717');
  let base: Rgb | Uint8ClampedArray;
  if (/^#[\da-f]{6}$/i.test(color)) base = hex(color);
  else {
    const frame = strokes[0].paintFrame;
    paint.save(); paint.scale(k, k); paint.translate((frame ? frame.x * scale : 0) - left, (frame ? frame.y * scale : 0) - top);
    paint.fillStyle = canvasPaint(paint, color, frame ? frame.width * scale : canvasW, frame ? frame.height * scale : canvasH);
    paint.fillRect(left - (frame ? frame.x * scale : 0), top - (frame ? frame.y * scale : 0), right - left, bottom - top); paint.restore();
    base = paint.getImageData(0, 0, w, h).data; paint.clearRect(0, 0, w, h);
  }
  const shaded = shadeVolume(style, mask, w, h, maxR * k, options, base, strokes[0].seed, Math.max(.35, scale * k)), image = paint.createImageData(w, h);
  image.data.set(shaded); paint.putImageData(image, 0, 0);
  context.save(); context.globalAlpha = 1; context.imageSmoothingEnabled = true; context.drawImage(tile, left, top, right - left, bottom - top); context.restore();
}

/** Consecutive strokes of the same 3D brush and colour fuse into one form. */
export function groupVolumeStrokes<T extends VolumeStroke>(strokes: T[]) {
  const groups: T[][] = [];
  for (const stroke of strokes) {
    const last = groups[groups.length - 1]?.[0], fuse = last && isVolumeBrush(String(stroke.settings.brushPreset)) && stroke.settings.volumeMerge !== false && last.settings.volumeMerge !== false && last.settings.brushPreset === stroke.settings.brushPreset && last.settings.color === stroke.settings.color;
    if (fuse) groups[groups.length - 1].push(stroke); else groups.push([stroke]);
  }
  return groups;
}
