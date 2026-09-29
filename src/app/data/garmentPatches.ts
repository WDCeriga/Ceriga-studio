import { contours } from 'd3-contour';
import type { GarmentDetail } from './garmentDetails';

export const PATCH_TYPES = { embroidered: 'Embroidered patch', woven: 'Woven patch', chenille: 'Chenille patch', pvc: 'PVC / Rubber patch', leather: 'Leather patch', printed: 'Printed fabric patch', twill: 'Twill patch' } as const;
export const PATCH_SHAPES = { rectangle: 'Rectangle', rounded: 'Rounded rectangle', square: 'Square', circle: 'Circle', oval: 'Oval', shield: 'Shield', arch: 'Arch', banner: 'Banner', auto: 'Auto contour' } as const;
export const PATCH_FINISHES = { stitched: 'Stitched', heatPress: 'Heat press', velcro: 'Velcro', sewOn: 'Sew-on', ironOn: 'Iron-on' } as const;
export const PATCH_EDGES = { merrow: 'Merrow edge', laser: 'Laser cut', folded: 'Folded edge', raw: 'Raw edge' } as const;
export const PATCH_DEPTHS = { flat: 'Flat', low: 'Low raise', medium: 'Medium raise', high: 'High raise' } as const;
export const PATCH_APPLICATIONS = { embroidered: 'Embroidered', woven: 'Woven', printed: 'Printed', embossed: 'Embossed', debossed: 'Debossed', moulded: 'Moulded', chenille: 'Loop pile' } as const;
export const PATCH_MATERIAL_APPLICATIONS = {
  embroidered: ['embroidered', 'printed'], woven: ['woven', 'printed'], chenille: ['chenille', 'embroidered'],
  pvc: ['moulded', 'printed'], leather: ['embossed', 'debossed', 'printed'], printed: ['printed'], twill: ['embroidered', 'printed'],
} as const;
export interface PatchSettings {
  material: keyof typeof PATCH_TYPES;
  shape: keyof typeof PATCH_SHAPES;
  artwork?: string;
  artworkName?: string;
  artworkRatio?: number;
  contour?: number[][];
  borderThickness: number;
  artworkScale: number;
  borderStyle: 'stitched' | 'merrow' | 'plain';
  relief: 'raised' | 'recessed';
  leatherFinish: 'embossed' | 'debossed' | 'printed';
  stitchedEdge: boolean;
  finish?: keyof typeof PATCH_FINISHES;
  edgeStyle?: keyof typeof PATCH_EDGES;
  depth?: keyof typeof PATCH_DEPTHS;
  application?: keyof typeof PATCH_APPLICATIONS;
  padding?: number;
  cornerRadius?: number;
}
export const DEFAULT_PATCH: PatchSettings = { material: 'embroidered', shape: 'rounded', borderThickness: 3, artworkScale: 85, borderStyle: 'merrow', relief: 'raised', leatherFinish: 'embossed', stitchedEdge: true };

export function patchSettings(patch?: PatchSettings) {
  const settings = { ...DEFAULT_PATCH, ...patch };
  const applications: readonly string[] = PATCH_MATERIAL_APPLICATIONS[settings.material];
  const legacyApplication = settings.material === 'leather' ? settings.leatherFinish : PATCH_MATERIAL_APPLICATIONS[settings.material][0];
  return { ...settings,
    finish: settings.finish ?? 'sewOn',
    edgeStyle: settings.edgeStyle ?? (settings.material === 'leather' || settings.material === 'pvc' || settings.borderStyle === 'plain' ? 'laser' : 'merrow'),
    depth: settings.depth ?? (settings.material === 'chenille' ? 'high' : 'low'),
    application: settings.application && applications.includes(settings.application) ? settings.application : legacyApplication,
    padding: settings.padding ?? 5,
    cornerRadius: settings.cornerRadius ?? 12,
  };
}

export async function readPatchArtwork(file: File): Promise<Pick<PatchSettings, 'artwork' | 'artworkName' | 'artworkRatio' | 'contour'>> {
  if (!/\.(png|jpe?g|svg)$/i.test(file.name)) throw new Error('Choose a PNG, JPG or SVG image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose artwork smaller than 5 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 32_000_000) throw new Error('Artwork must contain an image smaller than 32 megapixels.');
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, right = -1, top = canvas.height, bottom = -1;
    let transparent = false;
    for (let row = 0; row < canvas.height; row++) for (let column = 0; column < canvas.width; column++) {
      const alpha = pixels[(row * canvas.width + column) * 4 + 3];
      if (alpha < 128) transparent = true;
      if (alpha > 128) { left = Math.min(left, column); right = Math.max(right, column); top = Math.min(top, row); bottom = Math.max(bottom, row); }
    }
    if (right < left) throw new Error('The artwork is fully transparent.');
    const cropped = document.createElement('canvas');
    cropped.width = right - left + 1; cropped.height = bottom - top + 1;
    cropped.getContext('2d')!.drawImage(canvas, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
    const mask = document.createElement('canvas'); mask.width = 128; mask.height = 128;
    const maskContext = mask.getContext('2d')!;
    maskContext.filter = 'blur(1px)';
    maskContext.drawImage(cropped, 3, 3, 122, 122);
    const alpha = maskContext.getImageData(0, 0, 128, 128).data;
    const values = Array.from({ length: 128 * 128 }, (_, index) => alpha[index * 4 + 3] / 255);
    const polygons = contours().size([128, 128]).thresholds([.4])(values)[0]?.coordinates ?? [];
    const area = (ring: number[][]) => Math.abs(ring.reduce((sum, point, index) => { const next = ring[(index + 1) % ring.length]; return sum + point[0] * next[1] - next[0] * point[1]; }, 0));
    const ring = polygons.map(polygon => polygon[0]).sort((first, second) => area(second) - area(first))[0];
    const step = ring ? Math.max(1, Math.ceil(ring.length / 180)) : 1;
    const contour = transparent && ring ? ring.filter((_, index) => index % step === 0).map(point => [Math.max(0, Math.min(1, (point[0] - 3) / 122)), Math.max(0, Math.min(1, (point[1] - 3) / 122))]) : undefined;
    return { artwork: cropped.toDataURL('image/png'), artworkName: file.name, artworkRatio: cropped.width / cropped.height, contour };
  } finally { URL.revokeObjectURL(url); }
}

export function patchSvg(detail: GarmentDetail, ratio = 1.25) {
  const settings = patchSettings(detail.patch);
  const width = 200, height = width / Math.max(.05, ratio);
  const shorter = Math.min(width, height);
  const border = shorter * Math.max(0, Math.min(12, settings.borderThickness)) / 100;
  const edgeWidth = settings.edgeStyle === 'merrow' ? border * 1.7 : settings.edgeStyle === 'folded' ? border * 1.3 : border;
  const inset = edgeWidth / 2;
  const innerWidth = width - inset * 2, innerHeight = height - inset * 2;
  const raised = ['leather', 'pvc', 'chenille'].includes(settings.material);
  const depth = raised ? { flat: 0, low: .65, medium: 1.25, high: 2.1 }[settings.depth] : settings.material === 'woven' || settings.material === 'printed' ? .25 : .65;
  const document = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"/>', 'image/svg+xml');
  const svg = document.documentElement;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('data-patch-material', settings.material);
  svg.setAttribute('data-patch-application', settings.application);
  svg.setAttribute('data-patch-finish', settings.finish);
  svg.setAttribute('overflow', 'visible');
  const append = (tag: string, attributes: Record<string, string | number>, parent: Element = svg) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, String(value)));
    parent.appendChild(element); return element;
  };
  const prefix = `patch-${detail.id.replace(/[^a-zA-Z0-9-]/g, '')}`;
  const defs = append('defs', {});
  const filter = (name: string) => append('filter', { id: `${prefix}-${name}`, x: '-15%', y: '-15%', width: '130%', height: '140%', 'color-interpolation-filters': 'sRGB' }, defs);
  const shadow = filter('attachment');
  const attachment = settings.finish === 'velcro' ? 1.8 : settings.finish === 'heatPress' || settings.finish === 'ironOn' ? .25 : .75;
  append('feDropShadow', { dx: 0, dy: attachment + depth, stdDeviation: .55 + depth * .5, 'flood-color': '#000', 'flood-opacity': .42 }, shadow);
  const sheen = append('linearGradient', { id: `${prefix}-sheen`, x1: 0, y1: 0, x2: .7, y2: 1 }, defs);
  append('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': .22 }, sheen);
  append('stop', { offset: .42, 'stop-color': '#fff', 'stop-opacity': 0 }, sheen);
  append('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': .22 }, sheen);
  const grain = filter('grain');
  append('feTurbulence', { type: 'fractalNoise', baseFrequency: .75, numOctaves: 3, seed: 17, result: 'noise' }, grain);
  const lighting = append('feDiffuseLighting', { in: 'noise', surfaceScale: 1.8, diffuseConstant: .8, 'lighting-color': '#fff', result: 'light' }, grain);
  append('feDistantLight', { azimuth: 225, elevation: 48 }, lighting);
  append('feComposite', { in: 'light', in2: 'SourceGraphic', operator: 'in' }, grain);
  const texturePattern = (name: string, kind: string) => {
    const size = kind === 'chenille' ? 9 : kind === 'woven' ? 2 : 4;
    const pattern = append('pattern', { id: `${prefix}-${name}`, width: size, height: size, patternUnits: 'userSpaceOnUse' }, defs);
    if (kind === 'chenille') {
      for (const [centerX, centerY, angle] of [[2, 2, 25], [6.6, 1.8, -35], [4.5, 5.5, 85], [.5, 7, 15], [8.4, 7.5, 55]]) {
        const loop = append('g', { transform: `translate(${centerX} ${centerY}) rotate(${angle})` }, pattern);
        append('path', { d: 'M-1 1C-3-2 2-3 1 1C0 3-1 1 0 0', fill: 'none', stroke: '#000', 'stroke-width': 1.5, opacity: .38, 'stroke-linecap': 'round' }, loop);
        append('path', { d: 'M-1 .2C-2-1.8 1.8-2.2 1 .2', fill: 'none', stroke: '#fff', 'stroke-width': .7, opacity: .34, 'stroke-linecap': 'round' }, loop);
      }
    } else {
      const path = kind === 'woven' || kind === 'printed' ? `M0 .5H${size}M.5 0V${size}` : 'M-1 1L1-1M0 4L4 0M3 5L5 3';
      append('path', { d: path, fill: 'none', stroke: '#000', 'stroke-width': kind === 'embroidered' ? 1 : .5, opacity: kind === 'printed' ? .08 : .28 }, pattern);
      append('path', { d: path, transform: 'translate(.6 .6)', fill: 'none', stroke: '#fff', 'stroke-width': .45, opacity: kind === 'printed' ? .07 : .32 }, pattern);
      if (kind === 'embroidered') append('path', { d: 'M1 3L2 2', stroke: '#fff', 'stroke-width': .65, opacity: .22 }, pattern);
    }
    return `url(#${prefix}-${name})`;
  };
  const baseTexture = texturePattern('base-texture', settings.material);
  const artTexture = texturePattern('art-texture', settings.application);
  let shape: Element;
  if (settings.shape === 'circle' || settings.shape === 'oval') {
    const radius = Math.min(innerWidth, innerHeight) / 2;
    shape = append('ellipse', { cx: width / 2, cy: height / 2, rx: settings.shape === 'circle' ? radius : innerWidth / 2, ry: settings.shape === 'circle' ? radius : innerHeight / 2 });
  } else if (settings.shape === 'shield') {
    shape = append('path', { d: `M${inset} ${inset + innerHeight * .12}Q${width / 2} ${inset - innerHeight * .12} ${width - inset} ${inset + innerHeight * .12}V${height * .55}Q${width - inset} ${height * .85} ${width / 2} ${height - inset}Q${inset} ${height * .85} ${inset} ${height * .55}Z` });
  } else if (settings.shape === 'arch') {
    shape = append('path', { d: `M${inset} ${height - inset}V${inset + innerHeight * .42}C${inset} ${inset - innerHeight * .14} ${width - inset} ${inset - innerHeight * .14} ${width - inset} ${inset + innerHeight * .42}V${height - inset}Z` });
  } else if (settings.shape === 'banner') {
    shape = append('path', { d: `M${inset} ${inset}H${width - inset}L${width - inset - innerWidth * .12} ${height / 2}L${width - inset} ${height - inset}H${inset}L${inset + innerWidth * .12} ${height / 2}Z` });
  } else if (settings.shape === 'auto' && settings.contour?.length) {
    shape = append('path', { d: settings.contour.map((point, index) => `${index ? 'L' : 'M'}${inset + point[0] * innerWidth} ${inset + point[1] * innerHeight}`).join(' ') + 'Z', 'stroke-linejoin': 'round' });
  } else {
    shape = append('rect', { x: inset, y: inset, width: innerWidth, height: innerHeight, rx: settings.shape === 'rectangle' || settings.shape === 'square' ? 0 : shorter * Math.max(0, Math.min(50, settings.cornerRadius)) / 100 });
  }
  shape.setAttribute('id', `${prefix}-shape`);
  shape.remove(); defs.appendChild(shape);
  const clip = append('clipPath', { id: `${prefix}-clip` }, defs);
  append('use', { href: `#${prefix}-shape` }, clip);
  const body = append('g', { transform: `translate(${detail.flipX ? width : 0} ${detail.flipY ? height : 0}) scale(${detail.flipX ? -1 : 1} ${detail.flipY ? -1 : 1})` });
  append('use', { href: `#${prefix}-shape`, fill: detail.fill, stroke: detail.outline, 'stroke-width': edgeWidth, 'stroke-linejoin': 'round', filter: `url(#${prefix}-attachment)` }, body);
  if (settings.material === 'leather') append('use', { href: `#${prefix}-shape`, fill: detail.fill, filter: `url(#${prefix}-grain)`, opacity: .32 }, body);
  else if (settings.material !== 'pvc') append('use', { href: `#${prefix}-shape`, fill: baseTexture }, body);
  append('use', { href: `#${prefix}-shape`, fill: `url(#${prefix}-sheen)`, opacity: settings.material === 'pvc' || settings.material === 'leather' ? .7 : .3 }, body);
  const artwork = append('g', { 'clip-path': `url(#${prefix}-clip)` }, body);
  if (settings.artwork?.startsWith('data:image/png;base64,')) {
    const scale = Math.max(.1, Math.min(1.2, settings.artworkScale / 100));
    const padding = shorter * Math.max(0, Math.min(35, settings.padding)) / 100 + edgeWidth / 2;
    const imageWidth = Math.max(1, innerWidth - padding * 2) * scale, imageHeight = Math.max(1, innerHeight - padding * 2) * scale;
    const imageAttributes = { href: settings.artwork, x: (width - imageWidth) / 2, y: (height - imageHeight) / 2, width: imageWidth, height: imageHeight, preserveAspectRatio: 'xMidYMid meet' };
    const image = append('image', { ...imageAttributes, 'data-patch-artwork': '' }, artwork);
    const artFilter = filter('artwork');
    const embossed = settings.application === 'embossed' || settings.application === 'debossed';
    const moulded = settings.application === 'moulded';
    if (embossed) {
      append('feColorMatrix', { in: 'SourceGraphic', type: 'matrix', values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -.2126 -.7152 -.0722 1 0', result: 'imprint' }, artFilter);
      append('feFlood', { 'flood-color': detail.fill, result: 'leather' }, artFilter);
      append('feComposite', { in: 'leather', in2: 'imprint', operator: 'in', result: 'surface' }, artFilter);
    } else if (moulded) {
      const transfer = append('feComponentTransfer', { in: 'SourceGraphic', result: 'surface' }, artFilter);
      for (const channel of ['R', 'G', 'B']) append(`feFunc${channel}`, { type: 'discrete', tableValues: '0 .18 .36 .54 .72 .9 1' }, transfer);
    }
    const recessed = settings.application === 'debossed' || moulded && settings.relief === 'recessed';
    const artDepth = settings.application === 'printed' || settings.application === 'woven' ? 0 : depth;
    append('feDropShadow', { dx: .35 * artDepth, dy: (recessed ? -1 : 1) * artDepth, stdDeviation: .35 + artDepth * .15, 'flood-color': '#000', 'flood-opacity': artDepth ? .7 : 0 }, artFilter);
    append('feDropShadow', { dx: -.25 * artDepth, dy: (recessed ? 1 : -1) * artDepth * .55, stdDeviation: .2, 'flood-color': '#fff', 'flood-opacity': artDepth ? .45 : 0 }, artFilter);
    image.setAttribute('filter', `url(#${prefix}-artwork)`);
    if (['embroidered', 'chenille', 'woven'].includes(settings.application)) {
      const mask = append('mask', { id: `${prefix}-art-mask`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width, height, style: 'mask-type:alpha' }, defs);
      append('image', imageAttributes, mask);
      append('rect', { width, height, fill: artTexture, mask: `url(#${prefix}-art-mask)`, 'data-patch-artwork-texture': settings.application }, artwork);
    }
  }
  const edge = append('g', { 'data-patch-edge': settings.edgeStyle }, body);
  const rim = (attributes: Record<string, string | number>) => append('use', { href: `#${prefix}-shape`, fill: 'none', 'stroke-linejoin': 'round', ...attributes }, edge);
  if (edgeWidth > 0) {
    rim({ stroke: detail.outline, 'stroke-width': edgeWidth });
    rim({ stroke: `url(#${prefix}-sheen)`, 'stroke-width': edgeWidth, opacity: .85 });
    if (settings.edgeStyle === 'merrow') {
      rim({ stroke: '#000', 'stroke-width': edgeWidth, 'stroke-dasharray': '.55 1.2', opacity: .4 });
      rim({ stroke: '#fff', 'stroke-width': edgeWidth * .82, 'stroke-dasharray': '.35 1.4', 'stroke-dashoffset': .7, opacity: .3 });
    } else if (settings.edgeStyle === 'raw') {
      rim({ stroke: detail.fill, 'stroke-width': edgeWidth, 'stroke-dasharray': '.5 1.1', opacity: .85 });
    } else if (settings.edgeStyle === 'folded') {
      rim({ stroke: '#000', 'stroke-width': .65, opacity: .5 });
    } else if (settings.material === 'pvc' || settings.material === 'leather') {
      rim({ stroke: '#fff', 'stroke-width': .6, opacity: .35 });
    }
  }
  const sewn = settings.finish === 'stitched' || settings.finish === 'sewOn';
  if (sewn && settings.stitchedEdge) {
    const offset = edgeWidth / 2 + 2;
    const transform = `translate(${offset} ${offset}) scale(${Math.max(.1, (width - offset * 2) / width)} ${Math.max(.1, (height - offset * 2) / height)})`;
    rim({ transform, stroke: '#000', 'stroke-width': 1.5, 'stroke-dasharray': '.5 3.5', 'stroke-linecap': 'round', opacity: .6 });
    rim({ transform, stroke: detail.stitch, 'stroke-width': .9, 'stroke-dasharray': '2.5 1.5', 'stroke-linecap': 'round' });
    rim({ transform, stroke: '#fff', 'stroke-width': .25, 'stroke-dasharray': '2.3 1.7', opacity: .5 });
  }
  return new XMLSerializer().serializeToString(svg);
}