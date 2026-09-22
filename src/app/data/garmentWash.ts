import { tintPotraceSvg } from '../lib/tshirtSvgUtils';
import type { GarmentView } from './garmentView';

export const WASH_TYPES = { none: 'Clean / None', vintage: 'Vintage Wash', mineral: 'Mineral Wash', acid: 'Acid Wash', stone: 'Stone / Distressed Wash' } as const;
export const WASH_PLACEMENTS = { full: 'Full Garment', center: 'Center Fade', upper: 'Upper / Shoulder Fade', lower: 'Lower / Hem Fade', sleeves: 'Sleeve Fade', edges: 'Edge / Seam Fade', random: 'Random / All-over', custom: 'Custom' } as const;
export type WashPoint = { x: number; y: number };
export type WashStroke = { id: string; points: WashPoint[]; size: number; strength: number; softness: number; erase: boolean; mirror: boolean };
export type WashShape = { id: string; kind: 'circle' | 'oval' | 'rectangle' | 'band'; x: number; y: number; width: number; height: number; rotation: number; intensity: number; softness: number; tint?: string; mirror: boolean };
export type WashView = { strokes: WashStroke[]; shapes: WashShape[]; placement?: keyof typeof WASH_PLACEMENTS };
export type GarmentWash = {
  type: keyof typeof WASH_TYPES;
  placement: keyof typeof WASH_PLACEMENTS;
  mode: 'natural' | 'tinted' | 'bleach';
  colour: string;
  tone: number;
  intensity: number;
  blend: number;
  spread: number;
  softness: number;
  contrast: number;
  noiseScale: number;
  seed: number;
  autoWear: boolean;
  wearStrength: number;
  symmetry: boolean;
  views: Record<GarmentView, WashView>;
};
export type WashBounds = { minX: number; minY: number; maxX: number; maxY: number };
export type WashTool = { mode: 'brush' | 'shape'; size: number; strength: number; softness: number; erase: boolean; selectedId: string | null };

const washSources = new Map<string, string>();

function washSource(raw: string): string {
  const cached = washSources.get(raw);
  if (cached) return cached;
  const source = `data:image/svg+xml;base64,${btoa(tintPotraceSvg(raw, '#ffffff', 'solid', false, 0))}`;
  if (washSources.size >= 32) washSources.delete(washSources.keys().next().value!);
  washSources.set(raw, source);
  return source;
}

export function defaultGarmentWash(): GarmentWash {
  return { type: 'none', placement: 'full', mode: 'natural', colour: '#b8afa1', tone: 45,
    intensity: 50, blend: 70, spread: 65, softness: 65, contrast: 50, noiseScale: 50,
    seed: 17, autoWear: false, wearStrength: 25, symmetry: false,
    views: { front: { strokes: [], shapes: [] }, back: { strokes: [], shapes: [] } } };
}

export function washTone(base: string, wash: GarmentWash, tint?: string): string {
  const hex = /^#[\da-f]{6}$/i.test(base) ? base : '#808080';
  const custom = tint ?? wash.colour;
  const target = /^#[\da-f]{6}$/i.test(custom) ? custom : hex;
  const channels = [1, 3, 5].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16);
    if (tint || wash.mode === 'tinted') return Math.round(value * .3 + parseInt(target.slice(offset, offset + 2), 16) * .7);
    const amount = Math.abs(wash.tone) / 100;
    return Math.round(wash.mode === 'bleach' ? value + (250 - value) * (.55 + amount * .4)
      : wash.tone >= 0 ? value + (255 - value) * amount : value * (1 - amount));
  });
  return `#${channels.map(value => value.toString(16).padStart(2, '0')).join('')}`;
}

export function updateWashView(wash: GarmentWash, view: GarmentView, value: WashView): GarmentWash {
  return { ...wash, views: { ...wash.views, [view]: value } };
}

export function washStrokeFilterBounds(stroke: WashStroke, bounds: WashBounds, mirror = false): WashBounds {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const diameter = stroke.size * Math.min(width, height);
  const padding = diameter / 2 + diameter * stroke.softness / 100 + 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const point of stroke.points) {
    const horizontal = bounds.minX + (mirror ? 1 - point.x : point.x) * width;
    const vertical = bounds.minY + point.y * height;
    minX = Math.min(minX, horizontal);
    minY = Math.min(minY, vertical);
    maxX = Math.max(maxX, horizontal);
    maxY = Math.max(maxY, vertical);
  }
  return { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding };
}

export function washStrokePath(points: WashPoint[], bounds: WashBounds, mirror = false): string {
  if (!points.length) return '';
  const mapped = points.map(point => ({
    x: bounds.minX + (mirror ? 1 - point.x : point.x) * (bounds.maxX - bounds.minX),
    y: bounds.minY + point.y * (bounds.maxY - bounds.minY),
  }));
  const first = mapped[0];
  let path = `M${first.x},${first.y}`;
  if (mapped.length === 1) return `${path} l.001,0`;
  for (let index = 1; index < mapped.length - 1; index++) {
    const current = mapped[index];
    const next = mapped[index + 1];
    path += ` Q${current.x},${current.y} ${(current.x + next.x) / 2},${(current.y + next.y) / 2}`;
  }
  const last = mapped[mapped.length - 1];
  return `${path} L${last.x},${last.y}`;
}

export function washSvg(raw: string, base: string, bounds: WashBounds, region: string, wash: GarmentWash | undefined, view: GarmentView, identifier: string, placementTransform = ''): string {
  if (!wash || wash.type === 'none' || wash.intensity <= 0 || wash.blend <= 0) return '';
  const prefix = identifier.replace(/[^a-z\d_-]/gi, '');
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const unit = Math.min(width, height);
  const horizontal = (value: number) => bounds.minX + value * width;
  const vertical = (value: number) => bounds.minY + value * height;
  const local = wash.views[view];
  const placement = local.placement ?? wash.placement;
  const source = washSource(raw);
  const defs: string[] = [
    `<mask id="${prefix}-clip" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:alpha"><image href="${source}" width="2048" height="2048"/></mask>`,
    `<radialGradient id="${prefix}-soft"><stop offset="${Math.max(0, 1 - wash.softness / 100)}" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient>`,
    `<filter id="${prefix}-edges" x="0" y="0" width="2048" height="2048" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feMorphology in="SourceAlpha" operator="erode" radius="${4 + unit * .016 * wash.spread / 100}" result="inside"/><feComposite in="SourceAlpha" in2="inside" operator="out"/><feGaussianBlur stdDeviation="${1 + wash.softness / 35}" result="wear"/><feFlood flood-color="white"/><feComposite in2="wear" operator="in"/></filter>`,
  ];
  const ellipse = (x: number, y: number, radiusX: number, radiusY: number) => `<ellipse cx="${horizontal(x)}" cy="${vertical(y)}" rx="${width * radiusX}" ry="${height * radiusY}" fill="url(#${prefix}-soft)"/>`;
  const edge = `<image href="${source}" width="2048" height="2048" filter="url(#${prefix}-edges)"/>`;
  const spread = .12 + wash.spread / 100 * .65;
  let preset = '';
  switch (placement) {
    case 'full': preset = `<rect width="2048" height="2048" fill="white" opacity="${wash.type === 'stone' ? .2 : .65}"/>`; break;
    case 'random': {
      let randomState = wash.seed >>> 0;
      const random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; };
      preset = Array.from({ length: 16 }, () => ellipse(random(), random(), .05 + random() * spread * .35, .04 + random() * spread * .3)).join('');
      break;
    }
    case 'center': preset = ellipse(.5, .48, spread * .55, spread * .6); break;
    case 'upper': preset = ellipse(.5, .1, spread, spread * .48); break;
    case 'lower': preset = ellipse(.5, 1, spread, spread * .5); break;
    case 'sleeves': preset = /sleeve|cuff/i.test(region) ? '<rect width="2048" height="2048" fill="white"/>' : ''; break;
    case 'edges': preset = edge; break;
  }
  const shapeMarkup = (shape: WashShape, index: number, fill: string) => {
    const shapeId = `${prefix}-shape-${index}`;
    const shapeWidth = shape.width * width;
    const shapeHeight = shape.height * height;
    const blur = shape.softness / 100 * Math.min(shapeWidth, shapeHeight) * .2;
    if (!defs.some(def => def.includes(`id="${shapeId}"`))) defs.push(`<filter id="${shapeId}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="${blur}"/></filter>`,
      `<linearGradient id="${shapeId}-band" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${fill}" stop-opacity="0"/><stop offset=".5" stop-color="${fill}"/><stop offset="1" stop-color="${fill}" stop-opacity="0"/></linearGradient>`);
    const primitive = shape.kind === 'circle' || shape.kind === 'oval'
      ? `<ellipse rx="${shapeWidth / 2}" ry="${(shape.kind === 'circle' ? shapeWidth : shapeHeight) / 2}" fill="${fill}"/>`
      : `<rect x="${-shapeWidth / 2}" y="${-shapeHeight / 2}" width="${shapeWidth}" height="${shapeHeight}" fill="${shape.kind === 'band' ? `url(#${shapeId}-band)` : fill}"/>`;
    const placed = (x: number, rotation: number) => `<g transform="translate(${horizontal(x)},${vertical(shape.y)}) rotate(${rotation})" opacity="${shape.intensity / 100}" filter="url(#${shapeId})">${primitive}</g>`;
    return placed(shape.x, shape.rotation) + (shape.mirror ? placed(1 - shape.x, -shape.rotation) : '');
  };
  const strokes = local.strokes.map((stroke, index) => {
    if (!stroke.points.length) return '';
    const strokeId = `${prefix}-stroke-${index}`;
    const path = (mirror: boolean) => {
      const filterId = `${strokeId}-${mirror}`;
      const area = washStrokeFilterBounds(stroke, bounds, mirror);
      if (stroke.softness > 0) defs.push(`<filter id="${filterId}" data-wash-filter="${index}" data-wash-mirror="${mirror}" filterUnits="userSpaceOnUse" x="${area.minX}" y="${area.minY}" width="${area.maxX - area.minX}" height="${area.maxY - area.minY}"><feGaussianBlur stdDeviation="${stroke.size * unit * stroke.softness / 100 * .25}"/></filter>`);
      const data = washStrokePath(stroke.points, bounds, mirror);
      return `<path data-wash-stroke="${index}" data-wash-mirror="${mirror}" d="${data}" fill="none" stroke="${stroke.erase ? 'black' : 'white'}" stroke-width="${stroke.size * unit}" stroke-opacity="${stroke.strength / 100}" stroke-linecap="round" stroke-linejoin="round"${stroke.softness > 0 ? ` filter="url(#${filterId})"` : ''}/>`;
    };
    return path(false) + (stroke.mirror ? path(true) : '');
  }).join('');
  const shapes = local.shapes.map((shape, index) => shapeMarkup(shape, index, 'white')).join('');
  const wear = wash.autoWear || wash.type === 'stone' ? `<g opacity="${wash.wearStrength / 100}">${edge}</g>` : '';
  const placedPreset = placement === 'edges' ? preset : `<g transform="${placementTransform}">${preset}</g>`;
  defs.push(`<mask id="${prefix}-placement" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:luminance"><rect width="2048" height="2048" fill="black"/>${placedPreset}${wear}<g transform="${placementTransform}">${shapes}${strokes}</g></mask>`);
  const frequency = .0015 + (100 - wash.noiseScale) / 100 * .009;
  const contrast = wash.contrast / 100;
  const strength = wash.type === 'vintage' ? .5 + contrast : wash.type === 'acid' ? 3 + contrast * 5 : 1.5 + contrast * 3;
  const intercept = wash.type === 'vintage' ? .45 : .15 - strength * .38;
  defs.push(`<filter id="${prefix}-texture" x="0" y="0" width="2048" height="2048" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${frequency} ${wash.type === 'acid' ? frequency * 3 : frequency}" numOctaves="3" seed="${wash.seed}"/><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 .333 .333 .333 0 0"/><feComponentTransfer><feFuncA type="linear" slope="${strength}" intercept="${intercept}"/></feComponentTransfer><feComposite in="SourceGraphic" operator="in"/></filter>`);
  const tintShapes = local.shapes.filter(shape => shape.tint).map(shape => {
    const index = local.shapes.indexOf(shape);
    const tintId = `${prefix}-tint-${index}`;
    defs.push(`<mask id="${tintId}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><g transform="${placementTransform}">${shapeMarkup(shape, index, 'white')}</g></mask>`);
    return `<rect width="2048" height="2048" fill="${washTone(base, wash, shape.tint)}" mask="url(#${tintId})"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" width="2048" height="2048" data-wash-layer="${region}"><defs>${defs.join('')}</defs><g mask="url(#${prefix}-clip)" opacity="${wash.intensity / 100 * wash.blend / 100}"><g mask="url(#${prefix}-placement)"><g filter="url(#${prefix}-texture)"><rect width="2048" height="2048" fill="${washTone(base, wash)}"/>${tintShapes}</g></g></g></svg>`;
}