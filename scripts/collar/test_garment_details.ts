import { GARMENT_DETAIL_ASSETS, GARMENT_DETAIL_OPTIONS, ZIP_PULL_STYLES, zipPullStyle, zipPullThumbnail, zipHardwareGeometry, createGarmentDetail, detailAsset, detailPlacement, detailSvg, resizeGarmentDetail, alignGarmentZip, detailFrame, setDetailTransform, detailGesture, alignGarmentDetail, copyDetailToOpposite, arrangeGarmentDetails,
  type GarmentDetail, type GarmentDetailType } from '../../src/app/data/garmentDetails';
import { getGarmentAssets } from '../../src/app/data/garmentSvgCatalog';
import { getPotraceSvgBBox } from '../../src/app/lib/tshirtSvgUtils';

export async function verifyGarmentDetails() {
  const details: GarmentDetail[] = [];
  const bounds = { minX: 400, minY: 100, maxX: 1600, maxY: 1900 };
  let placements = 0;
  const cases = (Object.keys(GARMENT_DETAIL_ASSETS) as GarmentDetailType[]).flatMap(type => {
    if (GARMENT_DETAIL_OPTIONS[type].length !== 5) throw new Error(`${type}: expected five options`);
    return [undefined, ...GARMENT_DETAIL_OPTIONS[type].map(option => option.id)].map(variant => ({ type, variant }));
  });
  const uniqueSvgs = new Set<string>();
  for (const { type, variant } of cases) {
    const detail = createGarmentDetail(type, details, '#CC2D24', variant);
    details.push(detail);
    const asset = detailAsset(detail);
    if (variant) {
      if (asset.svg === GARMENT_DETAIL_ASSETS[type].svg || uniqueSvgs.has(asset.svg)) throw new Error(`${variant}: missing or duplicated asset`);
      uniqueSvgs.add(asset.svg);
    }
    const duplicate = createGarmentDetail(type, details, detail.fill);
    if (duplicate.id === detail.id || duplicate.name === detail.name) throw new Error(`${type}: duplicate identity`);
    const svg = detailSvg(detail);
    const recolored = detailSvg({ ...detail, fill: '#112233', outline: '#445566', stitch: '#778899', hardware: '#AABBCC' });
    for (const expected of ['#112233', '#445566', ...(asset.stitch ? ['#778899'] : []), ...(asset.hardware ? ['#AABBCC'] : [])]) {
      if (!recolored.includes(expected)) throw new Error(`${variant ?? type}: missing colour channel ${expected}`);
    }
    const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (document.querySelector('parsererror') || svg.includes('var(')) throw new Error(`${type}: invalid SVG`);
    if (document.documentElement.getAttribute('stroke-linejoin') !== 'round' || document.documentElement.getAttribute('stroke-linecap') !== 'round') throw new Error(`${type}: inconsistent construction joins`);
    if (document.querySelector('image, text, script, filter, linearGradient, radialGradient')) throw new Error(`${type}: non-outline content`);
    const viewBox = document.documentElement.getAttribute('viewBox')!.split(' ').map(Number);
    if (Math.abs(viewBox[2] / viewBox[3] - asset.ratio) > .00001) throw new Error(`${type}: viewBox ratio mismatch`);
    if (!svg.includes('#CC2D24')) throw new Error(`${type}: fill missing`);
    const image = new Image();
    image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 240;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0, 200, 240);
    const pixels = context.getImageData(0, 0, 200, 240).data;
    if (!pixels.some((value, index) => index % 4 === 3 && value > 0)) throw new Error(`${type}: blank render`);
    if (pixels[3] !== 0) throw new Error(`${type}: background is not transparent`);
    for (const x of [-10, .5, 10]) {
      for (const y of [-10, .5, 10]) {
        const placed = detailPlacement({ ...detail, x, y }, bounds);
        const centerX = placed.left + placed.width / 2;
        const centerY = placed.top + placed.height / 2;
        if (centerX < 0 || centerY < 0 || centerX > 2048 || centerY > 2048) {
          throw new Error(`${type}: center escaped canvas`);
        }
        placements++;
      }
    }
    for (const position of [{ x: .5, y: .4 }, { x: .3, y: .3 }, { x: .7, y: .7 }]) {
      const placed = detailPlacement({ ...detail, ...position }, bounds);
      if (Math.abs(placed.x - position.x) > .00001 || Math.abs(placed.y - position.y) > .00001) throw new Error(`${type}: position snapped`);
    }
    const original = detailPlacement(detail, bounds);
    for (const factor of [.5, 1.7]) {
      const resized = resizeGarmentDetail(detail, bounds, 1, 1, original.width * (factor - 1), original.height * (factor - 1));
      const placed = detailPlacement(resized, bounds);
      if (Math.abs(placed.width / original.width - factor) > .00001 || Math.abs(placed.width / placed.height - asset.ratio) > .00001) throw new Error(`${type}: distorted scale`);
      if (Math.abs(placed.left - original.left) > .00001 || Math.abs(placed.top - original.top) > .00001) throw new Error(`${type}: resize anchor moved`);
    }
    const legacy = { ...detail, scale: undefined } as unknown as GarmentDetail;
    if (detailPlacement(legacy, bounds).width !== original.width) throw new Error(`${type}: legacy scale changed`);
    if (!variant && asset.svg !== GARMENT_DETAIL_ASSETS[type].svg) throw new Error(`${type}: legacy asset changed`);
    if (detailSvg({ ...detail, fill: '"><script>' }).includes('<script>')) throw new Error(`${type}: unsafe colour`);
  }
  const restored = JSON.parse(JSON.stringify(details));
  if (JSON.stringify(restored) !== JSON.stringify(details)) throw new Error('State serialization changed details');
  for (const detail of restored as GarmentDetail[]) {
    if (detailSvg(detail) !== detailSvg(details.find(original => original.id === detail.id)!)) throw new Error('Restored variant changed');
  }
  return { assets: details.length, variants: uniqueSvgs.size, decodedAndPainted: true, colorChannels: true, placements, freePositions: true, proportionalResizing: true, uniqueInstances: true, serialized: true };
}

export function verifyDetailResizeAxes() {
  const bounds = { minX: 400, minY: 100, maxX: 1600, maxY: 1900 };
  const close = (actual: number, expected: number, message: string) => {
    if (Math.abs(actual - expected) > .00001) throw new Error(message);
  };
  let cases = 0;
  for (const type of ['zip', 'pocket', 'button'] as const) {
    const detail = { ...createGarmentDetail(type, [], '#123456'), x: .5, y: .5, lockProportions: false, view: 'back' as const };
    const original = detailPlacement(detail, bounds);
    for (const handle of [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }]) {
      for (const amount of [-10000, -10, 80, 10000]) {
        for (const lockProportions of [false, true]) {
          const resized = resizeGarmentDetail({ ...detail, lockProportions }, bounds, handle.x, handle.y, handle.x * amount, handle.y * amount);
          const placed = detailPlacement(resized, bounds);
          if (placed.width < 12 || placed.height < 12 || placed.left < bounds.minX - .00001 || placed.top < bounds.minY - .00001 ||
            placed.left + placed.width > bounds.maxX + .00001 || placed.top + placed.height > bounds.maxY + .00001) throw new Error('Resize escaped bounds or minimum');
          close(placed.left + placed.width * (1 - handle.x) / 2, original.left + original.width * (1 - handle.x) / 2, 'Horizontal anchor moved');
          close(placed.top + placed.height * (1 - handle.y) / 2, original.top + original.height * (1 - handle.y) / 2, 'Vertical anchor moved');
          if (lockProportions) close(placed.width / placed.height, original.width / original.height, 'Aspect lock failed');
          else {
            if (!handle.x) close(placed.width, original.width, 'Height handle changed width');
            if (!handle.y) close(placed.height, original.height, 'Width handle changed height');
          }
          if (resized.view !== 'back' || resized.id !== detail.id || resized.fill !== detail.fill) throw new Error('Resize lost detail state');
          const restored = JSON.parse(JSON.stringify(resized));
          close(detailPlacement(restored, bounds).height, placed.height, 'Axis size lost on serialization');
          cases++;
        }
      }
    }
    const bottom = detailPlacement(resizeGarmentDetail(detail, bounds, 0, 1, 400, 10000), bounds);
    close(bottom.width, original.width, 'Long zip widened');
    close(bottom.top + bottom.height, bounds.maxY, 'Bottom handle cannot reach hem');
  }
  return { cases, independentAxes: true, anchoredEdges: true, boundaries: true, aspectLock: true, serialization: true };
}

export async function verifyDetailResizeRendering() {
  let cases = 0;
  for (const variant of [undefined, ...GARMENT_DETAIL_OPTIONS.zip.map(option => option.id)]) {
    const detail = createGarmentDetail('zip', [], '#789abc', variant);
    const asset = detailAsset(detail);
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
    document.body.append(holder);
    try {
      let normalPull: DOMRect | undefined;
      for (const heightFactor of [1, 4, .3]) {
        holder.innerHTML = detailSvg({ ...detail, scaleX: 1, scaleY: heightFactor });
        const svg = holder.querySelector('svg')!;
        svg.setAttribute('width', '96');
        svg.setAttribute('height', String(96 / asset.ratio * heightFactor));
        const pull = holder.querySelector('[data-zip-pull]')!.getBoundingClientRect();
        if (!normalPull) normalPull = pull;
        const expectedFactor = Math.min(1, heightFactor);
        if (Math.abs(pull.width - normalPull.width * expectedFactor) > .01 || Math.abs(pull.height - normalPull.height * expectedFactor) > .01) throw new Error(`${variant}: distorted zip pull`);
        const image = new Image();
        image.src = `data:image/svg+xml,${encodeURIComponent(holder.innerHTML)}`;
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = 96; canvas.height = 400;
        const context = canvas.getContext('2d')!;
        context.drawImage(image, 0, 0, 96, 400);
        if (!context.getImageData(0, 0, 96, 400).data.some((value, index) => index % 4 === 3 && value > 0)) throw new Error('Resized zip is blank');
        cases++;
      }
    } finally { holder.remove(); }
  }
  return { cases, proportionalPulls: true, decodedAndPainted: true };
}

export function verifyZipWorkflows() {
  const bounds = { minX: 400, minY: 100, maxX: 1600, maxY: 1900, necklineY: 350 };
  const close = (actual: number, expected: number, name: string) => { if (Math.abs(actual - expected) > .00001) throw new Error(name); };
  let cases = 0;
  for (const variant of GARMENT_DETAIL_OPTIONS.zip) {
    const detail = createGarmentDetail('zip', [], '#789abc', variant.id);
    const original = detailPlacement(detail, bounds);
    for (const mode of ['chest', 'quarter', 'full', 'hem'] as const) {
      const zip = alignGarmentZip(detail, bounds, mode);
      const placed = detailPlacement(zip, bounds);
      close(placed.width, original.width, 'Zip preset widened');
      if (mode === 'full' || mode === 'hem') close(placed.top + placed.height, bounds.maxY, 'Zip does not reach hem');
      if (mode !== 'hem') close(placed.top, bounds.necklineY, 'Zip does not start at neckline');
      else close(placed.top, original.top, 'Extend to hem moved top');
      const document = new DOMParser().parseFromString(detailSvg(zip), 'image/svg+xml');
      for (const part of ['track', 'teeth', 'slider', 'pull', 'stops']) if (!document.querySelector(`[data-zip-${part}]`)) throw new Error(`Missing ${part}`);
      if (document.querySelector('[data-zip-track]')!.hasAttribute('transform')) throw new Error('Tape is still scaled');
      const height = Number(document.documentElement.getAttribute('viewBox')!.split(' ')[3]);
      const stop = document.querySelector('[data-zip-stops] rect:last-child')!;
      close(Number(stop.getAttribute('y')) + Number(stop.getAttribute('height')), height - 1, 'Bottom stop does not meet hem');
      cases++;
    }
    for (const rotation of [0, 90, 180, 270]) {
      const turned = { ...detail, x: .5, y: .5, rotation };
      const initial = detailPlacement(turned, bounds);
      const radians = rotation * Math.PI / 180;
      const resized = resizeGarmentDetail(turned, bounds, 0, 1, -80 * Math.sin(radians), 80 * Math.cos(radians));
      const placed = detailPlacement(resized, bounds);
      close(placed.width, initial.width, 'Rotated height handle changed width');
      close(placed.height, initial.height + 80, 'Rotated height handle failed');
      const beforeX = bounds.minX + initial.x * 1200 + Math.sin(radians) * initial.height / 2;
      const beforeY = bounds.minY + initial.y * 1800 - Math.cos(radians) * initial.height / 2;
      close(bounds.minX + placed.x * 1200 + Math.sin(radians) * placed.height / 2, beforeX, 'Rotated anchor X moved');
      close(bounds.minY + placed.y * 1800 - Math.cos(radians) * placed.height / 2, beforeY, 'Rotated anchor Y moved');
      for (const position of [{ x: .2, y: .3 }, { x: .8, y: .7 }]) {
        const moved = detailPlacement({ ...turned, ...position }, bounds);
        close(moved.x, position.x, 'Free horizontal movement blocked');
        close(moved.y, position.y, 'Free vertical movement blocked');
      }
      cases++;
    }
    for (const flip of [{ flipX: true }, { flipY: true }, { flipX: true, flipY: true }]) {
      const mirrored = detailSvg({ ...detail, ...flip, zipSliderPosition: .8, zipPullSide: 'left' });
      if (!mirrored.includes('data-detail-mirror') || !mirrored.includes('rotate(18)')) throw new Error('Mirror or pull orientation missing');
      const restored = JSON.parse(JSON.stringify({ ...detail, ...flip, zipSliderPosition: .8, view: 'back' }));
      if (restored.zipSliderPosition !== .8 || restored.view !== 'back') throw new Error('Zip state not preserved');
      cases++;
    }
  }
  return { cases, chest: true, quarter: true, fullBody: true, hem: true, rotatedResize: true, movement: true, mirroring: true, separateParts: true };
}

export async function verifyZipPullStyles() {
  const bounds = { minX: 400, minY: 100, maxX: 1600, maxY: 1900, necklineY: 350 };
  let cases = 0;
  if (new Set(ZIP_PULL_STYLES.map(style => style.path)).size !== 8) throw new Error('Pull shapes are not distinct');
  for (const variant of [undefined, ...GARMENT_DETAIL_OPTIONS.zip.map(option => option.id)]) {
    const legacy = createGarmentDetail('zip', [], '#abcdef', variant);
    if (zipPullStyle(legacy).id !== (variant === 'zip-03' ? 'ring' : variant === 'zip-02' ? 'slim' : 'rounded')) throw new Error('Legacy pull changed');
    for (const mode of ['chest', 'quarter', 'half', 'full'] as const) {
      const original = { ...alignGarmentZip(legacy, bounds, mode), zipSliderPosition: .8, rotation: 90, flipX: true, view: 'back' as const };
      const body = detailSvg(original, undefined, 'body');
      for (const style of ZIP_PULL_STYLES) {
        const changed = { ...original, zipPullStyle: style.id, zipPullColor: '#CC3366', zipPullScale: 1.25, zipPullSide: 'left' as const };
        if (detailSvg(changed, undefined, 'body') !== body) throw new Error('Pull edit changed tape, teeth or slider');
        if (JSON.stringify(detailPlacement(changed, bounds)) !== JSON.stringify(detailPlacement(original, bounds))) throw new Error('Pull edit changed placement');
        const parsed = new DOMParser().parseFromString(detailSvg(changed), 'image/svg+xml');
        const tab = parsed.querySelector('[data-zip-pull-tab] path')!;
        if (tab.getAttribute('d') !== style.path || tab.getAttribute('fill') !== '#CC3366' || tab.getAttribute('transform') !== 'scale(1.25)') throw new Error('Pull setting missing');
        const restored = JSON.parse(JSON.stringify(changed));
        if (detailSvg(restored) !== detailSvg(changed)) throw new Error('Pull settings lost on save');
        cases++;
      }
    }
  }
  for (const style of ZIP_PULL_STYLES) {
    const image = new Image();
    image.src = `data:image/svg+xml,${encodeURIComponent(zipPullThumbnail(style.id))}`;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 88; canvas.height = 120;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 88, 120);
    if (!context.getImageData(0, 0, 88, 120).data.some((value, index) => index % 4 === 3 && value > 0)) throw new Error('Blank pull thumbnail');
  }
  return { cases, distinctStyles: 8, isolatedPullEdits: true, legacyDefaults: true, savedSettings: true, thumbnails: true };
}

export function verifyPreciseDetailTransforms() {
  const bounds = { minX: 350, minY: 250, maxX: 1650, maxY: 1850, necklineY: 430 };
  let cases = 0;
  for (const type of Object.keys(GARMENT_DETAIL_ASSETS) as GarmentDetailType[]) for (const option of GARMENT_DETAIL_OPTIONS[type]) {
    const original = { ...createGarmentDetail(type, [], '#abcdef', option.id), x: .5, y: .5, lockProportions: false, view: 'front' as const };
    const placement = detailPlacement(original, bounds);
    const wide = setDetailTransform(original, bounds, { width: placement.width + 12 });
    if (Math.abs(detailPlacement(wide, bounds).height - placement.height) > .001 || wide.x !== .5 || wide.y !== .5) throw new Error('Width changed height or centre');
    const tall = setDetailTransform(original, bounds, { height: placement.height + 12 });
    if (Math.abs(detailPlacement(tall, bounds).width - placement.width) > .001 || tall.fill !== original.fill) throw new Error('Height changed width or colour');
    for (const rotation of [0, 17, 45, 90, 133, 180, 270, 359]) {
      const rotated = setDetailTransform(original, bounds, { rotation });
      if (rotated.rotation !== rotation) throw new Error('Arbitrary rotation rejected');
      for (const corner of [{ x: 1, y: 1 }, { x: 0, y: 1 }, { x: -1, y: 0 }]) {
        const resized = resizeGarmentDetail(rotated, bounds, corner.x, corner.y, 400, 600);
        const frame = detailFrame(resized, bounds);
        if (frame.minX < bounds.minX - .01 || frame.minY < bounds.minY - .01 || frame.maxX > bounds.maxX + .01 || frame.maxY > bounds.maxY + .01) throw new Error('Rotated resize left bounds');
        cases++;
      }
    }
    const near = { ...original, x: .5 - 4 / 1300 };
    if (Math.abs(detailGesture(near, bounds, [], 0, 0, undefined, 6).detail.x - .5) > .00001) throw new Error('Centre snap failed');
    if (detailGesture(near, bounds, [], 0, 0).detail.x !== near.x) throw new Error('Snap disabled still snapped');
    if (detailGesture({ ...near, x: .31 }, bounds, [], 0, 0, undefined, 6).guides.some(guide => guide.axis === 'x')) throw new Error('Long-distance snap');
    const aligned = alignGarmentDetail(original, bounds, 'bottom');
    if (Math.abs(detailFrame(aligned, bounds).maxY - bounds.maxY) > .001) throw new Error('Hem alignment failed');
    const copied = copyDetailToOpposite([original], original, 'front');
    if (copied.length !== 2 || copyDetailToOpposite(copied, original, 'front') !== copied || copied[1].id === original.id || copied[1].x !== 1 - original.x) throw new Error('Independent copy failed');
    copied[1].fill = '#123456';
    if (original.fill !== '#abcdef' || JSON.stringify(JSON.parse(JSON.stringify(copied))) !== JSON.stringify(copied)) throw new Error('Copy/save isolation failed');
  }
  const zip = { ...createGarmentDetail('zip', [], '#ffffff', 'zip-03'), rotation: 180, zipPullStyle: 'oval' as const };
  const extended = alignGarmentZip(zip, bounds, 'hem');
  if (Math.abs(detailPlacement(extended, bounds).width - detailPlacement(zip, bounds).width) > .001 || extended.rotation !== 180 || extended.zipPullStyle !== 'oval' || Math.abs(detailFrame(extended, bounds).maxY - bounds.maxY) > .001) throw new Error('Hem extension changed zip settings');
  return { cases, independentAxes: true, snapping: true, rotatedBounds: true, mirroredCopies: true, saveReload: true };
}

export function verifyUniversalDetailControls() {
  const bounds = { minX: 350, minY: 250, maxX: 1650, maxY: 1850, necklineY: 430 };
  const button = { ...createGarmentDetail('button', [], '#abcdef'), x: .4, y: .3 };
  const repeats = arrangeGarmentDetails([button], button, bounds, 3, .12, 'y');
  if (repeats.length !== 3 || new Set(repeats.map(item => item.id)).size !== 3 || Math.abs(repeats[2].y - .54) > .00001) throw new Error('Repeat positions or identities failed');
  const resized = repeats.map((item, index) => index === 1 ? { ...item, scaleX: 1.5, scaleY: 1.5 } : item);
  const spaced = arrangeGarmentDetails(resized, resized[0], bounds, 3, .18, 'y');
  if (spaced[1].scaleX !== 1.5 || spaced[0].scaleX !== repeats[0].scaleX || Math.abs(spaced[2].y - .66) > .00001) throw new Error('Spacing changed individual sizing');
  if (arrangeGarmentDetails(spaced, spaced[0], bounds, 12, .5, 'y') !== spaced) throw new Error('Invalid arrangement changed objects');
  const shortZip = { ...createGarmentDetail('zip', [], '#abcdef', 'zip-01'), scaleY: .3, zipSliderScale: .75, zipPullScale: 1.2 };
  const extended = alignGarmentZip(shortZip, bounds, 'hem');
  const hardwareSize = (detail: GarmentDetail) => { const placement = detailPlacement(detail, bounds); return zipHardwareGeometry(detail, 48, 48 * placement.height / placement.width).hardwareScale * placement.width / 48; };
  if (Math.abs(hardwareSize(shortZip) - hardwareSize(extended)) > .000001 || extended.zipSliderScale !== .75 || extended.zipPullScale !== 1.2) throw new Error('Hem extension resized hardware');
  let catalogueCases = 0;
  for (const category of ['pockets', 'zips', 'zip pull', 'drawstrings']) {
    const asset = getGarmentAssets('hoodie', category)[0];
    if (!asset) continue;
    const crop = getPotraceSvgBBox(asset.svgRaw);
    if (!crop) throw new Error('Catalogue bounds missing');
    const detail: GarmentDetail = { ...createGarmentDetail('pocket', [], '#abcdef'), x: .5, y: .5,
      catalogueAsset: { id: asset.id, crop, width: .2, ratio: (crop.maxX - crop.minX) / (crop.maxY - crop.minY) }, sourceLayerId: category };
    const svg = detailSvg(detail);
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    if (parsed.querySelector('parsererror') || !svg.includes('#abcdef') || !svg.includes(`0 0 ${crop.maxX - crop.minX}`)) throw new Error('Catalogue artwork crop or colour failed');
    const wide = setDetailTransform(detail, bounds, { width: detailPlacement(detail, bounds).width * 1.1 });
    if (Math.abs(detailPlacement(wide, bounds).height - detailPlacement(detail, bounds).height) > .001) throw new Error('Catalogue axes coupled');
    const copy = copyDetailToOpposite([wide], wide, 'front')[1];
    if (copy.sourceLayerId || copy.catalogueAsset?.id !== asset.id || detailSvg(JSON.parse(JSON.stringify(copy))) !== detailSvg(copy)) throw new Error('Catalogue copy/save failed');
    catalogueCases++;
  }
  if (catalogueCases !== 4) throw new Error(`Expected four built-in trim categories, got ${catalogueCases}`);
  return { catalogueCases, repeatSpacing: true, independentItemSizes: true, hardwarePreserved: true, serialized: true };
}