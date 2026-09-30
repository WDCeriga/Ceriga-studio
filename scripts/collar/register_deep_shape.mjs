import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { DOMParser } from '@xmldom/xmldom';
import { alpha, profile, neckline, hash, W } from './rebuild_hood_variants.mjs';
import { readAsset, rawSvg, inner, tint } from './hood_render.mjs';
import { assetHashes } from './export_hoodie_test.mjs';

const sourceDirectory = 'src/assets/studio-hoodie/hoods/deep-reference-v3';
const boxyScaleReview = process.argv.includes('--boxy-scale-review');
assert(!(boxyScaleReview && process.argv.includes('--install')), 'Boxy scale review cannot install assets');
const directory = boxyScaleReview ? path.join(sourceDirectory, 'boxy-scale-review') : sourceDirectory;
const shape = JSON.parse(fs.readFileSync(path.join(sourceDirectory, 'shape-parts.json'), 'utf8'));
const protectedAssets = assetHashes();
fs.mkdirSync(directory, { recursive: true });
const wrap = content => `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">${content}</svg>`;
const paths = (values, attributes = '') => values.map(value => `<path d="${value}" ${attributes}/>`).join('');
function packGeometry(geometry, scale = 1, translateX = 0, translateY = 0) {
  assert(!/[^MLCZ\d\s.,-]/i.test(geometry));
  return geometry.replace(/([MLC])([^MLCZ]*)/gi, (_, command, numbers) => command
    + numbers.trim().split(/[\s,]+/).filter(Boolean).map(Number)
      .map((value, index) => (index % 2 ? (W - value * scale - translateY) * 10 : (value * scale + translateX) * 10).toFixed(6)).join(' '));
}
function existingPaths(svg) {
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return Array.from(document.getElementsByTagName('g')).map(group =>
    paths(Array.from(group.getElementsByTagName('path')).map(element => element.getAttribute('d')),
      `transform="${group.getAttribute('transform')}" fill-rule="evenodd"`)).join('');
}
const manifest = { schema: 1, styleId: 'oversized-deep', status: 'registration-review-only', installed: false,
  shapeSha256: hash(fs.readFileSync(path.join(sourceDirectory, 'shape-parts.json'))),
  method: 'Uniform source transform; exact body exclusion mask and existing neckline contact strip. No hood-body or opening warp.',
  compatibleConstructionTested: 'Body (set-in)', fits: {} };
const attachmentCurve = 'C235 324 283 356 350 367 C416 356 465 324 494 275';
assert(shape.silhouette.includes(attachmentCurve));
const outerInk = shape.silhouette.replace(attachmentCurve, 'M494 275').replace(/ Z$/, '');
const reference = { necklineBottom: 367, torsoHem: 880, crownTop: 25 };
const calibrationNeckline = neckline(alpha(await rawSvg(readAsset('Hood', 'boxy'), W)));
const calibrationBody = profile(alpha(await rawSvg(readAsset('Body', 'boxy'), W)));
const torsoCanvasHeight = calibrationBody.maxY - calibrationNeckline.maxY;
const scale = torsoCanvasHeight / (reference.torsoHem - reference.necklineBottom);
manifest.scaleCalibration = { source: boxyScaleReview ? '../reference.png' : 'reference.png', reference,
  method: 'Calibrate reference neckline-to-torso-hem distance on approved Boxy; preserve that uniform hood scale across all fits.',
  fit: 'boxy', torsoCanvasHeight, scale };
for (const fit of boxyScaleReview ? ['boxy'] : ['slim', 'regular', 'boxy', 'cropped', 'baggy']) {
  const regularSvg = readAsset('Hood', fit);
  const regular = alpha(await rawSvg(regularSvg, W));
  const target = neckline(regular);
  const bodySvg = readAsset('Body', fit);
  const body = alpha(await rawSvg(bodySvg, W));
  const translateX = (target.left + target.right) / 2 - 349.5 * scale;
  const translateY = target.maxY - 367 * scale;
  const transform = `translate(${translateX} ${translateY}) scale(${scale})`;
  const sourceFabric = paths([shape.silhouette], `transform="${transform}"`);
  const cordFabric = paths(shape.cords, `transform="${transform}"`);
  const referenceMask = alpha(await rawSvg(wrap(`<g fill="black">${sourceFabric}</g>`), W));
  const sourceBounds = profile(referenceMask);
  const contactTop = [];
  const contactBottom = [];
  for (let column = target.left; column <= target.right; column++) {
    const sourceBottom = sourceBounds.bottom[column];
    contactTop.push(`${column},${sourceBottom < 0 ? target.bottom[column] - 6 : Math.min(target.bottom[column] - 6, sourceBottom - 2)}`);
    contactBottom.unshift(`${column},${target.bottom[column] + 2}`);
  }
  const definitions = `<defs><mask id="outside-body" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/>${existingPaths(bodySvg).replaceAll('<path ', '<path fill="black" ')}</mask><clipPath id="contact-strip"><polygon points="${[...contactTop, ...contactBottom].join(' ')}"/></clipPath><mask id="outside-cords" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/>${paths(shape.cords, `transform="${transform}" fill="black"`)}</mask></defs>`;
  const contact = `<g clip-path="url(#contact-strip)">${existingPaths(regularSvg)}</g>`;
  const hoodFabric = `<g mask="url(#outside-body)">${sourceFabric}${contact}</g>`;
  const sideConnections = [[205, target.left], [494, target.right]].map(([sourceX, column]) =>
    `M${sourceX * scale + translateX} ${275 * scale + translateY} L${column} ${target.bottom[column] + 1}`);
  const hoodInk = `<g mask="url(#outside-body)"><g mask="url(#outside-cords)">${paths([outerInk, shape.opening, ...shape.seams], `transform="${transform}" fill="none" stroke="#141414" stroke-width="${shape.hoodStroke}" stroke-linecap="round" stroke-linejoin="round"`)}${paths(sideConnections, `fill="none" stroke="#141414" stroke-width="${shape.hoodStroke * scale}" stroke-linecap="round"`)}</g></g>`;
  const cordInk = paths(shape.cords, `transform="${transform}" fill="none" stroke="#141414" stroke-width="${shape.cordStroke}" stroke-linecap="round" stroke-linejoin="round"`);
  const candidate = wrap(`<title>${fit} - Oversized Deep Hood - staged registration</title>${definitions}<g fill="#000000">${hoodFabric}${cordFabric}</g><g fill="#141414">${hoodInk}${cordInk}</g>`);
  const fabric = alpha(await rawSvg(wrap(`${definitions}<g fill="black">${hoodFabric}</g>`), W));
  const attachmentInk = alpha(await rawSvg(wrap(`${definitions}${hoodInk}`), W));
  const full = alpha(await rawSvg(candidate, W));
  const bounds = profile(full);
  assert(bounds.top > 4 && bounds.left > 4 && bounds.right < W - 4 && bounds.maxY < W - 4, `${fit}: clipped hood`);
  let gaps = 0;
  let overlap = 0;
  let maximumAttachmentChange = 0;
  let changedPixels = 0;
  for (let column = target.left + 2; column <= target.right - 2; column++) {
    const connectionTop = sourceBounds.bottom[column] < 0 ? target.bottom[column] - 3
      : Math.min(target.bottom[column] - 3, sourceBounds.bottom[column] - 1);
    for (let row = connectionTop; row <= target.bottom[column]; row++) {
      const index = row * W + column;
      if (regular[index] >= 200 && Math.max(full[index], body[index]) < 64) gaps++;
    }
  }
  for (let index = W; index < fabric.length - W; index++) {
    if (body[index] > 240 && body[index - 1] > 240 && body[index + 1] > 240
      && body[index - W] > 240 && body[index + W] > 240 && fabric[index] > 128) overlap++;
    if ((fabric[index] >= 128) === (referenceMask[index] >= 128)) continue;
    const column = index % W;
    const row = Math.floor(index / W);
    const distance = Math.abs(row - sourceBounds.bottom[column]);
    maximumAttachmentChange = Math.max(maximumAttachmentChange, distance);
    changedPixels++;
    assert(row >= translateY + 275 * scale - 3, `${fit}: change above attachment zone at ${column},${row}`);
  }
  console.log(JSON.stringify({ fit, scale, translateX, translateY, gaps, overlap, maximumAttachmentChange, changedPixels }));
  assert.equal(gaps, 0, `${fit}: neckline gaps`);
  assert.equal(overlap, 0, `${fit}: unwanted hood-fabric overlap`);
  for (const [sourceX, targetColumn] of [[205, target.left], [494, target.right]]) {
    const startX = sourceX * scale + translateX;
    const startY = 275 * scale + translateY;
    const endY = target.bottom[targetColumn] + 1;
    const steps = Math.ceil(Math.hypot(targetColumn - startX, endY - startY));
    for (let step = 0; step <= steps; step++) {
      const column = Math.round(startX + (targetColumn - startX) * step / steps);
      const row = Math.round(startY + (endY - startY) * step / steps);
      const index = row * W + column;
      assert(Math.max(attachmentInk[index - 1], attachmentInk[index], attachmentInk[index + 1], body[index]) >= 64,
        `${fit}: disconnected outer outline at ${column},${row}`);
    }
  }
  assert(maximumAttachmentChange <= 60, `${fit}: attachment change exceeds 60 canvas pixels`);
  const sourcePaths = (values, attributes = '') => paths(values.map(value => packGeometry(value, scale, translateX, translateY)), attributes);
  const localExisting = svg => existingPaths(svg).replace(/ transform="[^"]*"/g, '');
  const packedBody = localExisting(bodySvg).replaceAll('<path ', '<path fill="black" ');
  const packedCords = sourcePaths(shape.cords, 'fill="black"');
  const maskBase = '<rect width="20480" height="20480" fill="white"/>';
  const maskAttributes = 'maskUnits="userSpaceOnUse" x="0" y="0" width="20480" height="20480"';
  const packedDefinitions = `<defs><mask id="${fit}-body" ${maskAttributes}>${maskBase}${packedBody}</mask><mask id="${fit}-ink" ${maskAttributes}>${maskBase}${packedBody}${packedCords}</mask><clipPath id="${fit}-contact"><polygon points="${[...contactTop, ...contactBottom].map(point => { const [column, row] = point.split(',').map(Number); return `${column * 10},${(W - row) * 10}`; }).join(' ')}"/></clipPath></defs>`;
  const fabricAttributes = `mask="url(#${fit}-body)"`;
  const packedContact = localExisting(regularSvg).replaceAll('<path ', `<path ${fabricAttributes} clip-path="url(#${fit}-contact)" `);
  const inkAttributes = `mask="url(#${fit}-ink)" fill="none" stroke="#141414" stroke-width="${shape.hoodStroke * scale * 10}" stroke-linecap="round" stroke-linejoin="round"`;
  const packed = wrap(`${packedDefinitions}<g transform="translate(0,2048) scale(0.1,-0.1)" fill="#000000" stroke="none">${sourcePaths([shape.silhouette], fabricAttributes)}${packedContact}${sourcePaths(shape.cords)}</g><g transform="translate(0,2048) scale(0.1,-0.1)" fill="#141414" stroke="none">${sourcePaths([outerInk, shape.opening, ...shape.seams], inkAttributes)}${paths(sideConnections.map(value => packGeometry(value)), inkAttributes)}${sourcePaths(shape.cords, `fill="none" stroke="#141414" stroke-width="${shape.cordStroke * scale * 10}" stroke-linecap="round" stroke-linejoin="round"`)}</g>`);
  const packedMask = alpha(await rawSvg(packed, W));
  let conversionDifferences = 0;
  for (let index = W + 1; index < full.length - W - 1; index++) {
    if ((full[index] >= 128) === (packedMask[index] >= 128)) continue;
    conversionDifferences++;
    const reference = full[index] >= 128 ? packedMask : full;
    assert([-W - 1, -W, -W + 1, -1, 0, 1, W - 1, W, W + 1].some(offset => reference[index + offset] >= 64),
      `${fit}: packing moved a contour by more than one canvas pixel`);
  }
  for (const part of ['Left sleeve', 'Right sleeve']) {
    const sleeve = alpha(await rawSvg(readAsset(part, fit), W));
    assert(!sleeve.some((value, index) => value > 240 && packedMask[index] > 128), `${fit}: ${part} collision`);
  }
  for (let column = target.left + 2; column <= target.right - 2; column++) {
    for (let row = Math.min(target.bottom[column] - 3, sourceBounds.bottom[column] - 1); row <= target.bottom[column]; row++) {
      const index = row * W + column;
      assert(regular[index] < 200 || Math.max(packedMask[index], body[index]) >= 64, `${fit}: packed neckline gap`);
    }
  }
  fs.writeFileSync(path.join(directory, `${fit}-live.svg`), packed);
  fs.writeFileSync(path.join(directory, `${fit}-hood.svg`), candidate);
  const garment = wrap(['Left sleeve', 'Right sleeve', 'Body', 'Rib hem', 'Left cuff', 'Right cuff', 'Hood', 'Kangaroo pocket']
    .map(part => inner(tint(part === 'Hood' ? packed : readAsset(part, fit), '#ffffff'))).join(''));
  fs.writeFileSync(path.join(directory, `${fit}-registered.svg`), garment);
  await sharp(Buffer.from(garment)).resize(1000, 1000).flatten({ background: '#f1f2f1' }).png().toFile(path.join(directory, `${fit}-registered.png`));
  if (boxyScaleReview) {
    const regularGarment = wrap(['Left sleeve', 'Right sleeve', 'Body', 'Rib hem', 'Left cuff', 'Right cuff', 'Hood', 'Kangaroo pocket']
      .map(part => inner(tint(readAsset(part, fit), '#ffffff'))).join(''));
    fs.writeFileSync(path.join(directory, 'boxy-regular.svg'), regularGarment);
    await sharp(Buffer.from(regularGarment)).resize(1000, 1000).flatten({ background: '#f1f2f1' }).png().toFile(path.join(directory, 'boxy-regular.png'));
    const regularBounds = profile(regular);
    manifest.scaleCalibration = { ...manifest.scaleCalibration,
      regular: { crownY: regularBounds.top, width: regularBounds.right - regularBounds.left + 1, height: target.maxY - regularBounds.top },
      deep: { crownY: sourceBounds.top, width: sourceBounds.right - sourceBounds.left + 1, height: target.maxY - sourceBounds.top } };
    assert(sourceBounds.top < regularBounds.top, 'Deep crown must be taller than Regular');
    assert(sourceBounds.right - sourceBounds.left > regularBounds.right - regularBounds.left, 'Deep hood must be wider than Regular');
    console.log(JSON.stringify(manifest.scaleCalibration));
  }
  const cropLeft = target.left - 35;
  const cropTop = Math.floor(translateY + 250 * scale);
  await sharp(Buffer.from(garment)).extract({ left: cropLeft, top: cropTop, width: target.right - target.left + 71,
    height: target.maxY - cropTop + 55 }).resize({ width: 1100 }).flatten({ background: '#ffffff' }).png().toFile(path.join(directory, `${fit}-attachment.png`));
  manifest.fits[fit] = { scale, translateX, translateY, gaps, unwantedFabricOverlap: overlap, maximumAttachmentChange,
    shoulderCollisions: 0, conversionDifferences, packedSha256: hash(packed),
    changedPixels, bodySha256: hash(bodySvg), candidateSha256: hash(candidate),
    drawstrings: 'Rigidly transformed with the hood; intentional chest overlap, excluded from fabric-intersection test.',
    socket: { left: target.left, right: target.right, bottom: target.maxY } };
  console.log(`PASS ${fit}: zero gaps, zero unwanted fabric overlap, uniform hood transform, attachment-only adjustment.`);
}
assert.deepEqual(assetHashes(), protectedAssets, 'Live garment assets changed');
manifest.liveAssetsUnchanged = true;
fs.writeFileSync(path.join(directory, 'registration.json'), JSON.stringify(manifest, null, 2));
console.log(`PASS: ${Object.keys(manifest.fits).join(', ')} staged only. All live assets unchanged.`);
if (process.argv.includes('--install')) {
  const validation = JSON.parse(fs.readFileSync(path.join(directory, 'staged-validation.json'), 'utf8'));
  assert.equal(validation.browserPassed, true, 'Staged browser validation is required before installation');
  assert.deepEqual(validation.fits, Object.keys(manifest.fits));
  const installationPath = path.join(directory, 'installation.json');
  const previousInstallation = fs.existsSync(installationPath)
    ? JSON.parse(fs.readFileSync(installationPath, 'utf8')) : null;
  if (previousInstallation) assert.equal(previousInstallation.styleId, manifest.styleId);
  const targets = Object.entries(manifest.fits).map(([fit, result]) => {
    assert.equal(validation.assets[fit], result.packedSha256, `${fit}: candidate changed since browser validation`);
    const source = path.join(directory, `${fit}-live.svg`);
    const target = path.join('src/assets/hoodie-test/Hood', `Oversized Deep Hood${fit === 'boxy' ? '' : ` (${fit})`}.svg`);
    const assetKey = path.relative('src/assets/hoodie-test', target);
    const currentSha256 = fs.existsSync(target) ? hash(fs.readFileSync(target)) : null;
    const previousSha256 = validation.protectedAssets[assetKey] ?? null;
    if (currentSha256) {
      const previousAsset = previousInstallation?.assets.find(asset => path.normalize(asset.target) === target);
      assert(previousAsset, `${fit}: refusing to overwrite an unrecorded asset`);
      assert.equal(previousSha256, previousAsset.sha256, `${fit}: installed asset changed since recorded installation`);
      assert(currentSha256 === previousSha256 || currentSha256 === result.packedSha256,
        `${fit}: current asset is neither the recorded installation nor the validated candidate`);
    }
    return { source, target, sha256: result.packedSha256, previousSha256 };
  });
  const expectedAssets = { ...validation.protectedAssets };
  for (const { target, sha256 } of targets) {
    const assetKey = path.relative('src/assets/hoodie-test', target);
    if (protectedAssets[assetKey] === sha256) expectedAssets[assetKey] = sha256;
  }
  assert.deepEqual(protectedAssets, expectedAssets, 'Live assets changed since staged validation');
  for (const { source, target, previousSha256 } of targets) fs.copyFileSync(source, target, previousSha256 ? 0 : fs.constants.COPYFILE_EXCL);
  const installedHashes = assetHashes();
  const replacedAssets = new Set(targets.filter(asset => asset.previousSha256)
    .map(asset => path.relative('src/assets/hoodie-test', asset.target)));
  for (const [file, digest] of Object.entries(protectedAssets)) {
    if (!replacedAssets.has(path.normalize(file))) assert.equal(installedHashes[file], digest, `${file}: protected asset changed`);
  }
  for (const { target, sha256 } of targets) assert.equal(hash(fs.readFileSync(target)), sha256);
  fs.writeFileSync(installationPath, JSON.stringify({
    styleId: 'oversized-deep', reference: 'shape.json', assets: targets,
    existingAssetsUnchanged: replacedAssets.size === 0, protectedAssetsUnchanged: true,
    scaleCalibration: manifest.scaleCalibration,
  }, null, 2));
  console.log('PASS: five validated Deep hood assets installed; all other garment assets are unchanged.');
}