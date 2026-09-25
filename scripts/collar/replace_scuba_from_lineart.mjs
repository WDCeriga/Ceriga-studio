import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import potrace from 'potrace';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import { hash, W, alpha, profile, neckline, layer } from './rebuild_hood_variants.mjs';
import { fits, readAsset, rawSvg, assetPath, inner, tint } from './hood_render.mjs';
import { assetHashes } from './export_hoodie_test.mjs';

export function regions(ink, width, height) {
  const labels = new Int32Array(width * height).fill(-1);
  const queue = new Int32Array(labels.length);
  const components = [];
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] !== -1 || ink[start] >= 128) continue;
    const id = components.length;
    let head = 0, tail = 1, minY = height, maxY = 0, minX = width, maxX = 0;
    let border = false;
    queue[0] = start;
    labels[start] = id;
    while (head < tail) {
      const index = queue[head++], column = index % width, row = Math.floor(index / width);
      minX = Math.min(minX, column); maxX = Math.max(maxX, column);
      minY = Math.min(minY, row); maxY = Math.max(maxY, row);
      if (!column || column === width - 1 || !row || row === height - 1) border = true;
      const visit = next => {
        if (labels[next] === -1 && ink[next] < 128) {
          labels[next] = id; queue[tail++] = next;
        }
      };
      if (column) visit(index - 1);
      if (column < width - 1) visit(index + 1);
      if (row) visit(index - width);
      if (row < height - 1) visit(index + width);
    }
    components.push({ id, area: tail, minX, maxX, minY, maxY, border });
  }
  return { labels, components };
}

export async function traceAlpha(ink, width, height, minimumSubpaths = 2) {
  const png = await sharp(Buffer.from(ink), { raw: { width, height, channels: 1 } })
    .resize(width * 3, height * 3, { kernel: 'lanczos3' }).negate().png().toBuffer();
  const svg = await new Promise((resolve, reject) => potrace.trace(png, {
    turdSize: 4, turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
    alphaMax: 1, optCurve: true, optTolerance: 0.2,
    threshold: 128, blackOnWhite: true, color: '#141414',
  }, (error, result) => error ? reject(error) : resolve(result)));
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const root = document.documentElement;
  root.setAttribute('width', String(width)); root.setAttribute('height', String(height));
  root.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const outline = document.getElementsByTagName('path')[0];
  outline.setAttribute('transform', 'scale(0.3333333333333333)');
  outline.setAttribute('fill-rule', 'evenodd');
  assert((outline.getAttribute('d').match(/M/g) ?? []).length >= minimumSubpaths, 'Reject empty/block trace');
  return new XMLSerializer().serializeToString(document);
}

export async function extractHood(source) {
  const bytes = fs.readFileSync(source);
  const { data, info } = await sharp(bytes).flatten({ background: '#ffffff' })
    .removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const ink = Uint8Array.from({ length: width * height }, (_, index) => {
    const luminance = data[index * 3] * 0.2126 + data[index * 3 + 1] * 0.7152 + data[index * 3 + 2] * 0.0722;
    const contrast = Math.min(255, Math.max(0, (luminance - 128) * 1.35 + 128));
    return Math.round(255 * Math.min(1, Math.max(0, (246 - contrast) / 126)));
  });
  const { labels, components } = regions(ink, width, height);
  const selected = components.filter(component => !component.border && component.area > 30
    && component.maxY < height * 0.38 && component.minX > width * 0.25
    && component.maxX < width * 0.75);
  assert(selected.length >= 5, 'Expected closed crown, opening and neck panels');
  const ids = new Set(selected.map(component => component.id));
  const fill = Uint8Array.from(labels, label => ids.has(label) ? 255 : 0);
  const expanded = fill.slice();
  for (let row = 3; row < height - 3; row++) for (let column = 3; column < width - 3; column++) {
    const index = row * width + column;
    if (fill[index] || !ink[index]) continue;
    for (let offsetY = -3; offsetY <= 3 && !expanded[index]; offsetY++) {
      for (let offsetX = -3; offsetX <= 3; offsetX++) {
        if (fill[index + offsetY * width + offsetX]) { expanded[index] = 255; break; }
      }
    }
  }
  const hoodInk = Uint8Array.from(ink, (value, index) => expanded[index] ? value : 0);
  const hoodFill = Uint8Array.from(fill, (value, index) => Math.max(value, hoodInk[index]));
  const closed = regions(hoodInk, width, height);
  for (let index = 0; index < hoodFill.length; index++) {
    if (closed.labels[index] >= 0 && !closed.components[closed.labels[index]].border) hoodFill[index] = 255;
  }
  return { bytes, width, height, hoodInk, hoodFill, selected };
}

export async function stageSource(source) {
  const extracted = await extractHood(source);
  const { bytes, width, height, hoodInk, hoodFill, selected } = extracted;
  fs.mkdirSync('.tmp-hoodie-assembly', { recursive: true });
  const directory = fs.mkdtempSync('.tmp-hoodie-assembly/supplied-scuba-');
  fs.writeFileSync(path.join(directory, 'source.png'), bytes);
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < hoodInk.length; index++) rgba[index * 4 + 3] = hoodInk[index];
  await sharp(rgba, { raw: { width, height, channels: 4 } }).png().toFile(path.join(directory, 'hood-keyed.png'));
  await sharp(rgba, { raw: { width, height, channels: 4 } }).flatten({ background: 'white' }).png()
    .toFile(path.join(directory, 'hood-lineart.png'));
  await sharp(Buffer.from(hoodFill), { raw: { width, height, channels: 1 } }).png()
    .toFile(path.join(directory, 'hood-mask.png'));
  fs.writeFileSync(path.join(directory, 'hood-source.svg'), await traceAlpha(hoodInk, width, height));
  fs.writeFileSync(path.join(directory, 'source.json'), JSON.stringify({
    sourceSha256: hash(bytes), width, height, selected,
    key: { contrast: 1.35, transparent: 246, opaque: 120 },
    trace: { upsample: 3, threshold: 128, turdSize: 4, turnPolicy: 'minority', alphaMax: 1, optCurve: true,
      polarity: 'Node Potrace blackOnWhite=true; negate alpha, not Python Bitmap inversion' },
  }, null, 2));
  console.log(JSON.stringify({ directory, width, height, selected }, null, 2));
  return { directory, ...extracted };
}

function canvasMask(mask, width, height) {
  assert(width <= W && height <= W);
  const result = new Uint8Array(W * W);
  for (let row = 0; row < height; row++) result.set(mask.subarray(row * width, (row + 1) * width), row * W);
  return result;
}

function sample(mask, column, row) {
  const left = Math.floor(column), top = Math.floor(row);
  const horizontal = column - left, vertical = row - top;
  const at = (nextColumn, nextRow) => nextColumn >= 0 && nextColumn < W && nextRow >= 0 && nextRow < W
    ? mask[nextRow * W + nextColumn] : 0;
  return (at(left, top) * (1 - horizontal) + at(left + 1, top) * horizontal) * (1 - vertical)
    + (at(left, top + 1) * (1 - horizontal) + at(left + 1, top + 1) * horizontal) * vertical;
}

function distanceInside(mask) {
  const distance = Uint16Array.from(mask, value => value >= 128 ? W : 0);
  for (let row = 0; row < W; row++) for (let column = 0; column < W; column++) {
    const index = row * W + column;
    if (distance[index]) distance[index] = Math.min(distance[index], column ? distance[index - 1] + 1 : 1, row ? distance[index - W] + 1 : 1);
  }
  for (let row = W - 1; row >= 0; row--) for (let column = W - 1; column >= 0; column--) {
    const index = row * W + column;
    if (distance[index]) distance[index] = Math.min(distance[index], column < W - 1 ? distance[index + 1] + 1 : 1, row < W - 1 ? distance[index + W] + 1 : 1);
  }
  return distance;
}

function inkWeight(mask) {
  const runs = [];
  for (let row = 0; row < W; row++) {
    let length = 0;
    for (let column = 0; column < W; column++) {
      if (mask[row * W + column] >= 128) length++;
      else if (length) { if (length < 15) runs.push(length); length = 0; }
    }
  }
  assert(runs.length > 100, 'Not enough ink to measure');
  runs.sort((first, second) => first - second);
  return [runs[Math.floor(runs.length / 4)], runs[Math.floor(runs.length / 2)]];
}

async function builderSvg(fill, ink, fit) {
  const paths = [];
  for (const [mask, minimum] of [[fill, 1], [ink, 5]]) {
    const traced = await traceAlpha(mask, W, W, minimum);
    const document = new DOMParser().parseFromString(traced, 'image/svg+xml');
    const coordinates = document.getElementsByTagName('path')[0].getAttribute('d');
    assert(!/[^MLCZ\d\s.,-]/i.test(coordinates), 'Unexpected tracer path command');
    paths.push(coordinates.replace(/([MLC])([^MLCZ]*)/gi, (_, command, numbers) => {
      const values = numbers.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      return command + values.map((value, index) => (index % 2 ? (W - value / 3) * 10 : value / 3 * 10).toFixed(2)).join(' ');
    }));
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><title>${fit} - Scuba Hood from supplied line art</title>`
    + paths.map((coordinates, index) => `<g transform="translate(0,2048) scale(0.1,-0.1)" fill="${index ? '#141414' : '#000000'}" stroke="none"><path d="${coordinates}" fill-rule="evenodd"/></g>`).join('') + '</svg>\n';
}

function proof(svg, fit) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">`
    + ['Left sleeve', 'Right sleeve', 'Body', 'Rib hem', 'Left cuff', 'Right cuff', 'Hood', 'Kangaroo pocket']
      .map(part => inner(tint(part === 'Hood' ? svg : readAsset(part, fit), '#ffffff'))).join('') + '</svg>';
}

export async function validateReplacement(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'replacement.json'), 'utf8'));
  assert.equal(hash(fs.readFileSync(path.join(directory, 'source.png'))), manifest.sourceSha256);
  const results = {};
  for (const fit of fits) {
    const entry = manifest.fits[fit];
    const candidate = path.join(directory, `${fit}.svg`);
    const svg = fs.existsSync(candidate) ? fs.readFileSync(candidate, 'utf8') : readAsset('Hood', fit, 'Scuba hood');
    assert.equal(hash(svg), entry.svgSha256);
    assert.equal(hash(readAsset('Hood', fit)), entry.regularSha256);
    const regular = alpha(await rawSvg(readAsset('Hood', fit), W));
    const target = neckline(regular);
    const full = alpha(await rawSvg(svg, W));
    const fill = alpha(await rawSvg(layer(svg, 0), W));
    const ink = alpha(await rawSvg(layer(svg, 1), W));
    const weight = inkWeight(ink);
    const referenceWeight = inkWeight(alpha(await rawSvg(layer(readAsset('Hood', fit), 1), W)));
    assert(weight.every((value, index) => Math.abs(value - referenceWeight[index]) <= 1), `${fit}: ink mismatch ${weight} vs ${referenceWeight}`);
    const bounds = profile(full);
    assert(bounds.top > 4 && bounds.left > 4 && bounds.right < W - 4 && bounds.maxY < W - 4);
    const attachments = {};
    for (const name of ['Body', 'Raglan Body', 'Dropped Shoulder Body']) {
      const bodySvg = readAsset('Body', fit, name);
      assert.equal(hash(bodySvg), entry.bodies[name]);
      const body = alpha(await rawSvg(bodySvg, W));
      let missing = 0, overlap = 0;
      for (let column = target.left + 2; column <= target.right - 2; column++) {
        for (let row = target.bottom[column] - 3; row <= target.bottom[column]; row++) {
          const index = row * W + column;
          if (regular[index] >= 200 && Math.max(full[index], body[index]) < 64) missing++;
        }
      }
      for (let index = W; index < fill.length - W; index++) {
        if (body[index] > 240 && body[index - 1] > 240 && body[index + 1] > 240
          && body[index - W] > 240 && body[index + W] > 240 && fill[index] > 128) overlap++;
      }
      assert.equal(missing, 0, `${fit}/${name}: neckline gaps`);
      assert.equal(overlap, 0, `${fit}/${name}: fabric overlap`);
      attachments[name] = { missing, overlap };
    }
    results[fit] = { inkWeight: weight, referenceInkWeight: referenceWeight, attachments };
  }
  console.log(JSON.stringify(results, null, 2));
  return manifest;
}

export async function buildReplacement(source) {
  const extracted = await stageSource(source);
  const { directory, width, height } = extracted;
  const sourceFill = canvasMask(extracted.hoodFill, width, height);
  const sourceInk = canvasMask(extracted.hoodInk, width, height);
  const sourceAttachment = neckline(sourceFill);
  const sourceBounds = profile(sourceFill);
  const sourceDistance = distanceInside(sourceFill);
  const manifest = { schema: 1, sourceSha256: hash(extracted.bytes), sourceWidth: width, sourceHeight: height,
    description: 'Supplied line-art raster; isolated hood only. Crown/opening uniformly scaled; lower collar registered to existing neckline.',
    sourceTrace: 'hood-source.svg', defaultTransform: { x: 0, y: 0, scale: 1, rotation: 0 }, fits: {} };
  for (const fit of fits) {
    const regularSvg = readAsset('Hood', fit);
    const regularFull = alpha(await rawSvg(regularSvg, W));
    const regularInk = alpha(await rawSvg(layer(regularSvg, 1), W));
    const target = neckline(regularFull);
    const body = alpha(await rawSvg(readAsset('Body', fit), W));
    const scale = (target.right - target.left) / (sourceAttachment.right - sourceAttachment.left);
    const translateX = target.left - sourceAttachment.left * scale;
    const translateY = target.maxY - sourceAttachment.maxY * scale;
    const collarStart = sourceAttachment.maxY - (sourceAttachment.maxY - sourceAttachment.top) * 0.28;
    const collarTop = collarStart * scale + translateY;
    const nextFill = new Uint8Array(W * W), nextInk = new Uint8Array(W * W);
    let maximumSeamAdjustment = 0;
    for (let column = Math.floor(sourceBounds.left * scale + translateX) - 2;
      column <= Math.ceil(sourceBounds.right * scale + translateX) + 2; column++) {
      const sourceX = (column - translateX) / scale;
      const sourceColumn = Math.max(0, Math.min(W - 1, Math.round(sourceX)));
      const inAttachment = column >= target.left && column <= target.right;
      const sourceBottom = sourceBounds.bottom[sourceColumn];
      const bottom = inAttachment ? target.bottom[column] : sourceBottom * scale + translateY;
      if (inAttachment) maximumSeamAdjustment = Math.max(maximumSeamAdjustment, Math.abs(bottom - (sourceBottom * scale + translateY)));
      for (let row = Math.max(0, Math.floor(sourceBounds.top * scale + translateY) - 2); row <= bottom; row++) {
        const sourceY = row > collarTop && inAttachment
          ? collarStart + (row - collarTop) / (bottom - collarTop) * (sourceBottom - collarStart)
          : (row - translateY) / scale;
        const index = row * W + column;
        nextFill[index] = Math.round(sample(sourceFill, sourceX, sourceY));
        nextInk[index] = sample(sourceDistance, sourceX, sourceY) > 5 ? Math.round(sample(sourceInk, sourceX, sourceY)) : 0;
        if (inAttachment && row >= bottom - 4) {
          nextFill[index] = regularFull[index]; nextInk[index] = regularInk[index];
        }
        if (body[index] >= 128) { nextFill[index] = 0; nextInk[index] = 0; }
      }
    }
    assert(maximumSeamAdjustment < 60, `${fit}: incompatible lower attachment`);
    const distance = distanceInside(nextFill);
    const outlineWidth = inkWeight(regularInk)[0];
    for (let index = 0; index < distance.length; index++) {
      if (distance[index] && distance[index] <= outlineWidth) nextInk[index] = 255;
    }
    for (let column = target.left; column <= target.right; column++) {
      for (let row = target.bottom[column] - 6; row <= target.bottom[column]; row++) {
        nextInk[row * W + column] = row >= target.bottom[column] - 4 ? regularInk[row * W + column] : 0;
      }
    }
    let svg = await builderSvg(nextFill, nextInk, fit);
    const referenceWeight = inkWeight(regularInk);
    let inkExpansion = 0;
    for (const amount of [0.5, 0.75, 1]) {
      const measured = inkWeight(alpha(await rawSvg(layer(svg, 1), W)));
      if (measured.every((value, index) => Math.abs(value - referenceWeight[index]) <= 1)) break;
      const adjusted = nextInk.slice();
      for (let row = 1; row < W - 1; row++) for (let column = 1; column < W - 1; column++) {
        const index = row * W + column;
        if (distance[index] <= outlineWidth + 2 || row >= target.bottom[column] - 8) continue;
        const adjacent = Math.max(nextInk[index - 1], nextInk[index + 1], nextInk[index - W], nextInk[index + W]);
        adjusted[index] = Math.max(nextInk[index], Math.round(adjacent * amount));
      }
      svg = await builderSvg(nextFill, adjusted, fit);
      inkExpansion = amount;
    }
    fs.writeFileSync(path.join(directory, `${fit}.svg`), svg);
    await sharp(Buffer.from(proof(svg, fit))).resize(900, 900).flatten({ background: 'white' }).png()
      .toFile(path.join(directory, `${fit}-proof.png`));
    manifest.fits[fit] = { scale, translateX, translateY, collarStart, maximumSeamAdjustment,
      outlineWidth, inkExpansion, regularSha256: hash(regularSvg), previousScubaSha256: hash(readAsset('Hood', fit, 'Scuba hood')),
      svgSha256: hash(svg), bodies: Object.fromEntries(['Body', 'Raglan Body', 'Dropped Shoulder Body']
        .map(name => [name, hash(readAsset('Body', fit, name))])) };
  }
  fs.writeFileSync(path.join(directory, 'replacement.json'), JSON.stringify(manifest, null, 2));
  await validateReplacement(directory);
  console.log(`Validated replacement: ${directory}`);
  return directory;
}

export async function installReplacement(directory) {
  const manifest = await validateReplacement(directory);
  const archive = 'src/assets/studio-hoodie/hoods/supplied-scuba-20260925';
  assert(!fs.existsSync(archive), 'This source version is already installed');
  const before = assetHashes();
  const originals = new Map(fits.map(fit => [assetPath('Hood', fit, 'Scuba hood'), fs.readFileSync(assetPath('Hood', fit, 'Scuba hood'))]));
  for (const fit of fits) assert.equal(hash(readAsset('Hood', fit, 'Scuba hood')), manifest.fits[fit].previousScubaSha256, 'Live Scuba changed since staging');
  fs.mkdirSync(path.join(archive, 'previous'), { recursive: true });
  try {
    for (const name of ['source.png', 'source.json', 'hood-source.svg', 'hood-lineart.png', 'replacement.json']) {
      fs.copyFileSync(path.join(directory, name), path.join(archive, name));
    }
    for (const [file, bytes] of originals) fs.writeFileSync(path.join(archive, 'previous', path.basename(file)), bytes);
    for (const fit of fits) fs.copyFileSync(path.join(directory, `${fit}.svg`), assetPath('Hood', fit, 'Scuba hood'));
    const after = assetHashes();
    for (const [file, digest] of Object.entries(before)) {
      const replaced = fits.some(fit => file === path.relative('src/assets/hoodie-test', assetPath('Hood', fit, 'Scuba hood')));
      if (!replaced) assert.equal(after[file], digest, `Unrelated asset changed: ${file}`);
    }
    for (const fit of fits) assert.equal(hash(readAsset('Hood', fit, 'Scuba hood')), manifest.fits[fit].svgSha256);
  } catch (error) {
    for (const [file, bytes] of originals) fs.writeFileSync(file, bytes);
    fs.rmSync(archive, { recursive: true, force: true });
    throw error;
  }
  console.log('Installed five fit-specific Scuba traces; Regular Hood and all other hoodie assets unchanged.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv[2] === '--install') await installReplacement(process.argv[3]);
  else if (process.argv[2] === '--validate') await validateReplacement(process.argv[3]);
  else if (process.argv[2] === '--build') await buildReplacement(process.argv[3]);
  else await stageSource(process.argv[2]);
}