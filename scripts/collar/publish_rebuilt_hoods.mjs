import fs from 'node:fs';
import path from 'node:path';
import { fits, assetPath } from './hood_render.mjs';
import { variants, candidate, hash } from './rebuild_hood_variants.mjs';
import { validateRebuiltHoods } from './validate_rebuilt_hoods.mjs';

await validateRebuiltHoods();
const workspace = fs.realpathSync('.');
const allowed = path.join(workspace, 'src', 'assets', 'hoodie-test', 'Hood') + path.sep;
const targets = variants.flatMap((variant) => fits.map((fit) => ({
  current: path.resolve(assetPath('Hood', fit, variant.file)),
  replacement: path.resolve(candidate(variant, fit)),
})));
for (const target of targets) {
  if (!fs.realpathSync(target.current).startsWith(allowed)) throw new Error('Refusing out-of-scope replacement');
  if (hash(fs.readFileSync(target.current)) === hash(fs.readFileSync(target.replacement))) throw new Error('Replacement must be a new design');
}
// Retire exactly the ten incorrect SVGs outside the asset import tree. They are
// recoverable but never read as source geometry by the rebuild pipeline.
const backup = fs.mkdtempSync(path.join(workspace, '.tmp-retired-hoods-'));
const completed = [];
try {
  for (const target of targets) {
    const retired = path.join(backup, path.basename(target.current));
    fs.renameSync(target.current, retired);
    completed.push({ ...target, retired });
    fs.copyFileSync(target.replacement, target.current);
  }
} catch (error) {
  for (const target of completed.reverse()) fs.copyFileSync(target.retired, target.current);
  throw error;
}
fs.writeFileSync(path.join(backup, 'replacements.json'), JSON.stringify(completed, null, 2));
console.log(`Replaced ${completed.length} SVGs. Retired copies: ${backup}`);
