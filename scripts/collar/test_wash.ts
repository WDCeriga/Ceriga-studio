import { defaultGarmentWash, washSvg, washTone, updateWashView, WASH_TYPES, WASH_PLACEMENTS, type GarmentWash, type WashBounds } from '../../src/app/data/garmentWash';
import { getDefaultGarmentSelection, getGarmentAssetsForFit, resolveGarmentLayers } from '../../src/app/data/garmentSvgCatalog';
import { getPotraceSvgBBox, tintPotraceSvg } from '../../src/app/lib/tshirtSvgUtils';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function raster(markup: string, size = 256) {
  const image = new Image();
  image.src = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048" width="${size}" height="${size}">${markup}</svg>`)}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, size, size).data;
}

function alphaSum(pixels: Uint8ClampedArray) {
  let sum = 0;
  for (let offset = 3; offset < pixels.length; offset += 4) sum += pixels[offset];
  return sum;
}

export async function verifyWashMasks() {
  const raw = '<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><g fill="#000000"><path fill-rule="evenodd" d="M300 200H1748V1848H300ZM800 200V400H1248V200Z"/></g></svg>';
  const bounds: WashBounds = { minX: 300, minY: 200, maxX: 1748, maxY: 1848 };
  let wash = defaultGarmentWash();
  const render = () => washSvg(raw, '#173752', bounds, 'sleeveLeft', wash, 'front', 'wash-test');
  check(render() === '', 'Clean produces a wash');
  wash.type = 'mineral'; wash.intensity = 0;
  check(render() === '', 'Intensity zero produces a wash');
  wash.intensity = 100; wash.blend = 100;
  const source = await raster(raw);
  let combinations = 0;
  const styleHashes = new Set<string>();
  for (const type of Object.keys(WASH_TYPES).filter(type => type !== 'none') as GarmentWash['type'][]) {
    for (const placement of Object.keys(WASH_PLACEMENTS).filter(value => value !== 'custom') as GarmentWash['placement'][]) {
      for (const mode of ['natural', 'tinted', 'bleach'] as const) {
        wash = { ...wash, type, placement, mode, autoWear: true };
        const markup = render();
        check(markup === render(), 'Seed is not deterministic');
        check(!new DOMParser().parseFromString(markup, 'image/svg+xml').querySelector('parsererror'), 'Invalid SVG');
        const pixels = await raster(markup);
        check(alphaSum(pixels) > 0, `${type}/${placement}/${mode}: empty wash`);
        for (let offset = 3; offset < pixels.length; offset += 4) check(pixels[offset] <= source[offset] + 2, `${type}/${placement}: spill at ${offset}`);
        if (placement === 'full' && mode === 'natural') styleHashes.add(Array.from(pixels.filter((_, index) => index % 997 === 0)).join(','));
        combinations++;
      }
    }
  }
  check(styleHashes.size === 4, 'Styles are visually identical');
  wash = { ...wash, type: 'mineral', placement: 'custom', mode: 'natural', autoWear: false };
  check(alphaSum(await raster(render())) === 0, 'Empty custom mask is not empty');
  const stroke = { id: 'paint', points: [{ x: .35, y: .5 }, { x: .65, y: .5 }], size: .2, strength: 100, softness: 0, erase: false, mirror: true };
  wash = updateWashView(wash, 'front', { strokes: [stroke], shapes: [] });
  const painted = alphaSum(await raster(render()));
  check(painted > 0, 'Brush is empty');
  check(!wash.views.back.strokes.length, 'Brush crossed views');
  wash = updateWashView(wash, 'front', { ...wash.views.front, strokes: [stroke, { ...stroke, id: 'erase', erase: true, size: .3 }] });
  check(alphaSum(await raster(render())) < painted * .05, 'Eraser did not remove paint');
  let softStrokeChecks = 0;
  for (const points of [
    [{ x: .4, y: .5 }],
    [{ x: .3, y: .5 }, { x: .6, y: .5 }],
    [{ x: .4, y: .3 }, { x: .4, y: .7 }],
    [{ x: .3, y: .4 }, { x: .4, y: .6 }, { x: .6, y: .4 }],
  ]) {
    for (const erase of [false, true]) {
      wash = updateWashView(wash, 'front', { strokes: [{ ...stroke, points, softness: 100, erase }], shapes: [], placement: erase ? 'full' : 'custom' });
      const markup = render();
      const document = new DOMParser().parseFromString(markup, 'image/svg+xml');
      const filters = document.querySelectorAll('[data-wash-filter]');
      check(filters.length === 2, 'Mirrored soft strokes need independent filters');
      for (const filter of filters) {
        const width = Number(filter.getAttribute('width'));
        const height = Number(filter.getAttribute('height'));
        check(width > 0 && height > 0 && width * height < 6144 ** 2 / 10, 'Stroke blur bounds are degenerate or oversized');
        filter.setAttribute('x', '-2048');
        filter.setAttribute('y', '-2048');
        filter.setAttribute('width', '6144');
        filter.setAttribute('height', '6144');
      }
      const bounded = await raster(markup);
      const reference = await raster(new XMLSerializer().serializeToString(document));
      check(alphaSum(bounded) > 0, 'Soft stroke is invisible');
      let difference = 0;
      for (let offset = 3; offset < bounded.length; offset += 4) difference += Math.abs(bounded[offset] - reference[offset]);
      check(difference < alphaSum(reference) * .01, 'Tight bounds clip the soft stroke');
      softStrokeChecks++;
    }
  }
  for (const kind of ['circle', 'oval', 'rectangle', 'band'] as const) {
    wash = updateWashView(wash, 'front', { strokes: [], shapes: [{ id: kind, kind, x: .4, y: .5, width: .35, height: .25, rotation: 35, intensity: 80, softness: 40, tint: '#c34928', mirror: true }] });
    check(alphaSum(await raster(render())) > 0, `${kind}: empty shape`);
  }
  check(JSON.stringify(JSON.parse(JSON.stringify(wash))) === JSON.stringify(wash), 'Save round trip');
  check(washTone('#173752', wash) !== washTone('#ad3529', wash), 'Region colours lost');
  const half = alphaSum(await raster(washSvg(raw, '#173752', bounds, 'base', { ...wash, intensity: 50 }, 'front', 'half')));
  const full = alphaSum(await raster(render()));
  check(half > full * .47 && half < full * .53, 'Intensity does not scale opacity');
  const seeded = await raster(render());
  wash.seed++;
  check((await raster(render())).some((value, index) => value !== seeded[index]), 'Random seed did not change texture');
  return { combinations, styles: styleHashes.size, clean: true, zero: true, clipping: true, brushErase: true, softStrokeChecks, shapes: 4, intensity: true, seed: true, serialization: true };
}

export async function verifyWashGarments() {
  let combinations = 0;
  let regions = 0;
  const started = performance.now();
  for (const fit of ['slim', 'regular', 'boxy', 'oversized']) {
    for (const view of ['front', 'back'] as const) {
      for (const sleeve of getGarmentAssetsForFit('tshirt', 'Sleeve length', fit)) {
        const selection = { ...getDefaultGarmentSelection('tshirt', fit), 'Sleeve length': sleeve.id };
        const layers = resolveGarmentLayers({ garmentType: 'tshirt', fit, view, selection,
          partColors: { base: '#173752', sleeveLeft: '#a13729', sleeveRight: '#358d60', underSleeveLeft: '#847db2', underSleeveRight: '#b38a2e' },
          tshirtHemStyles: { sleeve: 'ribbed', bottom: 'ribbed', undersleeve: 'ribbed' } });
        const snapshot = JSON.stringify(layers);
        const fabric = layers.filter(layer => layer.kind === 'solid' && !['outline', 'innerBackNeck'].includes(layer.id));
        const boxes = fabric.map(layer => getPotraceSvgBBox(layer.svgRaw)!);
        const bounds = { minX: Math.min(...boxes.map(box => box.minX)), minY: Math.min(...boxes.map(box => box.minY)), maxX: Math.max(...boxes.map(box => box.maxX)), maxY: Math.max(...boxes.map(box => box.maxY)) };
        const wash: GarmentWash = { ...defaultGarmentWash(), type: 'acid', autoWear: true, intensity: 100 };
        for (const layer of fabric) {
          const source = await raster(tintPotraceSvg(layer.svgRaw, '#ffffff', 'solid', false, 0));
          const pixels = await raster(washSvg(layer.svgRaw, layer.tint ?? '#173752', bounds, layer.id, wash, view, 'garment-test'));
          check(alphaSum(pixels) > 0, `${fit}/${view}/${sleeve.displayName}/${layer.id}: blank`);
          for (let offset = 3; offset < pixels.length; offset += 4) check(pixels[offset] <= source[offset] + 3, `${fit}/${view}/${layer.id}: spill at ${offset}`);
          regions++;
        }
        check(JSON.stringify(layers) === snapshot, 'Construction source mutated');
        combinations++;
      }
    }
  }
  return { combinations, regions, geometryPreserved: true, regionClipping: true, elapsedSeconds: Math.round((performance.now() - started) / 1000) };
}

export async function verifyWashPreview() {
  const { createElement } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { flushSync } = await import('react-dom');
  const { TshirtSvgPreview } = await import('../../src/app/components/builder/TshirtSvgPreview');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;width:512px;height:512px';
  document.body.append(host);
  const root = createRoot(host);
  const wash: GarmentWash = { ...defaultGarmentWash(), type: 'mineral', placement: 'custom' };
  wash.views.front.strokes.push({ id: 'alignment', points: [{ x: .5, y: .5 }], size: .2, strength: 100, softness: 30, erase: false, mirror: false });
  const props = { garmentType: 'tshirt' as const, fit: 'slim', color: '#173752', selection: getDefaultGarmentSelection('tshirt', 'slim'), garmentWash: wash,
    layerTransforms: { base: { x: 22, y: -14, rotation: 17, scale: 1.2 }, sleeveLeft: { x: -16, y: 9, rotation: -23, scale: .8 } } };
  try {
    flushSync(() => root.render(createElement(TshirtSvgPreview, props)));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    let transformedRegions = 0;
    const originalSources = new Map<string, string>();
    for (const layer of host.querySelectorAll<HTMLElement>('[data-layer-id]')) {
      const finish = layer.querySelector('[data-wash-layer]');
      if (!finish) continue;
      originalSources.set(layer.dataset.layerId!, layer.querySelector('svg')!.outerHTML);
      const style = getComputedStyle(layer);
      const ratio = 2048 / layer.offsetWidth;
      const origin = style.transformOrigin.split(' ').map(parseFloat);
      const forward = new DOMMatrix().scale(ratio).translate(origin[0], origin[1]).multiply(new DOMMatrix(style.transform)).translate(-origin[0], -origin[1]).scale(1 / ratio);
      const mapping = finish.querySelector('mask[id$="-placement"] > g:last-child')!.getAttribute('transform')!;
      const combined = forward.multiply(new DOMMatrix(mapping));
      for (const point of [new DOMPoint(600, 800), new DOMPoint(1400, 1200)]) {
        const result = point.matrixTransform(combined);
        check(Math.hypot(result.x - point.x, result.y - point.y) < .02, `${layer.dataset.layerId}: transformed brush drift`);
      }
      const outline = host.querySelector<HTMLElement>('[data-layer-id="outline"]')!;
      check(Number(style.zIndex) < Number(getComputedStyle(outline).zIndex), 'Wash covers construction ink');
      transformedRegions++;
    }
    check(transformedRegions >= 5, 'Missing wash preview regions');
    flushSync(() => root.render(createElement(TshirtSvgPreview, { ...props, showWash: false })));
    check(!host.querySelector('[data-wash-layer]'), 'Before mode still renders wash');
    for (const [identifier, markup] of originalSources) check(host.querySelector(`[data-layer-id="${identifier}"] svg`)!.outerHTML === markup, 'Wash changed source SVG');
    return { transformedRegions, inverseMapping: true, constructionOrder: true, beforeAfterSourcePreserved: true };
  } finally {
    root.unmount();
    host.remove();
  }
}