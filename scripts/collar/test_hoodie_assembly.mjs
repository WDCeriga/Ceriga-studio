import assert from 'node:assert/strict';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { XMLSerializer } from '@xmldom/xmldom';
import { buildRegisteredSleeve } from './build_hoodie_part.mjs';
import { assetHashes, installRegisteredSleeve } from './export_hoodie_test.mjs';
import { parsePart, sha256, validateRecipe, validateRegisteredSleeve, workspaceRoot } from './validate_hoodie_pack.mjs';

const bundle = await build({
  entryPoints: ['src/app/data/hoodieAssembly.ts'], bundle: true,
  format: 'esm', platform: 'node', write: false,
});
const { usesHoodieAssembly, isHoodieStructuralPart, HOODIE_STRUCTURAL_PARTS } =
  await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const identity = { x: 0, y: 0, scale: 1, rotation: 0 };

assert.equal(usesHoodieAssembly('hoodie', 1), true);
assert.equal(usesHoodieAssembly('hoodie', undefined), false);
assert.equal(usesHoodieAssembly('hoodie', 2), false);
assert.equal(usesHoodieAssembly('tshirt', 1), false);
for (const part of HOODIE_STRUCTURAL_PARTS) {
  assert.equal(isHoodieStructuralPart(part), true);
  assert.equal(usesHoodieAssembly('hoodie', 1, { [part]: identity }), true);
  for (const change of [{ x: 20 }, { y: -10 }, { scale: .8 }, { scaleX: -1 }, { scaleY: 2 }, { rotation: 35 }, { x: NaN }]) {
    const transforms = { [part]: { ...identity, ...change } };
    const before = structuredClone(transforms);
    assert.equal(usesHoodieAssembly('hoodie', 1, transforms), true);
    assert.deepEqual(transforms, before, 'Legacy transforms must never be mutated');
  }
}
for (const detail of ['custom-zip', 'patch', 'decoration']) {
  assert.equal(isHoodieStructuralPart(detail), false);
  assert.equal(usesHoodieAssembly('hoodie', 1, { [detail]: { ...identity, x: 42 } }), true);
}
console.log('Hoodie assembly policy: registration independent of user transforms, legacy preservation and detail isolation passed.');

const installedDirectory = path.join(workspaceRoot, 'src/assets/hoodie-test/Left sleeve');
const installedName = 'Set-in Left sleeve v1 (boxy).registration.json';
const installed = await validateRegisteredSleeve(installedDirectory, installedName);
const before = assetHashes();
const stage = await buildRegisteredSleeve('scripts/collar/refs/boxy-set-in-left-v1.json');
const regenerated = await validateRegisteredSleeve(stage);
assert.equal(regenerated.manifest.svgSha256, installed.manifest.svgSha256, 'Regeneration must be reproducible');
assert.deepEqual(regenerated.measured, installed.measured);
await assert.rejects(installRegisteredSleeve(stage), /Version already exists/, 'Never overwrite a working version');
assert.deepEqual(assetHashes(), before);

const manifestPath = path.join(stage, 'registration.json');
const candidatePath = path.join(stage, regenerated.manifest.fileName);
const failures = [
  ['wrong fit', manifest => { manifest.fit = 'slim'; }, /Only Boxy/],
  ['wrong construction', manifest => { manifest.construction = 'raglan'; }, { code: 'ERR_ASSERTION', actual: 'raglan', expected: 'set-in' }],
  ['wrong part', manifest => { manifest.part = 'hood'; }, { code: 'ERR_ASSERTION', actual: 'hood', expected: 'sleeveLeft' }],
  ['wrong side', manifest => { manifest.side = 'right'; }, { code: 'ERR_ASSERTION', actual: 'right', expected: 'left' }],
  ['missing dependency', manifest => { delete manifest.dependencies['Left cuff']; }, /Missing registration dependencies/],
  ['changed body', manifest => { manifest.dependencies.Body.sha256 = '0'.repeat(64); }, /Body: registration dependency changed/],
  ['changed source', manifest => { manifest.source.sha256 = '0'.repeat(64); }, /Source hash changed/],
  ['unsafe path', manifest => { manifest.source.path = '../outside.png'; }, /repository-owned/],
  ['cropped source canvas', manifest => { manifest.source.width = 512; }, { code: 'ERR_ASSERTION', actual: 512, expected: 1024 }],
  ['wrong default placement', manifest => { manifest.registration.offsetX = 0; }, error => error.code === 'ERR_ASSERTION' && error.actual?.offsetX === 0 && error.expected?.offsetX === 1024 / 3],
  ['unrelated transform reference', manifest => { manifest.transformReferenceAssetId = 'hoodie/Body/Body'; }, { code: 'ERR_ASSERTION', actual: 'hoodie/Body/Body', expected: 'hoodie/Left sleeve/Left sleeve' }],
  ['candidate hash mismatch', manifest => { manifest.svgSha256 = '0'.repeat(64); }, /Candidate hash changed/],
];
for (const [name, mutate, expected] of failures) {
  const manifest = structuredClone(regenerated.manifest);
  mutate(manifest);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  await assert.rejects(installRegisteredSleeve(stage), expected, name);
  assert.deepEqual(assetHashes(), before, `${name}: failed candidate changed live assets`);
}

for (const [name, mutate, expected] of [
  ['wrong viewBox', document => document.documentElement.setAttribute('viewBox', '0 0 1024 1024'), /viewBox/],
  ['detached trace', document => {
    for (const element of Array.from(document.getElementsByTagName('path'))) {
      element.setAttribute('d', element.getAttribute('d').replace(/M\s*(-?\d+(?:\.\d+)?)/g, (_, coordinate) => `M${Number(coordinate) + 1200}`));
    }
  }, /Left cuff: attachment boundary drift/],
  ['missing ink', document => {
    const group = document.getElementsByTagName('g')[1];
    for (const element of Array.from(group.getElementsByTagName('path'))) group.removeChild(element);
  }, /Missing traced geometry/],
]) {
  const document = parsePart(regenerated.svg);
  mutate(document);
  const svg = new XMLSerializer().serializeToString(document);
  const manifest = { ...regenerated.manifest, svgSha256: sha256(svg) };
  fs.writeFileSync(candidatePath, svg);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  await assert.rejects(installRegisteredSleeve(stage), expected, name);
  assert.deepEqual(assetHashes(), before, `${name}: failed trace changed live assets`);
}
fs.writeFileSync(candidatePath, regenerated.svg);
fs.writeFileSync(manifestPath, JSON.stringify(regenerated.manifest, null, 2));
validateRecipe(regenerated.manifest);
console.log('Registered sleeve: deterministic regeneration, attachment geometry, 15 invalid candidates rejected, duplicate install blocked, all live assets preserved.');