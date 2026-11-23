/**
 * Direction-aware brushes. Marks are built along the stroke rather than stamped, so bristles follow the line,
 * see-through inks stay even, and everything is plain paths that export as vector. Randomness is tied to the
 * distance along the stroke, so a stroke does not shimmer while it is being drawn.
 */
type Input = {
  points: { x: number; y: number; p: number; tilt: number }[];
  size: number; scale: number; seed: number; pressure: boolean; taperStart: number; taperEnd: number; nib: number;
  value: (key: string) => number;
};
type Frame = { x: number; y: number; tx: number; ty: number; nx: number; ny: number; r: number; p: number; d: number };

export const RIBBON_BRUSHES = new Set<string>([
  'marker', 'highlighter', 'dry-brush', 'oil-paint', 'watercolour', 'charcoal', 'graffiti-marker', 'drip-paint', 'graffiti-mop', 'satin-stitch', 'fill-stitch',
  'brush-pen', 'gel-pen', 'chisel-marker', 'rope', 'chain-link', 'barbed-wire', 'zipper', 'ribbon', 'star-scatter', 'sparkle-scatter', 'flower-scatter',
]);
const PATTERN = new Set(['rope', 'chain-link', 'barbed-wire', 'zipper', 'ribbon', 'star-scatter', 'sparkle-scatter', 'flower-scatter']);

const fract = (v: number) => v - Math.floor(v);
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
function hash(a: number, b: number) {
  let n = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function wave(x: number, seed: number) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u;
}

/** Pattern brushes turn on a small radius, so links and twists bend round a corner instead of colliding. */
function roundCorners(points: Input['points'], spacing: number, radius: number) {
  const even: Input['points'] = [points[0]];
  let travelled = 0, next = spacing;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) continue;
    while (next <= travelled + length) { const t = (next - travelled) / length; even.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t, tilt: a.tilt + (b.tilt - a.tilt) * t }); next += spacing; }
    travelled += length;
  }
  const last = points[points.length - 1];
  if (even.length < 5) return { points, closed: false };
  const closed = Math.hypot(last.x - points[0].x, last.y - points[0].y) <= spacing * 1.5 && travelled > radius * 6;
  let row = closed ? even.slice(0, Math.hypot(even[even.length - 1].x - even[0].x, even[even.length - 1].y - even[0].y) < spacing * .5 ? -1 : undefined) : [...even, last];
  const n = row.length, reach = Math.max(1, Math.ceil(radius / spacing));
  for (let pass = 0; pass < 2; pass++) {
    row = row.map((point, i) => {
      const r = closed ? Math.min(reach, Math.floor((n - 1) / 2)) : Math.min(reach, i, n - 1 - i);
      let x = 0, y = 0;
      for (let k = -r; k <= r; k++) { const item = row[closed ? (i + k + n) % n : i + k]; x += item.x; y += item.y; }
      return { ...point, x: x / (2 * r + 1), y: y / (2 * r + 1) };
    });
  }
  return { points: closed ? [...row, row[0]] : row, closed };
}

function buildFrames(input: Input, spacing: number, closed = false) {
  const { points, size, pressure, taperStart, taperEnd } = input, raw: { x: number; y: number; p: number; d: number }[] = [{ ...points[0], d: 0 }];
  let travelled = 0, next = spacing;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y);
    if (!length) continue;
    while (next <= travelled + length) { const t = (next - travelled) / length; raw.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, p: a.p + (b.p - a.p) * t, d: next }); next += spacing; }
    travelled += length;
  }
  const last = points[points.length - 1];
  if (travelled - raw[raw.length - 1].d > spacing * .25) raw.push({ x: last.x, y: last.y, p: last.p, d: travelled });
  const n = raw.length, frames: Frame[] = [];
  for (let i = 0; i < n; i++) {
    const ring = n - 1, a = closed ? raw[(i - 2 + ring * 2) % ring] : raw[Math.max(0, i - 2)], b = closed ? raw[(i + 2) % ring] : raw[Math.min(n - 1, i + 2)], dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1, tx = dx / length, ty = dy / length;
    let p = 0, weight = 0;
    for (let k = Math.max(0, i - 2); k <= Math.min(n - 1, i + 2); k++) { p += raw[k].p; weight++; }
    p /= weight;
    const start = taperStart ? Math.max(.04, Math.min(1, raw[i].d / Math.max(1, travelled * taperStart / 200))) : 1, end = taperEnd ? Math.max(.04, Math.min(1, (travelled - raw[i].d) / Math.max(1, travelled * taperEnd / 200))) : 1;
    frames.push({ x: raw[i].x, y: raw[i].y, tx, ty, nx: -ty, ny: tx, r: Math.max(.3 * input.scale, size / 2 * (pressure ? .35 + .65 * p : 1) * Math.min(start, end)), p, d: raw[i].d });
  }
  return { frames, length: travelled };
}

export function renderRibbonBrush(context: CanvasRenderingContext2D, preset: string, input: Input) {
  const { size, scale, seed, value } = input, spacing = Math.max(.75 * scale, size * .06), bends = PATTERN.has(preset) && !preset.endsWith('-scatter') && input.points.length > 2, route = bends ? roundCorners(input.points, spacing, size * .62) : { points: input.points, closed: false }, closed = route.closed, built = buildFrames({ ...input, points: route.points }, spacing, closed), length = built.length;
  const baseAlpha = context.globalAlpha, ink = context.strokeStyle, wobble = PATTERN.has(preset) && !preset.endsWith('-scatter') ? value('patternJitter') * size * (preset === 'rope' ? .07 : .22) : 0;
  const frames = wobble ? built.frames.map(f => { const shift = (wave(f.d / (size * 1.8), seed + 91) - .5) * 2 * wobble; return { ...f, x: f.x + f.nx * shift, y: f.y + f.ny * shift }; }) : built.frames;
  const alpha = (v: number) => { context.globalAlpha = baseAlpha * clamp(v); };
  const at = (distance: number): Frame => {
    const d = closed && length > 0 ? ((distance % length) + length) % length : distance;
    const index = clamp(d / spacing, 0, frames.length - 1), i = Math.floor(index), j = Math.min(frames.length - 1, i + 1), t = index - i, a = frames[i], b = frames[j];
    return { ...a, x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, r: a.r + (b.r - a.r) * t, d };
  };
  const disc = (x: number, y: number, r: number) => { context.beginPath(); context.ellipse(x, y, Math.max(.2, r), Math.max(.2, r), 0, 0, Math.PI * 2); context.fill(); };
  if (frames.length < 2) { alpha(preset === 'highlighter' ? .34 : 1); disc(frames[0].x, frames[0].y, frames[0].r); context.globalAlpha = baseAlpha; return; }
  type Width = (f: Frame) => number;
  const plain: Width = f => f.r;
  const band = (a: number, b: number, opacity: number, width: Width = plain, edge?: (f: Frame, side: number) => number, from = 0, to = frames.length - 1) => {
    alpha(opacity); context.beginPath();
    for (let i = from; i <= to; i++) { const f = frames[i], r = width(f), o = a * r + (edge?.(f, -1) ?? 0), x = f.x + f.nx * o, y = f.y + f.ny * o; if (i === from) context.moveTo(x, y); else context.lineTo(x, y); }
    for (let i = to; i >= from; i--) { const f = frames[i], r = width(f), o = b * r + (edge?.(f, 1) ?? 0); context.lineTo(f.x + f.nx * o, f.y + f.ny * o); }
    context.closePath(); context.fill();
  };
  const strand = (offset: number | ((f: Frame) => number), width: number, opacity: number, gate?: (f: Frame) => boolean, colour?: string) => {
    alpha(opacity); context.lineWidth = Math.max(.35 * scale, width);
    if (colour) context.strokeStyle = colour;
    context.beginPath();
    let open = false;
    for (const f of frames) {
      if (gate && !gate(f)) { open = false; continue; }
      const o = (typeof offset === 'number' ? offset : offset(f)) * f.r, x = f.x + f.nx * o, y = f.y + f.ny * o;
      if (open) context.lineTo(x, y); else { context.moveTo(x, y); open = true; }
    }
    context.stroke();
    if (colour) context.strokeStyle = ink;
  };
  const rough = (amount: number, scaleBy = .5, salt = 3) => (f: Frame, side: number) => (wave(f.d / (size * scaleBy), seed + salt + side) - .5) * f.r * amount;
  const caps = (opacity: number, factor = 1) => { alpha(opacity); disc(frames[0].x, frames[0].y, frames[0].r * factor); const end = frames[frames.length - 1]; disc(end.x, end.y, end.r * factor); };
  const drips = (amount: number, thick: number, bodyWidth: number) => {
    const cell = size / Math.max(.05, amount * 2.2), count = Math.ceil(length / cell);
    context.lineCap = 'round';
    for (let c = 0; c < count; c++) {
      if (hash(c, seed + 41) > .62) continue;
      const d = (c + hash(c, seed + 42)) * cell;
      if (d > length) continue;
      const f = at(d), side = (hash(c, seed + 43) - .5) * 1.5 * bodyWidth, x = f.x + f.nx * f.r * side, y = f.y + f.ny * f.r * side, h = hash(c, seed + 44), reach = size * value('dripLength') * (.12 + h * h * .8), w = Math.max(.6 * scale, size * value('dripThickness') * thick * (.7 + hash(c, seed + 45) * .8));
      alpha(1); context.beginPath(); context.moveTo(x - w * 1.25, y - w * .3);
      context.quadraticCurveTo(x - w * .3, y + reach * .3, x - w * .36, y + reach); context.lineTo(x + w * .36, y + reach);
      context.quadraticCurveTo(x + w * .3, y + reach * .3, x + w * 1.25, y - w * .3); context.closePath(); context.fill();
      disc(x, y + reach, w * .62);
    }
  };
  const repeat = size * Math.max(.2, value('patternScale')), gap = 1 + value('patternGap');
  // On a closed shape the pattern lands exactly back on its start, so there is no visible seam.
  const fit = (step: number, even = false) => { if (!closed) return step; let count = Math.max(even ? 2 : 1, Math.round(length / step)); if (even && count % 2) count++; return length / count; };
  const limit = closed ? length - spacing * .01 : length, ahead = (d: number) => closed ? d : Math.min(length, d);
  const seg = (x1: number, y1: number, x2: number, y2: number) => { context.moveTo(x1, y1); context.lineTo(x2, y2); };
  const place = (f: Frame, across: number, along = 0) => ({ x: f.x + f.nx * f.r * across + f.tx * along, y: f.y + f.ny * f.r * across + f.ty * along });
  const polygon = (cx: number, cy: number, radius: number, rotation: number, spikes: number, inner: number) => {
    context.beginPath();
    for (let i = 0; i < spikes * 2; i++) { const a = rotation + i * Math.PI / spikes - Math.PI / 2, r = i % 2 ? radius * inner : radius, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r; if (!i) context.moveTo(x, y); else context.lineTo(x, y); }
    context.closePath(); context.fill();
  };

  context.lineCap = 'round'; context.lineJoin = 'round';
  switch (preset) {
    case 'marker': { const flow = value('inkFlow'); band(-1, 1, .74 * flow / .8); band(-1, -.84, .16); band(.84, 1, .16); break; }
    case 'highlighter': band(-1, 1, .36 * value('inkFlow') / .8, () => size / 2); break;
    case 'chisel-marker': { const nib = input.nib * Math.PI / 180, width: Width = f => f.r * (.2 + .8 * Math.abs(f.tx * Math.sin(nib) - f.ty * Math.cos(nib))); band(-1, 1, value('inkFlow') / .8, width); break; }
    case 'brush-pen': { const width: Width = f => f.r * (input.pressure ? .3 + .7 * f.p ** 1.4 : 1); band(-1, 1, value('inkFlow') / .8, width); break; }
    case 'gel-pen': strand(0, size * .55, value('inkFlow') / .8 * .96); caps(.96, .62); break;
    case 'graffiti-marker': {
      band(-1, 1, value('inkFlow') / .8, plain, rough(.1, .22));
      const dry = Math.max(0, length - size * 2.2);
      for (let b = 0; b < 12; b++) { const o = -.9 + b * 1.8 / 11, stop = dry + hash(b, seed + 5) * size * 2.2; strand(o, size * .07, 1, f => f.d > dry * .9 && f.d < stop); }
      break;
    }
    case 'dry-brush': {
      const load = value('paintLoad'), count = Math.round(12 + value('bristleDensity') * 42);
      for (let b = 0; b < count; b++) {
        const o = count > 1 ? -.95 + b * 1.9 / (count - 1) : 0, h = hash(b, seed + 7), coverage = 1 - clamp(load * .75 + .1) * (.72 + h * .28), rate = size * (.3 + h * .95);
        strand(o + (h - .5) * .05, size * (.014 + h * .04), .5 + h * .5, f => wave(f.d / rate, seed + b * 7) > coverage && f.r > size * .08);
      }
      break;
    }
    case 'oil-paint': {
      const load = value('paintLoad'), count = Math.round(5 + value('bristleDensity') * 16);
      band(-1, 1, clamp(load / .6), plain, rough(.14, .3)); caps(clamp(load / .6), .96);
      for (let b = 0; b < count; b++) { const o = -.9 + b * 1.8 / Math.max(1, count - 1), h = hash(b, seed + 11); strand(o, size * (.014 + h * .03), h > .5 ? .05 + h * .06 : .07 + h * .09, f => wave(f.d / (size * 1.4), seed + b) > .34, h > .5 ? '#ffffff' : '#000000'); }
      break;
    }
    case 'watercolour': {
      const load = value('paintLoad');
      for (let wash = 0; wash < 9; wash++) { const reach = 1.06 - wash * .1; band(-reach, reach, load * .11, plain, rough(.24 + wash * .03, .6 + wash * .12, 5 + wash * 4)); }
      band(-1.06, -.97, load * .2, plain, rough(.24, .6, 5)); band(.97, 1.06, load * .2, plain, rough(.24, .6, 5));
      break;
    }
    case 'charcoal': {
      const density = value('particleDensity'), count = Math.round(22 + density * 60);
      band(-.92, .92, .16, plain, rough(.2, .25));
      for (let b = 0; b < count; b++) { const o = -.98 + b * 1.96 / (count - 1), h = hash(b, seed + 17), rate = size * (.035 + h * .1); strand(o, size * (.012 + h * .03), .32 + h * .6, f => wave(f.d / rate, seed + b * 3) > .56 - density * .2); }
      break;
    }
    case 'drip-paint': band(-.62, .62, 1, plain, rough(.05)); caps(1, .62); drips(value('dripAmount'), 1, .55); break;
    case 'graffiti-mop': band(-1, 1, .96, plain, rough(.1)); caps(.96); drips(value('dripAmount') * .7, 1.5, .9); break;
    case 'satin-stitch': {
      const step = Math.max(.7 * scale, size * value('threadThickness') * .55 / Math.max(.2, value('stitchDensity'))), reach = value('stitchWidth'), slant = size * .1 * value('stitchLength');
      alpha(1); context.lineWidth = step * .86; context.lineCap = 'butt'; context.beginPath();
      for (let d = 0; d <= length; d += step) { const f = at(d), a = place(f, -reach), b = place(f, reach, slant); seg(a.x, a.y, b.x, b.y); }
      context.stroke();
      alpha(.24); context.strokeStyle = '#ffffff'; context.lineWidth = step * .22; context.stroke(); context.strokeStyle = ink; context.lineCap = 'round';
      break;
    }
    case 'fill-stitch': {
      const rows = Math.max(3, Math.round(7 * value('stitchDensity'))), run = Math.max(2 * scale, size * value('stitchLength') * .62), thread = Math.max(.6 * scale, size * value('threadThickness') * .95), reach = value('stitchWidth');
      for (let row = 0; row < rows; row++) { const o = (row / (rows - 1) * 2 - 1) * reach * .94, gate = (f: Frame) => fract(f.d / run + row * .37) < .86; strand(o, thread, 1, gate); strand(o - .02, thread * .3, .26, gate, '#ffffff'); }
      break;
    }
    case 'rope': {
      // Each strand is a filled twist that follows both edges of the line, so nothing can poke out on a bend.
      const step = fit(repeat * .46 * gap), run = step * .84, slant = step * 1.15, points = 7;
      alpha(1); context.beginPath();
      for (let d = 0; d <= limit; d += step) {
        for (let k = 0; k <= points; k++) { const t = k / points, o = place(at(ahead(d + run * t)), -(.8 + .2 * Math.sin(Math.PI * t))); if (k) context.lineTo(o.x, o.y); else context.moveTo(o.x, o.y); }
        for (let k = 0; k <= points; k++) { const t = k / points, o = place(at(ahead(d + slant + run * (1 - t))), .8 + .2 * Math.sin(Math.PI * t)); context.lineTo(o.x, o.y); }
        context.closePath();
      }
      context.fill();
      break;
    }
    case 'chain-link': {
      const step = fit(repeat * .82 * gap, true); let index = 0;
      alpha(1); context.lineWidth = Math.max(.7 * scale, size * .13);
      for (let d = step / 2; d <= limit; d += step, index++) {
        const f = at(d), angle = Math.atan2(f.ty, f.tx), rx = step * .62;
        context.beginPath();
        if (index % 2) { context.moveTo(f.x - f.tx * rx, f.y - f.ty * rx); context.lineTo(f.x + f.tx * rx, f.y + f.ty * rx); }
        else context.ellipse(f.x, f.y, rx, Math.max(scale, size * .3), angle, 0, Math.PI * 2);
        context.stroke();
      }
      break;
    }
    case 'barbed-wire': {
      const twist = fit(repeat * .75 * gap), thin = Math.max(.6 * scale, size * .08);
      strand(f => Math.sin(f.d / twist * Math.PI * 2) * .2, thin, 1); strand(f => -Math.sin(f.d / twist * Math.PI * 2) * .2, thin, 1);
      alpha(1); context.lineWidth = thin; context.beginPath();
      for (let d = twist * 1.25; d <= limit; d += twist * 3) {
        const f = at(d), lean = size * .24;
        for (const [across, along] of [[-1, -lean], [1, lean], [-1, lean], [1, -lean]] as const) { const tip = place(f, across * .95, along); seg(f.x, f.y, tip.x, tip.y); }
      }
      context.stroke();
      break;
    }
    case 'zipper': {
      band(-1, -.3, .95, () => size / 2); band(.3, 1, .95, () => size / 2);
      const step = fit(repeat * .26 * gap, true); let side = 0; alpha(1); context.lineWidth = Math.max(.6 * scale, step * .62); context.lineCap = 'butt'; context.beginPath();
      for (let d = step / 2; d <= limit; d += step, side++) { const f = at(d), r = size / 2, s = side % 2 ? 1 : -1; seg(f.x + f.nx * r * .24 * s, f.y + f.ny * r * .24 * s, f.x - f.nx * r * .34 * s, f.y - f.ny * r * .34 * s); }
      context.stroke(); context.lineCap = 'round';
      break;
    }
    case 'ribbon': {
      // One unbroken band in the back tone, with front faces laid over it. Slanted fold lines make it read as a twist.
      const half = fit(repeat * 1.7 * gap, true), slant = size * .3, samples = Math.max(10, Math.ceil((half + slant) / spacing)), faces = closed ? Math.round(length / half) : Math.ceil(length / half + 1);
      const profile = (d: number) => { const u = clamp(Math.abs(Math.cos(d / half * Math.PI)) * 1.7); return .7 + .3 * u * u * (3 - 2 * u); };
      band(-1, 1, .68, f => f.r * profile(f.d));
      const edge = (d: number) => closed ? d : clamp(d, 0, length);
      alpha(1); context.beginPath();
      for (let k = 0; k < faces; k += 2) {
        const from = (k - .5) * half, to = (k + .5) * half;
        if (!closed && (to + slant <= 0 || from - slant >= length)) continue;
        for (let i = 0; i <= samples; i++) { const d = edge(from - slant + (to - from) * i / samples), f = at(d), o = f.r * profile(d), x = f.x + f.nx * o, y = f.y + f.ny * o; if (i) context.lineTo(x, y); else context.moveTo(x, y); }
        for (let i = samples; i >= 0; i--) { const d = edge(from + slant + (to - from) * i / samples), f = at(d), o = f.r * profile(d); context.lineTo(f.x - f.nx * o, f.y - f.ny * o); }
        context.closePath();
      }
      context.fill();
      break;
    }
    case 'star-scatter': case 'sparkle-scatter': case 'flower-scatter': {
      const step = size * Math.max(.3, value('patternScale')) * 1.25 * gap, jitter = value('patternJitter');
      let index = 0;
      for (let d = step / 2; d <= length; d += step, index++) {
        const f = at(d), o = (hash(index, seed + 3) - .5) * 2 * jitter * 1.5, x = f.x + f.nx * f.r * o, y = f.y + f.ny * f.r * o, radius = Math.max(scale, f.r * .95 * (1 - jitter * .5 + hash(index, seed + 5) * jitter)), rotation = (hash(index, seed + 7) - .5) * Math.PI * jitter;
        alpha(1);
        if (preset === 'star-scatter') polygon(x, y, radius, rotation, 5, .42);
        else if (preset === 'sparkle-scatter') polygon(x, y, radius, rotation * .3, 4, .17);
        else {
          for (let petal = 0; petal < 5; petal++) { const a = rotation + petal * Math.PI * .4; context.beginPath(); context.ellipse(x + Math.cos(a) * radius * .52, y + Math.sin(a) * radius * .52, radius * .46, radius * .32, a, 0, Math.PI * 2); context.fill(); }
          alpha(.42); context.fillStyle = '#ffffff'; disc(x, y, radius * .22); context.fillStyle = ink;
        }
      }
      break;
    }
  }
  context.globalAlpha = baseAlpha; context.strokeStyle = ink;
}
