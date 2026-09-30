import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { DOMParser } from '@xmldom/xmldom';
import { hash, W, alpha, profile, neckline, layer } from './rebuild_hood_variants.mjs';
import { regions, traceAlpha } from './replace_scuba_from_lineart.mjs';
import { fits, readAsset, rawSvg, assetPath, inner, tint } from './hood_render.mjs';
import { assetHashes } from './export_hoodie_test.mjs';

const directory = 'src/assets/studio-hoodie/hoods/deep-reference-v1';
const source = process.argv[2];
assert(source, 'Provide the original deephoodie.jfif path');
const bytes = fs.readFileSync(source);
const metadata = await sharp(bytes).metadata();
assert.equal(metadata.width, metadata.height, 'Expected the supplied square reference');
fs.mkdirSync(directory, { recursive: true });
const reference = await sharp(bytes).resize(768, 768).removeAlpha().png().toBuffer();
await sharp(reference).toFile(path.join(directory, 'reference.png'));
await sharp(reference).extract({ left: 110, top: 58, width: 145, height: 190 })
  .resize(580, 760).png().toFile(path.join(directory, 'front-crop.png'));
fs.writeFileSync(path.join(directory, 'source.json'), JSON.stringify({
  sourceSha256: hash(bytes), originalWidth: metadata.width, originalHeight: metadata.height,
  normalizedCanvas: [768, 768], frontCrop: { left: 110, top: 58, width: 145, height: 190 },
  status: 'source-inspection',
}, null, 2));
console.log(JSON.stringify({ sourceSha256: hash(bytes), width: metadata.width, height: metadata.height, directory }));

const width = 580;
const height = 760;
const crop = await sharp(bytes).resize(3072, 3072)
  .extract({ left: 440, top: 232, width, height }).greyscale().raw().toBuffer();
const ink = Uint8Array.from(crop, value => value < 170 ? 255 : 0);
const closed = await sharp(Buffer.from(ink), { raw: { width, height, channels: 1 } })
  .dilate(1).erode(1).toColourspace('b-w').raw().toBuffer();
assert.equal(closed.length, width * height);
const segmentation = regions(closed, width, height);
const panels = segmentation.components.filter(component => !component.border && component.area > 100);
assert(panels.some(panel => panel.area > 10000), 'The source opening must form an enclosed region');
const ids = new Set(panels.map(panel => panel.id));
const interior = Uint8Array.from(segmentation.labels, label => ids.has(label) ? 255 : 0);
const expanded = interior.slice();
for (let row = 3; row < height - 3; row++) {
  for (let column = 3; column < width - 3; column++) {
    const index = row * width + column;
    if (expanded[index] || !closed[index]) continue;
    for (let offsetY = -3; offsetY <= 3 && !expanded[index]; offsetY++) {
      for (let offsetX = -3; offsetX <= 3; offsetX++) {
        if (interior[index + offsetY * width + offsetX]) { expanded[index] = 255; break; }
      }
    }
  }
}
let hoodInk = Uint8Array.from(closed, (value, index) => expanded[index] ? value : 0);
assert(hoodInk.filter(value => value >= 128).length > 1000, 'Source outline must remain visible');
const hoodFill = Uint8Array.from(interior, (value, index) => Math.max(value, hoodInk[index]));
const localBackground = await sharp(crop, { raw: { width, height, channels: 1 } })
  .blur(4).toColourspace('b-w').raw().toBuffer();
hoodInk = Uint8Array.from(hoodInk, (value, index) =>
  hoodFill[index] && localBackground[index] - crop[index] > 4 ? 255 : value);
const inkRegions = regions(Uint8Array.from(hoodInk, value => 255 - value), width, height);
const retainedInk = new Set(inkRegions.components.filter(component => component.area >= 45).map(component => component.id));
hoodInk = Uint8Array.from(hoodInk, (value, index) => retainedInk.has(inkRegions.labels[index]) ? value : 0);
const proof = Buffer.alloc(width * height * 4);
for (let index = 0; index < hoodFill.length; index++) {
  const shade = hoodInk[index] ? 20 : 255;
  proof[index * 4] = shade;
  proof[index * 4 + 1] = shade;
  proof[index * 4 + 2] = shade;
  proof[index * 4 + 3] = hoodFill[index];
}
await sharp(proof, { raw: { width, height, channels: 4 } }).png().toFile(path.join(directory, 'extracted-front.png'));
console.log(JSON.stringify({ panels, threshold: 170, closingRadius: 1 }));

function canvas(mask) {
  const result = new Uint8Array(W * W);
  for (let row = 0; row < height; row++) result.set(mask.subarray(row * width, (row + 1) * width), row * W);
  return result;
}

function sample(mask, column, row) {
  const left = Math.floor(column);
  const top = Math.floor(row);
  const horizontal = column - left;
  const vertical = row - top;
  const at = (nextColumn, nextRow) => nextColumn >= 0 && nextColumn < W && nextRow >= 0 && nextRow < W
    ? mask[nextRow * W + nextColumn] : 0;
  return (at(left, top) * (1 - horizontal) + at(left + 1, top) * horizontal) * (1 - vertical)
    + (at(left, top + 1) * (1 - horizontal) + at(left + 1, top + 1) * horizontal) * vertical;
}

async function technicalSvg(fill, lines, title) {
  const paths = [];
  for (const mask of [fill, lines]) {
    const traced = await traceAlpha(mask, W, W, 1);
    const document = new DOMParser().parseFromString(traced, 'image/svg+xml');
    const coordinates = document.getElementsByTagName('path')[0].getAttribute('d');
    assert(!/[^MLCZ\d\s.,-]/i.test(coordinates));
    paths.push(coordinates.replace(/([MLC])([^MLCZ]*)/gi, (_, command, numbers) => {
      const values = numbers.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      return command + values.map((value, index) => (index % 2 ? (W - value / 3) * 10 : value / 3 * 10).toFixed(2)).join(' ');
    }));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><title>${title}</title>`
    + paths.map((coordinates, index) => `<g transform="translate(0,2048) scale(0.1,-0.1)" fill="${index ? '#141414' : '#000000'}" stroke="none"><path d="${coordinates}" fill-rule="evenodd"/></g>`).join('') + '</svg>\n';
}

const originalAssets = assetHashes();
const sourceFill = canvas(hoodFill);
const sourceInk = canvas(hoodInk);
const sourceBounds = profile(sourceFill);
const sourceSocket = neckline(sourceFill);
const sourceSvg = await technicalSvg(sourceFill, sourceInk, 'Oversized / Deep Hood - source trace');
fs.writeFileSync(path.join(directory, 'front-source.svg'), sourceSvg);
const tracedFill = alpha(await rawSvg(layer(sourceSvg, 0), W));
let union = 0;
let intersection = 0;
for (let index = 0; index < sourceFill.length; index++) {
  if (sourceFill[index] >= 128 || tracedFill[index] >= 128) union++;
  if (sourceFill[index] >= 128 && tracedFill[index] >= 128) intersection++;
}
assert(intersection / union > 0.99, 'Trace must preserve the extracted source silhouette');
const manifest = {
  schema: 1, styleId: 'oversized-deep', optionId: 'reference-v1', sourceSha256: hash(bytes),
  status: 'awaiting-visual-review', sourceSilhouetteIoU: intersection / union,
  construction: { layers: 'as-authored', drawstrings: 'no-drawstring' },
  rear: 'Reference shows rear center seam; no rear body socket exists, so back view remains unregistered.',
  extraction: { threshold: 170, localContrast: 4, minimumInkRegion: 45, sourceCrop: [110, 58, 145, 190] },
  sourceSocket: { left: sourceSocket.left, right: sourceSocket.right, bottom: sourceSocket.maxY },
  originalAssets, fits: {},
};
const tiles = [];
for (const fit of fits) {
  const regularSvg = readAsset('Hood', fit);
  const regular = alpha(await rawSvg(regularSvg, W));
  const regularInk = alpha(await rawSvg(layer(regularSvg, 1), W));
  const target = neckline(regular);
  const bodyNames = ['Body', 'Raglan Body', 'Dropped Shoulder Body'];
  const bodies = await Promise.all(bodyNames.map(async name => alpha(await rawSvg(readAsset('Body', fit, name), W))));
  const scale = (target.right - target.left) / (sourceSocket.right - sourceSocket.left);
  const translateX = target.left - sourceSocket.left * scale;
  const translateY = target.maxY - sourceSocket.maxY * scale;
  const collarStart = sourceBounds.maxY - (sourceBounds.maxY - sourceBounds.top) * 0.18;
  const collarTop = collarStart * scale + translateY;
  const fill = new Uint8Array(W * W);
  const lines = new Uint8Array(W * W);
  let maximumSeamAdjustment = 0;
  for (let column = Math.floor(sourceBounds.left * scale + translateX) - 2;
    column <= Math.ceil(sourceBounds.right * scale + translateX) + 2; column++) {
    const sourceX = (column - translateX) / scale;
    const sourceColumn = Math.max(0, Math.min(W - 1, Math.round(sourceX)));
    const inSocket = column >= target.left && column <= target.right;
    const sourceBottom = sourceBounds.bottom[sourceColumn];
    const bottom = inSocket ? target.bottom[column] : sourceBottom * scale + translateY;
    if (inSocket) maximumSeamAdjustment = Math.max(maximumSeamAdjustment, Math.abs(bottom - (sourceBottom * scale + translateY)));
    for (let row = Math.max(0, Math.floor(sourceBounds.top * scale + translateY) - 2); row <= bottom; row++) {
      const sourceY = row > collarTop && inSocket
        ? collarStart + (row - collarTop) / (bottom - collarTop) * (sourceBottom - collarStart)
        : (row - translateY) / scale;
      const index = row * W + column;
      fill[index] = Math.round(sample(sourceFill, sourceX, sourceY));
      lines[index] = Math.round(sample(sourceInk, sourceX, sourceY));
      if (inSocket && row >= bottom - 4) { fill[index] = regular[index] >= 200 ? 255 : regular[index]; lines[index] = regularInk[index]; }
      if (bodies.some(body => body[index] > 240 && body[index - 1] > 240 && body[index + 1] > 240
        && body[index - W] > 240 && body[index + W] > 240)) { fill[index] = 0; lines[index] = 0; }
    }
  }
  assert(maximumSeamAdjustment < 60, `${fit}: attachment adjustment exceeds local registration allowance`);
  const svg = await technicalSvg(fill, lines, `${fit} - Oversized / Deep Hood - supplied reference`);
  const full = alpha(await rawSvg(svg, W));
  const fabric = alpha(await rawSvg(layer(svg, 0), W));
  const bounds = profile(full);
  assert(bounds.top > 4 && bounds.left > 4 && bounds.right < W - 4 && bounds.maxY < W - 4, `${fit}: clipped hood`);
  const attachments = {};
  for (const [bodyIndex, body] of bodies.entries()) {
    let missing = 0;
    let overlap = 0;
    for (let column = target.left + 2; column <= target.right - 2; column++) {
      for (let row = target.bottom[column] - 3; row <= target.bottom[column]; row++) {
        const index = row * W + column;
        if (regular[index] >= 200 && Math.max(full[index], body[index]) < 64) missing++;
      }
    }
    for (let index = W; index < fabric.length - W; index++) {
      if (body[index] > 240 && body[index - 1] > 240 && body[index + 1] > 240
        && body[index - W] > 240 && body[index + W] > 240 && fabric[index] > 128) overlap++;
    }
    assert.equal(missing, 0, `${fit}/${bodyNames[bodyIndex]}: neckline gaps`);
    assert.equal(overlap, 0, `${fit}/${bodyNames[bodyIndex]}: fabric overlap`);
    attachments[bodyNames[bodyIndex]] = { missing, overlap, sha256: hash(readAsset('Body', fit, bodyNames[bodyIndex])) };
  }
  fs.writeFileSync(path.join(directory, `${fit}.svg`), svg);
  const garment = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">`
    + ['Left sleeve', 'Right sleeve', 'Body', 'Rib hem', 'Left cuff', 'Right cuff', 'Hood', 'Kangaroo pocket']
      .map(part => inner(tint(part === 'Hood' ? svg : readAsset(part, fit), '#ffffff'))).join('') + '</svg>';
  fs.writeFileSync(path.join(directory, `${fit}-registered.svg`), garment);
  await sharp(Buffer.from(garment)).resize(900, 900).flatten({ background: '#f0f0f0' }).png().toFile(path.join(directory, `${fit}-registered.png`));
  await sharp(Buffer.from(tint(svg, '#ffffff'))).extract({ left: bounds.left - 4, top: bounds.top - 4,
    width: bounds.right - bounds.left + 9, height: bounds.maxY - bounds.top + 9 }).resize({ height: 760 }).png()
    .toFile(path.join(directory, `${fit}-hood.png`));
  tiles.push({ input: await sharp(Buffer.from(garment)).resize(410, 410).flatten({ background: '#f0f0f0' }).png().toBuffer(), left: fits.indexOf(fit) * 410, top: 0 });
  manifest.fits[fit] = { assetId: `hoodie/Hood/Oversized Deep hood${fit === 'boxy' ? '' : ` (${fit})`}`,
    svgSha256: hash(svg), scale, translateX, translateY, collarStart, maximumSeamAdjustment,
    socketId: `hoodie/${fit}/neckline-v1`, attachments,
    socketProfile: Array.from({ length: target.right - target.left + 1 }, (_, index) => ({ x: target.left + index, y: target.bottom[target.left + index] })),
    bounds: { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.maxY },
  };
  console.log(`PASS ${fit}: source-preserving crown, registered neckline, no gaps/overlap on all three body constructions`);
}
await sharp({ create: { width: 2050, height: 410, channels: 4, background: '#f0f0f0' } }).composite(tiles).png().toFile(path.join(directory, 'all-fits.png'));
fs.writeFileSync(path.join(directory, 'registration.json'), JSON.stringify(manifest, null, 2));
assert.deepEqual(assetHashes(), originalAssets, 'Staging must not change any live asset');
if (process.argv.includes('--install')) {
  for (const fit of fits) {
    const target = assetPath('Hood', fit, 'Oversized Deep hood');
    assert(!fs.existsSync(target) || hash(fs.readFileSync(target)) === manifest.fits[fit].svgSha256, 'Refuse to overwrite a different authored hood');
  }
  for (const fit of fits) fs.copyFileSync(path.join(directory, `${fit}.svg`), assetPath('Hood', fit, 'Oversized Deep hood'));
  const after = assetHashes();
  for (const [file, digest] of Object.entries(originalAssets)) assert.equal(after[file], digest, `Protected asset changed: ${file}`);
  console.log('Installed only five Oversized / Deep front assets; all pre-existing assets unchanged.');
}