import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { sharp, fits, readAsset, rawSvg, inner, tint, suffix } from './hood_render.mjs';
import { alpha, profile, hash, W } from './rebuild_hood_variants.mjs';
import { assetHashes } from './export_hoodie_test.mjs';

const sourcePath = process.argv[2];
assert(sourcePath, 'Provide the first crossover technical reference image.');
const source = fs.readFileSync(sourcePath);
const protectedAssets = assetHashes();
const directory = 'src/assets/studio-hoodie/hoods/crossover-reference-v1';
fs.mkdirSync(directory, { recursive: true });
const metadata = await sharp(source).metadata();
assert.equal(metadata.width, metadata.height, 'Expected the square first technical reference');
const normalized = await sharp(source).resize(768, 768).png().toBuffer();
await sharp(source).png().toFile(`${directory}/reference-original.png`);
fs.writeFileSync(`${directory}/reference.png`, normalized);
const crop = { left: 298, top: 148, width: 176, height: 88 };
await sharp(normalized).extract(crop).png().toFile(`${directory}/reference-crop.png`);
const silhouette = 'M324 162 C349 152 416 151 449 162 C454 172 462 191 465 203 C467 207 460 209 449 212 C429 221 408 226 383 228 C358 227 330 218 308 208 C304 204 310 185 324 162 Z';
const opening = 'M324 162 C350 155 421 153 449 162 C442 180 430 200 414 214 C404 222 394 225 383 228 M324 162 C330 173 339 184 350 194 C360 209 374 218 388 224';
const rearPanel = 'M324 162 C330 173 339 184 350 194 C360 209 380 221 401 228 C358 227 330 218 308 208 C304 204 310 185 324 162 Z';
const frontPanel = 'M449 162 C454 172 462 191 465 203 C467 207 460 209 449 212 C429 221 408 226 383 228 C394 225 404 222 414 214 C430 200 442 180 449 162 Z';
const wrap = (content, viewBox = '0 0 2048 2048') => `<svg xmlns="http://www.w3.org/2000/svg" width="${viewBox.split(' ')[2]}" height="${viewBox.split(' ')[3]}" viewBox="${viewBox}">${content}</svg>`;
const referenceInk = `<g fill="none" stroke="#141414" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"><path d="${silhouette}"/><path d="${opening}"/></g>`;
const isolated = wrap(`<title>Crossover construction traced from first technical reference</title><path fill="#e2e2e2" d="${silhouette}"/><path fill="white" d="${rearPanel}"/><path fill="white" d="${frontPanel}"/>${referenceInk}`, '298 148 176 88');
fs.writeFileSync(`${directory}/isolated.svg`, isolated);
fs.writeFileSync(`${directory}/technical.svg`, isolated.replace('#e2e2e2', '#ffffff'));
await sharp(Buffer.from(isolated)).resize(1056, 528).png().toFile(`${directory}/isolated.png`);
const overlay = wrap(referenceInk.replaceAll('#141414', '#e12c48'), '298 148 176 88');
const overlayBytes = await sharp(normalized).extract(crop).composite([{ input: await sharp(Buffer.from(overlay)).resize(crop.width, crop.height).png().toBuffer() }]).png().toBuffer();
await sharp(overlayBytes).resize(1056, 528).png().toFile(`${directory}/overlay.png`);
const registration = JSON.parse(fs.readFileSync('src/assets/studio-hoodie/hoods/deep-reference-v3/registration.json', 'utf8'));
const deepShape = JSON.parse(fs.readFileSync('src/assets/studio-hoodie/hoods/deep-reference-v3/shape-parts.json', 'utf8'));
const inverse = 'translate(0,20480) scale(10,-10)';
const serializer = new XMLSerializer();
const manifest = { schemaVersion: 1, frontConstruction: 'crossover', sourceFile: path.basename(sourcePath), sourceSha256: hash(source),
  method: 'Reference-derived overlapping front panels; existing crown, upper opening band, attachment and cords retained. Original covered fabric and ink removed before inserting replacement panels.',
  authorization: 'User requested reference-based crossover assets and live selection; visual review remains available.', fits: {} };
for (const [family, name] of [['regular', 'Hood'], ['oversized-deep', 'Oversized Deep Hood']]) {
  const svg = readAsset('Hood', 'boxy', name);
  await sharp(Buffer.from(tint(svg, '#ffffff'))).trim().resize({ width: 700 }).flatten({ background: '#dedede' }).png().toFile(`${directory}/${family}-standard.png`);
  for (const fit of fits) {
    const standard = readAsset('Hood', fit, name);
    const standardRaw = await rawSvg(tint(standard, '#ffffff'), W);
    const bounds = profile(alpha(standardRaw));
    const attachment = profile(alpha(await rawSvg(readAsset('Hood', fit), W)));
    const bottom = attachment.maxY;
    const height = bottom - bounds.top;
    const startY = Math.round(bounds.top + height * 0.76);
    const rowRuns = [];
    let runStart = -1;
    for (let column = bounds.left; column <= bounds.right + 1; column++) {
      const offset = (startY * W + column) * 4;
      const ink = column <= bounds.right && standardRaw[offset + 3] > 128 && standardRaw[offset] < 100;
      if (ink && runStart < 0) runStart = column;
      if (!ink && runStart >= 0) { rowRuns.push((runStart + column - 1) / 2); runStart = -1; }
    }
    assert(rowRuns.length >= 4, `${family}/${fit}: opening landmarks missing`);
    const edgeIndex = family === 'regular' && rowRuns.length >= 7 ? 2 : 1;
    const left = rowRuns[edgeIndex];
    const right = rowRuns.at(-edgeIndex - 1);
    const center = (left + right) / 2;
    const span = right - left;
    const depth = bottom - startY;
    assert(span > 100 && depth > 50);
    const rearEdge = `M${left} ${startY} C${left + span * 0.35} ${startY + depth * 0.45} ${center + span * 0.02} ${bottom - depth * 0.22} ${center + span * 0.18} ${bottom - 3}`;
    const frontEdge = `M${right} ${startY} C${right - span * 0.35} ${startY + depth * 0.45} ${center - span * 0.02} ${bottom - depth * 0.22} ${center - span * 0.16} ${bottom - 2}`;
    const rear = `${rearEdge} L${bounds.left - 20} ${bottom + 10} L${bounds.left - 20} ${startY} Z`;
    const front = `${frontEdge} L${bounds.right + 20} ${bottom + 10} L${bounds.right + 20} ${startY} Z`;
    const interiorRows = [];
    for (let row = startY; row < bottom - 2; row++) {
      let rowLeft = bounds.left;
      let rowRight = bounds.right;
      while (rowLeft < rowRight && standardRaw[(row * W + rowLeft) * 4 + 3] < 200) rowLeft++;
      while (rowRight > rowLeft && standardRaw[(row * W + rowRight) * 4 + 3] < 200) rowRight--;
      let opaqueStart = -1;
      for (let column = bounds.left; column <= bounds.right + 1; column++) {
        const opaque = column >= rowLeft + 5 && column <= rowRight - 5 && row < bounds.bottom[column] - 3;
        if (opaque && opaqueStart < 0) opaqueStart = column;
        if (!opaque && opaqueStart >= 0) {
          interiorRows.push(`M${opaqueStart} ${row}h${column - opaqueStart}v1h-${column - opaqueStart}Z`);
          opaqueStart = -1;
        }
      }
    }
    const key = `cross-${family}-${fit}`;
    const interior = `<clipPath id="${key}-interior" clipPathUnits="userSpaceOnUse"><path fill="#ffffff" stroke="none" d="${interiorRows.join('')}"/></clipPath>`;
    const placement = registration.fits[fit];
    const cords = family === 'oversized-deep' ? `<g transform="translate(${placement.translateX} ${placement.translateY}) scale(${placement.scale})">${deepShape.cords.map(geometry => `<path d="${geometry}" fill="white" stroke="white" stroke-width="4"/>`).join('')}</g>` : '';
    const panelPaths = `<path d="${rear}"/><path d="${front}"/>`;
    const definitions = `${interior}<mask id="${key}-remove" maskUnits="userSpaceOnUse" x="0" y="0" width="20480" height="20480"><rect width="20480" height="20480" fill="white"/><g transform="${inverse}"><g clip-path="url(#${key}-interior)" fill="black">${panelPaths}</g>${cords}</g></mask><mask id="${key}-rear" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/><path d="${front}" fill="black"/></mask><mask id="${key}-cords" maskUnits="userSpaceOnUse" x="0" y="0" width="2048" height="2048"><rect width="2048" height="2048" fill="white"/>${cords.replaceAll('white', 'black')}</mask>`;
    const document = new DOMParser().parseFromString(standard, 'image/svg+xml');
    const root = document.documentElement;
    const groups = Array.from(root.childNodes).filter(node => node.nodeName === 'g');
    assert.equal(groups.length, 2);
    const existingDefs = Array.from(root.childNodes).filter(node => node.nodeName === 'defs').map(node => serializer.serializeToString(node)).join('');
    const original = groups.map(group => Array.from(group.childNodes).map(node => serializer.serializeToString(node)).join(''));
    const fabric = `<g transform="${inverse}" clip-path="url(#${key}-interior)">${panelPaths}</g>`;
    const ink = `<g transform="${inverse}" clip-path="url(#${key}-interior)" mask="url(#${key}-cords)" fill="none" stroke="#141414" stroke-width="${family === 'regular' ? 2.6 : 3.7}" stroke-linecap="round" stroke-linejoin="round"><path d="${rearEdge}" mask="url(#${key}-rear)"/><path d="${frontEdge}"/></g>`;
    const candidate = wrap(`<title>${family} Crossover Hood - ${fit}</title>${existingDefs}<defs>${definitions}</defs><g transform="translate(0,2048) scale(0.1,-0.1)" fill="#000000" stroke="none"><g mask="url(#${key}-remove)">${original[0]}</g>${fabric}</g><g transform="translate(0,2048) scale(0.1,-0.1)" fill="#141414" stroke="none"><g mask="url(#${key}-remove)">${original[1]}</g>${ink}</g>`);
    const candidateRaw = await rawSvg(tint(candidate, '#ffffff'), W);
    for (let offset = 0; offset < startY * W * 4; offset++) {
      assert(Math.abs(candidateRaw[offset] - standardRaw[offset]) <= 1, `${family}/${fit}: crown and upper band changed at ${offset}`);
    }
    let changed = 0;
    for (let offset = startY * W * 4; offset < candidateRaw.length; offset += 4) {
      if (candidateRaw[offset] !== standardRaw[offset] || candidateRaw[offset + 3] !== standardRaw[offset + 3]) changed++;
    }
    if (changed <= 300) {
      console.log({ family, fit, startY, bottom, left, right, top: bounds.top, clipRows: interiorRows.length });
      await sharp(Buffer.from(tint(candidate, '#ffffff'))).trim().resize({ width: 700 }).flatten({ background: '#dedede' }).png().toFile(`${directory}/clip-diagnostic.png`);
      await sharp(Buffer.from(wrap(`<path fill="black" d="${interiorRows.join('')}"/>`))).trim().resize({ width: 700 }).png().toFile(`${directory}/clip-mask.png`);
    }
    assert(changed > 300, `${family}/${fit}: front geometry must change (${changed} pixels, ${interiorRows.length} clip rows)`);
    assert.deepEqual(profile(alpha(candidateRaw)).bottom, bounds.bottom, `${family}/${fit}: outer attachment silhouette changed`);
    const file = `${family}-${fit}.svg`;
    fs.writeFileSync(`${directory}/${file}`, candidate);
    if (fit === 'boxy') await sharp(Buffer.from(tint(candidate, '#ffffff'))).trim().resize({ width: 700 }).flatten({ background: '#dedede' }).png().toFile(`${directory}/${family}-crossover.png`);
    const garment = wrap(['Left sleeve', 'Right sleeve', 'Body', 'Rib hem', 'Left cuff', 'Right cuff', 'Hood', 'Kangaroo pocket']
      .map(part => inner(tint(part === 'Hood' ? candidate : readAsset(part, fit), '#ffffff'))).join(''));
    await sharp(Buffer.from(garment)).resize(700, 700).flatten({ background: '#e9e9e9' }).png().toFile(`${directory}/${family}-${fit}.png`);
    manifest.fits[`${family}/${fit}`] = { file, sha256: hash(candidate), standardSha256: hash(standard), startY, left, right, bottom,
      changedPixels: changed, crownUnchanged: true, attachmentUnchanged: true, frontPanels: { rear, front } };
    console.log(`PASS ${family}/${fit}: replacement panels, ${changed} changed pixels; crown and attachment unchanged.`);
  }
}
assert.deepEqual(assetHashes(), protectedAssets, 'Existing assets must remain unchanged');
fs.writeFileSync(`${directory}/construction.json`, JSON.stringify(manifest, null, 2));
console.log('PASS: ten crossover assets built; all existing live assets unchanged.');
if (process.argv.includes('--install')) {
  for (const [selection, entry] of Object.entries(manifest.fits)) {
    const [family, fit] = selection.split('/');
    const name = family === 'regular' ? 'Regular Crossover Hood' : 'Deep Crossover Hood';
    fs.copyFileSync(`${directory}/${entry.file}`, `src/assets/hoodie-test/Hood/${name}${suffix(fit)}.svg`);
  }
  const installed = assetHashes();
  for (const [file, digest] of Object.entries(protectedAssets)) {
    if (!file.includes('Crossover Hood')) assert.equal(installed[file], digest, `${file}: existing asset changed`);
  }
  console.log('PASS: installed ten validated crossover assets; all Standard assets unchanged.');
}