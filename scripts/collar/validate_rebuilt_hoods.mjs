import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fits, readAsset, rawSvg } from './hood_render.mjs';
import { ROOT, W, variants, hash, layer, alpha, profile, neckline, candidate, compositeCandidate } from './rebuild_hood_variants.mjs';

export async function validateRebuiltHoods(live = false) {
  for (const variant of variants) {
    const registration = JSON.parse(fs.readFileSync(`${ROOT}/${variant.id}/registration.json`, 'utf8'));
    assert.equal(registration.oldVariantGeometryUsed, false);
    assert.equal(hash(fs.readFileSync(`${ROOT}/${variant.id}/source.png`)), registration.sourceSha256);
    for (const fit of fits) {
      const regular = readAsset('Hood', fit);
      const svg = fs.readFileSync(candidate(variant, fit), 'utf8');
      if (live) assert.equal(readAsset('Hood', fit, variant.file), svg, `${fit}: live asset differs from new trace`);
      assert.equal(hash(regular), registration.fits[fit].regularSha256, `${fit}: Regular Hood changed`);
      assert.equal(hash(readAsset('Body', fit)), registration.fits[fit].bodySha256, `${fit}: body changed`);
      assert.equal(hash(svg), registration.fits[fit].candidateSha256);
      assert.equal((svg.match(/<g /g) || []).length, 2);
      assert.equal((svg.match(/fill-rule="evenodd"/g) || []).length, 2);
      const original = alpha(await rawSvg(regular, W));
      const hood = alpha(await rawSvg(svg, W));
      const body = alpha(await rawSvg(layer(readAsset('Body', fit), 0), W));
      const fill = alpha(await rawSvg(layer(svg, 0), W));
      const ink = alpha(await rawSvg(layer(svg, 1), W));
      const ref = neckline(original), box = profile(hood);
      const composite = alpha(await rawSvg(compositeCandidate(variant, fit), W));
      let missing = 0, bleed = 0;
      for (let x = ref.left + 2; x <= ref.right - 2; x++) {
        for (let y = ref.bottom[x] - 3; y <= ref.bottom[x]; y++) {
          const i = y * W + x;
          if (original[i] >= 200 && composite[i] < 64) missing++;
        }
      }
      for (let i = W; i < body.length - W; i++) {
        if (body[i] > 240 && body[i - 1] > 240 && body[i + 1] > 240 && body[i - W] > 240 && body[i + W] > 240 && fill[i] > 128 && ink[i] < 128) bleed++;
      }
      assert.equal(missing, 0, `${variant.label}/${fit}: neckline gaps`);
      assert.equal(bleed, 0, `${variant.label}/${fit}: colour bleeds into body`);
      const aspect = (box.maxY - box.top) / (box.right - box.left);
      assert(aspect > 0.88 && aspect < 1.12, `${variant.label}/${fit}: hood proportions ${aspect}`);
      assert(box.top > 180, `${variant.label}/${fit}: oversized crown`);
      console.log(`${variant.label}/${fit}: new source, compact proportions, seam covered, contained fill`);
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await validateRebuiltHoods(process.argv.includes('--live'));
