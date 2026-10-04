import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { assetHashes } from './export_hoodie_test.mjs';

const protectedAssets = assetHashes();
const directory = '.tmp-hoodie-assembly/labels-review';
fs.mkdirSync(directory, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  page.setDefaultTimeout(60000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/builder/hd-001`);
  for (let step = 0; step < 8; step++) await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue to Review', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Hoodie labels and branding' });
  await panel.waitFor();
  const sources = () => page.locator('[data-layer-id]').evaluateAll(nodes => nodes.map(node => ({
    id: node.dataset.layerId, style: node.getAttribute('style'), svg: (node.querySelector('[data-inner-back-neck-surface] svg') ?? node.querySelector('svg'))?.outerHTML,
  })));
  const original = await sources();
  assert.equal(original.length, 8);
  assert(await page.getByTitle('Back editing unavailable: this hoodie pack contains front assets only').isDisabled());
  assert.equal(await panel.getByRole('tab', { name: 'Hand Tags' }).count(), 1);
  await panel.getByRole('tab', { name: 'Hand Tags', exact: true }).click();
  const isolated = page.locator('[data-isolated-label]');
  await isolated.waitFor();
  assert.equal(await page.locator('[data-layer-id], [data-garment-label]').count(), 0, 'Hang tag must replace garment, not stack on neck');
  const tagBox = await isolated.boundingBox();
  const stageBox = await page.locator('[data-label-stage]').boundingBox();
  assert(Math.abs(tagBox.x + tagBox.width / 2 - stageBox.x - stageBox.width / 2) < 1);
  assert(Math.abs(tagBox.y + tagBox.height / 2 - stageBox.y - stageBox.height / 2) < 1);
  assert.match(await isolated.getAttribute('class'), /duration-\[650ms\]/);
  await page.screenshot({ path: `${directory}/shared-hang-tag.png` });
  await page.getByRole('button', { name: 'Zoom in label editor', exact: true }).click();
  assert.match(await isolated.getAttribute('style'), /scale\(1\)/);
  await page.getByRole('button', { name: 'Reset editing zoom', exact: true }).click();
  assert.match(await isolated.getAttribute('style'), /scale\(0.8\)/);
  await panel.getByRole('button', { name: 'Add size label', exact: true }).click();
  await page.getByRole('button', { name: 'Garment', exact: true }).click();
  assert(await panel.getByRole('checkbox', { name: 'Enable Size', exact: true }).isChecked());
  assert.equal(await panel.getByRole('checkbox', { name: 'Enable Brand / logo', exact: true }).isChecked(), false);
  assert.equal(await page.locator('[data-attachment-layer="innerBackNeck"]').count(), 1);
  await panel.getByRole('button', { name: 'Size', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Size', exact: true }).fill('XL');
  assert.equal(await panel.getByLabel('Label artwork proof').count(), 0);
  assert.match(await page.locator('[data-attachment-layer="innerBackNeck"]').textContent(), /XL/);
  await panel.getByRole('tab', { name: 'Care Labels', exact: true }).click();
  assert.match(await panel.getByRole('note').textContent(), /illustrative only/);
  const care = page.locator('[data-layer-id="base"] [data-garment-label]');
  await page.getByRole('button', { name: 'Garment', exact: true }).click();
  assert.equal(await care.count(), 0, 'Care label must be hidden in the normal front view');
  await page.getByRole('button', { name: 'Label Close-up', exact: true }).click();
  await care.waitFor();
  assert.equal(await care.count(), 1);
  assert.match(await care.locator('..').getAttribute('mask'), /^url\(#/);
  await page.getByRole('button', { name: 'Label Close-up', exact: true }).click();
  const camera = page.locator('[data-label-camera]');
  assert.match(await camera.getAttribute('class'), /duration-\[1800ms\]/);
  const careCamera = await camera.getAttribute('style');
  await page.getByLabel('Care label pan area').press('ArrowDown');
  assert.notEqual(await camera.getAttribute('style'), careCamera);
  await page.getByRole('button', { name: 'Reset editing zoom', exact: true }).click();
  await page.screenshot({ path: `${directory}/shared-care-label.png` });
  await page.getByRole('button', { name: 'Garment', exact: true }).click();
  assert.equal(await care.count(), 0);
  await panel.getByRole('tab', { name: 'Neck Labels', exact: true }).click();
  await panel.getByRole('button', { name: 'Add label', exact: true }).click();
  await panel.getByRole('button', { name: 'Brand / logo', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Brand / company name', exact: true }).fill('CERIGA');
  await panel.getByRole('combobox', { name: 'Section font', exact: true }).selectOption('Georgia');
  await panel.getByRole('combobox', { name: 'Section weight', exact: true }).selectOption('700');
  await panel.getByRole('combobox', { name: 'Section alignment', exact: true }).selectOption('left');
  await panel.getByLabel('Section colour', { exact: true }).fill('#c62838');
  const number = async (name, value) => {
    const field = panel.getByRole('spinbutton', { name, exact: true });
    await field.fill(String(value)); await field.press('Enter');
  };
  await number('Section font size (mm)', 4);
  await number('Finished width (mm)', 60);
  await number('Finished height (mm)', 30);
  await panel.getByRole('button', { name: 'Move Size up', exact: true }).click();
  const neck = () => page.locator('[data-attachment-layer="innerBackNeck"]').last();
  const proof = await neck().innerHTML();
  assert.match(proof, /Georgia/);
  assert.match(proof, /#c62838/);
  assert.equal(await page.locator('[data-attachment-layer="innerBackNeck"]').count(), 2);
  const neckTransform = () => neck().getAttribute('transform');
  const neckDefault = await neckTransform();
  const neckBounds = await neck().boundingBox();
  await page.mouse.move(neckBounds.x + neckBounds.width / 2, neckBounds.y + 3);
  await page.mouse.down();
  await page.mouse.move(neckBounds.x + neckBounds.width / 2 + 7, neckBounds.y + 6, { steps: 4 });
  await page.mouse.up();
  const neckMoved = await neckTransform();
  assert.notEqual(neckMoved, neckDefault);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await neckTransform(), neckDefault);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await neckTransform(), neckMoved);
  const dragNeckHandle = async (mode, horizontal, vertical) => {
    const handle = await page.locator(`[data-neck-handle="${mode}"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + horizontal, handle.y + handle.height / 2 + vertical, { steps: 4 });
    await page.mouse.up();
  };
  await dragNeckHandle('resize', 8, 6);
  const resizedWidth = Number(await panel.getByRole('spinbutton', { name: 'Finished width (mm)', exact: true }).inputValue());
  const resizedHeight = Number(await panel.getByRole('spinbutton', { name: 'Finished height (mm)', exact: true }).inputValue());
  assert(resizedWidth > 60 && resizedHeight > 30, 'Neck resize must update actual dimensions');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(Number(await panel.getByRole('spinbutton', { name: 'Finished width (mm)', exact: true }).inputValue()), 60);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(Number(await panel.getByRole('spinbutton', { name: 'Finished width (mm)', exact: true }).inputValue()), resizedWidth);
  await page.getByRole('button', { name: 'Resize neck label', exact: true }).press('ArrowLeft');
  assert.equal(Number(await panel.getByRole('spinbutton', { name: 'Finished width (mm)', exact: true }).inputValue()), Math.round((resizedWidth - 1) * 10) / 10);
  await number('Finished width (mm)', 60);
  await number('Finished height (mm)', 30);
  await dragNeckHandle('rotate', 4, 0);
  assert(Number(await neck().getAttribute('data-neck-rotation')) > 0);
  await number('Rotation (degrees)', -10);
  assert.equal(Number(await neck().getAttribute('data-neck-rotation')), -10);
  await page.getByRole('button', { name: 'Reset neck placement', exact: true }).click();
  assert.equal(await neckTransform(), neckDefault);
  assert.equal(Number(await neck().getAttribute('data-neck-scale')), 1);
  await number('Placement scale', 1.2);
  await panel.getByRole('button', { name: 'Restore default placement', exact: true }).click();
  assert.equal(Number(await neck().getAttribute('data-neck-scale')), 1);
  await panel.getByRole('button', { name: 'Exterior', exact: true }).click();
  assert.equal(await page.locator('[data-layer-id="hood"] [data-attachment-layer="innerBackNeck"]').count(), 2);
  assert.equal(await page.locator('[data-neck-handle]').count(), 0);
  await page.screenshot({ path: `${directory}/shared-neck-exterior.png` });
  await panel.getByRole('button', { name: 'Interior neck', exact: true }).click();
  assert.equal(await page.locator('[data-attachment-layer="innerBackNeck"]').count(), 2);
  assert.deepEqual(await sources(), original);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel.getByRole('group', { name: 'Label garment context' }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${directory}/neck-controls-${width}.png` });
    for (const control of await panel.locator('select, input, textarea').all()) {
      const bounds = await control.boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${width}: neck control overflow`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await panel.getByRole('button', { name: 'Reset labels', exact: true }).click();
  await panel.getByRole('tab', { name: 'Sleeve & Hem Tags', exact: true }).click();
  const tag = () => page.locator('[data-garment-label]').first();
  await tag().waitFor();
  const position = panel.getByRole('combobox', { name: 'Position on garment', exact: true });
  assert.equal(await position.locator('option').count(), 3);
  assert(await panel.getByRole('button', { name: 'Back', exact: true }).isDisabled());
  const transform = () => tag().getAttribute('transform');
  const before = await transform();
  const rect = await tag().boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 7, rect.y + rect.height / 2 + 2, { steps: 4 });
  await page.mouse.up();
  const moved = await transform();
  assert.notEqual(moved, before);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await transform(), before);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await transform(), moved);
  await tag().locator('g').first().dispatchEvent('pointerdown', { button: 0, pointerId: 1, clientX: rect.x, clientY: rect.y });
  await tag().locator('g').first().dispatchEvent('pointercancel', { pointerId: 1 });
  assert.equal(await transform(), moved);
  await number('Rotation (degrees)', 18);
  assert.notEqual(await transform(), moved);
  await number('Finished width (mm)', 26);
  await number('Finished height (mm)', 32);
  const handle = await page.locator('[data-label-handle]').boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 5, handle.y + handle.height / 2 + 5, { steps: 4 });
  await page.mouse.up();
  assert(Number(await panel.getByRole('spinbutton', { name: 'Finished width (mm)', exact: true }).inputValue()) > 26);
  assert(Number(await panel.getByRole('spinbutton', { name: 'Finished height (mm)', exact: true }).inputValue()) > 32);
  await panel.getByRole('button', { name: 'Brand / logo', exact: true }).click();
  const fontChooser = page.waitForEvent('filechooser');
  await panel.getByRole('button', { name: 'Import section font', exact: true }).click();
  await (await fontChooser).setFiles('C:/Windows/Fonts/arial.ttf');
  await page.waitForFunction(() => document.querySelector('[aria-label="Label artwork proof"]')?.innerHTML.includes('LabelFont-'));
  assert.match(await panel.getByRole('combobox', { name: 'Section font', exact: true }).inputValue(), /^LabelFont-/);
  const chooser = page.waitForEvent('filechooser');
  await panel.getByRole('button', { name: 'Logo PNG / SVG', exact: true }).click();
  await (await chooser).setFiles({ name: 'label-review.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="#cf2736"/><path d="M20 15H80V45H20Z" fill="white"/></svg>') });
  await panel.getByRole('button', { name: 'Remove logo', exact: true }).waitFor();
  assert.match(await tag().locator('image').getAttribute('href'), /^data:image\/svg\+xml/);
  for (const [value, layer] of [['sleeve-right', 'sleeveHemRight'], ['hem', 'bodyHem'], ['sleeve-left', 'sleeveHemLeft']]) {
    await position.selectOption(value);
    await page.locator(`[data-layer-id="${layer}"] [data-garment-label]`).waitFor();
  }
  await panel.getByRole('button', { name: 'Duplicate label', exact: true }).click();
  const order = () => page.locator('[data-garment-label]').evaluateAll(nodes => nodes.map(node => node.dataset.garmentLabel));
  const initialOrder = await order();
  await panel.getByRole('button', { name: 'Move label backward', exact: true }).click();
  assert.deepEqual(await order(), [...initialOrder].reverse());
  await position.selectOption('hem');
  assert.equal(await page.locator('[data-layer-id="sleeveHemLeft"] [data-garment-label]').count(), 1);
  assert.equal(await page.locator('[data-layer-id="bodyHem"] [data-garment-label]').count(), 1);
  assert.deepEqual(await sources(), original);
  const count = await page.locator('[data-garment-label]').count();
  await panel.getByRole('button', { name: 'Reset labels', exact: true }).click();
  assert.equal(await page.locator('[data-garment-label]').count(), 0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.waitForFunction(expected => document.querySelectorAll('[data-garment-label]').length === expected, count);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Stitching', exact: true }).click();
  await page.getByRole('button', { name: 'Labels', exact: true }).click();
  assert(await panel.getByRole('button', { name: 'Reset labels', exact: true }).isDisabled());
  await panel.getByRole('tab', { name: 'Sleeve & Hem Tags', exact: true }).click();
  await panel.getByRole('textbox', { name: 'Brand / company name', exact: true }).fill('CERIGA');
  await position.selectOption('hem');
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await panel.getByLabel('Label artwork proof').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${directory}/controls-${width}.png` });
    for (const control of await panel.locator('select, input, textarea').all()) {
      const bounds = await control.boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width + 1, `${width}: control overflow`);
    }
  }
  console.log('PASS: size/care/brand; dimensions; typography/colour/content order; logo/font upload; cuff/hem placement; move/resize/history/cancel; rotation; independent tags/order; Reset/remount; native layers; mobile controls.');

  if (!process.argv.includes('--editor-only')) {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.evaluate(async () => {
    const React = (await import('/node_modules/.vite/deps/react.js')).default;
    const client = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { createRoot } = client.default ?? client;
    const dom = await import('/node_modules/.vite/deps/react-dom.js');
    const { flushSync } = dom.default ?? dom;
    const { TshirtSvgPreview } = await import('/src/app/components/builder/TshirtSvgPreview.tsx');
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    const { createGarmentLabel } = await import('/src/app/data/garmentLabels.ts');
    const { createHoodieSizeLabel, hoodieInnerBackNeck, hoodieNeckLabelPlacement } = await import('/src/app/data/hoodieLabels.ts');
    const { createGarmentDetail } = await import('/src/app/data/garmentDetails.ts');
    const { defaultGarmentWash } = await import('/src/app/data/garmentWash.ts');
    document.getElementById('root').style.display = 'none';
    const host = document.createElement('div'); host.id = 'labels-proof';
    host.style.cssText = 'position:absolute;left:0;top:0;width:640px;height:640px;background:white';
    document.body.append(host);
    const root = createRoot(host);
    const hidden = [createGarmentLabel('neck'), createHoodieSizeLabel(), createGarmentLabel('care'), { ...createGarmentLabel('tag'), exteriorView: 'back' }];
    const tags = ['sleeve-left', 'sleeve-right', 'hem'].map(position => ({ ...createGarmentLabel('tag'), position, brand: 'CERIGA', background: '#ff243b', widthMm: 26, heightMm: 30 }));
    const detail = { ...createGarmentDetail('patch', [], '#eac54a'), attachment: 'base', x: .35, y: .3 };
    const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    window.renderLabelsProof = async (fit, hoodId, mode) => {
      const interior = mode.startsWith('interior');
      const neckLabel = { ...hidden[0], brand: 'CERIGA', background: '#f4f2ec', foreground: mode === 'interior-printed' ? '#ffffff' : '#242a2a', neckScale: 1, rotation: 0,
        ...(mode === 'interior-printed' ? { construction: 'printed', method: 'screen' } : {}) };
      const props = { garmentType: 'hoodie', fit, color: '#657e80', hoodieAssemblyVersion: 1,
        selection: { ...catalog.getDefaultGarmentSelection('hoodie', fit), Hood: hoodId },
        hoodieStitching: { global: { style: 'double', color: '#fff', visible: true } },
        hoodieWash: { global: { ...defaultGarmentWash(), type: 'vintage', intensity: 65 }, regions: {} },
        garmentDetails: [detail], garmentLabels: interior ? [neckLabel] : mode === 'baseline' ? hidden.filter(label => label.category === 'neck') : mode === 'hidden' ? hidden : [...hidden, ...tags],
        hoodieLabelView: interior ? 'interior' : 'exterior',
        ...(mode === 'interior-transformed' ? { layerTransforms: { base: { x: 12, y: -8, scale: 1.1, rotation: 3 } } } : {}) };
      const region = hoodieInnerBackNeck(fit, hoodId);
      if (!region || region.center.y <= region.seamY) throw Error('Invalid innerBackNeck');
      const defaultPlacement = hoodieNeckLabelPlacement(neckLabel, region, 750);
      if (!defaultPlacement || Math.abs(defaultPlacement.x - region.center.x) > .001) throw Error('Label sits off-center');
      if (defaultPlacement.y + defaultPlacement.height / 2 <= region.frontEdgeY) throw Error('Front hood edge must overlap the label');
      const topEdge = defaultPlacement.y - defaultPlacement.height / 2;
      if (neckLabel.construction === 'printed' ? topEdge <= region.seamY + 6 : topEdge >= region.seamY + 6) throw Error('Incorrect sewn/printed seam attachment');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      const edgeCovered = context.isPointInPath(new Path2D(region.seamCoverPath), defaultPlacement.x, topEdge);
      if (edgeCovered !== (neckLabel.construction !== 'printed')) throw Error('Back-neck seam does not correctly tuck the label edge');
      for (const rotation of [-10, 0, 10]) for (const offset of [-100, 0, 100]) {
        const placement = hoodieNeckLabelPlacement({ ...neckLabel, rotation, offsetXmm: offset, offsetYmm: offset, neckScale: 2 }, region, 750);
        if (!placement) throw Error('Missing bounded placement');
        for (const horizontal of [-1, 1]) for (const vertical of [-1, 1]) {
          const column = placement.x + horizontal * placement.halfWidth;
          const row = placement.y + vertical * placement.halfHeight;
          if (column < region.bounds.minX - .001 || column > region.bounds.maxX + .001 || row < region.bounds.minY - .001 || row > region.bounds.maxY + .001
            || !context.isPointInPath(new Path2D(region.panelPath), column, row)) throw Error('Neck label escaped bounds');
        }
      }
      flushSync(() => root.render(React.createElement(TshirtSvgPreview, mode.endsWith('reload') ? JSON.parse(JSON.stringify(props)) : props)));
      await frames();
    };
  });
  const variants = await page.evaluate(async () => {
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    return ['slim', 'regular', 'boxy', 'cropped', 'baggy'].flatMap(fit => catalog.getGarmentAssetsForFit('hoodie', 'Hood', fit).map(asset => ({ fit, id: asset.id })));
  });
  const pixels = input => sharp(input).ensureAlpha().raw().toBuffer();
  const samePixels = (actual, expected, name) => {
    assert.equal(actual.length, expected.length);
    assert(actual.every((value, index) => Math.abs(value - expected[index]) <= 1), name);
  };
  for (const [index, variant] of variants.entries()) {
    const render = mode => page.evaluate(({ fit, id, mode }) => window.renderLabelsProof(fit, id, mode), { ...variant, mode });
    await render('baseline');
    await page.locator('#labels-proof [data-stitch-ready="true"]').waitFor();
    const native = await sources();
    const baseline = await pixels(await page.locator('#labels-proof').screenshot());
    await render('hidden');
    assert.equal(await page.locator('#labels-proof [data-garment-label]').count(), 2);
    samePixels(await pixels(await page.locator('#labels-proof').screenshot()), baseline, `${variant.id}: hidden label leaked`);
    await render('tags');
    await page.waitForFunction(() => document.querySelectorAll('#labels-proof [data-garment-label]').length === 5);
    assert.deepEqual(await sources(), native);
    const layers = await page.locator('#labels-proof [data-garment-label]:not([data-attachment-layer="innerBackNeck"])').evaluateAll(nodes => nodes.map(node => [node.dataset.attachmentLayer, node.closest('[data-layer-id]').dataset.layerId]));
    assert.deepEqual(layers.sort(), [['bodyHem', 'bodyHem'], ['sleeveHemLeft', 'sleeveHemLeft'], ['sleeveHemRight', 'sleeveHemRight']]);
    const image = await page.locator('#labels-proof').screenshot({ path: `${directory}/${String(index + 1).padStart(2, '0')}-${variant.fit}.png` });
    const painted = await pixels(image);
    assert(painted.some((value, offset) => Math.abs(value - baseline[offset]) > 10), `${variant.id}: blank tags`);
    await render('reload');
    samePixels(await pixels(await page.locator('#labels-proof').screenshot()), painted, `${variant.id}: serialization changed artwork`);
    await render('interior');
    await page.locator('#labels-proof [data-attachment-layer="innerBackNeck"]').waitFor();
    assert.equal(await page.locator('#labels-proof [data-attachment-layer="innerBackNeck"]').count(), 1);
    const backLayer = await page.locator('#labels-proof [data-hoodie-neck-context]').evaluate(node => Number(getComputedStyle(node).zIndex));
    const hoodLayer = await page.locator('#labels-proof [data-interior-hood-aperture]').evaluate(node => Number(getComputedStyle(node).zIndex));
    assert(backLayer < hoodLayer, 'Back neck must be behind native hood');
    assert.equal(await page.locator('#labels-proof [data-layer-id="hood"] [data-hoodie-neck-context]').count(), 1, 'Neck must be a native hood child');
    assert.equal(await page.locator('#labels-proof [data-interior-hood-aperture]').count(), 1);
    assert.deepEqual(await sources(), native);
    const interiorImage = await page.locator('#labels-proof').screenshot({ path: `${directory}/neck-${String(index + 1).padStart(2, '0')}-${variant.fit}.png` });
    const interiorPixels = await pixels(interiorImage);
    assert(interiorPixels.some((value, offset) => Math.abs(value - baseline[offset]) > 10), `${variant.id}: blank neck`);
    await render('interior-reload');
    samePixels(await pixels(await page.locator('#labels-proof').screenshot()), interiorPixels, `${variant.id}: neck JSON roundtrip changed artwork`);
    if (variant.fit === 'boxy') {
      const name = variant.id.includes('Scuba') ? 'scuba' : variant.id.includes('Deep') ? 'deep' : 'regular';
      const construction = variant.id.toLowerCase().includes('crossover') ? '-crossover' : '';
      await page.locator('#labels-proof [data-back-neck-occluder]').evaluate(node => { node.style.display = 'none'; });
      const uncovered = await pixels(await page.locator('#labels-proof').screenshot());
      assert(uncovered.some((value, offset) => Math.abs(value - interiorPixels[offset]) > 10), 'Back seam must occlude artwork');
      await page.locator('#labels-proof [data-back-neck-occluder]').evaluate(node => { node.style.display = ''; });
      await page.setViewportSize({ width: 1600, height: 1600 });
      await page.locator('#labels-proof').evaluate(node => { node.style.width = '1536px'; node.style.height = '1536px'; });
      const highResolution = await page.locator('#labels-proof').screenshot({ path: `${directory}/neck-${name}${construction}.png` });
      await sharp(highResolution).extract({ left: 528, top: 216, width: 480, height: 408 }).resize(800, 680).toFile(`${directory}/neck-${name}${construction}-close.png`);
      await render('interior-printed');
      const printed = await page.locator('#labels-proof').screenshot({ path: `${directory}/neck-${name}${construction}-printed.png` });
      await sharp(printed).extract({ left: 528, top: 216, width: 480, height: 408 }).resize(800, 680).toFile(`${directory}/neck-${name}${construction}-printed-close.png`);
      await page.locator('#labels-proof').evaluate(node => { node.style.width = '640px'; node.style.height = '640px'; });
      await page.setViewportSize({ width: 900, height: 900 });
    }
    await render('interior-transformed');
    assert.equal(await page.locator('#labels-proof [data-hoodie-neck-context]').evaluate(node => node.closest('[data-layer-id]').dataset.layerId), 'hood');
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(assetHashes(), protectedAssets);
  console.log(`PASS: ${variants.length} fit/hood combinations; neck/size/care/back pixel isolation; three native attachment contexts; nonblank tags; wash/stitch/trim coexistence; JSON reload; asset hashes unchanged.`);
  console.log(`Review images: ${directory}`);
  console.log('PASS: innerBackNeck direct move/scale/rotate/reset/history; exterior occlusion; 225 rotated-bounds cases; 25 interior hood contexts, body transforms and JSON roundtrips.');
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(assetHashes(), protectedAssets);
} finally {
  await browser?.close();
  await server.close();
}