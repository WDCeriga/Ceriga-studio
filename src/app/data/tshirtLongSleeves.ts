import type { ResolvedGarmentLayer } from './garmentSvgCatalog';

const parts = import.meta.glob('../../assets/studio-tshirt/long-sleeves/*.svg', {
  query: '?raw', import: 'default', eager: true,
}) as Record<string, string>;

function part(fit: string, name: string): string {
  return parts[`../../assets/studio-tshirt/long-sleeves/${fit}-${name}.svg`];
}

/** Keep the original torso/neck ink and replace only the raster-defined sleeves. */
export function withLongSleeves(layers: ResolvedGarmentLayer[], fit: string): ResolvedGarmentLayer[] {
  const keep = part(fit, 'keep');
  if (!keep) return layers;
  const keepUrl = `data:image/svg+xml;base64,${btoa(keep)}`;
  const replacements: Record<string, string> = {
    sleeveLeft: 'left', sleeveRight: 'right',
    sleeveHemLeft: 'left-cuff', sleeveHemRight: 'right-cuff',
  };
  return layers.map(layer => {
    const replacement = replacements[layer.id];
    if (replacement) return { ...layer, svgRaw: part(fit, replacement),
      assetId: `${layer.assetId}:long`, displayName: `${layer.displayName} — long sleeve` };
    if (!['base', 'outline', 'stitching'].includes(layer.id)) return layer;
    const maskId = `long-sleeve-torso-${fit}-${layer.id}`;
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
}
