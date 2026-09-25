import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { localFile, sha256, validateRegisteredSleeve, workspaceRoot } from './validate_hoodie_pack.mjs';

export function assetHashes() {
  const root = localFile('src/assets/hoodie-test');
  const hashes = {};
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(file);
      else hashes[path.relative(root, file)] = sha256(fs.readFileSync(file));
    }
  }
  visit(root);
  return hashes;
}

export async function installRegisteredSleeve(directory) {
  const stageRoot = localFile('.tmp-hoodie-assembly');
  const stage = fs.realpathSync(directory);
  assert(stage.startsWith(stageRoot + path.sep), 'Install only from the staging directory');
  const before = assetHashes();
  const { manifest } = await validateRegisteredSleeve(stage);
  assert(manifest.measurements, 'Missing validated attachment measurements');
  const targetDirectory = localFile('src/assets/hoodie-test/Left sleeve');
  const target = path.join(targetDirectory, manifest.fileName);
  const manifestName = manifest.fileName.replace(/\.svg$/, '.registration.json');
  const targetManifest = path.join(targetDirectory, manifestName);
  assert(!fs.existsSync(target) && !fs.existsSync(targetManifest), 'Version already exists; choose a new version, never overwrite');
  const created = [];
  try {
    fs.copyFileSync(path.join(stage, manifest.fileName), target, fs.constants.COPYFILE_EXCL);
    created.push(target);
    fs.copyFileSync(path.join(stage, 'registration.json'), targetManifest, fs.constants.COPYFILE_EXCL);
    created.push(targetManifest);
    await validateRegisteredSleeve(targetDirectory, manifestName);
    const after = assetHashes();
    for (const [file, hash] of Object.entries(before)) assert.equal(after[file], hash, `Existing asset changed: ${file}`);
    assert.equal(Object.keys(after).length, Object.keys(before).length + 2);
    console.log(`Installed ${manifest.assetId}; all ${Object.keys(before).length} existing asset files unchanged`);
  } catch (error) {
    for (const file of created.reverse()) fs.unlinkSync(file);
    throw error;
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert(process.argv.length === 3, 'Usage: node scripts/collar/export_hoodie_test.mjs <validated-stage-directory>');
  await installRegisteredSleeve(path.resolve(workspaceRoot, process.argv[2]));
}
