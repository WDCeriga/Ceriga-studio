import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';

const base = process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5189';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g"><stop stop-color="#c02146"/><stop offset=".5" stop-color="#439889"/><stop offset="1" stop-color="#e4bd65"/></linearGradient></defs><rect x="24" y="24" width="208" height="208" fill="url(#g)"/><path d="M32 40h60v55H32z" fill="#222"/><path d="M160 40h64v55h-64z" fill="#ddd"/><path d="M48 144h12v64H48zM80 144h12v64H80zM112 144h12v64h-12z" fill="#777"/><rect x="8" y="112" width="10" height="20" fill="#997755" opacity=".5"/></svg>`;
const source = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const bundle = await build({
  stdin: { loader: 'tsx', resolveDir: process.cwd(), contents: `
    import React from 'react';
    import { createRoot } from 'react-dom/client';
    import { flushSync } from 'react-dom';
    import { toCanvas } from 'html-to-image';
    import { IMAGE_FILTERS } from './src/app/lib/imageFilters';
    import { filteredImagePixels, waitForImageFilters } from './src/app/lib/imageFilterRendering';
    import { FilteredImage } from './src/app/components/builder/printsStudio/FilteredImage';
    import { ImageAdjustmentDefs } from './src/app/components/builder/printsStudio/ImageAdjustmentDefs';
    import { DesignAssetSurface } from './src/app/components/builder/printsStudio/DesignAssetSurface';
    import { DesignGroupArtwork } from './src/app/components/builder/printsStudio/DesignGroupArtwork';
    import { composeArtworkFilter } from './src/app/components/builder/PrintsDesignStep';
    import { sourceSignature } from './src/app/components/builder/printsStudio/WarpedArtwork';
    import { artworkFlipStyle } from './src/app/lib/artworkFlip';
    import { exportAssetArtboard } from './src/app/lib/exportAssetArtboard';
    const root = createRoot(document.getElementById('root'));
    window.filterIds = IMAGE_FILTERS.map(f => f.id);
    window.renderFilter = (source, patch = {}, grouped = false) => {
      const child = { id:'photo',type:'image',content:source,x:128,y:128,width:256,height:256,rotation:0,...patch };
      const element = grouped ? {id:'group',type:'group',content:'',x:128,y:128,width:256,height:256,rotation:0,children:[child],groupSourceWidth:256,groupSourceHeight:256,warp:typeof grouped === 'object' ? grouped : undefined} : child;
      window.filterElement = element;
      flushSync(() => root.render(<div id="capture" data-asset-artboard style={{position:'relative',width:256,height:256}}><div data-print-id={element.id} style={{width:256,height:256}}>
        <ImageAdjustmentDefs element={element}/>
        {grouped ? <DesignAssetSurface element={element} selected={false} scale={1} onChange={()=>{}} overlay={null}><DesignGroupArtwork element={element}/></DesignAssetSurface> : <DesignAssetSurface element={element} selected={false} scale={1} onChange={()=>{}} overlay={null}><div style={{width:'100%',height:'100%',filter:composeArtworkFilter(element)}}><FilteredImage source={source} settings={element.imageFilter} alt="test" className="h-full w-full" style={artworkFlipStyle(element)}/></div></DesignAssetSurface>}
      </div></div>));
    };
    window.captureFilter = async () => {
      const node = document.getElementById('capture');
      await waitForImageFilters(node);
      await Promise.all([...node.querySelectorAll('img')].map(image=>image.decode()));
      if (window.filterElement.warp) {
        const expected = sourceSignature(window.filterElement)+JSON.stringify(window.filterElement.warp);
        const deadline = Date.now()+10000;
        while(![...node.querySelectorAll('[data-warp-canvas]')].some(canvas=>canvas.dataset.warpReady === expected)) { if(Date.now()>deadline) throw Error('Warp timeout'); await new Promise(r=>setTimeout(r,20)); }
      }
      const canvas = await toCanvas(node,{width:256,height:256,pixelRatio:1,skipFonts:true,filter:n=>!(n instanceof Element)||!n.matches('[data-editor-chrome]')});
      return Array.from(canvas.getContext('2d').getImageData(0,0,256,256).data);
    };
    window.filterCacheIdentity = source => filteredImagePixels(source,{id:'film',intensity:10}) === filteredImagePixels(source,{id:'film',intensity:90});
    window.exportFilter = () => exportAssetArtboard(256,256,[window.filterElement]);
  ` },
  bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
  define: { 'import.meta.url': JSON.stringify(`${base}/src/app/lib/imageFilterRendering.ts`) },
});
const difference = (a, b) => a.reduce((sum, value, index) => sum + (index % 4 === 3 ? 0 : Math.abs(value - b[index])), 0) / (a.length * .75);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (!process.argv.includes('--ui-only')) {
  await page.goto(base);
  await page.setContent('<style>html,body{margin:0;background:transparent}.relative{position:relative}.absolute{position:absolute}.inset-0{inset:0}.h-full{height:100%}.w-full{width:100%}.object-fill{object-fit:fill}</style><div id="root"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const render = async (patch = {}, grouped = false) => page.evaluate(async ({ source, patch, grouped }) => { window.renderFilter(source, patch, grouped); return window.captureFilter(); }, { source, patch, grouped });
  const original = await render();
  const filters = await page.evaluate(() => window.filterIds);
  assert.equal(filters.length, 35);
  const outputs = new Map();
  for (const id of filters.slice(1)) {
    const pixels = await render({ imageFilter: { id, intensity: 100 } });
    assert(difference(original, pixels) > .05, `${id} should change rendered pixels`);
    assert.equal(pixels[3], 0, `${id}: transparent margin`);
    assert.equal(pixels[(120 * 256 + 12) * 4 + 3], original[(120 * 256 + 12) * 4 + 3], `${id}: partial alpha`);
    outputs.set(id, pixels);
  }
  assert.equal(new Set([...outputs.values()].map(pixels => Buffer.from(pixels).toString('base64'))).size, 34, 'Every preset has its own visual treatment');
  assert.deepEqual(await render({ imageFilter: { id: 'invert', intensity: 0 } }), original);
  const partial = await render({ imageFilter: { id: 'invert', intensity: 40 } });
  assert(difference(original, partial) > 0 && difference(original, partial) < difference(original, outputs.get('invert')));
  assert.equal(await page.evaluate(source => window.filterCacheIdentity(source), source), true, 'Intensity changes reuse the full effect');
  const patch = { imageFilter: { id: 'duotone', intensity: 80, shadowColor: '#123456', highlightColor: '#fef0a0' }, filterContrast: 130, filterExposure: .4, filterGrain: 10, flipHorizontal: true, cropLeft: 5 };
  const adjusted = await render(patch);
  assert(difference(adjusted, await render({ imageFilter: patch.imageFilter })) > 1);
  const grouped = await render(patch, true);
  assert(difference(adjusted, grouped) < .1, 'Grouped image retains filters, adjustments, flip and crop');
  const exported = await page.evaluate(() => window.exportFilter());
  const png = await sharp(Buffer.from(exported.split(',')[1], 'base64')).ensureAlpha().raw().toBuffer();
  assert(difference(grouped, png) < .1, 'Asset export contains current filtered pixels');
  const warp = { mode: 'preset', preset: 'arc', amount: 25, gridSize: 3 };
  const warpedA = await render({ imageFilter: { id: 'sepia' }, warp });
  const warpedB = await render({ imageFilter: { id: 'invert' }, warp });
  assert(difference(warpedA, warpedB) > 1, 'Warp recaptures when filters change');
  const nestedA = await render({ imageFilter: { id: 'sepia' }, warp }, { ...warp, amount: 10 });
  const nestedB = await render({ imageFilter: { id: 'invert' }, warp }, { ...warp, amount: 10 });
  assert(difference(nestedA, nestedB) > 1, 'Parent and child warps both recapture filtered source');
  await page.evaluate(() => window.exportFilter());
  assert.equal(await page.locator('#capture img').first().getAttribute('src'), source, 'Original upload is never overwritten');
  assert.deepEqual(await render({ filterExposure: .5, imageFilter: { id: 'film', intensity: 0 } }), await render({ filterExposure: .5 }), 'Zero intensity preserves manual adjustments');
  await page.evaluate(source => {
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function () {
      HTMLImageElement.prototype.decode = decode;
      return Promise.reject(new Error('Simulated decode failure'));
    };
    window.renderFilter(source, { imageFilter: { id: 'film' } });
  }, `data:image/svg+xml;base64,${Buffer.from(svg.replace('#777', '#778')).toString('base64')}`);
  await page.getByRole('alert').waitFor();
  assert.match(await page.evaluate(() => window.exportFilter().then(() => 'unexpected success', error => error.message)), /image filter could not be rendered/i);
  await page.getByRole('button', { name: 'Retry filter', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('#capture [data-image-filter-pending="true"]'));
  assert.equal(await page.locator('#capture [data-image-filter-error]').count(), 0);
  await page.evaluate(() => window.exportFilter());
  console.log('Pixels: 34 distinct presets, alpha, intensity, cache, adjustments, grouped transforms, export, warp and failed-render retry passed.');
  }

  await page.goto(`${base}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  for (let step = 0; step < 10 && !await page.getByRole('button', { name: 'Continue to Review', exact: true }).isVisible(); step++) await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  const zone = page.locator('[data-print-design-zone]');
  const assets = () => page.getByRole('button', { name: /^Assets/ }).first().click();
  await assets();
  await page.getByRole('button', { name: '+ Create Asset', exact: true }).click();
  await page.getByLabel('Asset name', { exact: true }).fill('Filtered source');
  await assets();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Upload image', exact: true }).click({ timeout: 10000 })]);
  await chooser.setFiles({ name: 'filter-sample.png', mimeType: 'image/png', buffer: await sharp(Buffer.from(svg)).png().toBuffer() });
  const panel = page.getByRole('region', { name: 'Image filters', exact: true });
  await panel.getByRole('button', { name: 'Original / None', exact: true }).waitFor();
  assert.equal(await panel.getByRole('button').count(), 35);
  assert.equal(await panel.getByRole('button').first().getAttribute('aria-label'), 'Original / None');
  const originalUpload = await zone.locator('img[alt="Artwork"]').getAttribute('src');
  await page.waitForFunction(() => !document.querySelector('[aria-label="Image filters"] [data-image-filter-pending="true"]'));
  assert.equal(await panel.locator('[data-image-filter-error]').count(), 0, 'All thumbnails use the uploaded image successfully');
  assert.equal(await panel.locator('img').evaluateAll(images => new Set(images.map(image => image.src)).size), 1);
  const select = name => panel.getByRole('button', { name, exact: true }).click();
  const ready = () => page.waitForFunction(() => !document.querySelector('[data-print-design-zone] [data-image-filter-pending="true"]'));
  await select('Duotone');
  assert.equal(await panel.getByRole('button', { name: 'Duotone', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.getByLabel(/^Filter Shadow Colour$/i).fill('#112244');
  assert.equal(await page.getByLabel(/^Filter Pixel Size$/i).count(), 0);
  await select('Pixelate');
  assert.equal(await page.getByLabel(/^Filter Shadow Colour$/i).count(), 0);
  await page.getByLabel(/^Filter Pixel Size$/i).fill('24');
  await select('Film');
  assert.equal(await page.getByLabel(/^Filter Grain$/i).count(), 1);
  assert.equal(await page.getByLabel(/^Filter Fade$/i).count(), 1);
  await page.getByLabel(/^Filter Contrast$/i).fill('50');
  await select('Invert');
  await ready();
  assert.equal(await panel.getByRole('button', { name: 'Invert', exact: true }).getAttribute('aria-pressed'), 'true');
  const imagePixels = () => zone.locator('[data-image-filter] canvas').evaluate(canvas => Array.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data));
  const full = await imagePixels();
  await page.getByLabel('Filter intensity', { exact: true }).fill('35');
  assert(difference(full, await imagePixels()) > 1, 'Intensity repaints while input is changed');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await page.getByLabel('Filter intensity', { exact: true }).inputValue(), '100');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  assert.equal(await page.getByLabel('Filter intensity', { exact: true }).inputValue(), '35');
  await page.getByLabel('Filter intensity', { exact: true }).fill('0');
  assert.equal(await zone.locator('[data-image-filter]').count(), 0);
  assert.equal(await zone.locator('img[alt="Artwork"]').getAttribute('src'), originalUpload);
  await page.getByLabel('Filter intensity', { exact: true }).fill('100');
  await ready();
  await page.getByRole('button', { name: 'Save Asset', exact: true }).click();
  await page.locator('[data-asset-artboard]').waitFor({ state: 'detached' });
  await assets();
  await page.getByRole('button', { name: 'Edit Asset', exact: true }).click();
  await zone.locator('[data-print-id]').first().click();
  await assets();
  assert.equal(await panel.getByRole('button', { name: 'Invert', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await zone.locator('img[alt="Artwork"]').getAttribute('src'), originalUpload);
  await page.getByRole('button', { name: '← Back to Garment', exact: true }).click();
  const placed = zone.locator('[data-print-id]');
  await placed.click();
  await assets();
  await select('Sepia');
  await ready();
  const frontId = await placed.getAttribute('data-print-id');
  await page.getByRole('button', { name: 'Duplicate', exact: true }).first().click();
  assert.equal(await zone.locator('[data-image-filter="sepia"]').count(), 2);
  await page.getByRole('checkbox', { name: 'Select layer 1 for group or merge', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Select layer 2 for group or merge', exact: true }).check();
  await page.getByRole('button', { name: /^Merge Layers/ }).click();
  await page.waitForFunction(() => document.querySelectorAll('[data-print-design-zone] [data-print-id]').length === 1);
  assert.equal(await zone.locator('[data-image-filter]').count(), 0, 'Merged image contains baked filtered pixels');
  assert((await zone.locator('img[alt="Artwork"]').getAttribute('src')).startsWith('data:image/png;base64,'));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  assert.equal(await zone.locator('[data-image-filter="sepia"]').count(), 2, 'Undo merge restores editable filters');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: /^back$/i }).last().click();
  await assets();
  await page.getByRole('button', { name: 'Place Filtered source', exact: true }).click();
  await assets();
  await select('Cold');
  await ready();
  await page.getByRole('button', { name: 'Continue to Review', exact: true }).click();
  for (let step = 0; step < 2; step++) await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.getByRole('button', { name: /Reset size split|One per size/ }).first().click();
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.getByRole('button', { name: 'Order', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-project-garment-side="front"] [data-image-filter="sepia"]').first().waitFor();
  await page.locator('[data-project-garment-side="back"] [data-image-filter="cold"]').first().waitFor();
  await page.getByRole('button', { name: 'Order', exact: true }).click();
  await page.waitForURL('**/delivery');
  await page.locator(`[data-project-garment-side="front"] [data-print-id="${frontId}"] [data-image-filter="sepia"]`).waitFor();
  await page.locator('[data-project-garment-side="back"] [data-image-filter="cold"]').waitFor();
  await page.reload();
  await page.locator('[data-project-garment-side="front"] [data-image-filter="sepia"]').first().waitFor();
  await page.locator('[data-project-garment-side="back"] [data-image-filter="cold"]').first().waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-project-garment-side] [data-image-filter-pending="true"]'));
  assert.equal(await page.locator('[data-project-garment-side] [data-image-filter-error]').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Editor: actual-image previews, conditional controls, live intensity, undo/redo, editable asset save, duplicate and front/back Review/Delivery reload passed. No order submitted.');
} finally { await browser.close(); }
