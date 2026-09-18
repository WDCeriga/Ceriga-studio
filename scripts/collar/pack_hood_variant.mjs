import { variants, rebuildHoods } from './rebuild_hood_variants.mjs';
const variant = process.argv[2] || 'scuba';
if (!variants.some((entry) => entry.id === variant)) throw new Error('Unsupported hood variant: ' + variant);
await rebuildHoods(variant);
console.log('New raster-derived candidates ready. Validate and publish with publish_rebuilt_hoods.mjs.');
