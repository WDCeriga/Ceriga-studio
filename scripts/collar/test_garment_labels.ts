import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { applyLabelPreset, applyLabelHierarchy, createGarmentLabel, normalizeLabel, LABEL_BLOCKS, LABEL_HIERARCHIES, LABEL_FOLDS, LABEL_SHAPES, LABEL_PRESETS, LABEL_SIZE_VERTICAL, DEFAULT_REGION_TRANSFORM, CARE_OPTIONS, MANUFACTURER_CARE_NOTE, generatedCareText, switchTagFace, copyTagFrontToBack, labelExportFaces, labelSpecification, labelPositions, labelVisible, labelWarnings, unfoldedLabelSize, type GarmentLabel, type LabelCategory } from '../../src/app/data/garmentLabels';
import { LabelArtwork, labelLayout } from '../../src/app/components/builder/LabelArtwork';
import { GarmentLabelOverlay, constrainNeckLabel, labelAttachmentMask, labelPlacement, type LabelAttachmentLayer } from '../../src/app/components/builder/GarmentLabelOverlay';
import { getPotraceSvgBBox, splitPotraceSvgBBoxAtCenter } from '../../src/app/lib/tshirtSvgUtils';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function verifyGarmentLabelArtwork() {
  let constructions = 0;
  for (const category of ['neck', 'care', 'tag', 'hand'] as LabelCategory[]) {
    const original = createGarmentLabel(category);
    check((category === 'tag' ? !original.brand : original.brand) && (category !== 'care' || original.careText === generatedCareText(original) && !Object.values(original.care).some(Boolean)), 'Incorrect label template');
    for (const fold of Object.keys(LABEL_FOLDS) as GarmentLabel['fold'][]) {
      const label = normalizeLabel({ ...original, fold, brand: 'TEST' });
      const unfolded = unfoldedLabelSize(label);
      check(unfolded.width >= label.widthMm && unfolded.height >= label.heightMm, 'Invalid unfolded dimensions');
      check(JSON.stringify(label) === JSON.stringify(JSON.parse(JSON.stringify(label))), 'Label serialization changed');
      constructions++;
    }
    for (const position of labelPositions(category)) {
      const label = { ...original, position };
      if (category === 'hand') {
        check(!labelVisible(label, 'front') && !labelVisible(label, 'back', true), 'Hand tag must use focused preview');
        continue;
      }
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
  for (const shape of ['rounded', 'oval', 'circle'] as const) {
    const label = normalizeLabel({ ...createGarmentLabel('neck'), shape, fold: 'end', construction: 'physical', widthMm: 35, heightMm: 20 });
    const svg = renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: `0 0 ${label.widthMm} ${label.heightMm}` }, createElement(LabelArtwork, { label })));
    const image = new Image(); image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 350; canvas.height = 200;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 350, 200);
    check(context.getImageData(0, 0, 1, 1).data[3] === 0 && context.getImageData(349, 0, 1, 1).data[3] === 0, `${shape}: end-fold shading escaped the label edge`);
  }
  check(!renderToStaticMarkup(createElement(LabelArtwork, { label: printed })).includes('data-label-fabric') && printed.borderEnabled, 'Direct print fabric or frame mismatch');
  const care = createGarmentLabel('care');
  check(!labelWarnings(care).some(value => value.includes('symbol incomplete')), 'Manufacturer care note requires consumer care settings');
  for (const [category, options] of Object.entries(CARE_OPTIONS)) {
    for (const value of Object.keys(options).filter(Boolean)) {
      const markup = renderToStaticMarkup(createElement(LabelArtwork, { label: { ...care, blocks: undefined, care: { ...care.care, [category]: value } } }));
      check(markup.includes((options as Record<string, string>)[value]), `Care symbol missing: ${category}/${value}`);
    }
  }
  check(labelLayout({ ...care, brand: 'UNBREAKABLE'.repeat(20) }).overflow, 'Oversized artwork not flagged');
  check(!labelLayout(care).overflow && labelLayout(care).textLines.length >= 6, 'Care template missing readable sections');
  check(labelLayout({ ...createGarmentLabel('neck'), brand: 'CERIGA' }).textLines[0].size > 3, 'Neck heading too small');
  for (const preset of Object.keys(LABEL_PRESETS) as GarmentLabel['preset'][]) {
    const label = applyLabelPreset({ ...createGarmentLabel('neck'), construction: 'printed' }, preset!);
    const layout = labelLayout(label);
    check(layout.symbols.length === (preset === 'care-stack' ? 5 : 0) && label.preset === preset, 'Print preset care visibility incorrect');
    check(!renderToStaticMarkup(createElement(LabelArtwork, { label })).includes('data-label-guide'), 'Print guides leaked into export');
  }
  const transformed = labelLayout(normalizeLabel({ ...care, blocks: undefined, regions: { top: { ...DEFAULT_REGION_TRANSFORM, rotation: 90, flipX: true, x: 100, y: -100 } } }));
  check(transformed.zones[0].transform.includes('rotate(90)') && transformed.zones[0].transform.includes('scale(-'), 'Region transforms missing');
  check(JSON.stringify(transformed.zones.slice(1)) === JSON.stringify(labelLayout({ ...care, blocks: undefined }).zones.slice(1)), 'Brand controls changed another region');
  return { constructions, shapes: Object.keys(LABEL_SHAPES).length, visibility: true, guideFreeArtwork: true, careSymbols: true, serialization: true };
}

export function verifyLabelSizeLayouts() {
  const label = normalizeLabel({ ...createGarmentLabel('care'), blocks: undefined, sizeFontSizeMm: 3, sizeScale: 70 });
  const original = labelLayout(label);
  let previousY = -Infinity;
  for (const sizeVertical of Object.keys(LABEL_SIZE_VERTICAL) as NonNullable<GarmentLabel['sizeVertical']>[]) {
    const layout = labelLayout({ ...label, sizeVertical });
    const zone = layout.zones.find(entry => entry.key === 'upper')!;
    const transform = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg"><g transform="${zone.transform}" /></svg>`, 'image/svg+xml').querySelector('g')!.transform.baseVal.consolidate()!.matrix;
    check(transform.f > previousY, `Size vertical position did not advance: ${sizeVertical}`);
    check(transform.f - zone.contentHeight * zone.scale / 2 >= zone.y - .001 && transform.f + zone.contentHeight * zone.scale / 2 <= zone.y + zone.height + .001, 'Size escaped its reserved zone');
    previousY = transform.f;
    check(JSON.stringify(layout.zones.filter(entry => entry.key !== 'upper')) === JSON.stringify(original.zones.filter(entry => entry.key !== 'upper')), 'Size position changed another zone');
  }
  const horizontal = (['left', 'center', 'right'] as const).map(sizePosition => labelLayout({ ...label, sizePosition }).zones.find(zone => zone.key === 'upper')!.transform);
  check(new Set(horizontal).size === 3, 'Size alignments are identical');
  const small = labelLayout({ ...label, sizeScale: 40 }).zones.find(zone => zone.key === 'upper')!;
  check(small.scale < original.zones.find(zone => zone.key === 'upper')!.scale, 'Size scale has no effect');
  check(labelLayout({ ...label, sizeFontSizeMm: 5 }).textLines.find(line => line.section === 'size')!.size === 5, 'Size font is not independent');
  const layouts = new Set<string>();
  for (const preset of Object.keys(LABEL_PRESETS) as NonNullable<GarmentLabel['preset']>[]) {
    const custom = { ...label, composition: '80% COTTON / 20% LINEN', careText: 'Hand wash only', care: { ...label.care, washing: 'no' } };
    const applied = applyLabelPreset(custom, preset);
    check(applied.composition === custom.composition && applied.careText === generatedCareText(applied) && applied.care.washing === 'no', 'Preset replaced composition or archived care settings');
    layouts.add(JSON.stringify(labelLayout(applied).zones.map(zone => [zone.key, zone.y, zone.height])));
  }
  check(layouts.size >= 5, 'Preset layouts have indistinguishable spacing');
  const sewnCare = labelLayout(applyLabelPreset(createGarmentLabel('neck'), 'care-stack'));
  check(sewnCare.symbols.length === 0 && !sewnCare.textLines.some(line => line.section === 'composition'), 'Preset enabled optional care content');
  const legacy = normalizeLabel({ ...label, sizeVertical: undefined, sizeFontSizeMm: undefined, sizeScale: undefined });
  check(legacy.sizeVertical === 'center' && legacy.sizeScale === 100 && legacy.sizeFontSizeMm === label.fontSizeMm * 1.15, 'Existing label migration changed');
  return { verticalPositions: 5, horizontalAlignments: 3, distinctLayouts: layouts.size, isolatedSizeControls: true, preservedContent: true };
}

export function verifyLabelContentBlocks() {
  const original = createGarmentLabel('care');
  const directNeck = normalizeLabel({ ...createGarmentLabel('neck'), construction: 'printed', care: original.care });
  const careStack = applyLabelPreset(directNeck, 'care-stack');
  check(careStack.blocks!.find(block => block.key === 'careText')?.enabled, 'Care stack did not enable care content');
  const careLayout = labelLayout(careStack);
  check(careLayout.symbols.length === 5 && careLayout.textLines.filter(line => line.section === 'careText').map(line => line.text).join(' ') === 'Wash at 30 C Do not bleach Tumble dry low Iron low Do not dry clean', 'Direct neck care stack missing symbols or stacked instructions');
  check(!careLayout.overflow && !renderToStaticMarkup(createElement(LabelArtwork, { label: careStack })).includes(MANUFACTURER_CARE_NOTE), 'Manufacturer note leaked onto artwork or care stack overflowed');
  for (const previous of Object.keys(LABEL_PRESETS) as NonNullable<GarmentLabel['preset']>[]) {
    const selected = applyLabelPreset(directNeck, previous);
    for (const preset of Object.keys(LABEL_PRESETS) as NonNullable<GarmentLabel['preset']>[]) {
      const expected = applyLabelPreset(directNeck, preset);
      const actual = applyLabelPreset(selected, preset);
      check(JSON.stringify(labelLayout(actual)) === JSON.stringify(labelLayout(expected)), `${previous} changed ${preset} preview`);
      check(actual.brand === directNeck.brand && actual.size === directNeck.size, 'Preset changed brand or size content');
    }
  }
  check(JSON.stringify(careStack.care) === JSON.stringify(directNeck.care), 'Care stack replaced care instructions');
  const blankCareStack = applyLabelPreset(normalizeLabel({ ...createGarmentLabel('neck'), construction: 'printed' }), 'care-stack');
  check(blankCareStack.blocks!.find(block => block.key === 'careText')?.enabled && !Object.values(blankCareStack.care).some(Boolean), 'Blank care stack invented care instructions');
  const woven = createGarmentLabel('neck');
  check(applyLabelPreset(woven, 'care-stack') === woven, 'Care stack applied to woven label');
  const archivedCare = { ...careStack, care: { washing: '60', bleaching: 'no', drying: 'normal', ironing: 'no', cleaning: 'p' } };
  check(JSON.stringify(labelLayout(archivedCare)) === JSON.stringify(careLayout), 'Archived care choices changed illustrative care artwork');
  const careSpecification = labelSpecification(archivedCare);
  check(careSpecification.careText === MANUFACTURER_CARE_NOTE && !Object.values(careSpecification.care).some(Boolean) && careSpecification.careResponsibility === 'manufacturer', 'Manufacturer care responsibility missing from export');
  const hiddenCare = { ...archivedCare, blocks: archivedCare.blocks!.map(block => block.key === 'careText' ? { ...block, enabled: false } : block) };
  check(!labelLayout(hiddenCare).textLines.some(line => line.section === 'careText') && !labelSpecification(hiddenCare).careText, 'Disabled manufacturer note still exported');
  for (const key of Object.keys(LABEL_BLOCKS)) {
    const label = { ...original, [key]: key === 'careText' ? original.careText : 'TEST', blocks: original.blocks!.map(block => ({ ...block, enabled: block.key === key })) };
    const layout = labelLayout(label);
    check(layout.zones.length === 1, `${key}: unexpected zones`);
    check(Math.abs(layout.zones[0].width - layout.usableWidth) < .001 && Math.abs(layout.zones[0].height - layout.usableHeight) < .001, `${key}: single block not using safe area`);
  }
  const disabled = { ...original, blocks: original.blocks!.map(block => ({ ...block, enabled: false })) };
  check(!labelWarnings(disabled).length && !labelLayout(disabled).symbols.length && !labelLayout(disabled).textLines.length, 'Disabled content remains active');
  for (const hierarchy of Object.keys(LABEL_HIERARCHIES) as (keyof typeof LABEL_HIERARCHIES)[]) {
    const applied = applyLabelHierarchy(original, hierarchy);
    const layout = labelLayout(applied);
    const size = layout.zones.find(zone => zone.key === 'size')!;
    const brand = layout.zones.find(zone => zone.key === 'brand')!;
    check(layout.zones.every(zone => zone.x >= layout.insetX && zone.x + zone.width <= layout.insetX + layout.usableWidth + .001), 'Block escaped safe width');
    if (hierarchy === 'inline' || hierarchy === 'split') check(size.y === brand.y && size.x > brand.x, 'Paired hierarchy is not inline');
    if (hierarchy === 'large-size-top' || hierarchy === 'size-first') check(layout.zones[0].key === 'size', 'Size not at top');
    if (hierarchy === 'large-size-bottom') check(layout.zones.at(-1)!.key === 'size', 'Size not at bottom');
    if (hierarchy.startsWith('large-size')) check(size.textLines[0].size === 9, 'Large size hierarchy missing emphasis');
  }
  const styled = { ...original, blocks: original.blocks!.map(block => block.key === 'size' ? { ...block, font: 'Georgia', color: '#b00000', fontWeight: 900, alignment: 'right' as const, spaceAboveMm: 2 } : block) };
  const zone = labelLayout(styled).zones.find(entry => entry.key === 'size')!;
  check(zone.font === 'Georgia' && zone.color === '#b00000' && zone.alignment === 'right' && zone.textLines[0].weight === 900, 'Section styling ignored');
  check(styled.blocks.find(block => block.key === 'brand') === original.blocks!.find(block => block.key === 'brand'), 'Style leaked to another block');
  const cramped = labelLayout({ ...original, heightMm: 8 });
  check(cramped.overflow && cramped.zones.every(entry => entry.textLines.every(line => line.size * entry.scale >= 1.5 - .001)), 'Unreadable text was silently scaled down');
  check(normalizeLabel({ ...original, careText: 'CUSTOM WORDING', care: { ...original.care, drying: 'flat' } }).careText === generatedCareText(original), 'Read-only care preview wording changed');
  const legacy = normalizeLabel({ ...original, blocks: undefined, careText: 'Legacy wording' });
  check(!legacy.blocks && legacy.careText === 'Legacy wording', 'Saved legacy layout changed');
  for (const preset of Object.keys(LABEL_PRESETS) as NonNullable<GarmentLabel['preset']>[]) {
    const applied = applyLabelPreset({ ...original, category: 'neck', construction: 'printed' }, preset);
    check(applied.preset === preset && applied.construction === 'printed' && applied.background === original.background, 'Manufacturing restricted preset or changed colour');
  }
  let front = createGarmentLabel('tag');
  check(!front.brand && !front.blocks!.some(block => block.enabled), 'New tag front is not blank');
  front = { ...front, brand: 'FRONT', background: '#cc0000', offsetXmm: 12, blocks: front.blocks!.map(block => ({ ...block, enabled: block.key === 'brand' })) };
  let back = switchTagFace(front, 'back');
  check(!back.brand && !back.logo && !back.blocks!.some(block => block.enabled) && back.offsetXmm === 0, 'Back reused front design');
  back = { ...back, brand: 'BACK', background: '#0000cc', offsetXmm: -8, blocks: back.blocks!.map(block => ({ ...block, font: 'Georgia', enabled: block.key === 'brand' })) };
  front = switchTagFace(back, 'front');
  check(front.brand === 'FRONT' && front.background === '#cc0000' && front.offsetXmm === 12 && front.blocks![0].font !== 'Georgia', 'Front overwritten by back');
  const restored = switchTagFace(JSON.parse(JSON.stringify(front)), 'back');
  check(restored.brand === 'BACK' && restored.background === '#0000cc' && restored.offsetXmm === -8, 'Back lost during save');
  const copied = copyTagFrontToBack(front);
  check(switchTagFace(copied, 'back').brand === 'FRONT' && copied.faces!.back!.blocks !== front.blocks, 'Explicit copy is not independent');
  check(labelExportFaces(front).map(face => face.brand).join(',') === 'FRONT', 'Export generated an unplaced back tag');
  const specification = labelSpecification(front);
  check(specification.faces!.front!.brand === 'FRONT' && specification.faces!.back!.brand === 'BACK', 'Export contains stale faces');
  const layers: LabelAttachmentLayer[] = [{ id: 'base', matrix: 'matrix(1,0,0,1,0,0)', svgRaw: '<svg viewBox="0 0 2048 2048"><rect width="2048" height="2048"/></svg>', bbox: { minX: 0, minY: 0, maxX: 2048, maxY: 2048, centerX: 1024, centerY: 1024 } }];
  for (const position of labelPositions('tag')) {
    const frontTag = { ...front, position };
    const backTag = { ...createGarmentLabel('tag'), position, exteriorView: 'back' as const };
    const render = (labels: GarmentLabel[], view: 'front' | 'back') => renderToStaticMarkup(createElement(GarmentLabelOverlay, { labels, layers, view }));
    check(render([frontTag], 'front').includes(`data-garment-label="${frontTag.id}"`), `${position}: front tag missing`);
    check(!render([frontTag], 'back').includes('data-garment-label='), `${position}: phantom back tag`);
    const saved = JSON.parse(JSON.stringify([frontTag, backTag])) as GarmentLabel[];
    check(render(saved, 'back').includes(`data-garment-label="${backTag.id}"`) && !render(saved, 'back').includes(`data-garment-label="${frontTag.id}"`), `${position}: independent back placement lost`);
    check(!render(saved, 'front').includes(`data-garment-label="${backTag.id}"`), `${position}: back tag leaked onto front`);
    check(saved.flatMap(labelExportFaces).length === 2 && !backTag.brand, `${position}: back tag not independently blank`);
  }
  check(!labelSpecification(createGarmentLabel('tag')).faces, 'Specification generated an unplaced face');
  return { singleBlocks: 7, hierarchies: 6, independentStyles: true, minimumReadableSize: true, optionalCare: true, legacyPreserved: true, independentTagFaces: true };
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
  return { ...await verifyGarmentLabelArtwork(), ...verifyLabelSizeLayouts(), ...verifyLabelContentBlocks(), ...await verifyGarmentLabelAttachments() };
}