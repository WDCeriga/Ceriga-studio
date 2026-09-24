import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { sharp, fits, suffix, readAsset, inner, tint } from './hood_render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
process.chdir(root);
const size = 2048;
const parts = ['Body', 'Left sleeve', 'Right sleeve', 'Rib hem', 'Left cuff', 'Right cuff', 'Hood', 'Kangaroo pocket'];
const selectedFits = process.argv.find((arg) => arg.startsWith('--fit='))?.split('=')[1];
const dropped = process.argv.includes('--construction=dropped');
const constructionName = dropped ? 'Dropped Shoulder' : 'Raglan';
const constructionId = dropped ? 'dropped-shoulder' : 'raglan';
const outputRoot = `src/assets/studio-hoodie/${constructionId}`;
const potrace = createRequire(import.meta.url)('potrace');

async function raster(svg) {
  const rgba = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  return Uint8Array.from({ length: size * size }, (_, index) => rgba[index * 4 + 3] >= 128 ? 1 : 0);
}

function rowBounds(mask, row, start = 0, end = size) {
  let left = size;
  let right = -1;
  for (let column = start; column < end; column++) {
    if (!mask[row * size + column]) continue;
    left = Math.min(left, column);
    right = column;
  }
  return { left, right };
}

function bounds(mask) {
  let top = size;
  let bottom = -1;
  let left = size;
  let right = -1;
  for (let row = 0; row < size; row++) {
    const span = rowBounds(mask, row);
    if (span.right < 0) continue;
    top = Math.min(top, row);
    bottom = row;
    left = Math.min(left, span.left);
    right = Math.max(right, span.right);
  }
  return { top, bottom, left, right };
}

async function loadFit(fit) {
  const layers = {};
  for (const part of parts) {
    const svg = readAsset(part, fit);
    const groups = [...svg.matchAll(/<g\b[^>]*>[\s\S]*?<\/g>/g)].map((match) => match[0]);
    assert.equal(groups.length, 2, `${fit}/${part}: fabric and ink groups`);
    const wrap = (group) => `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">${group}</svg>`;
    const fill = await raster(wrap(groups[0]));
    const ink = await raster(wrap(groups[1]));
    layers[part] = { svg, fill, ink, bounds: bounds(fill) };
  }
  return layers;
}

function landmarks(layers) {
  const body = layers.Body;
  const sleeve = layers['Left sleeve'];
  const center = (body.bounds.left + body.bounds.right) / 2;
  const topSpan = rowBounds(body.fill, body.bounds.top + 3, 0, Math.floor(center));
  const neckline = { x: (topSpan.left + topSpan.right) / 2, y: body.bounds.top };
  const samples = [];
  for (let row = sleeve.bounds.top + 10; row < body.bounds.top + (body.bounds.bottom - body.bounds.top) * 0.55; row += 5) {
    const bodySpan = rowBounds(body.fill, row);
    const sleeveSpan = rowBounds(sleeve.fill, row);
    samples.push({ y: row, body: bodySpan.left, sleeve: sleeveSpan.right, gap: bodySpan.left - sleeveSpan.right - 1 });
  }
  const underarmRow = samples.find((sample, index) => sample.gap >= 3 && samples[index + 1]?.gap >= 3);
  assert(underarmRow, 'Underarm must have a separated torso and sleeve');
  const underarm = { x: (underarmRow.body + underarmRow.sleeve) / 2, y: underarmRow.y };
  const widths = [];
  for (const sample of samples.filter((sample) => sample.y < underarm.y - 25)) {
    let run = 0;
    const previous = rowBounds(body.fill, sample.y - 3).left;
    const following = rowBounds(body.fill, sample.y + 3).left;
    const slope = (following - previous) / 6;
    for (let column = sample.body - 15; column <= sample.body + 15; column++) {
      if (body.ink[sample.y * size + column] || sleeve.ink[sample.y * size + column]) {
        run++;
      } else if (run) {
        if (run <= 6) widths.push(run / Math.sqrt(1 + slope * slope));
        run = 0;
      }
    }
  }
  widths.sort((first, second) => first - second);
  const lineWidth = widths[Math.floor(widths.length / 2)];
  assert(lineWidth >= 1 && lineWidth <= 5, `Unexpected original seam width: ${lineWidth}`);
  return { center, neckline, underarm, lineWidth, bounds: Object.fromEntries(Object.entries(layers).map(([part, layer]) => [part, layer.bounds])) };
}

function interiorDistance(mask) {
  const distance = new Uint16Array(mask.length);
  for (let index = 0; index < mask.length; index++) distance[index] = mask[index] ? 8192 : 0;
  for (let row = 1; row < size; row++) {
    for (let column = 1; column < size; column++) {
      const index = row * size + column;
      distance[index] = Math.min(distance[index], distance[index - 1] + 1, distance[index - size] + 1);
    }
  }
  for (let row = size - 2; row >= 0; row--) {
    for (let column = size - 2; column >= 0; column--) {
      const index = row * size + column;
      distance[index] = Math.min(distance[index], distance[index + 1] + 1, distance[index + size] + 1);
    }
  }
  return distance;
}

function curveAt(row, registration, fit) {
  if (dropped) {
    const { seamStart, seamEnd } = registration;
    const progress = Math.max(0, Math.min(1, (row - seamStart.y) / (seamEnd.y - seamStart.y)));
    return seamStart.x + (seamEnd.x - seamStart.x) * (progress + 0.18 * progress * (1 - progress));
  }
  const { neckline, underarm } = registration;
  const progress = Math.max(0, Math.min(1, (row - neckline.y) / (underarm.y - neckline.y)));
  const curvature = { slim: 0.25, regular: 0.32, cropped: 0.36, boxy: 0.40, baggy: 0.40 }[fit];
  return neckline.x + (underarm.x - neckline.x) * (progress + curvature * progress * (1 - progress));
}

function construct(layers, registration, fit) {
  const { center, neckline, underarm, lineWidth } = registration;
  const domain = new Uint8Array(size * size);
  const ink = new Uint8Array(size * size);
  const changedParts = parts.slice(0, 3);
  for (const part of changedParts) {
    for (let index = 0; index < domain.length; index++) {
      domain[index] |= layers[part].fill[index] | layers[part].ink[index];
      ink[index] |= layers[part].ink[index];
    }
  }
  const distance = interiorDistance(domain);
  if (dropped) {
    const dropRatio = { slim: 0.06, regular: 0.08, cropped: 0.11, boxy: 0.10, baggy: 0.12 }[fit];
    const drop = Math.round((layers.Body.bounds.bottom - layers.Body.bounds.top) * dropRatio);
    const startRow = layers['Left sleeve'].bounds.top + drop;
    const endRow = Math.max(startRow + 35, Math.round(underarm.y + drop * 0.55));
    const outside = rowBounds(domain, startRow);
    const leftInside = rowBounds(layers['Left sleeve'].fill, endRow).right;
    const rightInside = rowBounds(layers['Right sleeve'].fill, endRow).left;
    registration.seamStart = { x: Math.max(outside.left, 2 * center - outside.right), y: startRow };
    registration.seamEnd = { x: (leftInside + 2 * center - rightInside) / 2, y: endRow };
    registration.shoulderDropPixels = drop;
    assert(registration.seamEnd.x > registration.seamStart.x + 25, 'Dropped seam must cross the upper arm');
    assert(startRow > layers['Left sleeve'].bounds.top, 'Dropped seam must begin below the original shoulder');
  }
  const seamStartRow = dropped ? registration.seamStart.y : neckline.y;
  const seamEndRow = dropped ? registration.seamEnd.y : underarm.y;
  const cut = Math.ceil(seamEndRow + 12);
  const masks = Object.fromEntries(changedParts.map((part) => [part, { fill: layers[part].fill.slice(), ink: layers[part].ink.slice() }]));
  let erasedInk = 0;
  let transferredShoulder = 0;
  let lostBodyPixels = 0;
  const seam = new Uint8Array(size * size);
  for (let row = neckline.y - 3; row < cut + 5; row++) {
    const boundary = curveAt(row, registration, fit);
    const exterior = rowBounds(domain, row);
    const slope = (curveAt(row + 0.5, registration, fit) - curveAt(row - 0.5, registration, fit));
    const normal = Math.sqrt(1 + slope * slope);
    for (let column = 0; column < size; column++) {
      const index = row * size + column;
      if (!domain[index]) continue;
      const mirroredColumn = Math.min(column, 2 * center - column);
      const oldArmhole = row >= layers['Left sleeve'].bounds.top - 16 && row <= underarm.y && mirroredColumn <= underarm.x + 14;
      const exteriorDistance = Math.min(column - exterior.left, exterior.right - column);
      if (oldArmhole && exteriorDistance > Math.ceil(lineWidth * 1.6)) {
        erasedInk += ink[index];
        ink[index] = 0;
      }
      if (row >= seamStartRow && row <= seamEndRow) {
        const seamDistance = (mirroredColumn - boundary) / normal;
        const stitchOffset = lineWidth * 2.8 * Math.min(1, (seamEndRow - row) / 16);
        if (Math.abs(seamDistance) <= lineWidth / 2 || Math.abs(seamDistance + stitchOffset) <= lineWidth / 2) {
          ink[index] = 1;
          seam[index] = 1;
        }
      }
      let owner;
      if (dropped && row < seamStartRow) owner = 'Body';
      else if (row <= seamEndRow) owner = mirroredColumn >= boundary ? 'Body' : column < center ? 'Left sleeve' : 'Right sleeve';
      else owner = changedParts.find((part) => layers[part].fill[index]) ?? (column < underarm.x ? 'Left sleeve' : column > 2 * center - underarm.x ? 'Right sleeve' : 'Body');
      if (dropped) {
        if (owner === 'Body' && (layers['Left sleeve'].fill[index] || layers['Right sleeve'].fill[index])) transferredShoulder++;
        if (owner !== 'Body' && layers.Body.fill[index]) lostBodyPixels++;
      } else if (owner !== 'Body' && layers.Body.fill[index]) transferredShoulder++;
      for (const part of changedParts) {
        masks[part].fill[index] = part === owner && !ink[index] ? 1 : 0;
        masks[part].ink[index] = part === owner && ink[index] ? 1 : 0;
      }
    }
  }
  assert(erasedInk > 100, 'Old armhole ink must be removed');
  assert(transferredShoulder > 1000, 'Construction must transfer real shoulder area between body and sleeves');
  if (dropped) assert.equal(lostBodyPixels, 0, 'Extended body must retain its original fabric area');
  let missing = 0;
  let overlap = 0;
  let overflow = 0;
  let seamAsymmetry = 0;
  for (let row = neckline.y - 3; row < cut; row++) {
    for (let column = 0; column < size; column++) {
      const index = row * size + column;
      const count = changedParts.reduce((sum, part) => sum + masks[part].fill[index] + masks[part].ink[index], 0);
      if (domain[index] && !count) missing++;
      if (count > 1) overlap++;
      if (!domain[index] && count) overflow++;
      const mirror = Math.round(2 * center - column);
      if (mirror >= 0 && mirror < size && distance[index] > 8 && distance[row * size + mirror] > 8 && seam[index] !== seam[row * size + mirror]) seamAsymmetry++;
    }
  }
  assert.deepEqual({ missing, overlap, overflow, seamAsymmetry }, { missing: 0, overlap: 0, overflow: 0, seamAsymmetry: 0 });
  return { masks, domain, cut, checks: { missing, overlap, overflow, seamAsymmetry, erasedInk, transferredShoulder, lostBodyPixels } };
}

async function trace(mask, height) {
  const gray = Buffer.alloc(size * height, 255);
  for (let index = 0; index < gray.length; index++) if (mask[index]) gray[index] = 0;
  const png = await sharp(gray, { raw: { width: size, height, channels: 1 } }).resize(size * 3, height * 3, { kernel: 'nearest' }).png().toBuffer();
  return new Promise((resolve, reject) => {
    const tracer = new potrace.Potrace({ threshold: 128, blackOnWhite: true, turdSize: 4, turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY, alphaMax: 1, optCurve: true, optTolerance: 0.2, width: size, height });
    tracer.loadImage(png, (error) => {
      if (error) return reject(error);
      const tracedPath = tracer.getSVG().match(/<path\b[^>]*\bd="([^"]+)"/);
      if (!tracedPath) return reject(new Error('Potrace returned no path'));
      resolve(tracedPath[1]);
    });
  });
}

function registeredTrace(traced) {
  return traced.replace(/([MLC])([^MLCZ]*)/gi, (_, command, coordinates) => {
    const numbers = coordinates.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    const mapped = numbers.map((value, index) => Number((index % 2 ? (size - value) * 10 : value * 10).toFixed(3)));
    return `${command}${mapped.join(' ')}`;
  });
}

async function buildSvg(layer, masks, cut, fit, part) {
  const id = `${constructionId}-${fit}-${part.replaceAll(' ', '-').toLowerCase()}`;
  const groups = [...layer.svg.matchAll(/<g\b([^>]*)>([\s\S]*?)<\/g>/g)];
  const content = [];
  for (const [index, kind] of ['fill', 'ink'].entries()) {
    const traced = await trace(masks[kind], cut + 5);
    const transform = groups[index][1].match(/transform="([^"]+)"/)[1];
    assert.equal(transform, 'translate(0,2048) scale(0.1,-0.1)');
    const original = groups[index][2].replace(/<path /g, `<path clip-path="url(#${id}-lower)" `);
    content.push(`<g transform="${transform}" fill="${index ? '#141414' : '#000000'}" stroke="none"><path d="${registeredTrace(traced)}" fill-rule="evenodd" clip-path="url(#${id}-upper)"/>${original}</g>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><title>${fit} hoodie - ${constructionName} ${part}</title><defs><clipPath id="${id}-upper"><rect y="${(2048 - cut - 2) * 10}" width="20480" height="${(cut + 2) * 10}"/></clipPath><clipPath id="${id}-lower"><rect width="20480" height="${(2048 - cut + 2) * 10}"/></clipPath></defs>${content.join('')}</svg>\n`;
}

async function validateRendered(layers, variants, construction) {
  let changedLowerPixels = 0;
  for (const part of parts.slice(0, 3)) {
    const original = await sharp(Buffer.from(layers[part].svg)).ensureAlpha().raw().toBuffer();
    const candidate = await sharp(Buffer.from(variants[part])).ensureAlpha().raw().toBuffer();
    for (let index = (construction.cut + 8) * size * 4; index < original.length; index++) {
      if (original[index] !== candidate[index]) changedLowerPixels++;
    }
  }
  assert.equal(changedLowerPixels, 0, 'Lower fabric and ink must render identically');
  const compositeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048">${parts.slice(0, 3).map((part) => inner(variants[part])).join('')}</svg>`;
  const candidate = await sharp(Buffer.from(compositeSvg)).ensureAlpha().raw().toBuffer();
  const distance = interiorDistance(construction.domain);
  let holes = 0;
  const antialiasedBoundaryPixels = [];
  for (let index = 0; index < size * construction.cut; index++) {
    if (distance[index] <= 5) continue;
    const alpha = candidate[index * 4 + 3];
    if (alpha < 128) holes++;
    if (alpha < 200) antialiasedBoundaryPixels.push({ x: index % size, y: Math.floor(index / size), alpha });
  }
  assert.equal(holes, 0, `Traced upper panel holes: ${JSON.stringify(antialiasedBoundaryPixels.slice(0, 12))}`);
  return { changedLowerPixels, holes, antialiasedBoundaryPixels };
}

for (const fit of selectedFits ? [selectedFits] : fits) {
  assert(fits.includes(fit), `Unknown fit: ${fit}`);
  const layers = await loadFit(fit);
  const registration = landmarks(layers);
  const directory = path.join(outputRoot, fit);
  fs.mkdirSync(directory, { recursive: true });
  const construction = construct(layers, registration, fit);
  fs.writeFileSync(path.join(directory, 'registration.json'), JSON.stringify(registration, null, 2));
  const variants = {};
  for (const part of parts.slice(0, 3)) {
    variants[part] = await buildSvg(layers[part], construction.masks[part], construction.cut, fit, part);
    fs.writeFileSync(path.join(directory, `${constructionName} ${part}${suffix(fit)}.svg`), variants[part]);
    for (const kind of ['fill', 'ink']) {
      const pixels = Buffer.from(construction.masks[part][kind].map((value) => value * 255));
      await sharp(pixels, { raw: { width: size, height: size, channels: 1 } }).png().toFile(path.join(directory, `${part}-${kind}.png`));
    }
  }
  const colours = ['#74a6c4', '#a8afb3', '#a8afb3', '#74a6c4', '#a8afb3', '#a8afb3', '#d5d7d8', '#74a6c4'];
  for (const mode of ['original', constructionId, 'monochrome']) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">${parts.map((part, index) => inner(tint(mode === 'original' ? layers[part].svg : variants[part] ?? layers[part].svg, mode === 'monochrome' ? '#ffffff' : colours[index]))).join('')}</svg>`;
    await sharp(Buffer.from(svg)).resize(1024, 1024).flatten({ background: 'white' }).png().toFile(path.join(directory, `${mode}.png`));
  }
  const rendered = await validateRendered(layers, variants, construction);
  const report = { fit, ...registration, ...construction.checks, ...rendered, cut: construction.cut, provenance: `Existing Ceriga panels rasterized; original ${constructionName} partition; Potrace-generated upper paths; original lower paths retained. Photo used only as a construction reference.` };
  fs.writeFileSync(path.join(directory, 'validation.json'), JSON.stringify(report, null, 2));
  for (const part of parts) assert.equal(readAsset(part, fit), layers[part].svg, `${fit}/${part}: original asset changed`);
  if (process.argv.includes('--publish')) {
    for (const part of parts.slice(0, 3)) fs.writeFileSync(`src/assets/hoodie-test/${part}/${constructionName} ${part}${suffix(fit)}.svg`, variants[part]);
  }
  console.log(JSON.stringify(report));
}
console.log(`${constructionName.toUpperCase()} VALIDATION COMPLETE`);