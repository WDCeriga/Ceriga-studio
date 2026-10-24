import simplify from 'simplify-js';
import { canvasPaint } from './studioPaint';
import { applyBrushTexture, DEFAULT_TEXTURE_SETTINGS, type BrushTexture, type BrushTextureSettings } from './brushTextures';
export { BRUSH_TEXTURES, DEFAULT_TEXTURE_SETTINGS, applyBrushTexture } from './brushTextures';
export type { BrushTexture, BrushTextureSettings } from './brushTextures';

export interface BrushPoint {
  x: number;
  y: number;
  p: number;
  tilt: number;
}

export type BrushPreset = 'pencil' | 'pen' | 'marker' | 'paint' | 'crayon' | 'spray' | 'airbrush' | 'stitching' | 'embroidery'
  | 'fine-liner' | 'technical-pen' | 'ink-pen' | 'calligraphy' | 'highlighter'
  | 'chalk' | 'charcoal' | 'pastel' | 'dry-brush' | 'wet-brush' | 'gouache' | 'watercolour' | 'oil-paint'
  | 'graffiti-marker' | 'graffiti-mop' | 'splatter' | 'drip-paint' | 'sponge' | 'halftone-brush'
  | 'noise-brush' | 'grain-brush' | 'rough-edge-brush' | 'pixel-brush' | 'distress-brush'
  | 'running-stitch' | 'chain-stitch' | 'cross-stitch' | 'zigzag-stitch' | 'satin-stitch' | 'fill-stitch'
  | 'chain-embroidery' | 'chenille';

export interface BrushSettings extends BrushTextureSettings {
  brushPreset: BrushPreset;
  texture: BrushTexture;
  brushAngle: number;
  brushRotation: number;
  taperStart: number;
  taperEnd: number;
  blur: number;
  smoothing: number;
  symmetry: boolean;
  brushSpacing: number;
  scatterEnabled: boolean;
  scatterSpread: number;
  scatterCount: number;
  scatterSize: number;
  scatterOpacity?: number;
  brushSeed?: number;
  distressMode?: 'paint' | 'erase';
  inkFlow?: number;
  paintLoad?: number;
  bristleDensity?: number;
  edgeRoughness?: number;
  particleDensity?: number;
  pixelSize?: number;
  splatterAmount?: number;
  splatterParticleSize?: number;
  splatterScatter?: number;
  dripAmount?: number;
  dripLength?: number;
  dripThickness?: number;
  halftoneDotSize?: number;
  halftoneSpacing?: number;
  halftoneAngle?: number;
  halftoneDensity?: number;
  distressAmount?: number;
  distressRoughness?: number;
  threadThickness?: number;
  stitchLength?: number;
  stitchWidth?: number;
  stitchDensity?: number;
  stitchDirection?: number;
}

export interface BrushPresetControl {
  key: keyof Pick<BrushSettings, 'inkFlow' | 'paintLoad' | 'bristleDensity' | 'edgeRoughness' | 'particleDensity' | 'pixelSize'
    | 'splatterAmount' | 'splatterParticleSize' | 'splatterScatter' | 'dripAmount' | 'dripLength' | 'dripThickness'
    | 'halftoneDotSize' | 'halftoneSpacing' | 'halftoneAngle' | 'halftoneDensity' | 'distressAmount' | 'distressRoughness'
    | 'threadThickness' | 'stitchLength' | 'stitchWidth' | 'stitchDensity' | 'stitchDirection'>;
  label: string;
  min: number;
  max: number;
  step?: number;
  default: number;
}

// Sizes/lengths are percentages of the brush diameter; directions are degrees relative to the path.
const PRESET_CONTROLS = {
  ink: [{ key: 'inkFlow', label: 'Ink flow', min: 5, max: 100, default: 80 }],
  paint: [
    { key: 'paintLoad', label: 'Paint load', min: 5, max: 100, default: 70 },
    { key: 'bristleDensity', label: 'Bristle density', min: 10, max: 100, default: 55 },
  ],
  particles: [{ key: 'particleDensity', label: 'Particle density', min: 5, max: 100, default: 55 }],
  edge: [{ key: 'edgeRoughness', label: 'Edge roughness', min: 0, max: 100, default: 50 }],
  pixel: [{ key: 'pixelSize', label: 'Pixel size', min: 5, max: 100, default: 25 }],
  splatter: [
    { key: 'splatterAmount', label: 'Splatter amount', min: 1, max: 100, default: 45 },
    { key: 'splatterParticleSize', label: 'Particle size', min: 1, max: 100, default: 18 },
    { key: 'splatterScatter', label: 'Splatter scatter', min: 0, max: 300, default: 140 },
  ],
  drip: [
    { key: 'dripAmount', label: 'Drip amount', min: 1, max: 100, default: 35 },
    { key: 'dripLength', label: 'Drip length', min: 0, max: 500, default: 150 },
    { key: 'dripThickness', label: 'Drip thickness', min: 1, max: 100, default: 12 },
  ],
  halftone: [
    { key: 'halftoneDotSize', label: 'Dot size', min: 1, max: 50, default: 10 },
    { key: 'halftoneSpacing', label: 'Dot spacing', min: 5, max: 100, default: 30 },
    { key: 'halftoneAngle', label: 'Dot angle', min: -180, max: 180, default: 45 },
    { key: 'halftoneDensity', label: 'Dot density', min: 1, max: 100, default: 75 },
  ],
  distress: [
    { key: 'distressAmount', label: 'Distress amount', min: 1, max: 100, default: 55 },
    { key: 'distressRoughness', label: 'Distress roughness', min: 0, max: 100, default: 65 },
  ],
  thread: [
    { key: 'threadThickness', label: 'Thread thickness', min: 1, max: 60, default: 10 },
    { key: 'stitchLength', label: 'Stitch length', min: 20, max: 300, default: 100 },
    { key: 'stitchWidth', label: 'Stitch width', min: 10, max: 200, default: 100 },
    { key: 'stitchDensity', label: 'Stitch density', min: 10, max: 200, default: 100 },
    { key: 'stitchDirection', label: 'Thread direction', min: -180, max: 180, default: 0 },
  ],
} satisfies Record<string, BrushPresetControl[]>;

const THREAD_PRESETS: BrushPreset[] = ['stitching', 'embroidery', 'running-stitch', 'chain-stitch', 'cross-stitch',
  'zigzag-stitch', 'satin-stitch', 'fill-stitch', 'chain-embroidery', 'chenille'];

export function brushPresetControls(id: BrushPreset): BrushPresetControl[] {
  if (THREAD_PRESETS.includes(id)) return PRESET_CONTROLS.thread.map(control => ({ ...control }));
  let controls: BrushPresetControl[];
  switch (id) {
    case 'splatter': controls = PRESET_CONTROLS.splatter; break;
    case 'drip-paint': case 'graffiti-mop': controls = PRESET_CONTROLS.drip; break;
    case 'halftone-brush': controls = PRESET_CONTROLS.halftone; break;
    case 'distress-brush': controls = PRESET_CONTROLS.distress; break;
    case 'pixel-brush': controls = PRESET_CONTROLS.pixel; break;
    case 'rough-edge-brush': controls = PRESET_CONTROLS.edge; break;
    case 'paint': case 'dry-brush': case 'wet-brush': case 'gouache': case 'watercolour': case 'oil-paint':
      controls = PRESET_CONTROLS.paint; break;
    case 'pencil': case 'crayon': case 'chalk': case 'charcoal': case 'pastel': case 'spray':
    case 'sponge': case 'noise-brush': case 'grain-brush': controls = PRESET_CONTROLS.particles; break;
    default: controls = PRESET_CONTROLS.ink;
  }
  return controls.map(control => ({ ...control }));
}

export const BRUSH_PRESETS: { id: BrushPreset; label: string; size: number; grain: number; settings: Partial<BrushSettings> }[] = [
  { id: 'pencil', label: 'Pencil', size: 3, grain: 35, settings: { taperStart: 15, taperEnd: 30 } },
  { id: 'pen', label: 'Pen', size: 6, grain: 0, settings: {} },
  { id: 'marker', label: 'Marker', size: 24, grain: 8, settings: { brushAngle: 30, brushRotation: 35 } },
  { id: 'paint', label: 'Paint Brush', size: 22, grain: 22, settings: { brushAngle: 55, taperEnd: 25 } },
  { id: 'crayon', label: 'Crayon', size: 18, grain: 65, settings: { brushAngle: 55 } },
  { id: 'spray', label: 'Spray Paint', size: 40, grain: 35, settings: {} },
  { id: 'airbrush', label: 'Airbrush', size: 40, grain: 0, settings: { blur: 35 } },
  { id: 'stitching', label: 'Stitching Brush', size: 12, grain: 0, settings: { brushSpacing: 95 } },
  { id: 'embroidery', label: 'Embroidery Brush', size: 16, grain: 12, settings: { brushSpacing: 16 } },
  { id: 'fine-liner', label: 'Fine Liner', size: 3, grain: 0, settings: { brushSpacing: 8 } },
  { id: 'technical-pen', label: 'Technical Pen', size: 2, grain: 0, settings: { brushSpacing: 6 } },
  { id: 'ink-pen', label: 'Ink Pen', size: 10, grain: 0, settings: { taperStart: 20, taperEnd: 45 } },
  { id: 'calligraphy', label: 'Calligraphy', size: 24, grain: 0, settings: { brushRotation: -40, brushSpacing: 8 } },
  { id: 'highlighter', label: 'Highlighter', size: 32, grain: 0, settings: { brushSpacing: 15 } },
  { id: 'chalk', label: 'Chalk', size: 24, grain: 25, settings: {} },
  { id: 'charcoal', label: 'Charcoal', size: 24, grain: 30, settings: { brushAngle: 50 } },
  { id: 'pastel', label: 'Pastel', size: 28, grain: 18, settings: {} },
  { id: 'dry-brush', label: 'Dry Brush', size: 28, grain: 10, settings: { brushSpacing: 18 } },
  { id: 'wet-brush', label: 'Wet Brush', size: 32, grain: 0, settings: {} },
  { id: 'gouache', label: 'Gouache', size: 28, grain: 5, settings: {} },
  { id: 'watercolour', label: 'Watercolour', size: 36, grain: 12, settings: { brushSpacing: 22 } },
  { id: 'oil-paint', label: 'Oil Paint', size: 30, grain: 5, settings: {} },
  { id: 'graffiti-marker', label: 'Graffiti Marker', size: 28, grain: 0, settings: { brushRotation: -20 } },
  { id: 'graffiti-mop', label: 'Graffiti Mop', size: 34, grain: 0, settings: { brushSpacing: 24 } },
  { id: 'splatter', label: 'Splatter', size: 40, grain: 0, settings: { brushSpacing: 70 } },
  { id: 'drip-paint', label: 'Drip Paint', size: 28, grain: 0, settings: { brushSpacing: 85 } },
  { id: 'sponge', label: 'Sponge', size: 36, grain: 0, settings: { brushSpacing: 35 } },
  { id: 'halftone-brush', label: 'Halftone Brush', size: 40, grain: 0, settings: { brushSpacing: 80 } },
  { id: 'noise-brush', label: 'Noise Brush', size: 32, grain: 0, settings: { brushSpacing: 30 } },
  { id: 'grain-brush', label: 'Grain Brush', size: 28, grain: 0, settings: { brushSpacing: 24 } },
  { id: 'rough-edge-brush', label: 'Rough Edge Brush', size: 28, grain: 0, settings: { brushSpacing: 24 } },
  { id: 'pixel-brush', label: 'Pixel Brush', size: 20, grain: 0, settings: { brushSpacing: 50 } },
  { id: 'distress-brush', label: 'Distress Brush', size: 40, grain: 0, settings: { brushSpacing: 45 } },
  { id: 'running-stitch', label: 'Running Stitch', size: 12, grain: 0, settings: { brushSpacing: 120 } },
  { id: 'chain-stitch', label: 'Chain Stitch', size: 16, grain: 0, settings: { brushSpacing: 80 } },
  { id: 'cross-stitch', label: 'Cross Stitch', size: 16, grain: 0, settings: { brushSpacing: 115 } },
  { id: 'zigzag-stitch', label: 'Zigzag Stitch', size: 16, grain: 0, settings: { brushSpacing: 100 } },
  { id: 'satin-stitch', label: 'Satin Stitch', size: 20, grain: 0, settings: { brushSpacing: 90 } },
  { id: 'fill-stitch', label: 'Fill Stitch', size: 20, grain: 0, settings: { brushSpacing: 95 } },
  { id: 'chain-embroidery', label: 'Chain Embroidery', size: 20, grain: 0, settings: { brushSpacing: 80 } },
  { id: 'chenille', label: 'Chenille', size: 24, grain: 0, settings: { brushSpacing: 40 } },
];

export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  ...DEFAULT_TEXTURE_SETTINGS,
  brushPreset: 'pen', texture: 'smooth', brushAngle: 90, brushRotation: 0,
  taperStart: 0, taperEnd: 0, blur: 0, smoothing: 35, symmetry: false,
  brushSpacing: 12, scatterEnabled: false, scatterSpread: 100,
  scatterCount: 1, scatterSize: 100, scatterOpacity: 100, brushSeed: 0, distressMode: 'erase',
  ...Object.fromEntries(Object.values(PRESET_CONTROLS).flat().map(control => [control.key, control.default])),
};

function controlValue(settings: BrushSettings, key: BrushPresetControl['key']) {
  const control = Object.values(PRESET_CONTROLS).flat().find(control => control.key === key)!;
  return bounded(settings[key], control.default, control.min, control.max);
}

function strokeSeed(settings: BrushSettings, seed: number) {
  return (seed | 0) ^ Math.imul(bounded(settings.brushSeed, 0, -2147483648, 2147483647) | 0, 0x9e3779b1);
}

export function createBrushStabilizer(initial: BrushPoint, timestamp: number, scale = 1) {
  let previous = initial;
  let target = initial;
  let first = initial;
  let tip = initial;
  let previousTime = timestamp;
  return (raw: BrushPoint, amount: number, time: number): BrushPoint => {
    const elapsed = Math.min(64, Math.max(0, time - previousTime));
    previousTime = Math.max(previousTime, time);
    const strength = Math.max(0, Math.min(1, amount));
    if (strength === 0) {
      previous = target = first = tip = raw;
      return raw;
    }
    const radius = 18 * strength ** 1.5 * scale;
    const distance = Math.hypot(raw.x - target.x, raw.y - target.y);
    const follow = distance > radius ? (distance - radius) / distance : 0;
    target = {
      x: target.x + (raw.x - target.x) * follow,
      y: target.y + (raw.y - target.y) * follow,
      p: raw.p,
      tilt: raw.tilt,
    };
    if (elapsed === 0) return tip;
    const timeConstant = 4 + 106 * strength * strength;
    const decay = Math.exp(-elapsed / timeConstant);
    const nextFirst = { ...first };
    const nextTip = { ...tip };
    for (const coordinate of ['x', 'y', 'p', 'tilt'] as const) {
      const velocity = (target[coordinate] - previous[coordinate]) / elapsed;
      const ramp = velocity * timeConstant;
      const residual = first[coordinate] - previous[coordinate] + ramp;
      nextFirst[coordinate] = target[coordinate] - ramp + residual * decay;
      nextTip[coordinate] = target[coordinate] - 2 * ramp +
        (tip[coordinate] - previous[coordinate] + 2 * ramp + residual * elapsed / timeConstant) * decay;
    }
    previous = target;
    first = nextFirst;
    tip = nextTip;
    return tip;
  };
}

export function smoothBrushPoints(points: BrushPoint[], amount: number, scale: number): BrushPoint[] {
  if (amount <= 0 || points.length < 3) return points;
  const strength = Math.min(1, amount / 100);
  const filtered = points.map((point, index) => {
    if (!index || index === points.length - 1) return point;
    let horizontal = point.x;
    let vertical = point.y;
    let weight = 1;
    for (let offset = -3; offset <= 3; offset++) {
      const neighbor = points[index + offset];
      if (!offset || !neighbor) continue;
      const distance = Math.hypot(neighbor.x - point.x, neighbor.y - point.y) / scale;
      const influence = strength * Math.exp(-distance * distance / 32);
      horizontal += neighbor.x * influence;
      vertical += neighbor.y * influence;
      weight += influence;
    }
    return { ...point, x: horizontal / weight, y: vertical / weight };
  });
  const reduced = simplify(filtered, (0.15 + strength * 2.5) * scale, true) as BrushPoint[];
  let result = reduced;
  for (let pass = 0; pass < (strength > 0.65 ? 2 : 1); pass++) {
    const next = [result[0]];
    const mix = strength * 0.25;
    for (let index = 1; index < result.length; index++) {
      const previous = result[index - 1];
      const point = result[index];
      for (const fraction of [mix, 1 - mix]) next.push({
        x: previous.x + (point.x - previous.x) * fraction,
        y: previous.y + (point.y - previous.y) * fraction,
        p: previous.p + (point.p - previous.p) * fraction,
        tilt: previous.tilt + (point.tilt - previous.tilt) * fraction,
      });
    }
    next.push(result[result.length - 1]);
    result = next;
  }
  return simplify(result, (0.1 + strength * 0.35) * scale, true) as BrushPoint[];
}

function resample(points: BrushPoint[], spacing: number) {
  const samples = [{ ...points[0], distance: 0, heading: 0 }];
  let travelled = 0;
  let nextDistance = spacing;
  for (let index = 1; index < points.length; index++) {
    const previous = points[index - 1];
    const point = points[index];
    const length = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (!length) continue;
    const heading = Math.atan2(point.y - previous.y, point.x - previous.x);
    if (travelled === 0) samples[0].heading = heading;
    while (nextDistance <= travelled + length) {
      const fraction = (nextDistance - travelled) / length;
      samples.push({
        x: previous.x + (point.x - previous.x) * fraction,
        y: previous.y + (point.y - previous.y) * fraction,
        p: previous.p + (point.p - previous.p) * fraction,
        tilt: previous.tilt + (point.tilt - previous.tilt) * fraction,
        distance: nextDistance, heading,
      });
      nextDistance += spacing;
    }
    travelled += length;
  }
  return { samples, length: travelled };
}

function randomSource(seed: number) {
  let value = (seed | 0) || 7319;
  return () => {
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
    value ^= value >>> 16;
    return (value >>> 0) / 4294967296;
  };
}

function bounded(value: number | undefined, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback;
}

export function createBrushStamps(points: BrushPoint[], settings: BrushSettings & { brushSize: number }, scale: number, seed: number) {
  if (!points.length || !Number.isFinite(scale) || scale <= 0) return { samples: [], length: 0 };
  const size = bounded(settings.brushSize, 14, 1, 512) * scale;
  const defaultSpacing = BRUSH_PRESETS.find(preset => preset.id === settings.brushPreset)?.settings.brushSpacing ?? 12;
  const stitchSpacing = THREAD_PRESETS.includes(settings.brushPreset)
    ? controlValue(settings, 'stitchLength') / 100 * 100 / controlValue(settings, 'stitchDensity') : 1;
  const spacing = Math.max(0.5 * scale, size * bounded(settings.brushSpacing, defaultSpacing, 5, 500) / 100 * stitchSpacing);
  const path = resample(points, spacing);
  const random = randomSource(strokeSeed(settings, seed));
  const scatter = settings.scatterEnabled;
  const count = scatter ? Math.round(bounded(settings.scatterCount, 1, 1, 12)) : 1;
  const spread = scatter ? size * bounded(settings.scatterSpread, 100, 0, 300) / 100 : 0;
  const markSize = scatter ? bounded(settings.scatterSize, 100, 10, 200) / 100 : 1;
  // Arc-length sampling and a stroke-local seed keep marks stable across pointer events and repaints.
  const samples = path.samples.flatMap(point => Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * spread;
    return {
      ...point,
      x: point.x + Math.cos(angle) * distance,
      y: point.y + Math.sin(angle) * distance,
      sizeScale: markSize * (scatter ? 0.85 + random() * 0.3 : 1),
      opacity: scatter ? (0.75 + random() * 0.25) * bounded(settings.scatterOpacity, 100, 0, 100) / 100 : 1,
      rotation: scatter ? (random() - 0.5) * Math.PI / 3 : 0,
    };
  }));
  return { samples, length: path.length };
}

function drawBrushMark(
  context: CanvasRenderingContext2D, preset: BrushPreset, settings: BrushSettings, random: () => number, pixel: number,
) {
  const opacity = context.globalAlpha;
  const alpha = (value: number) => { context.globalAlpha = opacity * Math.max(0, Math.min(1, value)); };
  const value = (key: BrushPresetControl['key']) => controlValue(settings, key) / 100;
  const dot = (x: number, y: number, radius: number, aspect = 1) => {
    context.beginPath();
    context.ellipse(x, y, radius, radius * aspect, 0, 0, Math.PI * 2);
    context.fill();
  };
  const line = (x1: number, y1: number, x2: number, y2: number, width: number) => {
    context.lineWidth = width;
    context.beginPath(); context.moveTo(x1, y1); context.lineTo(x2, y2); context.stroke();
  };
  const ragged = (x: number, y: number, radius: number, roughness: number, vertices = 18) => {
    context.beginPath();
    for (let vertex = 0; vertex < vertices; vertex++) {
      const angle = vertex / vertices * Math.PI * 2;
      const reach = radius * (1 - roughness * random() * 0.8);
      const px = x + Math.cos(angle) * reach, py = y + Math.sin(angle) * reach;
      if (!vertex) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath(); context.fill();
  };
  const position = (spread = 1) => {
    const angle = random() * Math.PI * 2, distance = Math.sqrt(random()) * spread;
    return [Math.cos(angle) * distance, Math.sin(angle) * distance] as const;
  };
  const drips = (mop: boolean) => {
    const count = Math.max(1, Math.round(value('dripAmount') * (mop ? 5 : 10)));
    for (let index = 0; index < count; index++) {
      const x = (random() - 0.5) * 1.5;
      const reach = value('dripLength') * 2 * (0.2 + random() * 0.8);
      const thickness = value('dripThickness') * (0.6 + random() * 0.8);
      alpha(mop ? 0.65 : 0.9);
      context.lineWidth = Math.max(pixel * 0.35, thickness);
      context.beginPath(); context.moveTo(x, 0);
      context.bezierCurveTo(x - thickness, reach * 0.3, x + thickness, reach * 0.7, x, reach);
      context.stroke(); dot(x, reach, thickness * 0.8);
    }
  };
  if (THREAD_PRESETS.includes(preset)) {
    const length = value('stitchLength'), width = value('stitchWidth');
    const thickness = Math.max(pixel * 0.35, value('threadThickness') * 2);
    const density = value('stitchDensity');
    context.lineWidth = thickness;
    context.beginPath();
    const segment = (x1: number, y1: number, x2: number, y2: number) => {
      context.moveTo(x1, y1); context.lineTo(x2, y2);
    };
    const chain = (offset: number, breadth: number) => {
      context.moveTo(-length, offset);
      context.bezierCurveTo(-length * 0.35, offset - breadth, length, offset - breadth, length, offset);
      context.bezierCurveTo(length, offset + breadth, -length * 0.35, offset + breadth, -length, offset);
    };
    switch (preset) {
      case 'stitching': segment(-length * 0.65, -width * 0.04, length * 0.65, width * 0.04); break;
      case 'embroidery': segment(-length * 0.22, -width, length * 0.22, width); break;
      case 'running-stitch':
        context.moveTo(-length * 0.8, 0);
        context.quadraticCurveTo(0, -width * 0.22, length * 0.8, 0); break;
      case 'chain-stitch': chain(0, width * 0.75); break;
      case 'chain-embroidery': chain(-width * 0.45, width * 0.55); chain(width * 0.45, width * 0.55); break;
      case 'cross-stitch':
        segment(-length * 0.8, -width * 0.8, length * 0.8, width * 0.8);
        segment(-length * 0.8, width * 0.8, length * 0.8, -width * 0.8); break;
      case 'zigzag-stitch':
        context.moveTo(-length, -width); context.lineTo(0, width); context.lineTo(length, -width); break;
      case 'satin-stitch': {
        const count = Math.max(2, Math.round(10 * density));
        for (let index = 0; index < count; index++) {
          const x = -length + index / (count - 1) * 2 * length;
          segment(x - length * 0.06, -width, x + length * 0.06, width);
        }
        break;
      }
      case 'fill-stitch': {
        const rows = Math.max(2, Math.round(6 * density));
        for (let row = 0; row < rows; row++) for (let column = 0; column < 3; column++) {
          const x = (-0.9 + column * 0.65 + (row % 2) * 0.16) * length;
          const y = (row / (rows - 1) * 2 - 1) * width;
          segment(x, y, x + length * 0.44, y + width * 0.1);
        }
        break;
      }
      case 'chenille':
        for (let loop = 0; loop < Math.round(20 * density); loop++) {
          const [x, y] = position();
          context.moveTo(x * length + width * 0.16, y * width);
          context.ellipse(x * length, y * width, width * 0.16, width * 0.23, random() * Math.PI, 0, Math.PI * 2);
        }
        break;
    }
    context.stroke();
    alpha(0.38);
    context.strokeStyle = '#FFFFFF';
    context.lineWidth = thickness * 0.25;
    context.stroke();
    return;
  }
  const flow = value('inkFlow');
  const particles = Math.max(3, Math.round(value('particleDensity') * 65));
  const load = value('paintLoad');
  const bristles = Math.max(3, Math.round(value('bristleDensity') * 24));
  switch (preset) {
    case 'pen': alpha(flow / 0.8); dot(0, 0, 1); break;
    case 'fine-liner': alpha(flow / 0.8); dot(0, 0, 0.45); break;
    case 'technical-pen':
      alpha(flow / 0.8); context.lineCap = 'butt'; line(-0.28, 0, 0.28, 0, 0.5); break;
    case 'ink-pen':
      alpha(flow); dot(0, 0, 0.85, 0.7); dot(0.4, 0, 0.3);
      alpha(flow * 0.25); dot(-0.3, 0, 0.7); break;
    case 'calligraphy':
      alpha(flow / 0.8);
      context.beginPath(); context.moveTo(-1, -0.16); context.lineTo(0.86, -0.24);
      context.lineTo(1, 0.16); context.lineTo(-0.86, 0.24); context.closePath(); context.fill(); break;
    case 'marker': alpha(0.28 * flow / 0.8); dot(0, 0, 1); break;
    case 'highlighter':
      alpha(0.11 * flow / 0.8); context.fillRect(-0.4, -1, 0.8, 2); break;
    case 'graffiti-marker':
      alpha(flow); context.fillRect(-0.75, -1, 1.5, 2);
      alpha(flow * 0.5); line(-0.72, -1, -0.72, 1, 0.15); line(0.72, -1, 0.72, 1, 0.15); break;
    case 'airbrush':
      for (let ring = 10; ring >= 1; ring--) { alpha(0.018 * flow / 0.8); dot(0, 0, ring / 10); }
      break;
    case 'spray':
      for (let particle = 0; particle < Math.round(particles * 0.4); particle++) {
        const [x, y] = position(); alpha(0.18 + random() * 0.6);
        dot(x, y, Math.max(pixel * 0.3, 0.015 + random() * 0.035));
      }
      break;
    case 'pencil':
      alpha(0.6); dot(0, 0, 0.75);
      for (let particle = 0; particle < particles; particle++) {
        const [x, y] = position(0.9); alpha(0.15 + random() * 0.35);
        line(x, y, x + 0.12, y - 0.12, Math.max(pixel * 0.15, 0.035));
      }
      break;
    case 'crayon': case 'chalk': case 'charcoal': case 'pastel': {
      if (preset === 'pastel') { alpha(0.12); dot(0, 0, 1); alpha(0.2); dot(0, 0, 0.82); }
      if (preset === 'crayon') { alpha(0.3); ragged(0, 0, 1, 0.35); }
      for (let particle = 0; particle < particles; particle++) {
        const [x, y] = position(0.9);
        alpha(preset === 'charcoal' ? 0.35 + random() * 0.5 : 0.12 + random() * 0.45);
        if (preset === 'chalk') {
          const width = 0.04 + random() * 0.16; context.fillRect(x, y, width, width * 0.65);
        } else if (preset === 'charcoal') {
          line(x - 0.2, y, x + random() * 0.3, y + 0.04, 0.025 + random() * 0.1);
        } else if (preset === 'crayon') ragged(x, y, 0.06 + random() * 0.15, 0.7, 5);
        else dot(x, y, 0.025 + random() * 0.085, 1.3);
      }
      break;
    }
    case 'paint': case 'dry-brush': case 'oil-paint': {
      if (preset !== 'dry-brush') { alpha(load / 0.7); ragged(0, 0, 1, preset === 'paint' ? 0.12 : 0.28); }
      for (let bristle = 0; bristle < bristles; bristle++) {
        const y = (bristle / (bristles - 1) * 2 - 1) * 0.9;
        const extent = Math.sqrt(1 - y * y);
        if (preset === 'dry-brush') {
          alpha(load * (0.3 + random() * 0.7));
          const x = -extent + random() * extent * (1 - load);
          line(x, y, x + extent * (0.35 + load + random() * 0.3), y + (random() - 0.5) * 0.06, 0.025 + random() * 0.07);
        } else {
          context.strokeStyle = '#FFFFFF'; alpha(preset === 'oil-paint' ? 0.08 + random() * 0.24 : 0.18);
          line(-extent * 0.75, y, extent * 0.75, y, preset === 'oil-paint' ? 0.03 + random() * 0.07 : Math.max(pixel * 0.45, 0.015));
        }
      }
      break;
    }
    case 'wet-brush':
      for (let ring = 0; ring < bristles; ring++) {
        alpha(load * 0.09); dot(0, 0, 1.12 - ring / bristles * 0.45);
      }
      alpha(load * 0.2); dot(0, 0, 0.6); break;
    case 'gouache':
      alpha(Math.min(1, load * 1.5)); ragged(0, 0, 1, 0.14);
      context.strokeStyle = '#FFFFFF';
      for (let bristle = 0; bristle < bristles; bristle++) {
        const [x, y] = position(0.85); alpha(0.06); line(x, y, x + 0.12, y, 0.035);
      }
      break;
    case 'watercolour':
      alpha(load * 0.07); ragged(0, 0, 1.08, 0.08);
      context.lineWidth = 0.055; alpha(load * 0.1); context.stroke();
      for (let pool = 0; pool < bristles; pool++) {
        const [x, y] = position(0.4); alpha(load * 0.018); dot(x, y, 0.45 + random() * 0.45);
      }
      break;
    case 'graffiti-mop':
      alpha(0.9); ragged(0, 0, 1, 0.2);
      for (let rib = -3; rib <= 3; rib++) { alpha(0.22); line(-0.9, rib * 0.25, 0.9, rib * 0.25, 0.13); }
      drips(true); break;
    case 'drip-paint': alpha(0.8); dot(0, 0, 0.55, 0.45); drips(false); break;
    case 'splatter':
      for (let particle = 0; particle < Math.max(1, Math.round(value('splatterAmount') * 85)); particle++) {
        const [x, y] = position(value('splatterScatter') * 2);
        const radius = value('splatterParticleSize') * (0.15 + random() ** 2);
        alpha(0.45 + random() * 0.55); ragged(x, y, Math.max(pixel * 0.2, radius), 0.5, 8);
      }
      break;
    case 'sponge':
      for (let pore = 0; pore < particles; pore++) {
        const [x, y] = position(0.9); alpha(0.18 + random() * 0.45);
        ragged(x, y, 0.07 + random() * 0.17, 0.7, 8);
      }
      break;
    case 'halftone-brush': {
      const spacing = value('halftoneSpacing') * 2;
      const radius = value('halftoneDotSize');
      const density = value('halftoneDensity');
      context.rotate(controlValue(settings, 'halftoneAngle') * Math.PI / 180);
      for (let row = -Math.ceil(1 / spacing); row <= Math.ceil(1 / spacing); row++) {
        for (let column = -Math.ceil(1 / spacing); column <= Math.ceil(1 / spacing); column++) {
          const x = column * spacing, y = row * spacing;
          if (Math.hypot(x, y) + radius > 1 || random() > density) continue;
          dot(x, y, radius);
        }
      }
      break;
    }
    case 'noise-brush': case 'grain-brush':
      for (let particle = 0; particle < particles * 2; particle++) {
        const [x, y] = position(); alpha(0.15 + random() * 0.7);
        if (preset === 'noise-brush') {
          const width = Math.max(pixel * 0.5, 0.025 + random() * 0.06); context.fillRect(x, y, width, width);
        } else {
          const radius = 0.025 + random() * 0.045;
          context.save(); context.translate(x, y); context.rotate(random() * Math.PI); dot(0, 0, radius, 2.5); context.restore();
        }
      }
      break;
    case 'rough-edge-brush': ragged(0, 0, 1, value('edgeRoughness'), 48); break;
    case 'pixel-brush': {
      const grid = Math.max(1, Math.round(1 / value('pixelSize')));
      const cell = 2 / grid;
      for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
        if (Math.hypot(x + 0.5 - grid / 2, y + 0.5 - grid / 2) > grid / 2) continue;
        if (random() < 0.18 && grid > 1) continue;
        context.fillRect(-1 + x * cell, -1 + y * cell, cell, cell);
      }
      break;
    }
    case 'distress-brush':
      // This is an alpha mask in erase mode too; layer compositing belongs to the caller.
      for (let chip = 0; chip < Math.max(1, Math.round(value('distressAmount') * 90)); chip++) {
        const [x, y] = position(); alpha(0.3 + random() * 0.7);
        const radius = 0.025 + random() ** 2 * 0.22;
        ragged(x, y, radius, value('distressRoughness'), 12);
      }
      break;
  }
}

export function renderBrushStroke(
  context: CanvasRenderingContext2D,
  points: BrushPoint[],
  settings: BrushSettings & { color: string; brushSize: number; pressure: boolean; grain: number; pencil: { tiltShading: boolean } },
  scale: number,
  seed: number,
) {
  if (!points.length || !Number.isFinite(scale) || scale <= 0) return;
  const size = bounded(settings.brushSize, 14, 1, 512) * scale;
  const preset = settings.brushPreset;
  const thread = THREAD_PRESETS.includes(preset);
  const { samples, length } = createBrushStamps(points, settings, scale, seed);
  context.save();
  context.fillStyle = canvasPaint(context, settings.color, context.canvas.width, context.canvas.height);
  context.strokeStyle = context.fillStyle;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (let index = 0; index < samples.length; index++) {
      const point = samples[index];
      const start = settings.taperStart ? Math.max(0.04, Math.min(1, point.distance / Math.max(1, length * settings.taperStart / 200))) : 1;
      const end = settings.taperEnd ? Math.max(0.04, Math.min(1, (length - point.distance) / Math.max(1, length * settings.taperEnd / 200))) : 1;
      const pressure = settings.pressure ? 0.35 + 0.65 * point.p : 1;
      const tilt = settings.pencil.tiltShading ? 1 + point.tilt * 0.8 : 1;
      const radius = Math.max(0.3 * scale, size * point.sizeScale * pressure * Math.min(start, end) * tilt / 2);
      const aspect = Math.max(0.15, Math.sin(settings.brushAngle * Math.PI / 180));
      context.save();
      context.translate(point.x, point.y);
      context.rotate((thread ? point.heading + controlValue(settings, 'stitchDirection') * Math.PI / 180 : 0) + settings.brushRotation * Math.PI / 180 + point.rotation);
      context.scale(radius, radius * aspect);
      context.globalAlpha = point.opacity;
      const markSeed = strokeSeed(settings, seed) ^ Math.imul(index + 1, 0x45d9f3b);
      drawBrushMark(context, preset, settings, randomSource(markSeed), scale / radius);
      context.restore();
  }
  context.restore();
  applyBrushTexture(context, settings, settings.grain, scale);
  if (settings.blur > 0) {
    const copy = document.createElement('canvas');
    copy.width = context.canvas.width;
    copy.height = context.canvas.height;
    copy.getContext('2d', { willReadFrequently: true })!.drawImage(context.canvas, 0, 0);
    context.clearRect(0, 0, copy.width, copy.height);
    context.save();
    context.filter = `blur(${settings.blur / 100 * size * 0.35}px)`;
    context.drawImage(copy, 0, 0);
    context.restore();
  }
}