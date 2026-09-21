import type { ResolvedGarmentLayer } from './garmentSvgCatalog';
import oversizedSleeveColourMask from '../../assets/studio-tshirt/oversized-sleeve-colour-mask.svg?raw';

const parts = import.meta.glob('../../assets/studio-tshirt/long-sleeves/*.svg', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

const longerShortParts = import.meta.glob('../../assets/studio-tshirt/longer-short-sleeves/*.svg', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

const capParts = import.meta.glob('../../assets/studio-tshirt/cap-sleeves/*.svg', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

const layeredLongParts = import.meta.glob('../../assets/studio-tshirt/layered-long-sleeves/*.svg', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

function withOversizedSleeveColourBoundary(layers: ResolvedGarmentLayer[]): ResolvedGarmentLayer[] {
  const maskUrl = `data:image/svg+xml;base64,${btoa(oversizedSleeveColourMask)}`;
  return layers.map(layer => {
    if (!['sleeveLeft', 'sleeveRight'].includes(layer.id)) return layer;
    const maskId = `oversized-armhole-colour-${layer.id}`;
    const defs = `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:alpha"><image href="${maskUrl}" width="2048" height="2048"/></mask></defs>`;
    const svgRaw = layer.svgRaw
      .replace(/(<svg[^>]*>)/, `$1${defs}<g mask="url(#${maskId})">`)
      .replace('</svg>', '</g></svg>');
    return { ...layer, svgRaw };
  });
}

export function withLayeredLongSleeves(
  layers: ResolvedGarmentLayer[], fit: string,
  partColors: Partial<Record<string, string>> = {},
): ResolvedGarmentLayer[] {
  const additions: Record<string, string> = {
    sleeveLeft: 'left', sleeveRight: 'right', outline: 'outline', stitching: 'stitch',
  };
  const resolved = layers.map(layer => {
    const name = additions[layer.id];
    if (!name) return layer;
    const raw = layeredLongParts[`../../assets/studio-tshirt/layered-long-sleeves/${fit}-${name}.svg`];
    const group = raw?.match(/<g[\s\S]*<\/g>/)?.[0];
    if (!group) return layer;
    const svgRaw = name === 'outline'
      ? layer.svgRaw.replace('</svg>', `${group}</svg>`)
      : layer.svgRaw.replace('</g>', `${group.replace(/^<g[^>]*>|<\/g>$/g, '')}</g>`);
    return { ...layer,
      svgRaw,
      assetId: `${layer.assetId}:layered-long`,
      displayName: `${layer.displayName} - Layered Long Sleeve`,
    };
  });
  for (const side of ['left', 'right'] as const) {
    const suffix = side === 'left' ? 'Left' : 'Right';
    const sleeve = layers.find(layer => layer.id === `sleeve${suffix}`);
    const svgRaw = layeredLongParts[`../../assets/studio-tshirt/layered-long-sleeves/${fit}-${side}-hem.svg`];
    if (!sleeve || !svgRaw) continue;
    const id = `underlayerHem${suffix}`;
    resolved.push({
      id,
      category: `${suffix} underlayer sleeve hem`,
      assetId: `${fit}:${id}:layered-long`,
      displayName: `${suffix} underlayer sleeve hem`,
      svgRaw,
      kind: 'solid',
      tint: partColors[id] ?? sleeve.tint,
      zIndex: sleeve.zIndex + 1,
    });
  }
  return fit === 'oversized' ? withOversizedSleeveColourBoundary(resolved) : resolved;
}

/** Keep the original torso/neck ink and replace only the raster-defined sleeves. */
export function withLongSleeves(
  layers: ResolvedGarmentLayer[], fit: string, variant: 'long' | 'longer-short' | 'cap' = 'long',
): ResolvedGarmentLayer[] {
  const assets = variant === 'long' ? parts : variant === 'cap' ? capParts : longerShortParts;
  const part = (selectedFit: string, name: string): string =>
    assets[`../../assets/studio-tshirt/${variant}-sleeves/${selectedFit}-${name}.svg`];
  const keep = part(fit, 'keep');
  if (!keep) return layers;
  const keepUrl = `data:image/svg+xml;base64,${btoa(keep)}`;
  const replacements: Record<string, string> = {
    sleeveLeft: 'left', sleeveRight: 'right',
    sleeveHemLeft: 'left-cuff', sleeveHemRight: 'right-cuff',
  };
  const resolved = layers.map(layer => {
    const replacement = replacements[layer.id];
    if (replacement) return { ...layer, svgRaw: part(fit, replacement),
      assetId: `${layer.assetId}:${variant}`,
      displayName: `${layer.displayName} — ${variant === 'long' ? 'long sleeve' : variant === 'cap' ? 'Cap Sleeve' : 'longer short sleeve'}` };
    if (layer.id === 'base' && !['regular', 'oversized'].includes(fit)) return layer;
    if (!['base', 'outline', 'stitching'].includes(layer.id)) return layer;
    const maskId = `${variant}-sleeve-torso-${fit}-${layer.id}`;
    // The mask contains an image, so path-based hit bounds still describe the
    // garment rather than the full-canvas mask. Its alpha is the traced keep area.
    const defs = `<defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048" style="mask-type:alpha"><image href="${keepUrl}" width="2048" height="2048"/></mask></defs>`;
    let svg = layer.svgRaw.replace(/(<svg[^>]*>)/, `$1${defs}<g mask="url(#${maskId})">`)
      .replace('</svg>', '</g></svg>');
    const extra = layer.id === 'outline' ? 'outline' : layer.id === 'stitching' ? 'stitch' : undefined;
    if (extra) {
      // Both groups have the same Potrace coordinates. Inherit the original
      // group's tint for the new stitches; construction remains structural ink.
      const raw = part(fit, extra);
      const group = raw.match(/<g[\s\S]*<\/g>/)?.[0] ?? '';
      const colour = extra === 'stitch' ? (layer.tint ?? '#B0B0B0') : '#141414';
      svg = svg.replace('</svg>', group.replace(/fill="#[0-9a-f]+"/gi, `fill="${colour}"`) + '</svg>');
    }
    return { ...layer, svgRaw: svg };
  });
  return fit === 'oversized' && variant === 'cap' ? withOversizedSleeveColourBoundary(resolved) : resolved;
}
