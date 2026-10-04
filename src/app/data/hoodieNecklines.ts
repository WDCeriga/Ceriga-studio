import type { GarmentAssetSelection, ResolvedGarmentLayer } from './garmentSvgCatalog';
import { hoodieNecklineLandmarks } from './hoodieAuthoredSeams';
import calibration from '../../assets/studio-hoodie/neckline-donors/calibration.json';

const donors = import.meta.glob<string>('../../assets/studio-hoodie/neckline-donors/*.svg', { eager: true, query: '?raw', import: 'default' });
type Point = [number, number];
type Profile = { inner: Point[]; outer: Point[]; rearOuter: Point[]; rearInner: Point[]; left: Point; right: Point };
const profiles = new Map<string, Profile>(Object.entries(calibration.profiles) as [string, Profile][]);
const sockets = new Map<string, { left: Point; right: Point; bottom: number }>(Object.entries(calibration.sockets) as [string, { left: Point; right: Point; bottom: number }][]);
const namespace = 'http://www.w3.org/2000/svg';

function sourceKey(raw: string) {
  let hash = 2166136261;
  for (let index = 0; index < raw.length; index++) hash = Math.imul(hash ^ raw.charCodeAt(index), 16777619);
  return `${raw.length}-${hash >>> 0}`;
}

export function sweatshirtCalibration() {
  return { profiles: Object.fromEntries(profiles), sockets: Object.fromEntries(sockets) };
}

function probe(raw: string) {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden';
  host.innerHTML = raw;
  document.body.append(host);
  const svg = host.querySelector('svg')!;
  const paths = Array.from(svg.querySelectorAll('path')).filter(path => !path.closest('defs'));
  const transforms = paths.map(path => path.getCTM()!.inverse());
  return { paths, svg, remove: () => host.remove(), contains: (column: number, row: number) => {
    const point = new DOMPoint(column, row);
    return paths.some((path, index) => path.isPointInFill(point.matrixTransform(transforms[index])));
  } };
}

export function sweatshirtDonorRaw(id: SweatshirtNeckline) {
  const option = SWEATSHIRT_NECKLINES.find(candidate => candidate.id === id)!;
  return Object.entries(donors).find(([path]) => path.toLowerCase().endsWith(`/${option.donor} (boxy).svg`))![1];
}

function donorProfile(raw: string): Profile {
  const key = sourceKey(raw);
  const cached = profiles.get(key);
  if (cached?.rearOuter) return cached;
  const source = probe(raw);
  try {
    const group = source.svg.querySelector('g')!;
    const bounds = group.getBBox();
    const matrix = group.getCTM()!;
    const corners = [new DOMPoint(bounds.x, bounds.y), new DOMPoint(bounds.x + bounds.width, bounds.y + bounds.height)].map(point => point.matrixTransform(matrix));
    const minX = Math.ceil(Math.min(...corners.map(point => point.x)));
    const maxX = Math.floor(Math.max(...corners.map(point => point.x)));
    const minY = Math.floor(Math.min(...corners.map(point => point.y)));
    const maxY = Math.ceil(Math.max(...corners.map(point => point.y)));
    const inner: Point[] = [];
    const outer: Point[] = [];
    const rearOuter: Point[] = [];
    const rearInner: Point[] = [];
    for (let column = minX; column <= maxX; column += 1) {
      let bottom = maxY;
      while (bottom >= minY && !source.contains(column, bottom)) bottom -= 0.5;
      if (bottom < minY) continue;
      let top = bottom;
      while (top >= minY && source.contains(column, top)) top -= 0.5;
      outer.push([column, bottom + 0.25]);
      inner.push([column, top + 0.25]);
      let rearTop = minY;
      while (rearTop <= bottom && !source.contains(column, rearTop)) rearTop += 0.5;
      let rearBottom = rearTop;
      while (rearBottom <= bottom && source.contains(column, rearBottom)) rearBottom += 0.5;
      rearOuter.push([column, rearTop - 0.25]);
      rearInner.push([column, Math.min(rearBottom - 0.25, top + 0.25)]);
    }
    if (outer.length < 20) throw new Error('Donor neckline has no usable band');
    const profile = { inner, outer, rearOuter, rearInner, left: outer[0], right: outer[outer.length - 1] };
    profiles.set(key, profile);
    return profile;
  } finally { source.remove(); }
}

function bodySocket(raw: string, fit: string) {
  const key = fit + sourceKey(raw);
  const cached = sockets.get(key);
  if (cached) return cached;
  const seed = hoodieNecklineLandmarks(fit);
  if (!seed) throw new Error(`Unknown sweatshirt fit: ${fit}`);
  const source = probe(raw);
  try {
    const topAt = (column: number) => {
      for (let row = seed.sideY - 85; row <= seed.frontY + 60; row += 0.5) {
        if (source.contains(column, row)) return row;
      }
      throw new Error(`No sweatshirt socket at ${column}`);
    };
    const side = (center: number): Point => {
      const points: Point[] = [];
      for (let column = center - 35; column <= center + 35; column++) points.push([column, topAt(column)]);
      return points.sort((first, second) => first[1] - second[1] || Math.abs(first[0] - center) - Math.abs(second[0] - center))[0];
    };
    const socket = { left: side(seed.sideX), right: side(2 * seed.center - seed.sideX), bottom: topAt(seed.center) };
    sockets.set(key, socket);
    return socket;
  } finally { source.remove(); }
}

const line = (points: Point[]) => points.map(([column, row], index) => `${index ? 'L' : 'M'}${column.toFixed(2)},${row.toFixed(2)}`).join('');

export function withSweatshirtNeckline(layers: ResolvedGarmentLayer[], selection: GarmentAssetSelection, fit: string, tint?: string): ResolvedGarmentLayer[] {
  const option = sweatshirtNeckline(selection);
  if (!option) return layers;
  const base = layers.find(layer => layer.id === 'base');
  if (!base || typeof document === 'undefined') return layers.filter(layer => layer.id !== 'hood');
  const socket = bodySocket(base.svgRaw, fit);
  const donorRaw = sweatshirtDonorRaw(option.id);
  const profile = donorProfile(donorRaw);
  const scale = (socket.right[0] - socket.left[0]) / (profile.right[0] - profile.left[0]);
  const requestedWidth = Number(selection.NeckFinishWidth ?? 1);
  const width = Number.isFinite(requestedWidth) ? Math.max(0.4, Math.min(1.8, requestedWidth)) : 1;
  const register = ([column, row]: Point): Point => {
    const progress = (column - profile.left[0]) / (profile.right[0] - profile.left[0]);
    const donorBaseline = profile.left[1] + progress * (profile.right[1] - profile.left[1]);
    return [socket.left[0] + (column - profile.left[0]) * scale,
      socket.left[1] + progress * (socket.right[1] - socket.left[1]) + (row - donorBaseline) * scale];
  };
  const outer = profile.outer.map(register);
  const inner = profile.inner.map((point, index) => register([point[0], profile.outer[index][1] - (profile.outer[index][1] - point[1]) * width]));
  const rearOuter = profile.rearOuter.map(register);
  const rearInner = profile.rearInner.map(register);
  const band = `${line(outer)}${line([...inner].reverse()).replace(/^M/, 'L')}Z`;
  const rearBand = `${line(rearOuter)}${line([...rearInner].reverse()).replace(/^M/, 'L')}Z`;
  const potrace = ([column, row]: Point): Point => [column * 10, 20480 - row * 10];
  const fabricBand = `${line(outer.map(potrace))}${line([...inner].reverse().map(potrace)).replace(/^M/, 'L')}Z${line(rearOuter.map(potrace))}${line([...rearInner].reverse().map(potrace)).replace(/^M/, 'L')}Z`;
  const origin = register([0, 0]);
  const axis = register([1, 0]);
  const shear = axis[1] - origin[1];
  const donorPaths = new DOMParser().parseFromString(donorRaw, 'image/svg+xml').querySelector('g')!.innerHTML;
  const registeredDonor = `<g transform="matrix(${scale},${-shear},0,${scale},${origin[0] * 10},${20480 - origin[1] * 10 - 20480 * scale})">${donorPaths}</g>`;
  const fabric = width === 1 ? registeredDonor : `<path d="${fabricBand}"/>`;
  const opening = `M${socket.left[0]},0L${socket.right[0]},0${line([...inner].reverse()).replace(/^M/, 'L')}Z`;
  const patchBottom = Math.max(socket.bottom + 14, ...outer.map(point => point[1])) + 8;
  const patch = `${line([socket.left, socket.right, [socket.right[0], patchBottom], [socket.left[0], patchBottom]])}Z`;
  const id = `sweatshirt-${fit}-${option.id}`;
  const doc = new DOMParser().parseFromString(base.svgRaw, 'image/svg+xml');
  const root = doc.documentElement;
  const content = root.innerHTML;
  root.setAttribute('data-sweatshirt-fit', fit);
  root.innerHTML = `<g mask="url(#${id}-opening)">${content}<g data-linked-fabric="true" fill="#000000"><path d="${patch}"/></g></g><defs><mask id="${id}-opening" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><path d="${opening}" fill="black"/></mask></defs>`;
  const ribs = selection.NeckFinish === 'clean' ? '' : outer.filter((_, index) => index % 7 === 0).map((point, index) => {
    const innerPoint = inner[index * 7];
    return `<path d="${line([innerPoint, point])}"/>`;
  }).join('');
  const neckRaw = `<svg xmlns="${namespace}" width="2048" height="2048" viewBox="0 0 2048 2048" data-sweatshirt-fit="${fit}" data-neckline="${option.id}" data-socket="${socket.left.join(',')} ${socket.right.join(',')}"><g transform="translate(0,2048) scale(0.1,-0.1)" fill="#000000">${fabric}</g><g fill="none" stroke="#141414" stroke-width="1.5" stroke-linejoin="round"><path d="${band}${rearBand}"/><g stroke-opacity=".35" stroke-width="1">${ribs}</g></g></svg>`;
  const boundsSvg = `<svg xmlns="${namespace}" width="2048" height="2048" viewBox="0 0 2048 2048"><g transform="translate(0,2048) scale(0.1,-0.1)" fill="#000000"><path d="${fabricBand}"/></g></svg>`;
  return [...layers.filter(layer => layer.id !== 'hood').map(layer => layer.id === 'base' ? { ...layer, svgRaw: new XMLSerializer().serializeToString(root), transformReferenceSvg: base.transformReferenceSvg ?? base.svgRaw } : layer),
    { id: 'neck', category: 'Neck', assetId: id, displayName: option.label, svgRaw: neckRaw, transformReferenceSvg: boundsSvg, kind: 'solid' as const, tint, zIndex: 40 }];
}

export const SWEATSHIRT_NECKLINES = [
  { id: 'crew', label: 'Crew Neck', donor: 'crew neck', finish: 'ribbed' },
  { id: 'thin-crew', label: 'Thin Crew Neck', donor: 'thin crew neck', finish: 'ribbed' },
  { id: 'v', label: 'V-Neck', donor: 'v-neck', finish: 'ribbed' },
  { id: 'deep-v', label: 'Deep V-Neck', donor: 'deep v-neck', finish: 'ribbed' },
  { id: 'scoop', label: 'Scoop Neck', donor: 'scoop neck', finish: 'clean' },
] as const;

export type SweatshirtNeckline = typeof SWEATSHIRT_NECKLINES[number]['id'];
export type SweatshirtNeckFinish = 'ribbed' | 'clean';

export function sweatshirtNeckline(selection: GarmentAssetSelection) {
  return SWEATSHIRT_NECKLINES.find(option => option.id === selection.NeckConstruction);
}

export function selectSweatshirtConstruction(selection: GarmentAssetSelection, construction: 'hood' | SweatshirtNeckline): GarmentAssetSelection {
  const option = SWEATSHIRT_NECKLINES.find(candidate => candidate.id === construction);
  return { ...selection, NeckConstruction: construction,
    NeckFinish: option?.finish ?? selection.NeckFinish ?? 'ribbed',
    NeckFinishWidth: '1',
  };
}