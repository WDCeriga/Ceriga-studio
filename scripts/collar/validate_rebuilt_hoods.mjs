import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { sharp, fits, readAsset, rawSvg } from './hood_render.mjs';
import { ROOT, W, variants, hash, layer, alpha, profile, neckline, candidate, compositeCandidate, scubaBodyDimensions } from './rebuild_hood_variants.mjs';

function inkRunQuantiles(mask) {
  const runs = [];
  for (let row = 0; row < W; row++) {
    let length = 0;
    for (let column = 0; column < W; column++) {
      if (mask[row * W + column] >= 128) length++;
      else if (length) {
        if (length < 15) runs.push(length);
        length = 0;
      }
    }
  }
  assert(runs.length > 100, 'Insufficient construction ink');
  runs.sort((first, second) => first - second);
  return [runs[Math.floor(runs.length / 4)], runs[Math.floor(runs.length / 2)]];
}

export async function validateRebuiltHoods(live = false, { root = ROOT, variantDefinitions = variants } = {}) {
  for (const variant of variantDefinitions) {
    const registration = JSON.parse(fs.readFileSync(`${root}/${variant.id}/registration.json`, 'utf8'));
    assert.equal(registration.oldVariantGeometryUsed, false);
    assert.equal(hash(fs.readFileSync(`${root}/${variant.id}/source.png`)), registration.sourceSha256);
    if (variant.preserveSideContour) {
      const { data: source, info } = await sharp(`${root}/${variant.id}/source.png`).greyscale().raw().toBuffer({ resolveWithObject: true });
      assert.equal(info.width, W);
      assert.equal(info.height, W);
      assert(source.every((value) => value === 0 || value === 255), 'Source must contain only black and white');
      const keyed = alpha(await sharp(`${root}/${variant.id}/keyed-lineart.png`).ensureAlpha().raw().toBuffer());
      assert(keyed.every((value, index) => value === 255 - source[index]), 'White-key alpha polarity differs from source');
      let asymmetry = 0;
      for (let row = 0; row < W; row++) {
        for (let column = 0; column < W / 2; column++) {
          if (source[row * W + column] !== source[row * W + W - 1 - column]) asymmetry++;
        }
      }
      assert(asymmetry / source.length < 0.001, 'Source construction is not symmetric');
      console.log(`${variant.label}: binary ${W}px source, correct alpha polarity and symmetric construction`);
    }
    for (const fit of fits) {
      const regular = readAsset('Hood', fit);
      const svg = fs.readFileSync(candidate(variant, fit, root), 'utf8');
      if (live) assert.equal(readAsset('Hood', fit, variant.file), svg, `${fit}: live asset differs from new trace`);
      assert.equal(hash(regular), registration.fits[fit].regularSha256, `${fit}: Regular Hood changed`);
      assert.equal(hash(readAsset('Body', fit)), registration.fits[fit].bodySha256, `${fit}: body changed`);
      assert.equal(hash(svg), registration.fits[fit].candidateSha256);
      assert.equal((svg.match(/<g /g) || []).length, 2);
      assert.equal((svg.match(/fill-rule="evenodd"/g) || []).length, 2);
      if (variant.preserveSideContour) {
        assert(svg.includes(`viewBox="0 0 ${W} ${W}"`), 'viewBox must match source dimensions');
        assert.equal(registration.fits[fit].preserveSideContour, true);
        assert.equal(registration.fits[fit].singleAttachmentLine, variant.singleAttachmentLine);
        assert.equal(registration.fits[fit].inkColour, '#000000');
        assert([...svg.matchAll(/fill="([^"]+)"/g)].every((match) => match[1] === '#000000'), 'Trace contains non-black artwork');
      }
      const original = alpha(await rawSvg(regular, W));
      const hood = alpha(await rawSvg(svg, W));
      const body = alpha(await rawSvg(layer(readAsset('Body', fit), 0), W));
      const fill = alpha(await rawSvg(layer(svg, 0), W));
      const ink = alpha(await rawSvg(layer(svg, 1), W));
      if (variant.matchRegularInk) {
        const referenceInk = inkRunQuantiles(alpha(await rawSvg(layer(regular, 1), W)));
        const candidateInk = inkRunQuantiles(ink);
        assert(candidateInk.every((value, index) => Math.abs(value - referenceInk[index]) <= 1), `${variant.label}/${fit}: ink weight differs from Regular Hood`);
        assert.equal(registration.fits[fit].outlineWidth, variant.outlineWidth);
        console.log(`${variant.label}/${fit}: ink quartile/median ${candidateInk.join('/')}px, Regular ${referenceInk.join('/')}px`);
      }
      const ref = neckline(original), box = profile(hood);
      const composite = alpha(await rawSvg(compositeCandidate(variant, fit, true, root), W));
      if (variant.bodyRelativeScuba) {
        const bodyOutline = alpha(await rawSvg(readAsset('Body', fit), W));
        const dimensions = scubaBodyDimensions(bodyOutline, ref, fit, variant.necklineAttachment);
        assert.deepEqual(registration.fits[fit].bodySizing, dimensions, `${fit}: body-relative sizing metadata differs`);
        assert(Math.abs(box.right - box.left + 1 - dimensions.crownWidth) <= 3, `${fit}: crown does not match chest-relative width`);
        if (variant.necklineAttachment) {
          assert.equal(dimensions.attachmentWidth, ref.right - ref.left, `${fit}: attachment must follow the existing neckline`);
        } else {
          assert(dimensions.attachmentWidth > (ref.right - ref.left) * 1.1, `${fit}: attachment is not broader`);
        }
        const attachmentLeft = Math.round((ref.left + ref.right - dimensions.attachmentWidth) / 2);
        const attachmentRight = attachmentLeft + dimensions.attachmentWidth;
        let shoulderGaps = 0;
        for (let column = attachmentLeft + 4; column <= attachmentRight - 4; column++) {
          if (column >= ref.left && column <= ref.right) continue;
          let shoulderTop = 0;
          while (shoulderTop < W && bodyOutline[shoulderTop * W + column] < 128) shoulderTop++;
          for (let row = shoulderTop - 3; row <= shoulderTop; row++) {
            const index = row * W + column;
            const isolatedAntialias = composite[index] > 0 && Math.max(composite[index - W], composite[index + W]) >= 128;
            if (composite[index] < 64 && !isolatedAntialias) shoulderGaps++;
          }
        }
        assert.equal(shoulderGaps, 0, `${fit}: widened shoulder attachment has gaps`);
        console.log(`${variant.label}/${fit}: crown ${box.right - box.left + 1}px, chest ${dimensions.chestWidth}px, attachment ${dimensions.attachmentWidth}px; shoulder joins covered`);
      }
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
      if (variant.crownWidthScale) {
        assert.equal(registration.fits[fit].crownWidthScale, variant.crownWidthScale);
        assert(box.right - box.left > (ref.right - ref.left) * 1.1, `${variant.label}/${fit}: crown is not wider`);
      }
      if (variant.regularHeightScale) {
        const expectedHeight = Math.min((ref.maxY - ref.top) * variant.regularHeightScale, ref.maxY - 24);
        assert.equal(registration.fits[fit].regularHeightScale, variant.regularHeightScale);
        assert(Math.abs((box.maxY - box.top) - expectedHeight) <= 2, `${variant.label}/${fit}: incorrect scaled height`);
        assert(Math.abs(box.maxY - ref.maxY) <= 2, `${variant.label}/${fit}: neckline height changed`);
        assert(box.top > 4, `${variant.label}/${fit}: crown clipped by canvas`);
        console.log(`${variant.label}/${fit}: height ${box.maxY - box.top}px, Regular Hood ${ref.maxY - ref.top}px`);
      } else if (variant.matchRegularHeight) {
        assert.equal(registration.fits[fit].matchRegularHeight, true);
        assert(Math.abs(box.top - ref.top) <= 2, `${variant.label}/${fit}: crown height differs from Regular Hood`);
        assert(Math.abs(box.maxY - ref.maxY) <= 2, `${variant.label}/${fit}: neckline height differs from Regular Hood`);
        assert(Math.abs((box.maxY - box.top) - (ref.maxY - ref.top)) <= 2, `${variant.label}/${fit}: length differs from Regular Hood`);
        console.log(`${variant.label}/${fit}: height ${box.maxY - box.top}px, Regular Hood ${ref.maxY - ref.top}px`);
      } else {
        assert(aspect > 0.88 && aspect < 1.12, `${variant.label}/${fit}: hood proportions ${aspect}`);
        assert(box.top > 180, `${variant.label}/${fit}: oversized crown`);
      }
      console.log(`${variant.label}/${fit}: new source, seam covered, contained fill`);
    }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await validateRebuiltHoods(process.argv.includes('--live'));
