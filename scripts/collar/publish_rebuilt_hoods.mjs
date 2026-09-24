import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fits, assetPath } from './hood_render.mjs';
import { ROOT, variants, candidate, hash } from './rebuild_hood_variants.mjs';
import { validateRebuiltHoods } from './validate_rebuilt_hoods.mjs';

const photoScuba = process.argv.includes('--photo-scuba');
const originalScuba = process.argv.includes('--original-scuba');
const originalFunnel = process.argv.includes('--original-funnel');
const collection = process.argv.includes('--collection');
const structuredScuba = process.argv.includes('--structured-scuba');
const highNeckScuba = process.argv.includes('--high-neck-scuba');
if ([photoScuba, originalScuba, originalFunnel, collection, structuredScuba, highNeckScuba].filter(Boolean).length > 1) throw new Error('Choose one hood source.');
const options = {
  root: highNeckScuba ? 'src/assets/studio-hoodie/hoods/high-neck-scuba-20260922'
    : structuredScuba ? 'src/assets/studio-hoodie/hoods/structured-scuba-20260922'
    : collection ? 'src/assets/studio-hoodie/hoods/cohesive-collection-20260922'
    : originalFunnel ? 'src/assets/studio-hoodie/hoods/refined-funnel-20260922'
    : originalScuba ? 'src/assets/studio-hoodie/hoods/original-scuba-20260922'
    : photoScuba ? 'src/assets/studio-hoodie/hoods/photo-scuba-20260922' : ROOT,
  variantDefinitions: structuredScuba || highNeckScuba ? [
    { id: 'scuba', file: 'Scuba hood', label: 'Scuba Hood', matchRegularHeight: true,
      outlineWidth: 4, traceSmoothing: 0.5, matchRegularInk: true,
      necklineAttachment: highNeckScuba, bodyRelativeScuba: true, preserveSideContour: true, singleAttachmentLine: true, inkColour: '#000000' },
  ] : collection ? [
    { id: 'scuba', file: 'Scuba hood', label: 'Scuba Hood', matchRegularHeight: true },
    { id: 'funnel-hood-hybrid', file: 'Funnel-hood hybrid', label: 'Funnel Hybrid Hood', matchRegularHeight: true },
    { id: 'oversized', file: 'Oversized Hood', label: 'Oversized Hood', regularHeightScale: 1.18, crownWidthScale: 1.2 },
  ].map((variant) => ({ ...variant, outlineWidth: 4, traceSmoothing: 0.5, matchRegularInk: true })) : originalFunnel
    ? variants.filter((variant) => variant.id === 'funnel-hood-hybrid').map((variant) => ({ ...variant, matchRegularHeight: true }))
    : originalScuba
      ? variants.filter((variant) => variant.id === 'scuba').map((variant) => ({ ...variant, matchRegularHeight: true }))
      : photoScuba ? variants.filter((variant) => variant.id === 'scuba') : variants,
};
await validateRebuiltHoods(false, options);
const workspace = fs.realpathSync('.');
const allowed = path.join(workspace, 'src', 'assets', 'hoodie-test', 'Hood') + path.sep;
const targets = options.variantDefinitions.flatMap((variant) => fits.map((fit) => ({
  current: path.resolve(assetPath('Hood', fit, variant.file)),
  replacement: path.resolve(candidate(variant, fit, options.root)),
})));
for (const target of targets) {
  if (fs.realpathSync(path.dirname(target.current)) + path.sep !== allowed) throw new Error('Refusing out-of-scope addition');
  if (fs.existsSync(target.current)) {
    if (!fs.realpathSync(target.current).startsWith(allowed)) throw new Error('Refusing out-of-scope replacement');
    if (hash(fs.readFileSync(target.current)) === hash(fs.readFileSync(target.replacement))) throw new Error('Replacement must be a new design');
  }
}
const backup = fs.mkdtempSync(path.join(workspace, '.tmp-retired-hoods-'));
const assetRoot = path.join(workspace, 'src', 'assets', 'hoodie-test');
const untouched = fs.readdirSync(assetRoot, { recursive: true })
  .filter((name) => name.endsWith('.svg'))
  .map((name) => path.join(assetRoot, name))
  .filter((file) => !targets.some((target) => target.current === file))
  .map((file) => ({ file, sha256: hash(fs.readFileSync(file)) }));
const completed = [];
try {
  for (const target of targets) {
    const retired = fs.existsSync(target.current) ? path.join(backup, path.basename(target.current)) : null;
    if (retired) fs.renameSync(target.current, retired);
    completed.push({ ...target, retired });
    fs.copyFileSync(target.replacement, target.current);
  }
  await validateRebuiltHoods(true, options);
  for (const asset of untouched) assert.equal(hash(fs.readFileSync(asset.file)), asset.sha256, `Unrelated asset changed: ${asset.file}`);
} catch (error) {
  for (const target of completed.reverse()) {
    if (target.retired) fs.copyFileSync(target.retired, target.current);
    else fs.rmSync(target.current, { force: true });
  }
  throw error;
}
fs.writeFileSync(path.join(backup, 'replacements.json'), JSON.stringify(completed, null, 2));
console.log(`Verified ${untouched.length} unrelated hoodie SVGs unchanged.`);
console.log(`Replaced ${completed.length} SVGs. Retired copies: ${backup}`);
