import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const canvasSize = 2048;
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const boxyParts = ['Body', 'Left sleeve', 'Right sleeve', 'Left cuff', 'Right cuff', 'Hood', 'Rib hem', 'Kangaroo pocket'];
export const partPath = name => `src/assets/hoodie-test/${name}/${name}.svg`;

export function localFile(relative) {
  assert.equal(typeof relative, 'string', 'Expected repository-relative path');
  const resolved = path.resolve(workspaceRoot, relative);
  assert(resolved.startsWith(workspaceRoot + path.sep), 'Path must stay inside repository');
  const real = fs.realpathSync(resolved);
  assert(real.startsWith(fs.realpathSync(workspaceRoot) + path.sep), 'Symlink escapes repository');
  return real;
}

export function parsePart(svg, inkColours = ['#141414']) {
  const document = new DOMParser({ onError: level => { throw new Error(`Invalid SVG XML: ${level}`); } }).parseFromString(svg, 'image/svg+xml');
  assert(!document.doctype, 'SVG doctype is not allowed');
  const root = document.documentElement;
  assert.equal(root.tagName, 'svg');
  assert.equal(root.getAttribute('viewBox'), '0 0 2048 2048', 'Invalid registered viewBox');
  assert.equal(root.getAttribute('width'), '2048');
  assert.equal(root.getAttribute('height'), '2048');
  const elements = [...Array.from(root.getElementsByTagName('*')), root];
  for (const element of elements) {
    assert(['svg', 'title', 'g', 'path'].includes(element.tagName), 'Unsupported SVG element');
    for (const attribute of Array.from(element.attributes)) {
      assert(['xmlns', 'width', 'height', 'viewBox', 'transform', 'fill', 'fill-rule', 'd', 'stroke'].includes(attribute.name), `Unsupported SVG attribute ${attribute.name}`);
      if (attribute.name === 'stroke') assert.equal(attribute.value, 'none');
    }
    if (element.tagName !== 'g') assert(!element.hasAttribute('transform'), 'Unexpected placement transform');
  }
  const groups = Array.from(root.getElementsByTagName('g'));
  assert.equal(groups.length, 2, 'Expected separate fabric and construction ink');
  for (const [index, group] of groups.entries()) {
    assert.equal(group.parentNode, root);
    assert.equal(group.getAttribute('transform'), 'translate(0,2048) scale(0.1,-0.1)');
    if (index === 0) assert.equal(group.getAttribute('fill'), '#000000');
    else assert(inkColours.includes(group.getAttribute('fill')), 'Unsupported construction ink colour');
    assert(group.getElementsByTagName('path').length > 0, 'Missing traced geometry');
  }
  return document;
}

async function raster(svg, fabricOnly = false) {
  const document = parsePart(svg);
  if (fabricOnly) {
    const groups = document.documentElement.getElementsByTagName('g');
    document.documentElement.removeChild(groups[1]);
  }
  const bytes = await sharp(Buffer.from(new XMLSerializer().serializeToString(document))).ensureAlpha().raw().toBuffer();
  return Uint8Array.from({ length: canvasSize * canvasSize }, (_, index) => bytes[index * 4 + 3] >= (fabricOnly ? 250 : 33) ? 1 : 0);
}

function near(mask, index) {
  const column = index % canvasSize;
  return mask[index] || (column > 0 && mask[index - 1]) || (column < canvasSize - 1 && mask[index + 1])
    || mask[index - canvasSize] || mask[index + canvasSize];
}

function bounds(mask) {
  let left = canvasSize, top = canvasSize, right = -1, bottom = -1;
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index]) continue;
    left = Math.min(left, index % canvasSize);
    right = Math.max(right, index % canvasSize);
    top = Math.min(top, Math.floor(index / canvasSize));
    bottom = Math.max(bottom, Math.floor(index / canvasSize));
  }
  assert(right > left && bottom > top, 'Empty sleeve');
  return { left, top, right, bottom };
}

function components(mask) {
  const remaining = mask.slice();
  const queue = new Int32Array(mask.length);
  const counts = [];
  for (let start = 0; start < mask.length; start++) {
    if (!remaining[start]) continue;
    let head = 0, tail = 1;
    queue[0] = start;
    remaining[start] = 0;
    while (head < tail) {
      const index = queue[head++];
      const column = index % canvasSize;
      for (const next of [column > 0 ? index - 1 : -1, column < canvasSize - 1 ? index + 1 : -1, index - canvasSize, index + canvasSize]) {
        if (next < 0 || next >= mask.length || !remaining[next]) continue;
        remaining[next] = 0;
        queue[tail++] = next;
      }
    }
    counts.push(tail);
  }
  return counts;
}

export function validateRecipe(recipe) {
  assert.equal(recipe.schemaVersion, 1);
  assert.equal(recipe.fit, 'boxy', 'Only Boxy is certified by this demonstration');
  assert.equal(recipe.construction, 'set-in');
  assert.equal(recipe.part, 'sleeveLeft');
  assert.equal(recipe.side, 'left');
  assert.match(recipe.version, /^v[1-9][0-9]*$/);
  assert.equal(recipe.source.width, 1024);
  assert.equal(recipe.source.height, 1536);
  assert.match(recipe.source.sha256, /^[a-f0-9]{64}$/);
  assert(recipe.source.path.startsWith('src/assets/studio-hoodie/'), 'Use a repository-owned hoodie source');
}

export async function validateRegisteredSleeve(directory, manifestName = 'registration.json') {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, manifestName), 'utf8'));
  validateRecipe(manifest);
  const expectedId = `hoodie/Left sleeve/Set-in Left sleeve ${manifest.version} (boxy)`;
  assert.equal(manifest.assetId, expectedId);
  assert.equal(manifest.fileName, `Set-in Left sleeve ${manifest.version} (boxy).svg`);
  assert.equal(manifest.compatibilityFamily, 'hoodie/boxy/set-in/left-v1');
  assert.equal(manifest.transformReferenceAssetId, 'hoodie/Left sleeve/Left sleeve');
  assert.deepEqual(manifest.defaultTransform, { x: 0, y: 0, scale: 1, rotation: 0 });
  assert.deepEqual(manifest.registration, { canvas: [2048, 2048], scale: 4 / 3, offsetX: 1024 / 3, offsetY: 0 });
  const source = fs.readFileSync(localFile(manifest.source.path));
  assert.equal(sha256(source), manifest.source.sha256, 'Source hash changed');
  const metadata = await sharp(source).metadata();
  assert.equal(metadata.width, manifest.source.width, 'Source canvas width changed');
  assert.equal(metadata.height, manifest.source.height, 'Source canvas height changed');
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [...boxyParts].sort(), 'Missing registration dependencies');
  const originals = new Map();
  for (const name of boxyParts) {
    const dependency = manifest.dependencies[name];
    assert.equal(dependency.path, partPath(name), 'Wrong fit or construction dependency');
    const bytes = fs.readFileSync(localFile(dependency.path));
    assert.equal(sha256(bytes), dependency.sha256, `${name}: registration dependency changed`);
    originals.set(name, bytes.toString());
  }
  const svg = fs.readFileSync(path.join(directory, manifest.fileName), 'utf8');
  assert.equal(sha256(svg), manifest.svgSha256, 'Candidate hash changed');
  assert.notEqual(sha256(svg), manifest.dependencies['Left sleeve'].sha256, 'Candidate must be versioned, not the original file');
  const candidate = await raster(svg);
  const fabric = await raster(svg, true);
  const original = await raster(originals.get('Left sleeve'));
  const originalBounds = bounds(original);
  const candidateBounds = bounds(candidate);
  for (const key of Object.keys(originalBounds)) assert(Math.abs(originalBounds[key] - candidateBounds[key]) <= 16, `Unregistered sleeve ${key} bound`);
  const union = candidate.slice();
  let overlaps = 0;
  const attachments = {};
  for (const name of boxyParts.filter(name => name !== 'Left sleeve')) {
    const full = await raster(originals.get(name));
    const otherFabric = await raster(originals.get(name), true);
    let originalContact = 0, retainedContact = 0, contact = 0;
    const attachmentMask = new Uint8Array(full.length);
    for (let index = 0; index < full.length; index++) {
      union[index] ||= full[index];
      if (fabric[index] && otherFabric[index]) overlaps++;
      if (full[index] && near(original, index)) {
        originalContact++;
        attachmentMask[index] = 1;
        if (near(candidate, index)) retainedContact++;
      }
      if (full[index] && near(candidate, index)) contact++;
    }
    if (name === 'Body' || name === 'Left cuff') {
      assert(originalContact > 20 && contact > 20, `${name}: detached attachment`);
      assert(retainedContact / originalContact >= .98, `${name}: attachment boundary drift`);
      attachments[name] = { originalContact, retainedContact, contact, boundaryBounds: bounds(attachmentMask), boundarySha256: sha256(attachmentMask) };
    }
  }
  assert.equal(overlaps, 0, 'Sleeve overlaps another fabric panel');
  const areas = components(union);
  const connectedFraction = Math.max(...areas) / areas.reduce((sum, area) => sum + area, 0);
  assert(connectedFraction > .999, 'Detached garment components');
  const emptyAreas = components(Uint8Array.from(union, value => 1 - value));
  const enclosedGapPixels = emptyAreas.reduce((sum, area) => sum + area, 0) - Math.max(...emptyAreas);
  assert(enclosedGapPixels <= 16, 'Enclosed transparent gaps');
  const measured = { attachments, originalBounds, candidateBounds, overlaps, connectedFraction, enclosedGapPixels };
  if (manifest.measurements) assert.deepEqual(manifest.measurements, measured, 'Registration measurements changed');
  return { manifest, svg, measured };
}

const fits = ['boxy', 'cropped', 'baggy', 'regular', 'slim'];
const requiredNames = [
  'Body',
  'Kangaroo pocket',
  'Left sleeve',
  'Right sleeve',
  'Left cuff',
  'Right cuff',
  'Hood',
  'Rib hem',
];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) for (const fit of fits) {
  const mockupPath =
    fit === 'boxy'
      ? 'src/assets/studio-hoodie/mockup.json'
      : `src/assets/studio-hoodie/fits/${fit}/mockup.json`;
  const mockup = JSON.parse(fs.readFileSync(mockupPath, 'utf8'));
  const names = mockup.parts.map((part) => part.name);
  const missing = requiredNames.filter((name) => !names.includes(name));
  const malformed = mockup.parts.filter(
    (part) =>
      !part.svg.includes('fill-rule="evenodd"') ||
      !part.svg.includes('fill="#000000"') ||
      !part.svg.includes('fill="#141414"') ||
      (part.svg.match(/<g transform=/g) ?? []).length !== 2,
  );
  const area = Object.fromEntries(mockup.parts.map((part) => [part.name, part.area]));
  const cuffRatio = area['Left cuff'] / area['Right cuff'];

  if (mockup.partCount !== 8 || mockup.parts.length !== 8 || missing.length) {
    throw new Error(`${fit}: incomplete pack (${missing.join(', ')})`);
  }
  if (mockup.process?.exclusiveFillPartition !== true) {
    throw new Error(`${fit}: fill masks are not marked as an exclusive partition`);
  }
  if (malformed.length) {
    throw new Error(`${fit}: malformed SVG layers in ${malformed.map((part) => part.name).join(', ')}`);
  }
  if (cuffRatio < 0.75 || cuffRatio > 1.33) {
    throw new Error(`${fit}: asymmetric cuff ratio ${cuffRatio.toFixed(2)}`);
  }

  console.log(`${fit}: 8 parts, editable SVG layers, cuff ratio ${cuffRatio.toFixed(2)}`);
}
