import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fits } from './hood_render.mjs';
import { variants } from './rebuild_hood_variants.mjs';
import { validateRebuiltHoods } from './validate_rebuilt_hoods.mjs';
await validateRebuiltHoods(true);
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const catalog = await server.ssrLoadModule('/src/app/data/garmentSvgCatalog.ts');
  assert.deepEqual(catalog.getGarmentChoiceCategoriesForStep('hoodie', 3), ['Hood']);
  for (const fit of fits) {
    const options = catalog.getGarmentAssetsForFit('hoodie', 'Hood', fit);
    const regular = options.find((asset) => catalog.getGarmentAssetOptionLabel(asset) === 'Regular Hood');
    const defaults = catalog.getDefaultGarmentSelection('hoodie', fit);
    assert.equal(defaults.Hood, regular.id);
    for (const variant of variants) {
      const hood = options.find((asset) => catalog.getGarmentAssetOptionLabel(asset) === variant.label);
      assert(hood, fit + ': missing ' + variant.label);
      const selected = catalog.applyGarmentFitAndLinks('hoodie', { ...defaults, Hood: hood.id }, fit);
      assert.equal(selected.Hood, hood.id);
      for (const nextFit of fits) {
        const changed = catalog.applyGarmentFitAndLinks('hoodie', selected, nextFit);
        const next = catalog.getGarmentAsset(changed.Hood);
        assert.equal(catalog.getGarmentAssetOptionLabel(next), variant.label);
        assert(catalog.isAssetAvailableForFit('hoodie', next, nextFit));
        assert.equal(catalog.applyGarmentFitAndLinks('hoodie', changed, fit).Hood, hood.id);
      }
    }
  }
  assert.equal(catalog.getGarmentAssetOptionLabel({ id: 'custom', displayName: 'My collar (slim)' }), 'My collar (slim)');
  console.log('Both variants: defaults, saved IDs, selection persistence, all 50 fit transitions passed');
} finally { await server.close(); }
