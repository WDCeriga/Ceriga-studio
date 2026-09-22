import geometryData from '../../assets/studio-tshirt/hem-styles.json';
import type { ResolvedGarmentLayer } from './garmentSvgCatalog';

export type TshirtHemStyle = 'normal' | 'ribbed' | 'none';
export type TshirtHemStyles = Partial<Record<'sleeve' | 'bottom' | 'undersleeve', TshirtHemStyle>>;

export const TSHIRT_HEM_OPTIONS = [
  { value: 'normal', label: 'Normal Hem' },
  { value: 'ribbed', label: 'Ribbed Hem' },
  { value: 'none', label: 'No Hem' },
] as const;

type HemGeometry = Record<'normalCut' | 'noneCut' | 'stitchCut' | 'fill' | 'ribbing' | 'extraStitch' | 'extraSeam', string>;
const geometry = geometryData as Record<string, Record<string, HemGeometry>>;

function removeInk(raw: string, path: string, id: string): string {
  if (!path) return raw;
  const keep = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1536 1536"><path fill="white" fill-rule="evenodd" d="M0,0H1536V1536H0Z ${path}"/></svg>`;
  const mask = `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:alpha"><image href="data:image/svg+xml;base64,${btoa(keep)}" width="2048" height="2048"/></mask></defs>`;
  return raw.replace(/(<svg[^>]*>)/, `$1${mask}<g mask="url(#${id})">`)
    .replace('</svg>', '</g></svg>');
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
    const group = id === 'bodyHem' ? 'bottom' : id.startsWith('underlayer') ? 'undersleeve' : 'sleeve';
    const style = styles?.[group] ?? 'normal';
    resolved = resolved.map(layer => {
      if (layer.id === id && style === 'none') {
        const fill = `<path transform="translate(0,20480) scale(13.3333333333,-13.3333333333)" fill-rule="evenodd" d="${region.fill}"/>`;
        return { ...layer, svgRaw: layer.svgRaw.replace('</g>', `${fill}</g>`),
          assetId: `${layer.assetId}:hem-${style}` };
      }
      if (!['outline', 'stitching'].includes(layer.id)) return layer;
      const stitching = layer.id === 'stitching';
      const cut = stitching ? (style === 'none' ? region.stitchCut : '')
        : style === 'none' ? region.noneCut : region.normalCut;
      let svgRaw = removeInk(layer.svgRaw, cut, `hem-${fit}-${variant}-${id}-${layer.id}-${style}`);
      const addition = stitching ? (style === 'none' ? '' : region.extraStitch)
        : style === 'none' ? '' : `${region.extraSeam} ${style === 'ribbed' ? region.ribbing : ''}`.trim();
      if (addition) svgRaw = svgRaw.replace('</svg>', `${svgPath(addition, stitching ? layer.tint ?? '#B0B0B0' : '#141414')}</svg>`);
      return { ...layer, svgRaw, assetId: `${layer.assetId}:${id}-${style}` };
    });
  }
  return resolved;
}