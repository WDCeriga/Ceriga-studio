import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/app/data/hoodieAssembly.ts'], bundle: true, format: 'esm', platform: 'node', write: false });
const { HOODIE_PHASE_ONE, HOODIE_STRUCTURAL_PARTS } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const output = '.tmp-hoodie-assembly';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const colours = ['#CE584E', '#3AA883', '#E5B84A', '#508CC4', '#A36BBD', '#D380A0', '#76AD52', '#BE7844'];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.CERIGA_BASE_URL || 'http://localhost:5174'}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  assert.equal(await page.locator('[data-hoodie-assembly]').getAttribute('data-hoodie-assembly'), 'v1');
  await page.getByRole('button', { name: 'Background white', exact: true }).click();
  const parts = await page.locator('[data-layer-id]').evaluateAll(nodes => nodes.map(node => {
    const svg = node.querySelector('svg');
    const fabric = svg.cloneNode(true);
    for (const group of [...fabric.children].filter(child => child.tagName.toLowerCase() === 'g').slice(1)) group.remove();
    return { id: node.dataset.layerId, name: node.dataset.asset, svg: svg.outerHTML, fabric: fabric.outerHTML, transform: node.style.transform };
  }));
  assert.deepEqual(parts.map(part => part.id).sort(), [...HOODIE_STRUCTURAL_PARTS].sort());
  const size = HOODIE_PHASE_ONE.canvas;
  const masks = new Map();
  const ownership = new Uint8Array(size * size);
  const union = new Uint8Array(size * size);
  let overlaps = 0;
  for (const part of parts) {
    const fabric = await sharp(Buffer.from(part.fabric)).resize(size, size).ensureAlpha().raw().toBuffer();
    const full = await sharp(Buffer.from(part.svg)).resize(size, size).ensureAlpha().raw().toBuffer();
    const mask = new Uint8Array(size * size);
    let sample;
    for (let index = 0; index < mask.length; index++) {
      mask[index] = full[index * 4 + 3] > 32 ? 1 : 0;
      union[index] ||= mask[index];
      if (fabric[index * 4 + 3] >= 250) {
        if (ownership[index]++) overlaps++;
        if (index % 53 === 0 && fabric[(index + 8) * 4 + 3] === 255 && fabric[(index - 8) * 4 + 3] === 255
          && fabric[(index + size * 8) * 4 + 3] === 255 && fabric[(index - size * 8) * 4 + 3] === 255) sample = index;
      }
    }
    assert(sample !== undefined, `${part.id}: missing interior sample`);
    part.sample = { x: sample % size, y: Math.floor(sample / size) };
    masks.set(part.id, mask);
  }
  assert.equal(overlaps, 0, 'Opaque fabric interiors must have exclusive ownership');
  const contacts = [];
  for (const [first, second] of HOODIE_PHASE_ONE.attachments) {
    const firstMask = masks.get(first);
    const secondMask = masks.get(second);
    let contact = 0;
    for (let index = size + 1; index < firstMask.length - size - 1; index++) {
      if (firstMask[index] && (secondMask[index] || secondMask[index - 1] || secondMask[index + 1]
        || secondMask[index - size] || secondMask[index + size])) contact++;
    }
    assert(contact > 20, `${first}/${second}: detached attachment (${contact} contact pixels)`);
    contacts.push({ parts: [first, second], contactPixels: contact });
  }
  const remaining = union.slice();
  const queue = new Int32Array(union.length);
  const components = [];
  for (let start = 0; start < remaining.length; start++) {
    if (!remaining[start]) continue;
    let head = 0;
    let tail = 1;
    queue[0] = start;
    remaining[start] = 0;
    while (head < tail) {
      const index = queue[head++];
      for (const next of [index - 1, index + 1, index - size, index + size]) {
        if (next >= 0 && next < remaining.length && remaining[next]) {
          remaining[next] = 0;
          queue[tail++] = next;
        }
      }
    }
    components.push(tail);
  }
  const connectedFraction = Math.max(...components) / components.reduce((sum, count) => sum + count, 0);
  assert(connectedFraction > .999, `Detached garment pixels: ${connectedFraction}`);
  const exterior = union.slice();
  let head = 0;
  let tail = 1;
  queue[0] = 0;
  exterior[0] = 1;
  while (head < tail) {
    const index = queue[head++];
    for (const next of [index - 1, index + 1, index - size, index + size]) {
      if (next >= 0 && next < exterior.length && !exterior[next]) {
        exterior[next] = 1;
        queue[tail++] = next;
      }
    }
  }
  const uncoveredPixels = exterior.reduce((sum, value) => sum + (value === 0 ? 1 : 0), 0);
  assert(uncoveredPixels <= 16, `Enclosed transparent gaps: ${uncoveredPixels} pixels`);
  for (const [index, part] of parts.entries()) {
    const canvas = await page.locator('[data-layer-id="base"] svg').boundingBox();
    const point = { x: canvas.x + canvas.width * part.sample.x / size, y: canvas.y + canvas.height * part.sample.y / size };
    await page.mouse.click(point.x, point.y);
    assert((await page.getByRole('status', { name: 'Selected garment part' }).innerText()).includes(part.name), `${part.id}: wrong selection`);
    assert.equal(await page.getByRole('button', { name: 'Scale', exact: true }).count(), 8);
    assert.equal(await page.getByRole('button', { name: 'Rotate', exact: true }).count(), 1);
    assert.equal(await page.getByTitle('Reset position & scale', { exact: true }).count(), 1);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 35, point.y + 20, { steps: 5 });
    await page.mouse.up();
    await page.getByTitle('Reset position & scale', { exact: true }).click();
    assert.deepEqual(await page.locator('[data-layer-id]').evaluateAll(nodes => nodes.map(node => node.style.transform)), parts.map(entry => entry.transform));
    const input = page.getByRole('textbox', { name: 'Hex colour', exact: true });
    const inputIndex = part.id === 'sleeveRight' || part.id === 'sleeveHemLeft' ? 1 : part.id === 'sleeveHemRight' ? 2 : 0;
    await input.nth(inputIndex).fill(colours[index]);
    await input.nth(inputIndex).press('Enter');
    await page.waitForFunction(({ id, colour }) => document.querySelector(`[data-layer-id="${id}"] svg > g`)?.getAttribute('fill') === colour, { id: part.id, colour: colours[index] });
  }
  await page.getByRole('button', { name: 'Deselect', exact: true }).click();
  const coloured = await page.locator('[data-layer-id]').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.layerId, svg: node.querySelector('svg').outerHTML, transform: node.style.transform })));
  await page.getByRole('button', { name: /^Sleeves$/i }).click();
  await page.getByRole('button', { name: 'Raglan Sleeve', exact: true }).click();
  assert.equal(await page.locator('[data-layer-id]').count(), 8);
  await page.getByRole('button', { name: 'Set-in Sleeve', exact: true }).click();
  assert.deepEqual(await page.locator('[data-layer-id]').evaluateAll(nodes => nodes.map(node => ({ id: node.dataset.layerId, svg: node.querySelector('svg').outerHTML, transform: node.style.transform }))), coloured);
  const variantLabel = 'Set-in Sleeve v1 (regenerated left)';
  const sleeve = page.locator('[data-layer-id="sleeveLeft"]');
  const sleeveStyle = () => sleeve.evaluate(node => ({ transform: node.style.transform, origin: node.style.transformOrigin }));
  const originalStyle = await sleeveStyle();
  const unchangedParts = await page.locator('[data-layer-id]:not([data-layer-id="sleeveLeft"])').evaluateAll(nodes => nodes.map(node => node.outerHTML));
  await page.getByRole('button', { name: variantLabel, exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-layer-id="sleeveLeft"] title')?.textContent.includes('v1'));
  assert.deepEqual(await sleeveStyle(), originalStyle, 'New sleeve must start at the same registered transform');
  const leftPart = parts.find(part => part.id === 'sleeveLeft');
  const canvas = await page.locator('[data-layer-id="base"] svg').boundingBox();
  const point = { x: canvas.x + canvas.width * leftPart.sample.x / size, y: canvas.y + canvas.height * leftPart.sample.y / size };
  await page.mouse.click(point.x, point.y);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.mouse.move(point.x + 38, point.y - 24, { steps: 6 });
  await page.mouse.up();
  assert.notDeepEqual(await sleeveStyle(), originalStyle, 'Generated sleeve must move');
  const movedStyle = await sleeveStyle();
  const scaleHandle = await page.getByRole('button', { name: 'Scale', exact: true }).last().boundingBox();
  await page.mouse.move(scaleHandle.x + scaleHandle.width / 2, scaleHandle.y + scaleHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(scaleHandle.x + 28, scaleHandle.y + 34, { steps: 6 });
  await page.mouse.up();
  assert.notDeepEqual(await sleeveStyle(), movedStyle, 'Generated sleeve must resize');
  const scaledStyle = await sleeveStyle();
  const rotateHandle = await page.getByRole('button', { name: 'Rotate', exact: true }).boundingBox();
  await page.mouse.move(rotateHandle.x + rotateHandle.width / 2, rotateHandle.y + rotateHandle.height / 2);
  await page.mouse.down();
  await page.mouse.move(rotateHandle.x + 30, rotateHandle.y + 40, { steps: 6 });
  await page.mouse.up();
  const editedStyle = await sleeveStyle();
  assert.notDeepEqual(editedStyle, scaledStyle, 'Generated sleeve must rotate');
  assert.equal(await page.locator('[data-hoodie-assembly]').getAttribute('data-hoodie-assembly'), 'v1');
  await page.screenshot({ path: `${output}/sleeve-edited.png`, fullPage: true });
  await page.getByRole('button', { name: 'Set-in Sleeve', exact: true }).click();
  assert.deepEqual(await sleeveStyle(), editedStyle, 'Original compatible sleeve must retain edits and pivot');
  await page.getByRole('button', { name: variantLabel, exact: true }).click();
  assert.deepEqual(await sleeveStyle(), editedStyle, 'Generated compatible sleeve must retain edits and pivot');
  await page.mouse.click(point.x + 38, point.y - 24);
  if (await page.getByTitle('Reset position & scale', { exact: true }).count() === 0) {
    await page.locator('[data-tshirt-hit-target="sleeveLeft"]').focus();
    await page.keyboard.press('Enter');
  }
  await page.getByTitle('Reset position & scale', { exact: true }).click();
  assert.deepEqual(await sleeveStyle(), originalStyle, 'Reset must restore registered placement after move/resize/rotate');
  assert.deepEqual(await page.locator('[data-layer-id]:not([data-layer-id="sleeveLeft"])').evaluateAll(nodes => nodes.map(node => node.outerHTML)), unchangedParts, 'Sleeve replacement must not change other parts');
  await page.getByRole('button', { name: 'Set-in Sleeve', exact: true }).click();
  assert.deepEqual(await sleeveStyle(), originalStyle);
  await page.getByRole('button', { name: variantLabel, exact: true }).click();
  assert.deepEqual(await sleeveStyle(), originalStyle);
  await page.screenshot({ path: `${output}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.locator('[data-hoodie-assembly]').getAttribute('data-hoodie-assembly'), 'v1');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: `${output}/mobile.png`, fullPage: true });

  const fixture = await browser.newPage({ viewport: { width: 1000, height: 900 } });
  fixture.on('pageerror', error => errors.push(error.message));
  await fixture.goto(`${process.env.CERIGA_BASE_URL || 'http://localhost:5174'}/builder/hd-001`);
  await fixture.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  await fixture.evaluate(async () => {
    const { default: React } = await import('/node_modules/.vite/deps/react.js');
    const { default: ReactDOM } = await import('/node_modules/.vite/deps/react-dom_client.js');
    const { TshirtSvgPreview } = await import('/src/app/components/builder/TshirtSvgPreview.tsx');
    const { PrintsDesignPreview } = await import('/src/app/components/builder/PrintsDesignStep.tsx');
    const { PrintsStudioProvider } = await import('/src/app/components/builder/printsStudio/PrintsStudioContext.tsx');
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    document.getElementById('root').style.display = 'none';
    const mount = document.createElement('div');
    mount.style.cssText = 'width:800px;height:800px;background:white;position:relative';
    document.body.append(mount);
    const root = ReactDOM.createRoot(mount);
    window.fixtureChanges = [];
    window.renderHoodieFixture = (saved) => {
      const state = JSON.parse(JSON.stringify(saved));
      root.render(React.createElement(TshirtSvgPreview, {
        garmentType: 'hoodie', fit: 'boxy', color: '#80A8C4',
        selection: catalog.getDefaultGarmentSelection('hoodie', 'boxy'),
        ...state, selectedLayerId: 'base',
        onLayerTransformChange: (id, transform) => window.fixtureChanges.push({ id, transform }),
      }));
    };
    window.renderArtworkFixture = () => {
      function Artwork() {
        const [elements, setElements] = React.useState([{ id: 'custom-artwork', type: 'shape', content: 'square', x: 140, y: 140, width: 70, height: 70, rotation: 0, color: '#CE584E' }]);
        window.fixtureArtwork = elements;
        return React.createElement(PrintsDesignPreview, { elements, onChange: setElements, editable: true, selectedLayerId: 'custom-artwork', onSelectedLayerIdChange: () => {}, className: 'h-full w-full' });
      }
      root.render(React.createElement(PrintsStudioProvider, null, React.createElement(Artwork)));
    };
  });
  const stored = { base: { x: 24, y: -18, scale: .8, scaleX: -1.1, scaleY: .9, rotation: 17 } };
  const expectedStyle = 'translate(24px, -18px) rotate(17deg) scale(-1.1, 0.9)';
  for (const version of [undefined, 1, 2]) {
    await fixture.evaluate(({ version, stored }) => window.renderHoodieFixture({ hoodieAssemblyVersion: version, layerTransforms: stored }), { version, stored });
    await fixture.waitForFunction(version => document.querySelector('body > div:last-child [data-hoodie-assembly]')?.dataset.hoodieAssembly === (version === 1 ? 'v1' : 'legacy'), version);
    assert.equal(await fixture.locator('body > div:last-child [data-layer-id="base"]').evaluate(node => node.style.transform), expectedStyle);
    assert.equal(await fixture.getByRole('button', { name: 'Scale', exact: true }).count(), 8);
    assert.equal(await fixture.getByRole('button', { name: 'Rotate', exact: true }).count(), 1);
  }
  const handle = await fixture.getByRole('button', { name: 'Scale', exact: true }).first().boundingBox();
  await fixture.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await fixture.mouse.down();
  await fixture.mouse.move(handle.x + 30, handle.y + 25, { steps: 5 });
  await fixture.mouse.up();
  await fixture.waitForFunction(() => window.fixtureChanges.length > 0);
  await fixture.evaluate(() => window.renderArtworkFixture());
  await fixture.locator('[data-print-id="custom-artwork"]').waitFor();
  const artworkBefore = await fixture.evaluate(() => window.fixtureArtwork[0]);
  const artwork = await fixture.locator('[data-print-id="custom-artwork"]').boundingBox();
  await fixture.mouse.move(artwork.x + artwork.width / 2, artwork.y + artwork.height / 2);
  await fixture.mouse.down();
  await fixture.mouse.move(artwork.x + artwork.width / 2 + 30, artwork.y + artwork.height / 2 + 20, { steps: 5 });
  await fixture.mouse.up();
  await fixture.waitForFunction(before => window.fixtureArtwork[0].x !== before.x || window.fixtureArtwork[0].y !== before.y, artworkBefore);
  const movedArtwork = await fixture.evaluate(() => window.fixtureArtwork[0]);
  const resize = await fixture.getByRole('button', { name: /^Resize SE/ }).boundingBox();
  await fixture.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
  await fixture.mouse.down();
  await fixture.mouse.move(resize.x + 25, resize.y + 25, { steps: 5 });
  await fixture.mouse.up();
  await fixture.waitForFunction(before => window.fixtureArtwork[0].width !== before.width, movedArtwork);
  const rotate = await fixture.getByRole('button', { name: 'Rotate', exact: true }).boundingBox();
  await fixture.mouse.move(rotate.x + rotate.width / 2, rotate.y + rotate.height / 2);
  await fixture.mouse.down();
  await fixture.mouse.move(rotate.x + 40, rotate.y + 20, { steps: 5 });
  await fixture.mouse.up();
  await fixture.waitForFunction(() => window.fixtureArtwork[0].rotation !== 0);
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${output}/results.json`, JSON.stringify({ overlaps, contacts, connectedFraction, uncoveredPixels, editableParts: parts.map(part => part.id), generatedSleeveMoveResizeRotateReset: true, compatibleReplacementPreservesTransforms: true, constructionRoundTrip: true, legacyTransformsPreserved: true, independentArtworkTransforms: true, errors }, null, 2));
  console.log('Boxy Set-in hoodie: attached parts, editable structure, generated sleeve move/resize/rotate/reset and compatible swaps, colours, construction round trip, responsive rendering, legacy compatibility and independent artwork editing passed.');
} finally {
  await browser.close();
}