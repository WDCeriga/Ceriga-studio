import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { sharp, readAsset, inner, tint } from './hood_render.mjs';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const size = 2048;
const directory = '.tmp-dolman';
const parts = ['Body', 'Left sleeve', 'Right sleeve', 'Rib hem', 'Left cuff', 'Right cuff', 'Hood', 'Kangaroo pocket'];
const layers = {};
fs.mkdirSync(directory, { recursive: true });

function rowBounds(mask, row) {
  let left = size;
  let right = -1;
  for (let column = 0; column < size; column++) {
    if (mask[row * size + column]) {
      left = Math.min(left, column);
      right = column;
    }
  }
  return { left, right };
}

for (const part of parts) {
  const svg = readAsset(part, 'boxy');
  const groups = [...svg.matchAll(/<g\b[^>]*>[\s\S]*?<\/g>/g)].map(match => match[0]);
  assert.equal(groups.length, 2);
  const masks = [];
  for (const group of groups) {
    const pixels = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048">${group}</svg>`)).ensureAlpha().raw().toBuffer();
    masks.push(Uint8Array.from({ length: size * size }, (_, index) => pixels[index * 4 + 3] >= 128 ? 1 : 0));
  }
  const domain = masks[0].map((value, index) => value | masks[1][index]);
  const rows = Array.from({ length: size }, (_, row) => rowBounds(domain, row));
  layers[part] = { svg, fill: masks[0], ink: masks[1], domain, rows };
}

const original = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048">${parts.map(part => inner(tint(layers[part].svg, '#ffffff'))).join('')}</svg>`;
await sharp(Buffer.from(original)).resize(900).flatten({ background: 'white' }).png().toFile(`${directory}/original.png`);

const changedParts = parts.slice(0, 3);
const top = 700;
const bottom = 1640;
const mirror = 2046;
const shoulder = layers.Body.rows[top].left;
const wrist = layers['Left sleeve'].rows[bottom];
const bodySide = layers.Body.rows[1500].left;
const underarm = { x: bodySide + 39, y: 1160 };
const browser = await chromium.launch({ channel: 'msedge', headless: true });
let drawing;
try {
  const page = await browser.newPage();
  drawing = await page.evaluate(({ size, shoulder, wrist, bodySide, underarm, top, bottom, mirror }) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size * 2;
    const context = canvas.getContext('2d');
    context.scale(2, 2);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.fillStyle = '#000000';
    context.beginPath();
    context.moveTo(shoulder, top);
    context.bezierCurveTo(shoulder - 40, top + 70, 390, 860, 383, 1110);
    context.bezierCurveTo(372, 1320, 416, 1510, wrist.left, bottom);
    context.lineTo(wrist.right, bottom);
    context.bezierCurveTo(wrist.right - 66, 1450, underarm.x - 74, 1270, underarm.x - 3, underarm.y + 8);
    context.quadraticCurveTo(underarm.x + 4, underarm.y - 4, underarm.x + 3, underarm.y + 12);
    context.bezierCurveTo(underarm.x - 6, 1255, bodySide, 1380, bodySide, 1500);
    context.lineTo(bodySide, bottom);
    context.lineTo(mirror - bodySide, bottom);
    context.lineTo(mirror - bodySide, 1500);
    context.bezierCurveTo(mirror - bodySide, 1380, mirror - underarm.x + 6, 1255, mirror - underarm.x - 3, underarm.y + 12);
    context.quadraticCurveTo(mirror - underarm.x - 4, underarm.y - 4, mirror - underarm.x + 3, underarm.y + 8);
    context.bezierCurveTo(mirror - underarm.x + 74, 1270, mirror - wrist.right + 66, 1450, mirror - wrist.right, bottom);
    context.lineTo(mirror - wrist.left, bottom);
    context.bezierCurveTo(mirror - 416, 1510, mirror - 372, 1320, mirror - 383, 1110);
    context.bezierCurveTo(mirror - 390, 860, mirror - shoulder + 40, top + 70, mirror - shoulder, top);
    context.closePath();
    context.fill();
    return canvas.toDataURL('image/png').split(',')[1];
  }, { size, shoulder, wrist, bodySide, underarm, top, bottom, mirror: mirror + 1 });
} finally {
  await browser.close();
}
const pixels = await sharp(Buffer.from(drawing, 'base64')).resize(size, size).greyscale().raw().toBuffer();
const domain = new Uint8Array(size * size);
const originalDomain = new Uint8Array(size * size);
const ink = new Uint8Array(size * size);
for (let row = 0; row < size; row++) {
  for (let column = 0; column < size; column++) {
    const index = row * size + column;
    originalDomain[index] = changedParts.some(part => layers[part].domain[index]) ? 1 : 0;
    const lowerBody = row >= 1500 && column >= bodySide && column <= mirror - bodySide;
    const preserved = row < top || row >= bottom || lowerBody;
    domain[index] = preserved ? originalDomain[index] : pixels[index] < 128 ? 1 : 0;
    if (!originalDomain[index] && parts.slice(3).some(part => layers[part].domain[index])) domain[index] = 0;
    if (preserved) ink[index] = changedParts.some(part => layers[part].ink[index]) ? 1 : 0;
  }
}
for (let row = top; row < bottom; row++) {
  for (let column = 2; column < size - 2; column++) {
    const index = row * size + column;
    if (domain[index] && (!domain[index - 2] || !domain[index + 2] || !domain[index - size * 2] || !domain[index + size * 2])) ink[index] = 1;
  }
}
const masks = Object.fromEntries(changedParts.map(part => [part, { fill: new Uint8Array(size * size), ink: new Uint8Array(size * size) }]));
let changedPixels = 0;
let symmetricPixels = 0;
for (let row = 0; row < size; row++) {
  const progress = Math.max(0, Math.min(1, (row - top) / (underarm.y - top)));
  let boundary = shoulder + (underarm.x - shoulder) * progress;
  if (row >= underarm.y) {
    const left = rowBounds(domain, row).left;
    for (let column = left + 1; column < underarm.x; column++) {
      if (!domain[row * size + column]) {
        boundary = column;
        break;
      }
    }
  }
  for (let column = 0; column < size; column++) {
    const index = row * size + column;
    changedPixels += domain[index] !== originalDomain[index] ? 1 : 0;
    if (row > top + 5 && row < 1500 && column <= mirror && (pixels[index] < 128) !== (pixels[row * size + mirror - column] < 128)) symmetricPixels++;
    if (!domain[index]) continue;
    let owner;
    if (row < top || row >= bottom) owner = changedParts.find(part => layers[part].domain[index]);
    else owner = column < boundary ? 'Left sleeve' : column > mirror - boundary ? 'Right sleeve' : 'Body';
    assert(owner);
    masks[owner][ink[index] ? 'ink' : 'fill'][index] = 1;
  }
}
assert(changedPixels > 100000, 'Dolman must change the silhouette, not merely rename a set-in sleeve');
assert(symmetricPixels < 3000, `Dolman symmetry mismatch: ${symmetricPixels}`);
const potrace = createRequire(import.meta.url)('potrace');
async function trace(mask) {
  const binary = Buffer.alloc(mask.length);
  for (let index = 0; index < mask.length; index++) binary[index] = mask[index] ? 0 : 255;
  const png = await sharp(binary, { raw: { width: size, height: size, channels: 1 } }).resize(size * 3, size * 3, { kernel: 'nearest' }).png().toBuffer();
  return new Promise((resolve, reject) => {
    const tracer = new potrace.Potrace({ threshold: 128, blackOnWhite: true, turdSize: 4, turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY, alphaMax: 1, optCurve: true, optTolerance: 0.2, width: size, height: size });
    tracer.loadImage(png, error => {
      if (error) return reject(error);
      const traced = tracer.getSVG().match(/<path\b[^>]*\bd="([^"]+)"/)[1];
      resolve(traced.replace(/([MLC])([^MLCZ]*)/gi, (_, command, coordinates) => {
        const values = coordinates.trim().split(/[\s,]+/).filter(Boolean).map(Number);
        return `${command}${values.map((value, index) => Number((index % 2 ? (size - value) * 10 : value * 10).toFixed(3))).join(' ')}`;
      }));
    });
  });
}
const variants = {};
for (const part of changedParts) {
  const groups = [];
  for (const kind of ['fill', 'ink']) {
    await sharp(Buffer.from(masks[part][kind].map(value => value * 255)), { raw: { width: size, height: size, channels: 1 } }).png().toFile(`${directory}/${part}-${kind}.png`);
    groups.push(`<g transform="translate(0,2048) scale(0.1,-0.1)" fill="${kind === 'fill' ? '#000000' : '#141414'}" stroke="none"><path d="${await trace(masks[part][kind])}" fill-rule="evenodd"/></g>`);
  }
  variants[part] = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><title>boxy hoodie - Dolman ${part}</title>${groups.join('')}</svg>\n`;
  fs.writeFileSync(`${directory}/Dolman ${part}.svg`, variants[part]);
}
const source = Buffer.alloc(size * size, 255);
for (let index = 0; index < ink.length; index++) if (ink[index]) source[index] = 0;
await sharp(source, { raw: { width: size, height: size, channels: 1 } }).png().toFile(`${directory}/source.png`);
for (const coloured of [false, true]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048">${parts.map((part, index) => inner(tint(variants[part] ?? layers[part].svg, coloured ? ['#e6e6e6', '#70b9ba', '#70b9ba'][index] ?? '#ffffff' : '#ffffff'))).join('')}</svg>`;
  await sharp(Buffer.from(svg)).resize(900).flatten({ background: 'white' }).png().toFile(`${directory}/${coloured ? 'colour' : 'dolman'}.png`);
}
const hash = value => createHash('sha256').update(value).digest('hex');
const registration = {
  schemaVersion: 1, fit: 'boxy', construction: 'dolman', part: 'sleeveLeft',
  assetId: 'hoodie/Left sleeve/Dolman Left sleeve', label: 'Dolman Sleeve',
  compatibilityFamily: 'hoodie/boxy/dolman/v1',
  transformReferenceAssetId: 'hoodie/Left sleeve/Left sleeve',
  source: { reference: 'User image used for Dolman construction only; original symmetric raster geometry, no image pixels traced.', rasterFirst: true, canvas: [size, size] },
  defaultTransform: { x: 0, y: 0, scale: 1, rotation: 0 },
  tracing: { supersampling: 3, threshold: 128, blackOnWhite: true, turdSize: 4, turnPolicy: 'minority', alphaMax: 1, optTolerance: 0.2 },
  measurements: { shoulder, wrist, underarm, changedPixels, symmetricPixels },
  dependencies: Object.fromEntries(parts.map(part => [part, hash(layers[part].svg)])),
  svgSha256: hash(variants['Left sleeve']),
};
fs.writeFileSync(`${directory}/registration.json`, JSON.stringify(registration, null, 2) + '\n');
const ownership = new Uint8Array(size * size);
const rendered = new Uint8Array(size * size);
const renderedMasks = {};
let overlaps = 0;
for (const part of parts) {
  const svg = variants[part] ?? layers[part].svg;
  const fill = svg.match(/<g\b[^>]*>[\s\S]*?<\/g>/)[0];
  const fabric = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048">${fill}</svg>`)).ensureAlpha().raw().toBuffer();
  const full = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  const mask = new Uint8Array(size * size);
  for (let index = 0; index < mask.length; index++) {
    if (fabric[index * 4 + 3] >= 250 && ownership[index]++) overlaps++;
    mask[index] = full[index * 4 + 3] > 32 ? 1 : 0;
    rendered[index] ||= mask[index];
  }
  renderedMasks[part] = mask;
}
assert.equal(overlaps, 0, 'Colourable fabric interiors must not overlap');
const contacts = {};
for (const [first, second] of [['Body', 'Left sleeve'], ['Body', 'Right sleeve'], ['Body', 'Hood'], ['Body', 'Rib hem'], ['Left sleeve', 'Left cuff'], ['Right sleeve', 'Right cuff']]) {
  let contact = 0;
  for (let index = size + 1; index < rendered.length - size - 1; index++) {
    if (renderedMasks[first][index] && [index, index - 1, index + 1, index - size, index + size].some(neighbour => renderedMasks[second][neighbour])) contact++;
  }
  assert(contact > 20, `${first}/${second}: detached opening`);
  contacts[`${first}/${second}`] = contact;
}
const exterior = rendered.slice();
const queue = new Int32Array(rendered.length);
let head = 0;
let tail = 1;
exterior[0] = 1;
while (head < tail) {
  const index = queue[head++];
  for (const neighbour of [index - 1, index + 1, index - size, index + size]) {
    if (neighbour >= 0 && neighbour < exterior.length && !exterior[neighbour]) {
      exterior[neighbour] = 1;
      queue[tail++] = neighbour;
    }
  }
}
const gaps = exterior.reduce((total, value) => total + (value === 0 ? 1 : 0), 0);
assert(gaps <= 16, `Enclosed transparent gaps: ${gaps}`);
fs.writeFileSync(`${directory}/validation.json`, JSON.stringify({ ...registration.measurements, overlaps, contacts, gaps }, null, 2) + '\n');
if (process.argv.includes('--publish')) {
  for (const part of changedParts) fs.copyFileSync(`${directory}/Dolman ${part}.svg`, `src/assets/hoodie-test/${part}/Dolman ${part}.svg`);
  fs.copyFileSync(`${directory}/registration.json`, 'src/assets/hoodie-test/Left sleeve/Dolman Left sleeve.registration.json');
  const sourceDirectory = 'src/assets/studio-hoodie/sleeves/dolman-v1';
  fs.mkdirSync(sourceDirectory, { recursive: true });
  fs.copyFileSync(`${directory}/source.png`, `${sourceDirectory}/source.png`);
  for (const extension of ['svg', 'registration.json']) fs.rmSync(`src/assets/hoodie-test/Left sleeve/Set-in Left sleeve v1 (boxy).${extension}`, { force: true });
  for (const part of parts) assert.equal(hash(readAsset(part, 'boxy')), registration.dependencies[part], `${part}: original asset changed`);
}
console.log(JSON.stringify({ ...registration.measurements, overlaps, contacts, gaps, published: process.argv.includes('--publish') }));