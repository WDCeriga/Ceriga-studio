import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { XMLSerializer } from '@xmldom/xmldom';
import { packHoodie } from './pack_hoodie.mjs';
import { boxyParts, partPath, localFile, parsePart, sha256, validateRecipe, validateRegisteredSleeve, workspaceRoot } from './validate_hoodie_pack.mjs';

export async function buildRegisteredSleeve(recipeFile) {
  const recipe = JSON.parse(fs.readFileSync(localFile(recipeFile), 'utf8'));
  validateRecipe(recipe);
  const source = fs.readFileSync(localFile(recipe.source.path));
  assert.equal(sha256(source), recipe.source.sha256, 'Recipe source hash does not match');
  const metadata = await sharp(source).metadata();
  assert.equal(metadata.width, recipe.source.width);
  assert.equal(metadata.height, recipe.source.height);
  const dependencies = Object.fromEntries(boxyParts.map(name => [name, {
    path: partPath(name), sha256: sha256(fs.readFileSync(localFile(partPath(name)))),
  }]));
  fs.mkdirSync(path.join(workspaceRoot, '.tmp-hoodie-assembly'), { recursive: true });
  const directory = fs.mkdtempSync(path.join(workspaceRoot, '.tmp-hoodie-assembly', `boxy-set-in-left-${recipe.version}-`));
  const pack = await packHoodie({ fit: recipe.fit, source: localFile(recipe.source.path), output: directory, onlyPart: 'Left sleeve', skipRaster: true });
  assert.equal(pack.parts.length, 1);
  assert.equal(pack.parts[0].name, 'Left sleeve');
  const document = parsePart(pack.parts[0].svg);
  document.getElementsByTagName('title')[0].textContent = `Boxy Set-in left sleeve ${recipe.version} - registered raster regeneration`;
  const svg = new XMLSerializer().serializeToString(document);
  const fileName = `Set-in Left sleeve ${recipe.version} (boxy).svg`;
  const manifest = {
    ...recipe, fileName, assetId: `hoodie/Left sleeve/${fileName.slice(0, -4)}`,
    label: `Set-in Sleeve ${recipe.version} (regenerated left)`,
    compatibilityFamily: 'hoodie/boxy/set-in/left-v1',
    transformReferenceAssetId: 'hoodie/Left sleeve/Left sleeve',
    registration: { canvas: [2048, 2048], scale: 4 / 3, offsetX: 1024 / 3, offsetY: 0 },
    defaultTransform: { x: 0, y: 0, scale: 1, rotation: 0 },
    dependencies, svgSha256: sha256(svg),
    generator: { path: 'scripts/collar/pack_hoodie.mjs', sha256: sha256(fs.readFileSync(localFile('scripts/collar/pack_hoodie.mjs'))), process: pack.process },
  };
  fs.writeFileSync(path.join(directory, fileName), svg, { flag: 'wx' });
  fs.writeFileSync(path.join(directory, 'registration.json'), JSON.stringify(manifest, null, 2));
  const { measured } = await validateRegisteredSleeve(directory);
  manifest.measurements = measured;
  fs.writeFileSync(path.join(directory, 'registration.json'), JSON.stringify(manifest, null, 2));
  const proofColours = ['#e4b945', '#ce584e', '#3aa883', '#9963bd', '#dc8fad', '#79aa4f', '#539cce', '#b77940'];
  const layers = boxyParts.map((name, index) => {
    const proof = parsePart(name === 'Left sleeve' ? svg : fs.readFileSync(localFile(partPath(name)), 'utf8'));
    proof.getElementsByTagName('g')[0].setAttribute('fill', proofColours[index]);
    return { input: Buffer.from(new XMLSerializer().serializeToString(proof)) };
  });
  await sharp({ create: { width: 2048, height: 2048, channels: 4, background: '#ffffff' } }).composite(layers).png().toFile(path.join(directory, 'registered-proof.png'));
  console.log(`Validated candidate: ${path.relative(workspaceRoot, directory)}`);
  return directory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [recipeFile, option] = process.argv.slice(2);
  assert(recipeFile && (!option || option === '--install'), 'Usage: node scripts/collar/build_hoodie_part.mjs <recipe.json> [--install]');
  const directory = await buildRegisteredSleeve(recipeFile);
  if (option === '--install') {
    const { installRegisteredSleeve } = await import('./export_hoodie_test.mjs');
    await installRegisteredSleeve(directory);
  }
}