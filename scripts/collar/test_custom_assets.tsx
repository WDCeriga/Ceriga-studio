import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import '../../src/styles/index.css';
import { acceptedAssetBundle, acceptedDefinition, activeCustomAssets, customAssetTransforms, installCustomAsset, updateCustomAssetTransform, type CustomAssetCategory, type CustomAssetDefinition, type CustomAssetState } from '../../src/app/data/customAssets';
import { DEFAULT_TSHIRT_LAYER_TRANSFORM } from '../../src/app/data/tshirtLayerAssets';
import { copyDetailToOpposite, detailPlacement, detailSvg, resizeGarmentDetail, setDetailTransform, type GarmentDetail } from '../../src/app/data/garmentDetails';
import { detailMeasurements, editAssetDimension } from '../../src/app/components/builder/CustomAssetMeasurements';
import { TshirtSvgPreview } from '../../src/app/components/builder/TshirtSvgPreview';
import { CustomAssetUpload } from '../../src/app/components/builder/CustomAssetUpload';
import { GarmentDetailsPanel } from '../../src/app/components/builder/GarmentDetails';
import { getDefaultGarmentSelection, getGarmentAssetsForFit, resolveGarmentLayers } from '../../src/app/data/garmentSvgCatalog';
import { getLocalProject, saveLocalProject } from '../../src/app/lib/localProjects';
import { filledFabricSilhouette, getPotraceSvgBBox, renderFabricSvg } from '../../src/app/lib/tshirtSvgUtils';
import { measureStitchGeometry, renderStitchStyles } from '../../src/app/data/tshirtStitching';

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const fixtures = new Map<string, CustomAssetDefinition>();
function componentFixture(): CustomAssetDefinition {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2048 2048"><g transform="translate(0,1000) scale(1,-1)" fill="#000000"><path d="M100 300H350V700H100Z"/></g><g transform="translate(0,1000) scale(1,-1)" fill="#141414"><path d="M100 300H350V304H100Z"/></g></svg>';
  return { version: 1, id: 'parent', category: 'pocket', detailType: 'pocket', name: 'Pocket', svg,
    source: 'photo', provenance: 'front', analysis: { category: 'pocket', name: 'Pocket', construction: 'seams', provider: 'astra' },
    compatibility: { garmentTypes: ['tshirt'], fits: ['slim'], views: ['front'] },
    registration: { version: 1, profile: 'PocketPlacementProfile', layerId: 'pocket', socket: 'free-placement-v1', defaultTransform: { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, x: .7, y: .4 }, width: .2, ratio: 1 },
    validation: { version: 1, status: 'passed', checks: ['boundary', 'trace', 'registration'] }, colorBindings: { fabric: '#000000', ink: '#141414' } };
}

export function mountComponentUploadTest() {
  const primary = componentFixture();
  const additional = { ...primary, id: 'zip', name: 'Pocket zip', detailType: 'zip' as const,
    registration: { ...primary.registration, relativePlacement: { parentId: primary.id, x: .5, y: .2, width: .8 } } };
  const host = document.createElement('div');
  host.id = 'component-upload-test';
  host.style.cssText = 'position:fixed;inset:0;z-index:1;background:#171719;color:white;padding:24px;overflow:auto';
  document.body.append(host);
  const root = createRoot(host);
  flushSync(() => root.render(createElement(CustomAssetUpload, { category: 'pocket', garmentType: 'tshirt', fit: 'slim', view: 'front', assets: [], selectedIds: [],
    onAccept: (asset, extra = []) => { host.dataset.accepted = JSON.stringify([asset, ...extra].map(item => ({ id: item.id, type: item.detailType }))); },
    onRemove: () => {}, onRename: () => {}, renderPreview: (asset, extra = []) => createElement('div', { 'aria-label': 'Component preview', className: 'flex gap-2' },
      [asset, ...extra].map(item => createElement('img', { key: item.id, alt: item.name, src: `data:image/svg+xml,${encodeURIComponent(item.svg)}`, width: 120, height: 120 }))) })));
  return { ...primary, additionalAssets: [additional], cleanDrawing: referenceFixture('pocket') };
}

export function verifyComponentBundles() {
  const base = componentFixture();
  const svg = base.svg;
  const child = (id: string, type: 'button' | 'zip', parentId = 'parent'): CustomAssetDefinition => ({ ...base, id, name: type, detailType: type,
    registration: { ...base.registration, ratio: type === 'button' ? 1 : .2, relativePlacement: { parentId, x: .25, y: .5, width: .15 } } });
  const bounds = { minX: 400, minY: 200, maxX: 1600, maxY: 1800 };
  const initial = { garmentDetails: [] as GarmentDetail[] };
  const bundle = acceptedAssetBundle({ ...base, additionalAssets: [child('zip', 'zip')] });
  const state = bundle.reduce((next, asset) => installCustomAsset(next, asset, 'tshirt', 'slim', 'front', '#D45873', bounds), initial);
  check(state.garmentDetails.map(detail => detail.type).join(',') === 'pocket,zip', 'Composite did not create separate detail types');
  const recolored = state.garmentDetails.map(detail => detail.type === 'zip' ? { ...detail, fill: '#336699' } : detail);
  check(detailSvg(recolored[1]).includes('#336699') && detailSvg(recolored[0]).toLowerCase().includes('#d45873'), 'Component colours are not independent');
  check(recolored[0] === state.garmentDetails[0], 'Recolouring changed the parent');
  check(detailPlacement(recolored[1], bounds).left > detailPlacement(recolored[0], bounds).left, 'Zip lost parent placement');
  const sleeve: CustomAssetDefinition = { ...base, category: 'sleeve', detailType: undefined, name: 'Sleeve', keepSvg: svg,
    registration: { version: 1, profile: 'SleeveRegistrationProfile', layerId: 'sleeveLeft', side: 'left', socket: 'test', defaultTransform: DEFAULT_TSHIRT_LAYER_TRANSFORM } };
  const sleeves = acceptedAssetBundle({ ...sleeve, additionalAssets: [child('button-1', 'button'), { ...child('button-2', 'button'), registration: { ...child('button-2', 'button').registration, relativePlacement: { parentId: 'parent', x: .25, y: .75, width: .15 } } }] });
  const sleeveState = sleeves.reduce((next, asset) => installCustomAsset(next, asset, 'tshirt', 'slim', 'front', '#D45873', bounds), initial);
  const button = sleeveState.garmentDetails[0];
  const placement = detailPlacement(button, bounds);
  check(placement.left < bounds.minX && button.placementArea === 'canvas', 'Sleeve button was clamped onto the torso');
  check(sleeveState.garmentDetails[1].y !== button.y, 'Buttons overlap at the default position');
  const moved = setDetailTransform(button, bounds, { x: button.x + .01 });
  check(moved.x > button.x && detailPlacement(moved, bounds).left < bounds.minX, 'Sleeve button cannot move independently');
  check(resizeGarmentDetail(button, bounds, 1, 1, 5, 5).scaleX! > 1, 'Sleeve button cannot resize');
  for (const invalid of [{ ...base, additionalAssets: [child('parent', 'zip')] }, { ...base, additionalAssets: [child('zip', 'zip', 'wrong-parent')] }]) {
    let rejected = false;
    try { acceptedAssetBundle(invalid); } catch { rejected = true; }
    check(rejected, 'Malformed bundle accepted');
  }
  const restored = JSON.parse(JSON.stringify(sleeveState));
  check(acceptedDefinition(restored.garmentDetails[0].customAsset).detailType === 'button' && restored.garmentDetails[0].placementArea === 'canvas', 'Component state cannot round-trip');
  const host = document.createElement('div');
  const root = createRoot(host);
  let selected: string | null = null;
  try {
    flushSync(() => root.render(createElement(GarmentDetailsPanel, { details: [...recolored, ...sleeveState.garmentDetails], selectedId: null,
      onSelect: id => { selected = id; }, onChange: () => {}, color: '#D45873', bounds })));
    check(host.querySelector('[aria-label="Added pockets"]')?.textContent?.includes('Pocket'), 'Pocket section missing');
    check(host.querySelector('[aria-label="Added zips"]')?.textContent?.includes('zip'), 'Zip section missing');
    const buttonSection = host.querySelector('[aria-label="Added buttons"]');
    check(buttonSection?.querySelectorAll('button[aria-pressed]').length === 2, 'Buttons not listed separately');
    flushSync(() => buttonSection!.querySelector<HTMLButtonElement>('button[aria-pressed]')!.click());
    check(selected === button.id, 'Button section did not select its own asset');
  } finally { flushSync(() => root.unmount()); }
  const measurements = detailMeasurements(recolored, 'front', bounds, [], 50);
  check(measurements[1].kind === 'Custom zip', 'Zip measurement mislabeled as pocket');
  return { separatePocketAndZip: true, separateSleeveButtons: true, independentColours: true, sleevePlacement: true, movement: true, resizing: true, invalidBundlesRejected: true, editorSections: true, persistence: true };
}

export function verifyCustomPatch() {
  const fixture = componentFixture();
  const asset = acceptedDefinition({ ...fixture, detailType: 'patch', name: 'Uploaded patch', analysis: { ...fixture.analysis, category: 'patch' } });
  const state = installCustomAsset({ garmentDetails: [] as GarmentDetail[] }, asset, 'tshirt', 'slim', 'front', '#336699');
  const detail = state.garmentDetails[0];
  check(detail.type === 'patch', 'Upload installed as the wrong detail type');
  const svg = detailSvg(detail);
  check(svg.includes('M100 300H350V700H100Z') && svg.includes('#336699'), 'Uploaded patch artwork or colour was replaced');
  check(detailSvg({ ...detail, fill: '#996633' }).includes('#996633'), 'Uploaded patch cannot be recoloured');
  check(acceptedDefinition(JSON.parse(JSON.stringify(detail.customAsset))).detailType === 'patch', 'Uploaded patch cannot round-trip');
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    flushSync(() => root.render(createElement(GarmentDetailsPanel, { details: [detail], selectedId: detail.id, onSelect: () => {}, onChange: () => {}, color: '#336699' })));
    check(host.querySelector('[aria-label="Added patches"]')?.textContent?.includes('Uploaded patch'), 'Uploaded patch missing from Patches');
    check(host.querySelector('[aria-label="Detail colours"]'), 'Uploaded patch colour controls missing');
    check(!host.querySelector('[aria-label="Patch construction"]'), 'Procedural patch controls shown for traced artwork');
  } finally { flushSync(() => root.unmount()); }
  return { patchType: true, originalArtwork: true, editableColour: true, patchSection: true, persistence: true };
}

export function referenceFixture(category: CustomAssetCategory) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'white'; context.fillRect(0, 0, 1024, 1024);
  context.strokeStyle = 'black'; context.lineWidth = category === 'collar' ? 2 : 6;
  if (category === 'collar') {
    for (const [centerX, centerY, radiusX, radiusY] of [[512, 500, 332, 200], [512, 495, 302, 165]]) {
      context.beginPath(); context.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2); context.stroke();
    }
  } else if (category === 'pocket') context.strokeRect(200, 200, 500, 600);
  else {
    context.beginPath(); context.moveTo(760, 200); context.lineTo(760, 780); context.lineTo(560, 660); context.lineTo(560, 520); context.closePath(); context.stroke();
  }
  return canvas.toDataURL('image/png');
}

export async function processFixture(category: CustomAssetCategory, fit = 'slim', side = 'left', garmentType = category === 'collar' ? 'tshirtTest' : 'tshirt', image = referenceFixture(category)) {
  const response = await fetch('/api/custom-assets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
    image: image.split(',')[1], category, contextCategory: category, fit, side, source: 'drawing', view: 'front', crop: [0, 0, 1, 1], garmentType,
  }) });
  const messages = (await response.text()).trim().split('\n').map(line => JSON.parse(line));
  const error = messages.find(message => message.type === 'error');
  check(!error, error?.error);
  const result = messages.find(message => message.type === 'result')?.asset;
  check(response.ok && result, `${category}: missing completed asset`);
  check(result.cleanDrawing.startsWith('data:image/png;base64,'), 'Invalid drawing preview');
  const asset = acceptedDefinition(result);
  fixtures.set(`${category}:${fit}:${side}`, asset);
  return { category, fit, side, svgBytes: asset.svg.length, stages: messages.filter(message => message.type === 'progress').map(message => message.step) };
}

export async function verifyCustomAssetState() {
  const original: CustomAssetState & { garmentDetails: GarmentDetail[]; prints: [] } = { garmentDetails: [], prints: [] };
  const before = JSON.stringify(original);
  for (const category of ['collar', 'sleeve', 'pocket'] as const) {
    const asset = fixtures.get(`${category}:slim:left`);
    check(asset, `Run ${category} fixture first`);
    const garment = asset.compatibility.garmentTypes[0];
    let state = installCustomAsset(original, asset, garment, 'slim', 'front', '#D45873');
    check(JSON.stringify(original) === before, 'Installation mutated the original state');
    check(!('cleanDrawing' in state.customAssets![0]), 'Preview persisted');
    if (category === 'pocket') {
      state = installCustomAsset(state, asset, garment, 'slim', 'front', '#D45873');
      check(state.garmentDetails.length === 2 && state.garmentDetails[0].id !== state.garmentDetails[1].id, 'Pocket duplicate identity lost');
      const bounds = { minX: 400, maxX: 1600, minY: 200, maxY: 1800 };
      const rows = detailMeasurements(state.garmentDetails, 'front', bounds, [], 50);
      for (const [field, value] of [['width', 8], ['height', 12], ['rotation', 25], ['left', 28]] as const) {
        const edit = editAssetDimension(state, rows[0], field, value);
        check(!edit.error && edit.changes?.garmentDetails, `Pocket ${field}: ${edit.error}`);
        check(edit.changes.garmentDetails[1] === state.garmentDetails[1], 'Measurement changed another pocket');
      }
      check(detailSvg(state.garmentDetails[0]).toLowerCase().includes('#d45873'), 'Custom pocket fabric does not tint');
      const copied = copyDetailToOpposite(state.garmentDetails, state.garmentDetails[0], 'front');
      check(copied.some(detail => detail.view === 'back' && detail.customAsset?.provenance === 'derived'), 'Cross-view copy is not derived');
    } else {
      const layer = asset.registration.layerId;
      const moved = { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, x: 55, scaleX: 1.2, rotation: 12 };
      state = { ...state, customAssetInstances: updateCustomAssetTransform(state, garment, 'slim', 'front', layer, moved) };
      check(customAssetTransforms(state, garment, 'slim', 'front')[layer]?.x === 55, 'User transform lost');
      const replaced = installCustomAsset(state, { ...asset, id: `${asset.id}-replacement` }, garment, 'slim', 'front', '#D45873');
      check(customAssetTransforms(replaced, garment, 'slim', 'front', { [layer]: moved })[layer]?.x === 0, 'Replacement inherited stale offset');
      if (category === 'collar') check(customAssetTransforms(replaced, garment, 'slim', 'front', { base: moved }).base?.x === 0, 'Paired collar body inherited stale offset');
      state = { ...state, customAssetInstances: updateCustomAssetTransform(state, garment, 'slim', 'front', layer) };
      check(customAssetTransforms(state, garment, 'slim', 'front')[layer]?.rotation === 0, 'Reset lost registration');
      check(activeCustomAssets(state, garment, 'slim', 'back').length === 0, 'Front structural asset leaked onto back');
      const layers = resolveGarmentLayers({ garmentType: garment, fit: 'slim', view: 'front', color: '#D45873', selection: getDefaultGarmentSelection(garment, 'slim'), customAssetState: state });
      check(layers.some(item => item.id === layer && item.assetId === asset.id), 'Structural override missing');
      if (category === 'collar') check(layers.some(item => item.id === 'base' && item.svgRaw === asset.bodySvg), 'Matching collar body missing');
      else check(!layers.some(item => item.id === 'sleeveHemLeft'), 'Old cuff remains');
      if (category === 'collar' && garment === 'tshirt') {
        check(layers.some(item => item.id === 'innerBackNeck' && item.assetId === asset.id && item.colorBinding === 'body'), 'Custom collar backing missing');
        check(layers.filter(item => ['outline', 'stitching'].includes(item.id)).every(item => item.svgRaw.includes('custom-collar-')), 'Original neckline artwork is not masked');
      }
    }
    const id = `test-custom-${crypto.randomUUID()}`;
    try {
      await saveLocalProject({ id, name: category, product_id: 'ts-001', current_step: 6, state });
      check(JSON.stringify((await getLocalProject(id))?.state) === JSON.stringify(state), 'Saved asset changed on reload');
    } finally {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('ceriga-local-projects', 1);
        request.onsuccess = () => { const database = request.result; const transaction = database.transaction('projects', 'readwrite'); transaction.objectStore('projects').delete(id); transaction.oncomplete = () => { database.close(); resolve(); }; transaction.onerror = () => { database.close(); reject(transaction.error); }; };
        request.onerror = () => reject(request.error);
      });
    }
  }
  return { categories: 3, independentPockets: true, measurementEdits: 4, replacement: true, reset: true, frontBackIsolation: true, persistence: true };
}

let previewRoot: Root | undefined;
let previewHost: HTMLDivElement | undefined;

export async function verifyCustomCollarComposite(mockNeck = false) {
  const asset = fixtures.get('collar:slim:left');
  check(asset, 'Process collar fixture first');
  const selection = getDefaultGarmentSelection('tshirt', 'slim');
  selection.Neck = getGarmentAssetsForFit('tshirt', 'Neck', 'slim').find(asset => asset.displayName.startsWith('Scoop neck'))!.id;
  const state = installCustomAsset({}, asset, 'tshirt', 'slim', 'front', '#597db0');
  const input = { garmentType: 'tshirt' as const, fit: 'slim', view: 'front' as const, selection, color: '#597db0', neckTrimColor: '#cc2d24' };
  const original = resolveGarmentLayers(input);
  const layers = resolveGarmentLayers({ ...input, customAssetState: state });
  const backing = layers.find(layer => layer.id === 'innerBackNeck');
  check(backing?.colorBinding === 'body', 'Backing is not bound to body fabric');
  check(layers.find(layer => layer.id === 'neck')?.svgRaw === asset.svg, 'Custom collar drawing changed');
  const pixels = async (svg: string) => {
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2048;
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 2048, 2048);
    return context.getImageData(0, 0, 2048, 2048).data;
  };
  const bounds = getPotraceSvgBBox(asset.svg)!;
  const fabric = await pixels(renderFabricSvg(backing.svgRaw, '#597db0'));
  const center = (Math.round(bounds.centerY) * 2048 + Math.round(bounds.centerX)) * 4;
  check(fabric[center] === 89 && fabric[center + 1] === 125 && fabric[center + 2] === 176 && fabric[center + 3] === 255, 'Opening is not filled with body fabric');
  if (mockNeck) {
    const collarPixels = await pixels(renderFabricSvg(asset.svg, '#cc2d24'));
    const sample = (fraction: number) => (Math.round(bounds.minY + (bounds.maxY - bounds.minY) * fraction) * 2048 + Math.round(bounds.centerX)) * 4;
    const opening = sample(.12);
    const panel = sample(.46);
    check(collarPixels[opening + 3] === 0, 'Head opening incorrectly contains collar fabric');
    check(fabric[opening] === 89 && fabric[opening + 1] === 125 && fabric[opening + 2] === 176 && fabric[opening + 3] === 255, 'Upper opening lacks blue body backing');
    check(collarPixels[panel] === 204 && collarPixels[panel + 1] === 45 && collarPixels[panel + 2] === 36 && collarPixels[panel + 3] === 255, 'Upright panel does not take the red collar colour');
    const outline = layers.find(layer => layer.id === 'outline')!;
    const joins = new DOMParser().parseFromString(outline.svgRaw, 'image/svg+xml').querySelectorAll('[data-custom-shoulder-join]');
    check(joins.length === 2, 'Both shoulder joins must reach the uploaded collar');
    const geometry = await measureStitchGeometry(layers, 'slim');
    check(geometry.rows.neckline.length === 0 && geometry.rows.shoulder.length === 2, 'Preset neckline stitches remain beside the mock collar');
    const stitchPixels = await pixels(renderStitchStyles(layers.find(layer => layer.id === 'stitching')!, geometry, {}));
    const bodyPixels = await pixels(renderFabricSvg(layers.find(layer => layer.id === 'base')!.svgRaw, '#597db0'));
    const presetBounds = getPotraceSvgBBox(original.find(layer => layer.id === 'neck')!.svgRaw)!;
    for (let row = Math.ceil(bounds.maxY + 8); row < presetBounds.maxY; row++) {
      for (let column = Math.ceil(presetBounds.minX); column < presetBounds.maxX; column++) {
        check(stitchPixels[(row * 2048 + column) * 4 + 3] === 0, 'Rendered Scoop stitches remain below the custom collar');
        check(bodyPixels[(row * 2048 + column) * 4 + 3] === 255, 'Old neckline perforations remain in the body fabric');
      }
    }
  }
  const ring = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g fill="#000000"><path d="M10 10h80v80h-80z m20 20v40h40v-40z"/></g><g fill="#141414"><path d="M0 0h1v1z"/></g></svg>';
  const silhouette = new DOMParser().parseFromString(filledFabricSilhouette(ring), 'image/svg+xml');
  check(silhouette.querySelectorAll('g').length === 1 && silhouette.querySelectorAll('path')[1].getAttribute('d')?.startsWith('M30 30'), 'Relative closed contour was displaced');
  const oldNeck = getPotraceSvgBBox(original.find(layer => layer.id === 'neck')!.svgRaw)!;
  const left = Math.min(oldNeck.minX, bounds.minX);
  const right = Math.max(oldNeck.maxX, bounds.maxX);
  const before = await pixels(original.find(layer => layer.id === 'outline')!.svgRaw);
  const after = await pixels(layers.find(layer => layer.id === 'outline')!.svgRaw);
  let shoulderPixels = 0;
  for (let row = 0; row < Math.ceil(Math.max(oldNeck.maxY, bounds.maxY)); row++) {
    for (const start of [Math.floor(left) - 7, Math.ceil(right) + 1]) {
      for (let column = start; column < start + 6; column++) {
        const offset = (row * 2048 + column) * 4 + 3;
        if (before[offset] > 200) { shoulderPixels++; check(after[offset] > 200, 'Shoulder end clipped by collar mask'); }
      }
    }
  }
  check(shoulderPixels > 0, 'Shoulder sample missed the outline');
  const moved = { ...state, customAssetInstances: updateCustomAssetTransform(state, 'tshirt', 'slim', 'front', 'neck', { ...DEFAULT_TSHIRT_LAYER_TRANSFORM, x: 12 }) };
  check(customAssetTransforms(moved, 'tshirt', 'slim', 'front').innerBackNeck?.x === 12, 'Backing does not follow collar transform');
  return { bodyFabricFill: true, collarUnchanged: true, relativeContours: true, shoulderPixels, backingTransform: true };
}

export function mockNeckReferenceFixture() {
  const canvas = document.createElement('canvas');
  canvas.width = 400; canvas.height = 320;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'white'; context.fillRect(0, 0, 400, 400);
  context.strokeStyle = 'black'; context.lineWidth = 2;
  for (const points of [
    [[120, 50], [160, 54], [240, 54], [275, 50], [270, 60], [250, 72], [238, 87], [217, 98], [190, 99], [173, 94], [158, 83], [150, 68], [120, 50]],
    [[120, 50], [108, 113], [85, 155], [110, 178], [150, 198], [200, 210], [250, 198], [290, 178], [315, 155], [291, 113], [275, 50]],
    [[40, 190], [85, 155]], [[315, 155], [360, 190]], [[165, 202], [200, 265], [235, 202]],
  ]) {
    context.beginPath(); context.moveTo(points[0][0], points[0][1]);
    for (const [left, top] of points.slice(1)) context.lineTo(left, top);
    context.stroke();
  }
  return canvas.toDataURL('image/png');
}

export function verifyCustomAssetOption(asset: CustomAssetDefinition) {
  const host = document.createElement('div');
  const root = createRoot(host);
  let acceptedId = '';
  const render = (view: 'front' | 'back') => flushSync(() => root.render(createElement(CustomAssetUpload, {
    category: asset.category, garmentType: 'tshirt', fit: 'slim', view, assets: [asset], selectedIds: [asset.id],
    onAccept: selected => { acceptedId = selected.id; }, onRemove: () => {}, onRename: () => {}, renderPreview: () => null,
  })));
  try {
    render('front');
    const option = host.querySelector<HTMLButtonElement>('button[aria-pressed]');
    check(option && !option.disabled && option.getAttribute('aria-pressed') === 'true', 'Custom option selected state missing');
    option.querySelector('img')!.click();
    check(acceptedId === asset.id, 'Thumbnail does not select the custom asset');
    render('back');
    check(host.querySelector<HTMLButtonElement>('button[aria-pressed]')?.disabled, 'Incompatible option is selectable');
    return { thumbnailSelection: true, selectedState: true, incompatibleDisabled: true };
  } finally { flushSync(() => root.unmount()); }
}

export function layeredVReferenceFixture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'white'; context.fillRect(0, 0, 1024, 1024);
  context.scale(2.56, 2.56); context.strokeStyle = 'black'; context.lineWidth = 2;
  const lines = [
    [[50, 75], [95, 50], [150, 80], [250, 80], [305, 50], [350, 75]],
    [[50, 75], [80, 210], [200, 350], [320, 210], [350, 75]],
    [[95, 50], [105, 120], [135, 215], [200, 295], [265, 215], [295, 120], [305, 50]],
    [[105, 120], [160, 135], [240, 135], [295, 120]],
    [[200, 295], [200, 350]], [[175, 102], [185, 103]],
  ];
  for (const line of lines) {
    context.beginPath(); context.moveTo(line[0][0], line[0][1]);
    for (const [left, top] of line.slice(1)) context.lineTo(left, top);
    context.stroke();
  }
  return canvas.toDataURL('image/png');
}

export function mountSleeveUploadFixture() {
  removeCustomPreview();
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:20;background:#171719;padding:24px';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  let accepted: CustomAssetState = {};
  let preview: CustomAssetState = {};
  const install = (asset: CustomAssetDefinition, additionalAssets: CustomAssetDefinition[] = []) =>
    [asset, ...additionalAssets].reduce((state, definition) => installCustomAsset(state, definition, 'tshirt', 'slim', 'front', '#7da8dd'), {} as CustomAssetState);
  flushSync(() => previewRoot!.render(createElement(CustomAssetUpload, {
    category: 'sleeve', garmentType: 'tshirt', fit: 'slim', view: 'front', assets: [], selectedIds: [],
    onAccept: (asset, additionalAssets) => { accepted = install(asset, additionalAssets); }, onRemove: () => {}, onRename: () => {},
    renderPreview: (asset, additionalAssets) => {
      preview = install(asset, additionalAssets);
      return createElement(TshirtSvgPreview, {
        garmentType: 'tshirt', fit: 'slim', color: '#7da8dd', detailView: 'front',
        selection: getDefaultGarmentSelection('tshirt', 'slim'), customAssetState: preview, className: 'h-full w-full',
      });
    },
  })));
  return () => ({ accepted: Object.keys(accepted.customAssetInstances ?? {}), preview: Object.keys(preview.customAssetInstances ?? {}) });
}

export function mountCollarUploadFixture() {
  removeCustomPreview();
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:20;background:#171719;padding:24px';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  flushSync(() => previewRoot!.render(createElement(CustomAssetUpload, {
    category: 'collar', garmentType: 'tshirt', fit: 'slim', view: 'front', assets: [], selectedIds: [], previewColor: '#7da8dd',
    onAccept: () => {}, onRemove: () => {}, onRename: () => {},
    renderPreview: asset => createElement(TshirtSvgPreview, {
      garmentType: 'tshirt', fit: 'slim', color: '#7da8dd', detailView: 'front',
      selection: getDefaultGarmentSelection('tshirt', 'slim'),
      customAssetState: installCustomAsset({ garmentDetails: [] as GarmentDetail[] }, asset, 'tshirt', 'slim', 'front', '#7da8dd'),
      className: 'h-full w-full',
    }),
  })));
}

export function removeCustomPreview() { if (previewRoot) flushSync(() => previewRoot!.unmount()); previewRoot = undefined; previewHost?.remove(); previewHost = undefined; }
export function mountCustomPreview(category: CustomAssetCategory, fit = 'slim', side = 'left', custom = true) {
  removeCustomPreview();
  const asset = fixtures.get(`${category}:${fit}:${side}`);
  check(asset, 'Process fixture first');
  const garment = asset.compatibility.garmentTypes[0];
  const state = custom ? installCustomAsset({ garmentDetails: [] as GarmentDetail[] }, asset, garment, fit, 'front', '#597db0') : {};
  const selection = getDefaultGarmentSelection(garment, fit);
  if (category === 'collar' && garment === 'tshirt') selection.Neck = getGarmentAssetsForFit(garment, 'Neck', fit).find(asset => asset.displayName.startsWith('Scoop neck'))!.id;
  previewHost = document.createElement('div'); previewHost.id = 'custom-asset-test-preview';
  previewHost.style.cssText = 'position:fixed;inset:0;z-index:99990;background:#eee;display:flex;align-items:center;justify-content:center';
  document.body.append(previewHost); previewRoot = createRoot(previewHost);
  flushSync(() => previewRoot!.render(createElement(TshirtSvgPreview, { garmentType: garment, fit, color: '#597db0', neckTrimColor: '#cc2d24', detailView: 'front', selection, customAssetState: state, garmentDetails: state.garmentDetails })));
  return { category, fit, side, custom };
}