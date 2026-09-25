import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { XMLSerializer } from '@xmldom/xmldom';
import { rebuildHoods, neckline, alpha, profile, layer } from './rebuild_hood_variants.mjs';
import { readAsset, rawSvg, composite } from './hood_render.mjs';
import { parsePart, sha256, workspaceRoot, localFile, boxyParts, partPath } from './validate_hoodie_pack.mjs';
import { assetHashes } from './export_hoodie_test.mjs';

export const fileName = 'Reference Scuba hood v1 (boxy).svg';
export const assetId = 'hoodie/Hood/Reference Scuba hood v1 (boxy)';
export const manifestName = fileName.replace('.svg', '.registration.json');
const sourceName = fileName.replace('.svg', '.source.png');
const variant = {
  id: 'reference-scuba', file: 'Reference Scuba hood v1 (boxy)', label: 'Reference Scuba Hood v1',
  matchRegularHeight: true, necklineAttachment: true, bodyRelativeScuba: true,
  preserveSideContour: true, singleAttachmentLine: true, matchRegularInk: true,
  outlineWidth: 3, traceSmoothing: 0.5, taperToNeckline: true,
};
const dependencyPaths = [
  ...boxyParts.map(partPath),
  'src/assets/hoodie-test/Hood/Scuba hood.svg',
  'src/assets/hoodie-test/Body/Raglan Body.svg',
  'src/assets/hoodie-test/Body/Dropped Shoulder Body.svg',
];

async function drawSource(destination) {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const png = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 2048;
      const context = canvas.getContext('2d');
      context.scale(2, 2);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 1024, 1024);
      context.strokeStyle = '#000000';
      context.lineWidth = 3;
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.beginPath();
      context.moveTo(512, 100);
      context.bezierCurveTo(372, 100, 300, 208, 300, 385);
      context.bezierCurveTo(292, 522, 324, 640, 350, 748);
      context.lineTo(340, 800);
      context.bezierCurveTo(396, 858, 466, 900, 512, 910);
      context.bezierCurveTo(558, 900, 628, 858, 684, 800);
      context.lineTo(674, 748);
      context.bezierCurveTo(700, 640, 732, 522, 724, 385);
      context.bezierCurveTo(724, 208, 652, 100, 512, 100);
      context.closePath();
      context.stroke();
      context.beginPath();
      context.moveTo(320, 392);
      context.bezierCurveTo(386, 324, 638, 324, 704, 392);
      context.bezierCurveTo(700, 552, 622, 700, 512, 764);
      context.bezierCurveTo(402, 700, 324, 552, 320, 392);
      context.closePath();
      context.stroke();
      for (const side of [-1, 1]) {
        context.save();
        context.translate(512, 0);
        context.scale(side, 1);
        context.beginPath();
        context.moveTo(200, 390);
        context.bezierCurveTo(202, 570, 112, 737, 0, 802);
        context.lineTo(0, 906);
        context.moveTo(210, 426);
        context.bezierCurveTo(186, 608, 157, 748, 26, 846);
        context.stroke();
        context.lineWidth = 1.8;
        context.beginPath();
        context.moveTo(72, 119);
        context.bezierCurveTo(87, 182, 101, 264, 96, 345);
        context.moveTo(164, 527);
        context.bezierCurveTo(144, 645, 72, 730, 0, 758);
        context.stroke();
        context.restore();
      }
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await sharp(Buffer.from(png, 'base64')).greyscale().threshold(180).png().toFile(destination);
  } finally { await browser.close(); }
}

async function mask(svg, group) {
  const document = parsePart(svg, ['#141414', '#000000']);
  if (group !== undefined) document.documentElement.removeChild(document.getElementsByTagName('g')[1 - group]);
  return alpha(await rawSvg(new XMLSerializer().serializeToString(document), 2048));
}

export async function validateReferenceScuba(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, manifestName), 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.assetId, assetId);
  assert.equal(manifest.fileName, fileName);
  assert.equal(manifest.fit, 'boxy');
  assert.equal(manifest.part, 'hood');
  assert.equal(manifest.compatibilityFamily, 'hoodie/boxy/neckline-v1');
  assert.equal(manifest.transformReferenceAssetId, 'hoodie/Hood/Scuba hood');
  assert.deepEqual(manifest.defaultTransform, { x: 0, y: 0, scale: 1, rotation: 0 });
  assert.equal(manifest.source.fileName, sourceName);
  const source = fs.readFileSync(path.join(directory, sourceName));
  assert.equal(sha256(source), manifest.source.sha256, 'Source changed');
  const metadata = await sharp(source).metadata();
  assert.equal(metadata.width, 2048);
  assert.equal(metadata.height, 2048);
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [...dependencyPaths].sort(), 'Missing dependencies');
  for (const [dependency, digest] of Object.entries(manifest.dependencies)) {
    assert.equal(sha256(fs.readFileSync(localFile(dependency))), digest, `Dependency changed: ${dependency}`);
  }
  const svg = fs.readFileSync(path.join(directory, fileName), 'utf8');
  assert.equal(sha256(svg), manifest.svgSha256, 'Candidate changed');
  parsePart(svg);
  const hood = await mask(svg), fill = await mask(svg, 0), ink = await mask(svg, 1);
  const regular = await mask(readAsset('Hood', 'boxy'));
  const original = await mask(readAsset('Hood', 'boxy', 'Scuba hood'));
  const originalInk = await mask(readAsset('Hood', 'boxy', 'Scuba hood'), 1);
  const socket = neckline(regular), bounds = profile(hood);
  assert(bounds.left > 2 && bounds.right < 2045 && bounds.top > 2 && bounds.maxY < 2045, 'Clipped hood');
  assert(Math.abs((bounds.left + bounds.right) / 2 - (socket.left + socket.right) / 2) <= 2, 'Off-centre hood');
  let changed = 0, union = 0, inkPixels = 0;
  for (let index = 0; index < hood.length; index++) {
    changed += (hood[index] > 128) !== (original[index] > 128) || (ink[index] > 128) !== (originalInk[index] > 128);
    union += hood[index] > 128 || original[index] > 128;
    inkPixels += ink[index] > 128;
  }
  assert(changed / union > 0.08, 'New hood is not visibly different');
  assert(inkPixels > 2000 && inkPixels / union < 0.2, 'Missing or flooded construction ink');
  const attachments = {};
  for (const bodyPath of dependencyPaths.filter(dependency => dependency.includes('/Body/'))) {
    const bodySvg = fs.readFileSync(localFile(bodyPath), 'utf8');
    const body = alpha(await rawSvg(bodySvg, 2048)), bodyFill = alpha(await rawSvg(layer(bodySvg, 0), 2048));
    let missing = 0, overlap = 0;
    for (let column = socket.left + 2; column <= socket.right - 2; column++) {
      for (let row = socket.bottom[column] - 3; row <= socket.bottom[column]; row++) {
        const index = row * 2048 + column;
        if (regular[index] >= 200 && Math.max(body[index], hood[index]) < 64) missing++;
      }
    }
    for (let index = 2048; index < body.length - 2048; index++) {
      if (bodyFill[index] > 240 && bodyFill[index - 1] > 240 && bodyFill[index + 1] > 240
        && bodyFill[index - 2048] > 240 && bodyFill[index + 2048] > 240 && fill[index] > 128) overlap++;
    }
    assert.equal(missing, 0, `${bodyPath}: neckline gap`);
    assert.equal(overlap, 0, `${bodyPath}: fabric overlap`);
    attachments[bodyPath] = { missing, overlap };
  }
  const registration = {
    canvas: [2048, 2048], method: 'Raster column fitting to existing Regular hood neckline, clipped against existing body',
    necklineLeft: socket.left, necklineRight: socket.right, necklineBottom: socket.maxY,
    boundarySha256: sha256(Buffer.from(socket.bottom.buffer)),
  };
  assert.deepEqual(manifest.registration, registration, 'Neckline registration changed');
  const measured = { attachments, bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.maxY }, changedFraction: changed / union, inkPixels };
  if (manifest.measurements) assert.deepEqual(manifest.measurements, measured, 'Measurements changed');
  return { manifest, svg, measured };
}

export async function buildReferenceScuba() {
  const staging = path.join(workspaceRoot, '.tmp-hoodie-assembly');
  fs.mkdirSync(staging, { recursive: true });
  const directory = fs.mkdtempSync(path.join(staging, 'reference-scuba-v1-'));
  const root = path.join(directory, 'generation');
  fs.mkdirSync(path.join(root, variant.id), { recursive: true });
  const source = path.join(root, variant.id, 'source.png');
  await drawSource(source);
  await rebuildHoods(variant.id, { root, variantDefinitions: [variant], selectedFits: ['boxy'] });
  fs.copyFileSync(path.join(root, variant.id, 'fits/boxy.svg'), path.join(directory, fileName));
  fs.copyFileSync(source, path.join(directory, sourceName));
  const socket = neckline(await mask(readAsset('Hood', 'boxy')));
  const manifest = {
    schemaVersion: 1, assetId, fileName, label: variant.label, fit: 'boxy', part: 'hood',
    compatibilityFamily: 'hoodie/boxy/neckline-v1', transformReferenceAssetId: 'hoodie/Hood/Scuba hood',
    defaultTransform: { x: 0, y: 0, scale: 1, rotation: 0 },
    source: { fileName: sourceName, sha256: sha256(fs.readFileSync(source)),
      reference: 'User-attached black hoodie photograph, 2026-09-25; visually interpreted, photo bytes not archived',
      method: 'New symmetric Canvas technical drawing followed by raster fitting and Potrace; not a photo pixel trace',
      visibleDesign: 'Rounded structured crown, deep face opening, raised centre-front edges, opening binding and side-panel seams',
      hiddenInterfaces: 'Existing registered Boxy Regular hood neckline and body; no inferred photographic measurements, rear view or zip' },
    registration: { canvas: [2048, 2048], method: 'Raster column fitting to existing Regular hood neckline, clipped against existing body',
      necklineLeft: socket.left, necklineRight: socket.right, necklineBottom: socket.maxY, boundarySha256: sha256(Buffer.from(socket.bottom.buffer)) },
    dependencies: Object.fromEntries(dependencyPaths.map(dependency => [dependency, sha256(fs.readFileSync(localFile(dependency)))])),
    generator: Object.fromEntries(['scripts/collar/build_reference_scuba.mjs', 'scripts/collar/rebuild_hood_variants.mjs'].map(script => [script, sha256(fs.readFileSync(localFile(script)))])),
    svgSha256: sha256(fs.readFileSync(path.join(directory, fileName))),
  };
  fs.writeFileSync(path.join(directory, manifestName), JSON.stringify(manifest, null, 2));
  const result = await validateReferenceScuba(directory);
  manifest.measurements = result.measured;
  fs.writeFileSync(path.join(directory, manifestName), JSON.stringify(manifest, null, 2));
  fs.copyFileSync(path.join(root, variant.id, 'proofs/boxy.png'), path.join(directory, 'registered-proof.png'));
  await sharp(Buffer.from(composite('boxy', 'Scuba hood'))).flatten({ background: 'white' }).png().toFile(path.join(directory, 'original-scuba.png'));
  console.log(JSON.stringify({ directory, assetId, ...result.measured }, null, 2));
  return directory;
}

export async function installReferenceScuba(directory) {
  assert(fs.realpathSync(directory).startsWith(fs.realpathSync(path.join(workspaceRoot, '.tmp-hoodie-assembly')) + path.sep), 'Install from staging only');
  const { manifest } = await validateReferenceScuba(directory);
  assert(manifest.measurements, 'Validation measurements required');
  const before = assetHashes();
  const target = path.join(workspaceRoot, 'src/assets/hoodie-test/Hood');
  const files = [fileName, manifestName, sourceName];
  for (const file of files) assert(!fs.existsSync(path.join(target, file)), 'Version already exists');
  const created = [];
  try {
    for (const file of files) {
      const destination = path.join(target, file);
      fs.copyFileSync(path.join(directory, file), destination, fs.constants.COPYFILE_EXCL);
      created.push(destination);
    }
    await validateReferenceScuba(target);
    const after = assetHashes();
    for (const [file, digest] of Object.entries(before)) assert.equal(after[file], digest, `Existing asset changed: ${file}`);
    console.log(`Installed ${assetId}; ${Object.keys(before).length} existing files unchanged`);
  } catch (error) {
    for (const file of created) fs.rmSync(file);
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command = '--generate', directory] = process.argv.slice(2);
  if (command === '--generate') await buildReferenceScuba();
  else if (command === '--validate' && directory) console.log((await validateReferenceScuba(directory)).measured);
  else if (command === '--install' && directory) await installReferenceScuba(directory);
  else throw new Error('Use --generate, --validate <directory>, or --install <directory>');
}