import {
  getDefaultGarmentSelection, getGarmentAssetsForFit, resolveGarmentLayers,
  type ResolvedGarmentLayer,
} from '../../src/app/data/garmentSvgCatalog';
import { tintPotraceSvg } from '../../src/app/lib/tshirtSvgUtils';
import { getPotraceSvgBBox } from '../../src/app/lib/tshirtSvgUtils';
import { decorationsForView, replaceViewDecorations } from '../../src/app/data/garmentView';
import type { TshirtHemStyles } from '../../src/app/data/tshirtHemStyles';
import {
  measureStitchGeometry, renderStitchStyles, stitchPatternPath, TSHIRT_STITCH_OPTIONS, TSHIRT_STITCH_REGIONS,
  type StitchRegion, type TshirtStitching,
} from '../../src/app/data/tshirtStitching';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function verifyBackViews() {
  const parts = { base: '#A3C4C9', neck: '#E8C94F', sleeveLeft: '#D85246', sleeveRight: '#428D78',
    underSleeveLeft: '#446EB8', underSleeveRight: '#BE548D' };
  let combinations = 0;
  let stitchChecks = 0;
  for (const fit of ['slim', 'regular', 'boxy', 'oversized']) {
    for (const sleeve of getGarmentAssetsForFit('tshirt', 'Sleeve length', fit)) {
      for (const neck of getGarmentAssetsForFit('tshirt', 'Neck', fit)) {
        const selection = { ...getDefaultGarmentSelection('tshirt', fit), 'Sleeve length': sleeve.id, Neck: neck.id };
        const input = { garmentType: 'tshirt' as const, fit, selection, partColors: parts,
          tshirtHemStyles: { sleeve: 'ribbed', bottom: 'none', undersleeve: 'ribbed' } as TshirtHemStyles };
        const snapshot = JSON.stringify(input);
        const front = resolveGarmentLayers(input);
        const back = resolveGarmentLayers({ ...input, view: 'back' });
        const label = `${fit}/${sleeve.displayName}/${neck.displayName}`;
        for (const layer of front.filter(layer => !['base', 'neck', 'innerBackNeck', 'outline', 'stitching'].includes(layer.id))) {
          check(JSON.stringify(back.find(candidate => candidate.id === layer.id)) === JSON.stringify(layer), `${label}: changed ${layer.id}`);
        }
        for (const [id, tint] of Object.entries(parts)) {
          const layer = back.find(candidate => candidate.id === id);
          if (layer) check(layer.tint === tint, `${label}: lost ${id} colour`);
        }
        check(!back.some(layer => layer.id === 'innerBackNeck'), `${label}: front inner neck remains`);
        const bounds = getPotraceSvgBBox(back.find(layer => layer.id === 'neck')!.svgRaw)!;
        check(bounds.maxY - bounds.minY < 110, `${label}: deep front neck on rear`);
        check(bounds.minY < (fit === 'slim' ? 260 : 365), `${label}: rear collar is below the neck opening`);
        const image = await renderLayers(back, 256);
        const frontImage = await renderLayers(front, 256);
        const frontNeckBounds = getPotraceSvgBBox(front.find(layer => layer.id === 'neck')!.svgRaw)!;
        const outsideLeft = Math.floor((Math.min(frontNeckBounds.minX, bounds.minX) - 18) / 8);
        const outsideRight = Math.ceil((Math.max(frontNeckBounds.maxX, bounds.maxX) + 18) / 8);
        const belowNeck = Math.ceil((Math.max(frontNeckBounds.maxY, 522) + 32) / 8);
        for (let row = 0; row < 256; row++) {
          for (let column = 0; column < 256; column++) {
            if (column >= outsideLeft && column <= outsideRight && row <= belowNeck) continue;
            const offset = (row * 256 + column) * 4;
            for (let channel = 0; channel < 4; channel++) {
              check(Math.abs(image.pixels[offset + channel] - frontImage.pixels[offset + channel]) <= 2,
                `${label}: changed body outside neck at ${column},${row}`);
            }
          }
        }
        const center = (Math.round((bounds.maxY + 28) / 8) * 256 + 128) * 4;
        check(image.pixels[center + 3] > 240, `${label}: hole below rear neck`);
        check(image.pixels[center] === 163 && image.pixels[center + 1] === 196, `${label}: front neck ink or incorrect body tint remains`);
        check(JSON.stringify(input) === snapshot, `${label}: input mutated`);
        check(JSON.stringify(resolveGarmentLayers({ ...input, view: 'front' })) === JSON.stringify(front), `${label}: front changed after toggling`);
        if (neck.displayName.startsWith('Crew neck')) {
          const geometry = await measureStitchGeometry(back, fit);
          check(geometry.rows.neckline.length > 0 && geometry.rows.shoulder.length > 0, `${label}: rear construction stitching missing`);
          check(geometry.rows.bottom.length === 0, `${label}: no-hem stitching retained`);
          for (const option of TSHIRT_STITCH_OPTIONS) {
            const markup = renderStitchStyles(back.find(layer => layer.id === 'stitching')!, geometry,
              { neckline: { style: option.value, color: '#123456' } }, input.tshirtHemStyles);
            check(option.value === 'none' ? !markup.includes('#123456') : markup.includes('#123456'), `${label}: rear neckline ${option.value}`);
            stitchChecks++;
          }
        }
        combinations++;
      }
    }
  }
  const saved = [{ id: 'legacy', x: 17 }, { id: 'rear', view: 'back' as const, x: 25 }];
  const next = replaceViewDecorations(saved, 'front', [{ id: 'front', x: 40 }]);
  check(next[0] === saved[1] && decorationsForView(next, 'front')[0].x === 40, 'opposite-side edits lost');
  check(decorationsForView(saved, 'front')[0].id === 'legacy', 'legacy item not front-only');
  check(replaceViewDecorations(next, 'back', []).length === 1, 'side deletion removed other side');
  check(decorationsForView(JSON.parse(JSON.stringify(next)), 'back')[0].id === 'rear', 'saved side lost');
  return { combinations, stitchChecks, decorationIsolation: true };
}

export async function verifyRearCollarConstruction() {
  let pairs = 0;
  let clippedColourPixels = 0;
  const size = 768;
  const scale = size / 2048;
  for (const fit of ['slim', 'regular', 'boxy', 'oversized']) {
    let crewHeight = 0;
    for (const neck of getGarmentAssetsForFit('tshirt', 'Neck', fit)) {
      const input = { garmentType: 'tshirt' as const, fit,
        selection: { ...getDefaultGarmentSelection('tshirt', fit), Neck: neck.id },
        partColors: { base: '#5C7FB2', neck: '#E32D24', sleeveLeft: '#5C7FB2', sleeveRight: '#5C7FB2' } };
      const front = resolveGarmentLayers(input);
      const back = resolveGarmentLayers({ ...input, view: 'back' });
      const label = `${fit}/${neck.displayName}`;
      const collar = back.find(layer => layer.id === 'neck')!;
      const bounds = getPotraceSvgBBox(collar.svgRaw)!;
      const frontBounds = getPotraceSvgBBox(neck.svgRaw)!;
      const height = bounds.maxY - bounds.minY;
      if (neck.displayName.startsWith('Crew neck')) crewHeight = height;
      if (neck.displayName.startsWith('Thin crew')) check(height < crewHeight, `${label}: thin collar not thinner than crew`);
      const outline = back.find(layer => layer.id === 'outline')!.svgRaw;
      const ribbed = !/Polo|Scoop/.test(neck.displayName);
      check(outline.includes('-ribs') === ribbed, `${label}: wrong rear rib construction`);
      check(Math.abs(bounds.centerX - 1024) < .01, `${label}: collar not centered`);
      const collarDocument = new DOMParser().parseFromString(collar.svgRaw, 'image/svg+xml');
      const contour = collarDocument.querySelector('path')!.getAttribute('d')!;
      const points = Array.from(contour.matchAll(/[ML]([\d.]+),([\d.]+)/g), match => match.slice(1).map(Number));
      check(points.length === 146, `${label}: missing source-derived side contour`);
      for (const original of points) {
        check(points.some(mirrored => Math.abs(original[0] + mirrored[0] - 20480) < .001 &&
          Math.abs(original[1] - mirrored[1]) < .001), `${label}: asymmetric vector contour`);
      }
      check(points[0][0] > Math.min(...points.map(point => point[0])) + 50,
        `${label}: vertical end cap replaced the source shoulder angle`);
      for (let index = 65; index <= 72; index++) {
        const previous = points[index - 1];
        const current = points[index];
        check(Math.abs(current[0] - previous[0]) <= 5 * Math.abs(current[1] - previous[1]) + 50,
          `${label}: abrupt jump in source shoulder entry`);
      }
      const outlineDocument = new DOMParser().parseFromString(outline, 'image/svg+xml');
      check(!outlineDocument.querySelector('parsererror'), `${label}: invalid outline SVG`);
      if (ribbed) {
        const ribPath = outlineDocument.querySelector('[data-rear-ribs]')!.getAttribute('d')!;
        const ribs = Array.from(ribPath.matchAll(/M([\d.]+),([\d.]+)L([\d.]+),([\d.]+)/g), match => match.slice(1).map(Number));
        check(ribs.length > 25, `${label}: missing rib sections`);
        const pitch = ribs[1][0] - ribs[0][0];
        for (let index = 0; index < ribs.length; index++) {
          const [startX, startY, endX, endY] = ribs[index];
          check(startX === endX && endY > startY, `${label}: nonvertical rib`);
          if (index) check(Math.abs(startX - ribs[index - 1][0] - pitch) < .001, `${label}: uneven rib spacing`);
          const mirrored = ribs[ribs.length - 1 - index];
          check(Math.abs(startX + mirrored[0] - 2048) < .001 && Math.abs(startY - mirrored[1]) < .001 &&
            Math.abs(endY - mirrored[3]) < .001, `${label}: asymmetric ribs`);
        }
      }
      for (const layers of [front, back]) {
        const image = await renderLayers(layers, size, true);
        const neckImage = await renderLayers([layers.find(layer => layer.id === 'neck')!], size);
        for (let offset = 0; offset < image.pixels.length; offset += 4) {
          if (image.pixels[offset] === 227 && image.pixels[offset + 1] === 45 && image.pixels[offset + 2] === 36 && image.pixels[offset + 3] > 240) {
            check(neckImage.pixels[offset + 3] > 0, `${label}: collar colour escaped its boundary`);
            clippedColourPixels++;
          }
        }
        if (layers !== back) continue;
        const outlineImage = await renderLayers([layers.find(layer => layer.id === 'outline')!], size);
        for (let row = Math.floor(bounds.minY * scale); row <= Math.ceil(bounds.maxY * scale); row++) {
          for (let column = Math.floor(bounds.minX * scale); column < size / 2; column++) {
            const alpha = neckImage.pixels[(row * size + column) * 4 + 3];
            const mirrored = neckImage.pixels[(row * size + size - 1 - column) * 4 + 3];
            check(Math.abs(alpha - mirrored) <= 16, `${label}: asymmetric collar silhouette`);
          }
        }
        for (let column = Math.ceil((bounds.minX + 30) * scale); column < (bounds.maxX - 30) * scale; column++) {
          let first = Math.floor(bounds.minY * scale);
          while (first < bounds.maxY * scale && neckImage.pixels[(first * size + column) * 4 + 3] < 128) first++;
          const above = ((first - 4) * size + column) * 4 + 3;
          check(image.pixels[above] === outlineImage.pixels[above], `${label}: fabric protrudes above collar`);
          let last = Math.ceil(bounds.maxY * scale);
          while (last > first && neckImage.pixels[(last * size + column) * 4 + 3] < 128) last--;
          if (neck.displayName.startsWith('Polo')) {
            for (let row = first + 4; row < last - 4; row++) {
              const offset = (row * size + column) * 4;
              check(image.pixels[offset] === 227 && image.pixels[offset + 1] === 45 && image.pixels[offset + 2] === 36,
                `${label}: internal fold, placket or stray ink`);
            }
          }
          for (let row = first + 2; row < (frontBounds.maxY + 18) * scale; row++) {
            check(image.pixels[(row * size + column) * 4 + 3] > 250, `${label}: unclosed fill edge`);
          }
          for (let row = Math.ceil((bounds.maxY + 18) * scale); row < (frontBounds.maxY + 18) * scale; row++) {
            const offset = (row * size + column) * 4;
            check(Math.abs(image.pixels[offset] - 92) <= 2 && Math.abs(image.pixels[offset + 1] - 127) <= 2 &&
              Math.abs(image.pixels[offset + 2] - 178) <= 2 && image.pixels[offset + 3] > 250,
            `${label}: upper-back line or fill artifact at ${column},${row}`);
          }
        }
      }
      pairs++;
    }
  }
  return { pairs, clippedColourPixels, thinCrewWidth: true, rearRibbing: true,
    symmetry: true, poloInterior: 'clear', closedFill: true, cleanUpperBack: true };
}

export async function verifyRearOutlineWeights() {
  const reports = [];
  const size = 2048;
  for (const fit of ['slim', 'regular', 'boxy', 'oversized']) {
    for (const neck of getGarmentAssetsForFit('tshirt', 'Neck', fit)) {
      const input = { garmentType: 'tshirt' as const, fit,
        selection: { ...getDefaultGarmentSelection('tshirt', fit), Neck: neck.id } };
      const front = resolveGarmentLayers(input).find(layer => layer.id === 'outline')!;
      const back = resolveGarmentLayers({ ...input, view: 'back' }).find(layer => layer.id === 'outline')!;
      const bounds = getPotraceSvgBBox(neck.svgRaw)!;
      const documentSvg = new DOMParser().parseFromString(back.svgRaw, 'image/svg+xml');
      const collar = documentSvg.querySelector('[data-rear-collar-outline]')!;
      const shoulder = documentSvg.querySelector('[data-rear-shoulder-outline]')!;
      const label = `${fit}/${neck.displayName}`;
      const collarWeight = Number(collar.getAttribute('stroke-width'));
      const shoulderWeight = Number(shoulder.getAttribute('stroke-width'));
      check(collar.getAttribute('stroke') === '#141414' && shoulder.getAttribute('stroke') === '#141414',
        `${label}: outline colour changed`);
      const images = await Promise.all([renderLayers([front], size), renderLayers([back], size)]);
      const weights = images.map(image => {
        const edgeAt = (horizontal: number) => {
          const column = Math.floor(horizontal);
          const alpha = (row: number) => image.pixels[(row * size + column) * 4 + 3] / 255;
          let row = Math.floor(bounds.minY - 30);
          while (row < bounds.maxY && alpha(row) < .5) row++;
          const start = row;
          let width = alpha(row - 1);
          while (row < bounds.maxY && alpha(row) >= .5) width += alpha(row++);
          return { start, width: width + alpha(row) };
        };
        const weightAt = (horizontal: number) => {
          const slope = (edgeAt(horizontal + 4).start - edgeAt(horizontal - 4).start) / 8;
          return edgeAt(horizontal).width / Math.sqrt(1 + slope * slope);
        };
        const median = (values: number[]) => values.sort((first, second) => first - second)[Math.floor(values.length / 2)];
        return {
          collar: median(Array.from({ length: 41 }, (_, index) => weightAt(bounds.centerX - 50 + index * 2.5))),
          shoulder: median(Array.from({ length: 17 }, (_, index) =>
            [weightAt(bounds.minX - 16 - index * 2), weightAt(bounds.maxX + 16 + index * 2)]).flat()),
        };
      });
      check(Math.abs(weights[0].collar - collarWeight) < 1, `${label}: collar weight differs from front`);
      check(Math.abs(weights[0].shoulder - shoulderWeight) < 1, `${label}: shoulder weight differs from front`);
      check(Math.abs(weights[1].collar - weights[0].collar) < 1, `${label}: rendered collar weight differs from front`);
      reports.push({ fit, neck: neck.displayName, collarWeight, shoulderWeight });
    }
  }
  return { pairs: reports.length, rasterTolerance: 'less than one SVG unit', reports };
}

export async function renderLayers(layers: ResolvedGarmentLayer[], size = 768, sealBody = false) {
  const markup = layers.map(layer => tintPotraceSvg(layer.svgRaw,
    layer.id === 'outline' ? '#141414' : layer.tint ?? (layer.kind === 'detail' ? '#141414' : '#FFFFFF'),
    'solid', false, sealBody && layer.id === 'base' ? 72 : 0)).join('');
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