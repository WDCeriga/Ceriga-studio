import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGarmentLabel, normalizeLabel, LABEL_FOLDS, LABEL_SHAPES, CARE_OPTIONS, labelPositions, labelVisible, labelWarnings, unfoldedLabelSize, type GarmentLabel, type LabelCategory } from '../../src/app/data/garmentLabels';
import { LabelArtwork, labelLayout } from '../../src/app/components/builder/LabelArtwork';
import { constrainNeckLabel, labelAttachmentMask, labelPlacement, type LabelAttachmentLayer } from '../../src/app/components/builder/GarmentLabelOverlay';
import { getPotraceSvgBBox, splitPotraceSvgBBoxAtCenter } from '../../src/app/lib/tshirtSvgUtils';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function verifyGarmentLabelArtwork() {
  let constructions = 0;
  for (const category of ['neck', 'care', 'tag'] as LabelCategory[]) {
    const original = createGarmentLabel(category);
    check(category === 'care' ? original.careText === '[CARE INSTRUCTIONS]' && labelWarnings(original).includes('Replace template placeholders before production') : !original.brand && !original.composition && !original.origin, 'Invalid label template');
    for (const fold of Object.keys(LABEL_FOLDS) as GarmentLabel['fold'][]) {
      const label = normalizeLabel({ ...original, fold, brand: 'TEST' });
      const unfolded = unfoldedLabelSize(label);
      check(unfolded.width >= label.widthMm && unfolded.height >= label.heightMm, 'Invalid unfolded dimensions');
      check(JSON.stringify(label) === JSON.stringify(JSON.parse(JSON.stringify(label))), 'Label serialization changed');
      constructions++;
    }
    for (const position of labelPositions(category)) {
      const label = { ...original, position };
      if (position.startsWith('neck-')) {
        check(labelVisible(label, 'front') && !labelVisible(label, 'back', true) && !labelVisible(label, 'back'), 'Neck labels must be front-only');
        continue;
      }
      const inside = position.startsWith('care-');
      check(labelVisible(label, 'front', true) === inside, 'Interior visibility mismatch');
      check(!inside || !labelVisible(label, 'front'), 'Inside label visible on exterior');
    }
  }
  for (const shape of Object.keys(LABEL_SHAPES) as GarmentLabel['shape'][]) {
    const label = normalizeLabel({ ...createGarmentLabel('neck'), shape, widthMm: 35, heightMm: 20, brand: 'TEST' });
    if (shape === 'circle' || shape === 'square') check(label.widthMm === label.heightMm, 'Unequal square/circle dimensions');
    const svg = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${label.widthMm} ${label.heightMm}` }, createElement(LabelArtwork, { label })));
    check(!new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror,[data-label-guide],[data-label-handle]'), 'Invalid artwork export');
    const image = new Image(); image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; await image.decode();
  }
  const printed = normalizeLabel({ ...createGarmentLabel('neck'), construction: 'printed', borderEnabled: true });
  check(!renderToStaticMarkup(createElement(LabelArtwork, { label: printed })).includes('data-label-fabric') && !printed.borderEnabled, 'Direct print has fabric');
  const care = createGarmentLabel('care');
  check(labelWarnings(care).filter(value => value.includes('symbol incomplete')).length === 5, 'Missing care categories not flagged');
  for (const [category, options] of Object.entries(CARE_OPTIONS)) {
    for (const value of Object.keys(options).filter(Boolean)) {
      const markup = renderToStaticMarkup(createElement(LabelArtwork, { label: { ...care, care: { ...care.care, [category]: value } } }));
      check(markup.includes((options as Record<string, string>)[value]), `Care symbol missing: ${category}/${value}`);
    }
  }
  check(labelLayout({ ...care, brand: 'UNBREAKABLE'.repeat(20) }).overflow, 'Oversized artwork not flagged');
  check(!labelLayout(care).overflow && labelLayout(care).textLines.length >= 6, 'Care template missing readable sections');
  check(labelLayout({ ...createGarmentLabel('neck'), brand: 'CERIGA' }).textLines[0].size > 3, 'Neck heading too small');
  return { constructions, shapes: Object.keys(LABEL_SHAPES).length, visibility: true, guideFreeArtwork: true, careSymbols: true, serialization: true };
}

export async function verifyFrontNeckLabels() {
  const catalog = await import('../../src/app/data/garmentSvgCatalog');
  let combinations = 0;
  let placements = 0;
  for (const fit of ['slim', 'regular', 'boxy', 'oversized']) {
    for (const neck of catalog.getGarmentAssetsForFit('tshirt', 'Neck', fit)) {
      const selection = { ...catalog.getDefaultGarmentSelection('tshirt', fit), Neck: neck.id };
      const resolved = catalog.resolveGarmentLayers({ garmentType: 'tshirt', fit, selection, view: 'front' });
      const owners = resolved.filter(layer => ['base', 'innerBackNeck'].includes(layer.id));
      const masks = Object.fromEntries(await Promise.all(owners.map(async layer => [layer.id, await labelAttachmentMask(layer.svgRaw)])));
      check(masks.innerBackNeck, `${fit}/${neck.displayName}: missing inner back neck`);
      const layers: LabelAttachmentLayer[] = owners.map(layer => {
        const mask = masks[layer.id];
        let minX = mask.size, minY = mask.size, maxX = 0, maxY = 0;
        for (let row = 0; row < mask.size; row++) {
          for (let column = 0; column < mask.size; column++) {
            if (mask.pixels[(row * mask.size + column) * 4 + 3] <= 180) continue;
            minX = Math.min(minX, column); maxX = Math.max(maxX, column + 1);
            minY = Math.min(minY, row); maxY = Math.max(maxY, row + 1);
          }
        }
        const scale = 2048 / mask.size;
        return { id: layer.id, svgRaw: layer.svgRaw, matrix: 'matrix(1,0,0,1,0,0)', bbox: { minX: minX * scale, maxX: maxX * scale, minY: minY * scale, maxY: maxY * scale, centerX: (minX + maxX) * scale / 2, centerY: (minY + maxY) * scale / 2 } };
      });
      for (const position of labelPositions('neck')) {
        for (const oversized of [false, true]) {
          const label = constrainNeckLabel({ ...createGarmentLabel('neck'), position, ...(oversized ? { widthMm: 150, heightMm: 250, offsetXmm: 40, offsetYmm: 100 } : {}) }, layers, 500, masks);
          const placed = labelPlacement(label, layers, 500, masks);
          check(placed?.layerId === 'innerBackNeck', `${fit}/${neck.displayName}: wrong attachment`);
          check(labelVisible(label, 'front') && !labelVisible(label, 'back', true), 'Neck label not front-only');
          const mask = masks.innerBackNeck;
          const scale = mask.size / 2048;
          for (let row = Math.floor(placed.matrix.f * scale); row < Math.ceil((placed.matrix.f + placed.height) * scale); row++) {
            for (let column = Math.floor((placed.matrix.e - placed.width / 2) * scale); column < Math.ceil((placed.matrix.e + placed.width / 2) * scale); column++) {
              check(mask.pixels[(row * mask.size + column) * 4 + 3] > 180, `${fit}/${neck.displayName}: label escaped inner panel`);
            }
          }
          check(JSON.stringify(constrainNeckLabel(label, layers, 500, masks)) === JSON.stringify(label), 'Constraint does not stabilize');
          placements++;
        }
      }
      combinations++;
    }
  }
  check(combinations === 24, `Expected 24 fit/neck combinations, got ${combinations}`);
  return { combinations, placements, frontOnly: true, contained: true };
}

export async function verifyGarmentLabelAttachments(fits = ['slim', 'regular', 'boxy', 'oversized'], onProgress: (stage: string) => void = () => undefined) {
  const { getDefaultGarmentSelection, getGarmentAssetsForFit, resolveGarmentLayers } = await import('../../src/app/data/garmentSvgCatalog');
  let combinations = 0;
  let placements = 0;
  let underSleeves = 0;
  for (const fit of fits) {
    for (const sleeve of getGarmentAssetsForFit('tshirt', 'Sleeve length', fit)) {
      for (const neck of getGarmentAssetsForFit('tshirt', 'Neck', fit)) {
        const selection = { ...getDefaultGarmentSelection('tshirt', fit), Neck: neck.id, 'Sleeve length': sleeve.id };
        onProgress(`${fit}/${sleeve.displayName}/${neck.displayName}: resolve`);
        const resolved = resolveGarmentLayers({ garmentType: 'tshirt', fit, selection, view: 'front' });
        onProgress('measure layers');
        const layers: LabelAttachmentLayer[] = resolved.filter(layer => /^(base|innerBackNeck|neck|sleeves|sleeveLeft|sleeveRight|underSleeveLeft|underSleeveRight)$/.test(layer.id)).flatMap(layer => {
          if (layer.id === 'sleeves') {
            const split = splitPotraceSvgBBoxAtCenter(layer.svgRaw);
            return (['left', 'right'] as const).flatMap(side => split[side] ? [{ id: side === 'left' ? 'sleeveLeft' : 'sleeveRight', bbox: split[side]!, svgRaw: layer.svgRaw, matrix: 'matrix(1,0,0,1,0,0)' }] : []);
          }
          const bbox = getPotraceSvgBBox(layer.svgRaw);
          return bbox ? [{ id: layer.id, bbox, svgRaw: layer.svgRaw, matrix: 'matrix(1,0,0,1,0,0)' }] : [];
        });
        onProgress('decode masks');
        const masks = Object.fromEntries(await Promise.all(layers.map(async layer => [layer.id, await labelAttachmentMask(layer.svgRaw)])));
        onProgress('place labels');
        for (const category of ['neck', 'care', 'tag'] as LabelCategory[]) {
          for (const position of labelPositions(category)) {
            const placed = labelPlacement({ ...createGarmentLabel(category), position }, layers, 530, masks);
            check(placed && Number.isFinite(placed.center.x) && Number.isFinite(placed.center.y), `${fit}/${position}: invalid placement`);
            check(placed.center.x >= 0 && placed.center.x <= 2048 && placed.center.y >= 0 && placed.center.y <= 2048, `${fit}/${position}: outside canvas`);
            if (position.startsWith('neck-')) check(placed.layerId === 'innerBackNeck', 'Neck label not following selected inner back neck');
            placements++;
          }
        }
        if (sleeve.displayName.startsWith('Layered Long Sleeve')) {
          const placed = labelPlacement({ ...createGarmentLabel('tag'), sleeveLayer: 'under' }, layers, 530, masks);
          check(placed?.layerId === 'underSleeveLeft', 'Wrong layered sleeve attachment'); underSleeves++;
        }
        combinations++;
      }
    }
  }
  check(combinations > 0, 'No garment combinations were tested');
  return { combinations, placements, underSleeves };
}

export async function verifyGarmentLabels() {
  return { ...await verifyGarmentLabelArtwork(), ...await verifyGarmentLabelAttachments() };
}