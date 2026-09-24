import geometryData from '../../assets/studio-tshirt/hem-styles.json';
import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import { tintPotraceSvg } from '../lib/tshirtSvgUtils';

export type TshirtHemStyle = 'normal' | 'ribbed' | 'none';
export type HemSettings = { finish?: TshirtHemStyle; color?: string; stitchColor?: string; depth?: number; ribWeight?: number };
export type HemEditing = { applyAll?: boolean; global?: HemSettings; regions?: Record<string, HemSettings> };
export type TshirtHemStyles = Partial<Record<'sleeve' | 'bottom' | 'undersleeve', TshirtHemStyle>> & { editing?: HemEditing };

export function resolveHemSettings(styles: TshirtHemStyles | undefined, id: string): HemSettings {
  const group = id === 'bodyHem' ? 'bottom' : id.startsWith('underlayer') ? 'undersleeve' : 'sleeve';
  return { finish: styles?.[group] ?? 'normal', ...styles?.editing?.regions?.[id] };
}

export function updateHemSettings(styles: TshirtHemStyles | undefined, ids: string[], selected: string, patch: HemSettings): TshirtHemStyles {
  const editing = styles?.editing ?? {};
  const regions = { ...editing.regions };
  for (const id of editing.applyAll === false ? [selected] : ids) regions[id] = { ...regions[id], ...patch };
  return { ...styles, editing: { ...editing, regions, global: editing.applyAll === false ? editing.global : { ...editing.global, ...patch } } };
}

export function copyHemSettings(styles: TshirtHemStyles | undefined, ids: string[], settings: HemSettings): TshirtHemStyles {
  const regions = { ...styles?.editing?.regions };
  for (const id of ids) regions[id] = { ...settings };
  return { ...styles, editing: { ...styles?.editing, global: { ...settings }, regions } };
}

export const TSHIRT_HEM_OPTIONS = [
  { value: 'normal', label: 'Normal Hem' },
  { value: 'ribbed', label: 'Ribbed Hem' },
  { value: 'none', label: 'No Hem' },
] as const;

type HemGeometry = Record<'normalCut' | 'noneCut' | 'stitchCut' | 'fill' | 'ribbing' | 'extraStitch' | 'extraSeam', string>;
const geometry = geometryData as Record<string, Record<string, HemGeometry>>;

export type HemRegion = { id: string; name: string; category: string; adjustable: boolean; color?: string };
export function availableHemRegions(layers: ResolvedGarmentLayer[], garmentType: string): HemRegion[] {
  const names: Record<string, string> = { sleeveHemLeft: 'Left sleeve hem / cuff', sleeveHemRight: 'Right sleeve hem / cuff',
    bodyHem: 'Bottom hem', underlayerHemLeft: 'Left underlayer cuff', underlayerHemRight: 'Right underlayer cuff', trouserHem: 'Leg hem' };
  return layers.filter(layer => names[layer.id]).map(layer => ({ id: layer.id, name: names[layer.id], category: layer.category,
    adjustable: garmentType === 'tshirt', color: layer.tint }));
}

function bandTransform(path: string, depth: number): string {
  const points = Array.from(path.matchAll(/(?:M|L)\s*([\d.-]+),([\d.-]+)/g), match => [Number(match[1]), Number(match[2])]);
  if (!points.length) return 'matrix(1 0 0 1 0 0)';
  const meanX = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point[1], 0) / points.length;
  const varianceX = points.reduce((sum, point) => sum + (point[0] - meanX) ** 2, 0);
  const varianceY = points.reduce((sum, point) => sum + (point[1] - meanY) ** 2, 0);
  const covariance = points.reduce((sum, point) => sum + (point[0] - meanX) * (point[1] - meanY), 0);
  const angle = .5 * Math.atan2(2 * covariance, varianceX - varianceY);
  const normalX = -Math.sin(angle), normalY = Math.cos(angle);
  const edge = Math.max(...points.map(point => point[0] * normalX + point[1] * normalY));
  const amount = Math.max(.55, Math.min(1, depth)) - 1;
  return `matrix(${1 + amount * normalX * normalX} ${amount * normalX * normalY} ${amount * normalX * normalY} ${1 + amount * normalY * normalY} ${-amount * edge * normalX} ${-amount * edge * normalY})`;
}

export function hemGroupEnabled(styles: TshirtHemStyles | undefined, group: string): boolean {
  const ids = group === 'bottom' ? ['bodyHem'] : group === 'sleeve' ? ['sleeveHemLeft', 'sleeveHemRight']
    : group === 'undersleeve' ? ['underlayerHemLeft', 'underlayerHemRight'] : [];
  return !ids.length || ids.some(id => resolveHemSettings(styles, id).finish !== 'none');
}

function removeInk(raw: string, path: string, id: string): string {
  if (!path) return raw;
  const keep = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1536"><path fill="white" fill-rule="evenodd" d="M0,0H1536V1536H0Z ${path}"/></svg>`;
  const mask = `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:alpha"><image href="data:image/svg+xml;base64,${btoa(keep)}" width="2048" height="2048"/></mask></defs>`;
  return raw.replace(/(<svg[^>]*>)/, `$1${mask}<g mask="url(#${id})">`)
    .replace(/<\/svg>\s*$/, '</g></svg>');
}

function svgPath(path: string, color: string): string {
  return `<path transform="scale(1.3333333333)" fill="${color}" fill-rule="evenodd" d="${path}"/>`;
}

export function withTshirtHemStyles(
  layers: ResolvedGarmentLayer[], fit: string, variant: string, styles?: TshirtHemStyles,
): ResolvedGarmentLayer[] {
  const regions = geometry[`${fit}:${variant}`];
  if (!regions) return layers;
  let resolved = layers;
  for (const [id, region] of Object.entries(regions)) {
    const settings = resolveHemSettings(styles, id);
    const style = settings.finish ?? 'normal';
    const depth = Number.isFinite(settings.depth) ? Math.max(.55, Math.min(1, settings.depth!)) : 1;
    const transform = bandTransform(region.fill, depth);
    const customDepth = depth !== 1 && style !== 'none';
    const ribWeight = Number.isFinite(settings.ribWeight) ? Math.max(.15, Math.min(.75, settings.ribWeight!)) : .4;
    const band = (path: string, attributes: string) => `<g transform="scale(1.3333333333)"><g transform="${transform}"><path d="${path}" ${attributes}/></g></g>`;
    const parentId = id === 'bodyHem' ? 'base' : id.startsWith('underlayer') ? id.replace('underlayerHem', 'underSleeve') : id.replace('sleeveHem', 'sleeve');
    const parent = layers.find(layer => layer.id === parentId);
    resolved = resolved.map(layer => {
      if (layer.id === id) layer = { ...layer, tint: settings.color === '' ? parent?.tint : settings.color ?? layer.tint ?? parent?.tint };
      if (layer.id === id && customDepth) {
        const tint = /^#[\da-f]{6}$/i.test(layer.tint ?? '') ? layer.tint : undefined;
        const clipId = `hem-depth-${fit}-${variant}-${id}`;
        const fabric = tint ? band(region.fill, `fill="${tint}" fill-rule="evenodd"`)
          : band(region.fill, 'fill-rule="evenodd"').replace('<g transform="scale(1.3333333333)">', '<g transform="scale(1.3333333333)" data-shared-fabric="true" fill="#000000">');
        const addition = `<defs><clipPath id="${clipId}"><path transform="scale(1.3333333333)" d="${region.fill}"/></clipPath></defs><g clip-path="url(#${clipId})">${fabric}</g>`;
        const allowance = `<path data-hem-decoration="true" transform="translate(0,20480) scale(13.3333333333,-13.3333333333)" fill-rule="evenodd" d="${region.fill}"/>`;
        const covered = layer.svgRaw.replace('</g>', `${allowance}</g>`);
        return { ...layer, tint: parent?.tint, svgRaw: covered.replace(/<\/svg>\s*$/, `<g data-hem-decoration="true">${addition}</g></svg>`), assetId: `${layer.assetId}:depth-${depth}:${tint}` };
      }
      if (layer.id === id && style === 'none') {
        const fill = `<path data-hem-decoration="true" transform="translate(0,20480) scale(13.3333333333,-13.3333333333)" fill-rule="evenodd" d="${region.fill}"/>`;
        return { ...layer, svgRaw: layer.svgRaw.replace('</g>', `${fill}</g>`),
          assetId: `${layer.assetId}:hem-${style}` };
      }
      if (!['outline', 'stitching'].includes(layer.id)) return layer;
      const stitching = layer.id === 'stitching';
      const cut = stitching ? (style === 'none' || customDepth ? region.stitchCut : '')
        : style === 'none' || customDepth ? region.noneCut : region.normalCut;
      let svgRaw = removeInk(layer.svgRaw, cut, `hem-${fit}-${variant}-${id}-${layer.id}-${style}`);
      let addition = '';
      if (style !== 'none') {
        if (stitching && customDepth) {
          const clipId = `hem-stitch-${fit}-${variant}-${id}`;
          const source = tintPotraceSvg(layers.find(candidate => candidate.id === 'stitching')!.svgRaw, layer.tint ?? '#B0B0B0');
          addition = `<g transform="scale(1.3333333333)"><g transform="${transform}"><g transform="scale(.75)"><defs><clipPath id="${clipId}"><path transform="scale(1.3333333333)" d="${region.stitchCut}"/></clipPath></defs><g clip-path="url(#${clipId})">${source}</g></g></g></g>${band(region.extraStitch, `fill="${layer.tint ?? '#B0B0B0'}"`)}`;
        } else if (stitching) addition = svgPath(region.extraStitch, layer.tint ?? '#B0B0B0');
        else {
          const seam = customDepth ? band(region.fill, 'fill="none" stroke="#34383e" stroke-width="1.4" stroke-linejoin="round"') : svgPath(region.extraSeam, '#34383e');
          const ribs = style === 'ribbed' ? band(region.ribbing, `fill="#34383e" stroke="#34383e" stroke-width="${ribWeight}" stroke-linejoin="round"`) : '';
          const clipId = `hem-ink-${fit}-${variant}-${id}`;
          const ribClipId = `${clipId}-band`;
          addition = `<defs><clipPath id="${clipId}"><path transform="scale(1.3333333333)" d="${region.noneCut}"/></clipPath><clipPath id="${ribClipId}"><path transform="scale(1.3333333333) ${transform}" clip-rule="evenodd" d="${region.fill}"/></clipPath></defs><g clip-path="url(#${clipId})">${seam}<g data-hem-ribbing="${id}" clip-path="url(#${ribClipId})">${ribs}</g></g>`;
        }
      }
      if (addition) svgRaw = svgRaw.replace(/<\/svg>\s*$/, `<g data-hem-decoration="true">${addition}</g></svg>`);
      return { ...layer, svgRaw, assetId: `${layer.assetId}:${id}-${style}:${depth}:${ribWeight}` };
    });
  }
  return resolved;
}