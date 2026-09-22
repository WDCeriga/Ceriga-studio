import {
  getDefaultGarmentSelection, getGarmentAssetsForFit, resolveGarmentLayers,
  type ResolvedGarmentLayer,
} from '../../src/app/data/garmentSvgCatalog';
import { tintPotraceSvg } from '../../src/app/lib/tshirtSvgUtils';
import type { TshirtHemStyles } from '../../src/app/data/tshirtHemStyles';
import {
  measureStitchGeometry, renderStitchStyles, stitchPatternPath, TSHIRT_STITCH_OPTIONS, TSHIRT_STITCH_REGIONS,
  type StitchRegion, type TshirtStitching,
} from '../../src/app/data/tshirtStitching';

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

async function stitchPixels(svg: string) {
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 768;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0, 768, 768);
  return context.getImageData(0, 0, 768, 768).data;
}

export async function verifyStitchStyles() {
  const straight = [{ x: 0, y: 100 }, { x: 200, y: 100 }];
  const standard = stitchPatternPath(straight, 'standard');
  const dashes = standard.split('M').filter(Boolean).map(segment => {
    const points = segment.split('L').map(point => point.split(',').map(Number));
    return { start: points[0][0], end: points.at(-1)![0] };
  });
  check(dashes.length === 11, 'Standard: inconsistent dash density');
  for (const [index, dash] of dashes.entries()) {
    check(Math.abs(dash.end - dash.start - 9) < .02, 'Standard: unequal dash lengths');
    if (index) check(Math.abs(dash.start - dashes[index - 1].end - 9) < .02, 'Standard: unequal gaps');
  }
  check(Math.abs(dashes[0].start - (200 - dashes.at(-1)!.end)) < .02, 'Standard: unbalanced ends');
  for (const [style, rows] of [['double', 2], ['triple', 3]] as const) {
    check(stitchPatternPath(straight, style).split('M').length - 1 === dashes.length * rows, `${style}: incorrect parallel rows`);
  }
  check(stitchPatternPath(straight, 'coverstitch').split('M').length - 1 === 2, 'Coverstitch: expected two clean rails');
  check(stitchPatternPath(straight, 'zigzag').split('L').length - 1 === 20, 'Zigzag: excessive density');
  check(stitchPatternPath(straight, 'overlock').split('M').length - 1 === 11, 'Overlock: excessive loop density');
  check(stitchPatternPath(straight, 'none') === '', 'No Stitching: visible path');
  const regions = Object.keys(TSHIRT_STITCH_REGIONS) as StitchRegion[];
  const none = Object.fromEntries(regions.map(region => [region, { style: 'none' }])) as TshirtStitching;
  let renders = 0, independentAreas = 0, necklineChecks = 0;
  for (const fit of ['slim', 'regular', 'boxy', 'oversized']) {
    for (const sleeve of getGarmentAssetsForFit('tshirt', 'Sleeve length', fit)) {
      const selection = { ...getDefaultGarmentSelection('tshirt', fit), 'Sleeve length': sleeve.id };
      const input = { garmentType: 'tshirt' as const, fit, selection, stitchingColor: '#CC2D24', partColors: { base: '#5C7FB6' } };
      const layers = resolveGarmentLayers(input);
      const before = JSON.stringify(layers);
      const source = layers.find(layer => layer.id === 'stitching')!;
      const geometry = await measureStitchGeometry(layers, fit);
      const context = `${fit}/${sleeve.displayName}`;
      check((geometry.rows.undersleeve.length > 0) === sleeve.displayName.startsWith('Layered Long Sleeve'), `${context}: undersleeve visibility`);
      const baseline = await stitchPixels(tintPotraceSvg(source.svgRaw, source.tint!));
      const silhouette = (await renderLayers(layers.filter(layer => layer.id !== 'stitching'))).pixels;
      const signatures = new Set<string>();
      for (const option of TSHIRT_STITCH_OPTIONS) {
        const settings = Object.fromEntries(regions.map(region => [region, { style: option.value }])) as TshirtStitching;
        const svg = renderStitchStyles(source, geometry, settings);
        check(!new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror'), `${context}/${option.value}: invalid SVG`);
        check(svg.includes('pointer-events="none"') && !svg.includes('tabindex='), `${context}: interactive stitching`);
        const pixels = await stitchPixels(svg);
        let ink = 0, offSeam = 0, outside = 0, signature = 2166136261;
        for (let offset = 0; offset < pixels.length; offset += 4) {
          const alpha = pixels[offset + 3];
          signature = Math.imul(signature ^ alpha, 16777619);
          if (alpha < 32) continue;
          ink++;
          const column = offset / 4 % 768, row = Math.floor(offset / 4 / 768);
          let inside = false;
          for (let deltaY = -1; deltaY <= 1; deltaY++) for (let deltaX = -1; deltaX <= 1; deltaX++) {
            const nextX = column + deltaX, nextY = row + deltaY;
            if (nextX >= 0 && nextX < 768 && nextY >= 0 && nextY < 768 && silhouette[(nextY * 768 + nextX) * 4 + 3] > 16) inside = true;
          }
          if (!inside) outside++;
          let nearby = false;
          for (let deltaY = -8; deltaY <= 8 && !nearby; deltaY++) for (let deltaX = -8; deltaX <= 8; deltaX++) {
            const nextX = column + deltaX, nextY = row + deltaY;
            if (nextX >= 0 && nextX < 768 && nextY >= 0 && nextY < 768 && baseline[(nextY * 768 + nextX) * 4 + 3] > 16) { nearby = true; break; }
          }
          if (!nearby) offSeam++;
        }
        check(option.value === 'none' ? ink === 0 : ink > 100, `${context}/${option.value}: incorrect visible ink ${ink}`);
        check(offSeam === 0, `${context}/${option.value}: ${offSeam} pixels float off the source seam`);
        check(outside === 0, `${context}/${option.value}: ${outside} pixels outside garment`);
        if (option.value === 'standard') {
          check(!svg.includes('<image') && !svg.includes('<svg', 4), `${context}: Standard bypassed the clean path renderer`);
        }
        signatures.add(`${signature}`);
        renders++;
      }
      check(signatures.size === 7, `${context}: styles not visually distinct`);
      for (const region of regions.filter(area => geometry.rows[area].length)) {
        const settings: TshirtStitching = { ...none, [region]: { style: 'zigzag', color: '#10B981' } };
        const svg = renderStitchStyles(source, geometry, settings);
        const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
        check(parsed.querySelectorAll('[data-stitch-region]').length === 1, `${context}/${region}: changed another region`);
        const pixels = await stitchPixels(svg);
        check(pixels.some((value, offset) => offset % 4 === 3 && value > 128 && pixels[offset - 3] < 30 && pixels[offset - 2] > 170), `${context}/${region}: colour not applied`);
        const restored = JSON.parse(JSON.stringify(settings));
        check(renderStitchStyles(source, geometry, restored) === svg, `${context}: serialization changed styles`);
        independentAreas++;
      }
      const noHemStyles: TshirtHemStyles = { sleeve: 'none', bottom: 'none', undersleeve: 'none' };
      const noHemLayers = resolveGarmentLayers({ ...input, tshirtHemStyles: noHemStyles });
      const noHemGeometry = await measureStitchGeometry(noHemLayers, fit);
      const noHemSvg = renderStitchStyles(noHemLayers.find(layer => layer.id === 'stitching')!, noHemGeometry,
        { sleeve: { style: 'triple' }, bottom: { style: 'zigzag' }, undersleeve: { style: 'overlock' } }, noHemStyles);
      for (const region of ['sleeve', 'bottom', 'undersleeve']) check(!noHemSvg.includes(`data-stitch-region="${region}"`), `${context}: floating No Hem stitches`);
      check(JSON.stringify(layers) === before, `${context}: source garment layers mutated`);
      if (sleeve.displayName.startsWith('Short sleeve')) {
        for (const neck of getGarmentAssetsForFit('tshirt', 'Neck', fit)) {
          const neckLayers = resolveGarmentLayers({ ...input, selection: { ...selection, Neck: neck.id } });
          const neckGeometry = await measureStitchGeometry(neckLayers, fit);
          if (!neckGeometry.rows.neckline.length) {
            check(fit === 'slim' && neck.displayName === 'Scoop neck', `${fit}/${neck.displayName}: unexpected missing neckline`);
            necklineChecks++;
            continue;
          }
          const svg = renderStitchStyles(neckLayers.find(layer => layer.id === 'stitching')!, neckGeometry, { ...none, neckline: { style: 'coverstitch' } });
          check((await stitchPixels(svg)).some((value, offset) => offset % 4 === 3 && value > 128), `${fit}/${neck.displayName}: empty neckline`);
          necklineChecks++;
        }
      }
    }
  }
  return { renders, independentAreas, necklineChecks, balancedSpacing: true, outlineContainment: true, geometryPreserved: true, noHemSuppression: true, serialization: true };
}