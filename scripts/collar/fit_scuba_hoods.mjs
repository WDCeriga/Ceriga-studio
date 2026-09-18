// Compatibility entry point. Old scuba SVGs are no longer a geometry source.
import { rebuildHoods } from './rebuild_hood_variants.mjs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
export { layer, alpha, profile } from './rebuild_hood_variants.mjs';
export async function fitScubaHoods() { await rebuildHoods('scuba'); }
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await fitScubaHoods();
  console.log('New candidates ready. Validate and publish with publish_rebuilt_hoods.mjs.');
}
