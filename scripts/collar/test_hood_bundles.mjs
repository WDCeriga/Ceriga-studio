import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import { assetHashes } from './export_hoodie_test.mjs';
import { alpha, profile, W } from './rebuild_hood_variants.mjs';
import { rawSvg } from './hood_render.mjs';

const constructionUiChecks = process.argv.includes('--construction-ui');
const browserChecks = process.argv.includes('--browser') || constructionUiChecks;
const stagedDeep = process.argv.includes('--staged-deep');
const directory = 'src/assets/studio-hoodie/hoods/deep-reference-v3';
const protectedAssets = assetHashes();
const reviewFits = ['slim', 'regular', 'boxy', 'cropped', 'baggy'];
const stagedAssets = Object.fromEntries(reviewFits.map(fit => [
  `../../assets/hoodie-test/Hood/Oversized Deep Hood${fit === 'boxy' ? '' : ` (${fit})`}.svg`,
  fs.readFileSync(`${directory}/${fit}-live.svg`, 'utf8'),
]));
const stagingPlugin = {
  name: 'staged-deep-hood-validation', enforce: 'pre',
  transform(code, id) {
    if (id.endsWith('/hoodBundles.ts')) return code.replace("defineBundle('oversized-deep', 'Oversized / Deep Hood', [])", 'deepReferenceBundle');
    if (id.endsWith('/garmentSvgCatalog.ts')) return code.replace('} as Record<string, string>;', `...${JSON.stringify(stagedAssets)}, } as Record<string, string>;`);
  },
};
const server = await createServer(browserChecks ? {
  server: { host: '127.0.0.1', port: 0 },
  plugins: stagedDeep ? [stagingPlugin] : [],
} : {
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true },
  appType: 'custom',
  plugins: stagedDeep ? [stagingPlugin] : [],
});

try {
  const catalog = await server.ssrLoadModule('/src/app/data/garmentSvgCatalog.ts');
  const bundles = await server.ssrLoadModule('/src/app/data/hoodBundles.ts');
  const { tintPotraceSvg } = await server.ssrLoadModule('/src/app/lib/tshirtSvgUtils.ts');
  const fits = catalog.getGarmentPackFits('hoodie');
  const deepAvailable = bundles.HOOD_BUNDLES.find(bundle => bundle.styleId === 'oversized-deep').status === 'available';
  const snapshots = [];
  for (const fit of fits) {
    const hoods = catalog.getGarmentAssetsForFit('hoodie', 'Hood', fit.id)
      .filter(asset => bundles.getHoodBundleAsset(asset.id).variant.frontConstruction === 'standard');
    assert.deepEqual(hoods.map(catalog.getGarmentAssetOptionLabel), deepAvailable
      ? ['Regular Hood', 'Oversized / Deep Hood', 'Scuba Hood'] : ['Regular Hood', 'Scuba Hood']);
    for (const hood of hoods.filter(asset => bundles.getHoodBundleAsset(asset.id).bundle.styleId !== 'oversized-deep')) {
      const descriptor = bundles.getHoodBundleAsset(hood.id);
      assert.equal(descriptor.variant.fit, fit.id);
      assert.equal(descriptor.variant.views.back, null);
      assert.equal(descriptor.variant.views.front.assetId, hood.id);
      assert.equal(descriptor.variant.socket.bodyPolicy, 'unchanged');
      assert.equal(descriptor.variant.socket.profile, null);
      assert.equal(descriptor.bundle.storage.transformKey, catalog.garmentTransformStorageId('hood'));
      assert.deepEqual(descriptor.variant.registration.defaultTransform, { x: 0, y: 0, scale: 1, rotation: 0 });
      assert(catalog.getGarmentAsset(descriptor.variant.socket.referenceAssetId));
      for (const sleeve of catalog.getGarmentAssetsForFit('hoodie', 'Left sleeve', fit.id)) {
        const selection = catalog.applyGarmentFitAndLinks('hoodie', {
          ...catalog.getDefaultGarmentSelection('hoodie', fit.id), Hood: hood.id, 'Left sleeve': sleeve.id,
        }, fit.id);
        for (const nextFit of fits) {
          const next = catalog.applyGarmentFitAndLinks('hoodie', selection, nextFit.id);
          assert.equal(bundles.getHoodBundleAsset(next.Hood).bundle.styleId, descriptor.bundle.styleId);
          snapshots.push({ fit: nextFit.id, selection: next, layers: catalog.resolveGarmentLayers({
            garmentType: 'hoodie', selection: next, fit: nextFit.id, partColors: { hood: '#d45b62' },
          }) });
        }
      }
    }
  }
  assert.equal(snapshots.length, 160);
  assert.equal(createHash('sha256').update(JSON.stringify(snapshots)).digest('hex'),
    '2d3adbedad5ae0517b0c6877483a94dde44403b0c724dfafd580d6451e5e55e0',
    'Existing selections, SVG bytes, tint, layer ordering and transform reference geometry must remain identical');

  assert.deepEqual(bundles.HOOD_BUNDLES.map(bundle => bundle.styleId), ['regular', 'scuba', 'oversized-deep']);
  assert.equal(new Set(bundles.HOOD_BUNDLES.map(bundle => bundle.id)).size, 3);
  for (const bundle of bundles.HOOD_BUNDLES) {
    assert.equal(bundle.schemaVersion, 2);
    assert.deepEqual(bundle.constructionOptions.frontConstruction,
      bundle.styleId === 'scuba' ? ['standard'] : ['standard', 'crossover']);
    for (const fit of reviewFits) {
      const options = bundles.getHoodFrontConstructionOptions(bundle.styleId, fit);
      assert.equal(options[0].frontConstruction, 'standard');
      assert.equal(options[0].selectable, true);
      if (bundle.styleId !== 'scuba') {
        assert.equal(options[1].frontConstruction, 'crossover');
        assert.equal(options[1].selectable, true);
        assert(catalog.getGarmentAsset(options[1].variant.views.front.assetId));
      }
    }
    assert(bundles.getHoodFrontConstructionOptions(bundle.styleId, 'oversized').every(option => !option.selectable));
    for (const variant of bundle.variants) {
      assert.equal(variant.approval.status, variant.frontConstruction === 'standard' ? 'existing' : 'approved');
      assert.equal(bundles.isHoodVariantSelectable(bundle, { ...variant, approval: { status: 'pending' } }), false);
      const crossover = { ...variant, frontConstruction: 'crossover', approval: { status: 'existing' } };
      assert.equal(bundles.isHoodVariantSelectable(bundle, crossover), false, 'Legacy approval cannot enable crossover');
      assert.equal(bundles.isHoodVariantSelectable(bundle, {
        ...crossover, approval: { status: 'approved', referenceIds: [] },
      }), false, 'Crossover requires reference-linked approval');
      assert.equal(bundles.getHoodBundleConstructionVariant(bundle.styleId, variant.fit,
        variant.construction.layers, variant.construction.drawstrings, variant.frontConstruction), variant);
    }
    assert.deepEqual(bundle.constructionOptions.layers, ['single-layer', 'double-layer']);
    assert.deepEqual(bundle.constructionOptions.drawstrings, ['drawstring', 'no-drawstring']);
    if (bundle.status === 'awaiting-reference') assert.deepEqual(bundle.variants, []);
    for (const layers of bundle.constructionOptions.layers) {
      for (const drawstrings of bundle.constructionOptions.drawstrings) {
        assert.equal(bundles.getHoodBundleConstructionVariant(bundle.styleId, 'boxy', layers, drawstrings), undefined,
          'No geometry may be implied for unauthored construction options');
      }
    }
  }
  assert.equal(bundles.getHoodBundleVariantForFit('hoodie/Hood/Hood', 'oversized'), undefined);
  assert.equal(bundles.getHoodBundleAsset('hoodie/Hood/missing'), undefined);
  if (deepAvailable) {
    const registration = JSON.parse(fs.readFileSync(`${directory}/registration.json`, 'utf8'));
    const approved = JSON.parse(fs.readFileSync(`${directory}/boxy-scale-review/registration.json`, 'utf8'));
    assert.equal(registration.fits.boxy.packedSha256, approved.fits.boxy.packedSha256, 'Boxy must match the approved scale review exactly');
    for (const fit of reviewFits) {
      assert.equal(registration.fits[fit].scale, approved.fits.boxy.scale, `${fit}: preserve approved reference scale`);
      assert.equal(createHash('sha256').update(fs.readFileSync(`${directory}/${fit}-live.svg`)).digest('hex'),
        registration.fits[fit].packedSha256, `${fit}: geometry report must match staged SVG`);
    }
    const bundle = bundles.HOOD_BUNDLES.find(candidate => candidate.styleId === 'oversized-deep');
    assert.equal(bundle.source.kind, 'user-reference');
    assert.equal(bundle.variants.filter(variant => variant.frontConstruction === 'standard').length, 5);
    for (const fit of reviewFits) {
      const variant = bundle.variants.find(candidate => candidate.fit === fit && candidate.frontConstruction === 'standard');
      const asset = catalog.getGarmentAsset(variant.views.front.assetId);
      assert.equal(asset.svgRaw, stagedAssets[`../../assets/hoodie-test/Hood/${asset.fileName}`]);
      const original = { ...catalog.getDefaultGarmentSelection('hoodie', fit), Hood: asset.id };
      for (const nextFit of reviewFits) {
        const next = catalog.applyGarmentFitAndLinks('hoodie', original, nextFit);
        assert.equal(bundles.getHoodBundleAsset(next.Hood).variant.fit, nextFit);
        assert.equal(bundles.getHoodBundleAsset(next.Hood).bundle.styleId, 'oversized-deep');
        const expected = catalog.applyGarmentFitAndLinks('hoodie', catalog.getDefaultGarmentSelection('hoodie', fit), nextFit);
        assert.deepEqual({ ...next, Hood: expected.Hood }, expected, 'Deep hood must not change other parts');
      }
    }
    console.log('PASS: five exact reference assets and all 25 Deep hood fit transitions.');
  }

  const crossoverManifest = JSON.parse(fs.readFileSync('src/assets/studio-hoodie/hoods/crossover-reference-v1/construction.json', 'utf8'));
  for (const bundle of bundles.HOOD_BUNDLES.filter(bundle => bundle.styleId !== 'scuba')) {
    for (const variant of bundle.variants.filter(variant => variant.frontConstruction === 'crossover')) {
      const asset = catalog.getGarmentAsset(variant.views.front.assetId);
      const standard = bundles.getHoodFrontConstructionOptions(bundle.styleId, variant.fit)[0].variant;
      assert(asset);
      assert.notEqual(asset.id, standard.views.front.assetId);
      assert.notEqual(asset.svgRaw, catalog.getGarmentAsset(standard.views.front.assetId).svgRaw);
      const tinted = tintPotraceSvg(asset.svgRaw, '#d45b62');
      const whitePixels = await rawSvg(tintPotraceSvg(asset.svgRaw, '#ffffff'), W);
      const tintedPixels = await rawSvg(tinted, W);
      let fabricPixels = 0;
      let inkPixels = 0;
      for (let offset = 0; offset < whitePixels.length; offset += 4) {
        if (whitePixels[offset + 3] !== 255) continue;
        if (whitePixels[offset] === 255 && whitePixels[offset + 1] === 255 && whitePixels[offset + 2] === 255) {
          assert([212, 91, 98].every((channel, index) => Math.abs(tintedPixels[offset + index] - channel) <= 1), 'All hood panels must follow part colour');
          fabricPixels++;
        } else if (whitePixels[offset] === 20 && whitePixels[offset + 1] === 20 && whitePixels[offset + 2] === 20) {
          assert([...tintedPixels.subarray(offset, offset + 3)].every(channel => Math.abs(channel - 20) <= 1), 'Construction ink must remain unchanged');
          inkPixels++;
        }
      }
      assert(fabricPixels > 10000 && inkPixels > 100);
      assert.equal(createHash('sha256').update(asset.svgRaw).digest('hex'), crossoverManifest.fits[`${bundle.styleId}/${variant.fit}`].sha256);
      for (const nextFit of reviewFits) {
        const selection = catalog.applyGarmentFitAndLinks('hoodie', {
          ...catalog.getDefaultGarmentSelection('hoodie', variant.fit), Hood: asset.id,
        }, nextFit);
        const next = bundles.getHoodBundleAsset(selection.Hood);
        assert.equal(next.bundle.styleId, bundle.styleId);
        assert.equal(next.variant.frontConstruction, 'crossover');
        assert.equal(next.variant.fit, nextFit);
      }
    }
    const current = bundle.variants.find(variant => variant.frontConstruction === 'crossover' && variant.fit === 'boxy');
    const target = bundle.variants.find(variant => variant.frontConstruction === 'crossover' && variant.fit === 'slim');
    const originalId = target.views.front.assetId;
    try {
      target.views.front.assetId = 'hoodie/Hood/missing-crossover';
      const selection = catalog.applyGarmentFitAndLinks('hoodie', {
        ...catalog.getDefaultGarmentSelection('hoodie', 'boxy'), Hood: current.views.front.assetId,
      }, 'slim');
      assert.equal(selection.Hood, current.views.front.assetId, 'Missing Crossover must never fall back to Standard');
    } finally {
      target.views.front.assetId = originalId;
    }
  }
  console.log('PASS: ten distinct crossover assets, 50 family/construction fit transitions and missing-asset no-fallback checks.');

  for (const hood of [...catalog.getGarmentAssets('hoodie', 'Hood')]) {
    const fit = bundles.getHoodBundleAsset(hood.id)?.variant.fit ?? 'boxy';
    const saved = {
      garmentType: 'hoodie', fit,
      tshirtAssetSelection: { ...catalog.getDefaultGarmentSelection('hoodie', fit), Hood: hood.id },
      partColors: { hood: '#d45b62', base: '#336699' },
      tshirtLayerTransforms: {
        hood: { x: 23, y: -17, scale: 1.15, rotation: 9 },
        base: { x: 2, y: 3, scale: 1, rotation: 0 },
      },
    };
    for (const version of [undefined, 1, 99]) {
      const restored = JSON.parse(JSON.stringify({ ...saved, hoodieAssemblyVersion: version }));
      const before = JSON.stringify(restored);
      const selection = catalog.applyGarmentFitAndLinks('hoodie', restored.tshirtAssetSelection, fit);
      assert.equal(selection.Hood, hood.id, 'Saved and hidden registered hood IDs must survive');
      const layer = catalog.resolveGarmentLayers({ garmentType: 'hoodie', selection, fit, partColors: restored.partColors })
        .find(candidate => candidate.id === 'hood');
      assert.equal(layer.svgRaw, hood.svgRaw);
      assert.equal(layer.tint, '#d45b62');
      assert.equal(JSON.stringify(restored), before, 'Resolving must not mutate persisted state');
    }
  }
  console.log('PASS: 160 legacy render/fit-transition snapshots are byte-identical.');
  console.log('PASS: all saved hood IDs round-trip for legacy, v1 and unknown assembly versions.');
  console.log('PASS: placeholders, unavailable options, socket references and shared transform contract.');

  if (browserChecks) {
    await server.listen();
    const address = server.httpServer.address();
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${address.port}/builder/hd-001`);
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const label of ['Regular Hood', 'Oversized / Deep Hood', 'Scuba Hood']) {
          await page.getByRole('button', { name: label, exact: true }).click();
          const standard = page.getByRole('button', { name: 'Standard', exact: true });
          await standard.click();
          assert.equal(await standard.getAttribute('aria-pressed'), 'true');
          assert.equal(await standard.isEnabled(), true);
          const crossover = page.getByRole('button', { name: 'Crossover', exact: true });
          if (label === 'Scuba Hood') {
            assert.equal(await crossover.count(), 0);
          } else {
            assert.equal(await crossover.isEnabled(), true);
            const before = await page.locator('[data-layer-id="hood"]').innerHTML();
            await crossover.click();
            assert.equal(await crossover.getAttribute('aria-pressed'), 'true');
            assert.notEqual(await page.locator('[data-layer-id="hood"]').innerHTML(), before);
            await standard.click();
            assert.equal(await page.locator('[data-layer-id="hood"]').innerHTML(), before);
          }
          const control = page.getByRole('group', { name: 'Front Construction' });
          const bounds = await control.boundingBox();
          assert(bounds && bounds.width > 0 && bounds.x >= 0 && bounds.x + bounds.width <= width,
            `${width}px: front construction control must fit the viewport`);
          assert.equal(await control.evaluate(node => node.scrollWidth <= node.clientWidth), true);
        }
        await page.getByRole('button', { name: 'Regular Hood', exact: true }).click();
        await page.getByRole('button', { name: 'Crossover', exact: true }).click();
        await page.getByRole('button', { name: 'Oversized / Deep Hood', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Crossover', exact: true }).getAttribute('aria-pressed'), 'true');
        await page.getByRole('button', { name: 'Regular Hood', exact: true }).click();
        assert.equal(await page.getByRole('button', { name: 'Crossover', exact: true }).getAttribute('aria-pressed'), 'true');
        await page.screenshot({ path: `src/assets/studio-hoodie/hoods/crossover-reference-v1/controls-${width}.png`, fullPage: true });
        console.log(`PASS browser: ${width}px family/construction controls, real asset swaps, family persistence and layout.`);
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
      const hoodLayer = page.locator('[data-layer-id="hood"]');
      const style = () => hoodLayer.evaluate(node => ({ transform: node.style.transform, origin: node.style.transformOrigin }));
      const editingCases = [
        ...(!constructionUiChecks ? ['Regular Hood', 'Scuba Hood', ...(deepAvailable ? ['Oversized / Deep Hood'] : [])]
          .map(label => ({ label, construction: 'standard' })) : []),
        ...['Regular Hood', 'Oversized / Deep Hood'].map(label => ({ label, construction: 'crossover' })),
      ];
      for (const { label, construction } of editingCases) {
        await page.getByRole('button', { name: label, exact: true }).click();
        await page.getByRole('button', { name: construction === 'standard' ? 'Standard' : 'Crossover', exact: true }).click();
        for (const fit of ['Slim', 'Regular', 'Boxy', 'Cropped', 'Baggy']) {
          await page.getByRole('button', { name: /^Measurement$/i }).first().click();
          await page.getByRole('button', { name: fit, exact: true }).click();
          await page.getByText('Neck / Collar', { exact: true }).first().click();
          assert.equal(await hoodLayer.getAttribute('data-asset'), label, `${label}: ${fit} must retain style`);
          assert.equal(await page.getByRole('button', { name: construction === 'standard' ? 'Standard' : 'Crossover', exact: true }).getAttribute('aria-pressed'), 'true');
          assert.equal(await page.locator('[data-layer-id]').count(), 8);
          const expectedAsset = catalog.getGarmentAssetsForFit('hoodie', 'Hood', fit.toLowerCase())
            .find(asset => catalog.getGarmentAssetOptionLabel(asset) === label
              && bundles.getHoodBundleAsset(asset.id).variant.frontConstruction === construction);
          const expectedPaths = await page.evaluate(raw => [...new DOMParser().parseFromString(raw, 'image/svg+xml').querySelectorAll('path')].map(path => path.getAttribute('d')), expectedAsset.svgRaw);
          assert.deepEqual(await hoodLayer.locator('path').evaluateAll(nodes => nodes.map(node => node.getAttribute('d'))), expectedPaths,
            `${label}: ${fit} must render the exact registered SVG`);
        const original = await style();
        const untouched = await page.locator('[data-layer-id]:not([data-layer-id="hood"])').evaluateAll(nodes => nodes.map(node => node.outerHTML));
        await page.getByRole('button', { name: `Select ${label}`, exact: true }).focus();
        await page.keyboard.press('Enter');
        const handle = await page.getByRole('button', { name: 'Scale', exact: true }).last().boundingBox();
        assert(handle, 'Hood scale handle must be available');
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
        await page.mouse.down();
        await page.mouse.move(handle.x + handle.width / 2 + 24, handle.y + handle.height / 2 + 18, { steps: 5 });
        await page.mouse.up();
        const edited = await style();
        assert.notDeepEqual(edited, original, `${label}: scale edit must apply`);
        await page.getByTitle('Reset position & scale', { exact: true }).click();
        assert.deepEqual(await style(), original, `${label}: Reset must restore registration`);
        await page.keyboard.press('Control+z');
        assert.deepEqual(await style(), edited, `${label}: Undo must restore edited transform`);
        await page.keyboard.press('Control+Shift+z');
        assert.deepEqual(await style(), original, `${label}: Redo must restore Reset`);
        assert.deepEqual(await page.locator('[data-layer-id]:not([data-layer-id="hood"])').evaluateAll(nodes => nodes.map(node => node.outerHTML)), untouched);
          await page.keyboard.press('Escape');
          if (label === 'Oversized / Deep Hood') {
            const visible = profile(alpha(await rawSvg(expectedAsset.svgRaw, W)));
            const measured = await page.evaluate(async raw => {
              const { getPotraceSvgBBox } = await import('/src/app/lib/tshirtSvgUtils.ts');
              return getPotraceSvgBBox(raw);
            }, catalog.getGarmentAsset(bundles.getHoodBundleAsset(expectedAsset.id).variant.registration.referenceAssetId).svgRaw);
            assert(measured, `${fit}: hood transform bounds must exist`);
            for (const [actual, expected] of [[measured.minX, visible.left], [measured.maxX, visible.right],
              [measured.minY, visible.top], [measured.maxY, visible.maxY]]) {
              assert(Math.abs(actual - expected) <= 5, `${fit}: transform bounds must exclude hidden mask geometry: ${actual} vs ${expected}`);
            }
            if (construction === 'standard') await page.screenshot({ path: `${directory}/${fit.toLowerCase()}-builder.png`, fullPage: true });
          }
          if (construction === 'crossover') await page.screenshot({ path: `src/assets/studio-hoodie/hoods/crossover-reference-v1/${label === 'Regular Hood' ? 'regular' : 'oversized-deep'}-${fit.toLowerCase()}-builder.png`, fullPage: true });
          console.log(`PASS browser: ${label} ${construction}, ${fit}: exact SVG, selection, Reset, Undo/Redo, other parts unchanged.`);
        }
      }
      assert.deepEqual(errors, []);
      if (!constructionUiChecks) console.log('PASS: browser hood editing, Reset, Undo/Redo, unaffected parts and all five fit switches.');
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(assetHashes(), protectedAssets, 'Validation must not modify live assets');
  if (browserChecks && deepAvailable && !constructionUiChecks) {
    fs.writeFileSync(`${directory}/${stagedDeep ? 'staged' : 'installed'}-validation.json`, JSON.stringify({
      fits: reviewFits, browserPassed: true, legacySnapshots: 160, protectedAssets,
      assets: Object.fromEntries(reviewFits.map(fit => [fit, createHash('sha256').update(fs.readFileSync(`${directory}/${fit}-live.svg`)).digest('hex')])),
    }, null, 2));
  }
} finally {
  await server.close();
}