import {
  getDefaultGarmentSelection, getGarmentAssetsForFit, resolveGarmentLayers,
  type ResolvedGarmentLayer,
} from '../../src/app/data/garmentSvgCatalog';
import { tintPotraceSvg } from '../../src/app/lib/tshirtSvgUtils';
import type { TshirtHemStyles } from '../../src/app/data/tshirtHemStyles';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function renderLayers(layers: ResolvedGarmentLayer[], size = 768) {
  const markup = layers.map(layer => tintPotraceSvg(layer.svgRaw,
    layer.id === 'outline' ? '#141414' : layer.tint ?? (layer.kind === 'detail' ? '#141414' : '#FFFFFF'))).join('');
  const image = new Image();
  image.src = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 2048 2048">${markup}</svg>`)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(image, 0, 0, size, size);
  return { canvas, pixels: context.getImageData(0, 0, size, size).data };
}

export async function verifyHemStyles() {
  const reports = [];
  let necklineChecks = 0;
  const partColors = { base: '#D4D4D4', sleeveLeft: '#CC2D24', sleeveRight: '#10B981',
    underSleeveLeft: '#3B82F6', underSleeveRight: '#EC4899', bodyHem: '#D4D4D4',
    sleeveHemLeft: '#CC2D24', sleeveHemRight: '#10B981',
    underlayerHemLeft: '#3B82F6', underlayerHemRight: '#EC4899' };
  for (const fit of ['slim', 'regular', 'boxy', 'oversized']) {
    for (const sleeve of getGarmentAssetsForFit('tshirt', 'Sleeve length', fit)) {
      const selection = { ...getDefaultGarmentSelection('tshirt', fit), 'Sleeve length': sleeve.id };
      const input = { garmentType: 'tshirt' as const, fit, selection, partColors, stitchingColor: '#141414' };
      const normal = resolveGarmentLayers(input);
      const normalImage = await renderLayers(normal);
      const context = `${fit}/${sleeve.displayName}`;
      const inkCounts: Record<string, number> = {};
      for (const style of ['normal', 'ribbed', 'none'] as const) {
        const layers = resolveGarmentLayers({ ...input,
          tshirtHemStyles: { sleeve: style, bottom: style, undersleeve: style } });
        for (const id of ['base', 'neck', 'innerBackNeck', 'sleeveLeft', 'sleeveRight', 'underSleeveLeft', 'underSleeveRight']) {
          check(JSON.stringify(layers.find(layer => layer.id === id)) === JSON.stringify(normal.find(layer => layer.id === id)), `${context}: ${id} changed`);
        }
        for (const [id, color] of Object.entries(partColors)) {
          const layer = layers.find(candidate => candidate.id === id);
          if (layer) check(layer.tint === color, `${context}: ${id} tint changed`);
        }
        const image = style === 'normal' ? normalImage : await renderLayers(layers);
        let holes = 0;
        let topChanges = 0;
        let ink = 0;
        for (let offset = 0; offset < image.pixels.length; offset += 4) {
          if (normalImage.pixels[offset + 3] > 250 && image.pixels[offset + 3] < 200) holes++;
          if (offset < 768 * 170 * 4 && Math.abs(normalImage.pixels[offset] - image.pixels[offset]) > 10) topChanges++;
          ink += (255 - Math.max(image.pixels[offset], image.pixels[offset + 1], image.pixels[offset + 2]))
            / 255 * image.pixels[offset + 3] / 255;
        }
        check(holes <= 20, `${context}/${style}: ${holes} newly transparent pixels`);
        check(topChanges === 0, `${context}/${style}: ${topChanges} pixels changed near neck/shoulders`);
        inkCounts[style] = ink;
      }
      check(inkCounts.ribbed > inkCounts.normal + 100, `${context}: ribbed construction missing`);
      check(inkCounts.none < inkCounts.normal - 100, `${context}: hem construction not removed`);
      for (const group of ['sleeve', 'bottom', 'undersleeve'] as const) {
        if (group === 'undersleeve' && !sleeve.displayName.startsWith('Layered Long Sleeve')) continue;
        const changed = resolveGarmentLayers({ ...input, tshirtHemStyles: { [group]: 'none' } });
        const unaffected = group === 'bottom' ? ['sleeveHemLeft', 'underlayerHemLeft']
          : group === 'sleeve' ? ['bodyHem', 'underlayerHemLeft'] : ['bodyHem', 'sleeveHemLeft'];
        for (const id of unaffected) check(JSON.stringify(changed.find(layer => layer.id === id)) ===
          JSON.stringify(normal.find(layer => layer.id === id)), `${context}/${group}: changed independent ${id}`);
      }
      for (const neck of getGarmentAssetsForFit('tshirt', 'Neck', fit)) {
        const neckInput = { ...input, selection: { ...selection, Neck: neck.id } };
        const baseline = resolveGarmentLayers(neckInput);
        const changed = resolveGarmentLayers({ ...neckInput, tshirtHemStyles: { sleeve: 'none', bottom: 'none', undersleeve: 'none' } });
        for (const id of ['base', 'neck', 'innerBackNeck']) check(
          JSON.stringify(changed.find(layer => layer.id === id)) === JSON.stringify(baseline.find(layer => layer.id === id)), `${context}/${neck.displayName}: ${id} changed`);
        necklineChecks++;
      }
      reports.push({ fit, sleeve: sleeve.displayName, ...inkCounts });
    }
  }
  return { combinations: reports.length * 3, necklineChecks, reports };
}

export async function hemComparison(fit: string, variant: string, bounds?: number[]) {
  document.getElementById('hem-verification')?.remove();
  const gallery = document.createElement('div');
  gallery.id = 'hem-verification';
  gallery.style.cssText = 'position:fixed;inset:0;z-index:9999;background:white;color:black;padding:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;overflow:auto';
  const selection = getDefaultGarmentSelection('tshirt', fit);
  selection['Sleeve length'] = getGarmentAssetsForFit('tshirt', 'Sleeve length', fit)
    .find(asset => asset.displayName.startsWith(variant))!.id;
  for (const style of ['normal', 'ribbed', 'none'] as const) {
    const tshirtHemStyles: TshirtHemStyles = { sleeve: style, bottom: style, undersleeve: style };
    const { canvas } = await renderLayers(resolveGarmentLayers({ garmentType: 'tshirt', selection, fit, tshirtHemStyles }), 1536);
    const crop = document.createElement('canvas');
    crop.width = bounds ? 600 : 768;
    crop.height = bounds ? 450 : 768;
    crop.style.width = '100%';
    const [left, top, width, height] = bounds ?? [0, 0, 1536, 1536];
    crop.getContext('2d')!.drawImage(canvas, left, top, width, height, 0, 0, crop.width, crop.height);
    const cell = document.createElement('div');
    cell.append(`${fit} / ${variant} / ${style}`, crop);
    gallery.append(cell);
  }
  document.body.append(gallery);
}