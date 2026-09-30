import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { DOMParser } from '@xmldom/xmldom';
import { traceAlpha } from './replace_scuba_from_lineart.mjs';
import { assetHashes } from './export_hoodie_test.mjs';

const sourcePath = process.argv[2];
assert(sourcePath, 'Provide newneck.png; this script stages shape proofs only.');
const source = fs.readFileSync(sourcePath);
const metadata = await sharp(source).metadata();
assert.equal(metadata.width, 700);
assert.equal(metadata.height, 980);
const protectedAssets = assetHashes();
const output = 'src/assets/studio-hoodie/hoods/deep-reference-v3';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const silhouette = 'M350 25 C338 25 330 31 315 41 C281 64 246 90 230 119 C220 139 218 157 215 178 C210 197 210 216 220 235 L220 250 C220 263 215 270 205 275 C235 324 283 356 350 367 C416 356 465 324 494 275 C482 270 479 261 480 249 L480 232 C490 214 491 198 484 178 C480 154 479 137 468 117 C450 87 414 62 379 39 C366 30 359 25 350 25 Z';
const opening = 'M350 367 C330 326 298 292 260 255 C237 233 222 216 222 198 C222 182 232 161 247 160 C271 146 315 142 350 142 C385 142 428 146 451 160 C465 158 477 181 477 198 C477 218 460 236 438 257 C402 293 371 328 350 367 Z';
const seams = [
  'M215 178 C245 144 295 131 350 131 C405 131 457 144 484 178',
  'M251 159 C265 182 282 233 311.75 309.5',
  'M445 158 C432 183 414 234 388.375 310.875',
];
const leftCord = 'M309 321 C317 367 313 415 309 458 C305 500 302 531 305 557 C307 578 308 594 304 601 C301 607 308 611 312 606 C316 600 315 581 313 559 C309 532 315 493 320 449 C325 400 327 355 320 331 Z';
const rightCord = leftCord.replace(/([MC])([^MCZ]*)/g, (_, command, numbers) => command
  + numbers.trim().split(/[\s,]+/).map(Number).map((value, index) => index % 2 ? value : 700 - value).join(' '));
const cords = [leftCord, rightCord];
const approvedSvg = fs.readFileSync('src/assets/studio-hoodie/hoods/deep-reference-v2/isolated.svg', 'utf8');
assert(approvedSvg.includes(`d="${silhouette}"`), 'Approved outer silhouette must remain identical');
assert(approvedSvg.includes(`d="${opening}"`), 'Approved opening must remain identical');
const paths = values => values.map(value => `<path d="${value}"/>`).join('');
const fabric = paths([silhouette, ...cords]);
const baseInk = `<g fill="none" stroke="#141414" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${paths([silhouette, opening, ...seams])}</g>`;
const ink = `<defs><mask id="cord-clear" maskUnits="userSpaceOnUse" x="0" y="0" width="700" height="980"><rect width="700" height="980" fill="white"/><g fill="black">${paths(cords)}</g></mask></defs><g mask="url(#cord-clear)">${baseInk}</g><g fill="none" stroke="#141414" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths(cords)}</g>`;
const nativeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="620" viewBox="180 10 340 620"><title>Oversized Deep Hood - isolated source-coordinate recreation</title><g fill="#ffffff">${fabric}</g>${ink}</svg>`;
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'isolated.svg'), nativeSvg);
fs.writeFileSync(path.join(output, 'shape-parts.json'), JSON.stringify({ silhouette, opening, seams, cords, hoodStroke: 2.4, cordStroke: 1.8 }, null, 2));
await sharp(source).png().toFile(path.join(output, 'reference.png'));
await sharp(source).extract({ left: 180, top: 10, width: 340, height: 620 }).png().toFile(path.join(output, 'reference-crop.png'));

const canvasSize = 2048;
const scale = 2.8;
const transform = `translate(1024 170) scale(${scale}) translate(-350 -25)`;
const geometries = [];
for (const content of [`<g fill="#000000">${fabric}</g>`, ink]) {
  const raster = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048"><g transform="${transform}">${content}</g></svg>`)).ensureAlpha().extractChannel('alpha').raw().toBuffer();
  const traced = await traceAlpha(raster, canvasSize, canvasSize, 1);
  const document = new DOMParser().parseFromString(traced, 'image/svg+xml');
  const geometry = document.getElementsByTagName('path')[0].getAttribute('d');
  assert(!/[^MLCZ\d\s.,-]/i.test(geometry));
  geometries.push(geometry.replace(/([MLC])([^MLCZ]*)/gi, (_, command, numbers) => {
    const values = numbers.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    return command + values.map((value, index) => (index % 2 ? (canvasSize - value / 3) * 10 : value / 3 * 10).toFixed(2)).join(' ');
  }));
}
const technical = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><title>Oversized Deep Hood - clean technical shape - unregistered</title>${geometries.map((geometry, index) => `<g transform="translate(0,2048) scale(0.1,-0.1)" fill="${index ? '#141414' : '#000000'}" stroke="none"><path d="${geometry}" fill-rule="evenodd"/></g>`).join('')}</svg>`;
fs.writeFileSync(path.join(output, 'technical.svg'), technical);
const display = technical.replace('fill="#000000"', 'fill="#ffffff"');
await sharp(Buffer.from(display)).trim().extend({ top: 24, bottom: 24, left: 24, right: 24, background: '#ffffff' }).resize({ height: 1000 }).flatten({ background: '#ffffff' }).png().toFile(path.join(output, 'technical.png'));
await sharp(Buffer.from(nativeSvg)).resize({ height: 1000 }).flatten({ background: '#ffffff' }).png().toFile(path.join(output, 'isolated.png'));
const overlayInk = ink.replaceAll('#141414', '#d62939');
const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="620" viewBox="180 10 340 620"><g opacity="0.8">${overlayInk}</g></svg>`;
await sharp(source).extract({ left: 180, top: 10, width: 340, height: 620 }).composite([{ input: Buffer.from(overlaySvg) }]).png().toFile(path.join(output, 'overlay.png'));

const parsed = new DOMParser().parseFromString(technical, 'image/svg+xml');
assert.equal(parsed.getElementsByTagName('g').length, 2);
assert.equal(parsed.getElementsByTagName('path').length, 2);
const alpha = await sharp(Buffer.from(technical)).ensureAlpha().extractChannel('alpha').raw().toBuffer();
let occupied = 0;
for (let row = 0; row < canvasSize; row++) for (let column = 0; column < canvasSize; column++) {
  if (alpha[row * canvasSize + column] < 128) continue;
  assert(row > 8 && row < canvasSize - 9 && column > 8 && column < canvasSize - 9, 'Clipped shape');
  occupied++;
}
assert(occupied > 200000, 'Empty hood');
assert.deepEqual(assetHashes(), protectedAssets, 'Live garment assets must remain untouched');
const manifest = {
  schema: 1, styleId: 'oversized-deep', status: 'shape-review-only', registered: false, installed: false,
  sourceFile: path.basename(sourcePath), sourceSha256: digest(source), sourceDimensions: [700, 980],
  method: 'Manual Bezier reconstruction of visible reference contours; simplified construction ink. Not an exact pixel trace.',
  preserved: ['peaked crown', 'outer silhouette', 'deep opening', 'opening edge band', 'inward panel seams', 'curved reference attachment', 'two long front drawstrings'],
  simplified: ['dotted stitching omitted', 'secondary lower-tail lines removed', 'drawstrings simplified and mirrored'],
  eyelets: 'Cord exits retained; no separate metal rings invented.',
  constructionLayers: 'unconfirmed',
  sourceToCanvas: { scale, centerX: 1024, crownY: 170, purpose: 'Isolated canvas framing only; no garment socket or fit registration.' },
  assets: ['isolated.svg', 'technical.svg'].map(file => ({ file, sha256: digest(fs.readFileSync(path.join(output, file))) })),
  validation: { twoGroups: true, nonempty: true, unclipped: true, liveAssetsUnchanged: true, approvedSilhouetteUnchanged: true, approvedOpeningUnchanged: true },
};
fs.writeFileSync(path.join(output, 'shape.json'), JSON.stringify(manifest, null, 2));
console.log('PASS: isolated hood and two drawstrings; two-group technical SVG; unclipped; all live assets unchanged. No registration or installation.');