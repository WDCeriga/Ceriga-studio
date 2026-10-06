import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5189'}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  for (let step = 0; step < 10 && !await page.getByRole('button', { name: 'Continue to Review', exact: true }).isVisible(); step++) {
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  }
  await page.getByRole('button', { name: 'Continue to Review', exact: true }).waitFor();
  const zone = page.locator('[data-print-design-zone]');
  const sendDrag = async (type, x, y, id = 'diagonal') => zone.evaluate((node, args) => {
    const box = node.getBoundingClientRect();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('application/x-ceriga-asset', JSON.stringify({ kind: 'pattern', id: args.id }));
    dataTransfer.setData('application/x-ceriga-pattern', args.id);
    node.dispatchEvent(new DragEvent(args.type, { bubbles: true, cancelable: true, dataTransfer,
      clientX: box.x + args.x * box.width, clientY: box.y + args.y * box.height }));
  }, { type, x, y, id });
  await page.waitForFunction(() => document.querySelectorAll('[data-print-garment-preview] [data-layer-id] svg').length >= 6);
  const candidates = await zone.evaluate(async node => {
    const positions = {};
    const samples = [];
    const box = node.getBoundingClientRect();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('application/x-ceriga-asset', JSON.stringify({ kind: 'pattern', id: 'diagonal' }));
    dataTransfer.setData('application/x-ceriga-pattern', 'diagonal');
    // Scan the visible garment, including narrow cuffs and the hem, using the public drag behavior.
    for (let y = .0125; y < 1; y += .025) for (let x = .0125; x < 1; x += .025) {
      node.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer,
        clientX: box.x + x * box.width, clientY: box.y + y * box.height }));
      await new Promise(resolve => requestAnimationFrame(resolve));
      const target = node.querySelector('[data-pattern-drop-target]')?.getAttribute('data-pattern-drop-target');
      samples.push({ target, x, y });
    }
    for (const sample of samples) {
      if (!sample.target) continue;
      const clearance = Math.min(...samples.filter(other => other.target !== sample.target)
        .map(other => Math.hypot(other.x - sample.x, other.y - sample.y)));
      if (!positions[sample.target] || clearance > positions[sample.target].clearance) {
        positions[sample.target] = { x: sample.x, y: sample.y, clearance };
      }
    }
    return positions;
  });
  for (const id of ['base', 'sleeveLeft', 'sleeveRight', 'sleeveHemLeft', 'sleeveHemRight']) {
    assert(candidates[id], `Missing visible drop target ${id}; found ${Object.keys(candidates)}`);
  }
  assert(Object.keys(candidates).length >= 7, `Expected body, sleeves, cuffs, collar and hem: ${Object.keys(candidates)}`);
  for (const [id, point] of Object.entries(candidates)) {
    await sendDrag('dragover', point.x, point.y);
    assert.equal(await page.locator('[data-pattern-drop-target]').getAttribute('data-pattern-drop-target'), id);
    await sendDrag('drop', point.x, point.y);
    const fill = page.locator(`[data-pattern-clip="${id}"]`);
    await fill.waitFor();
    assert(await fill.evaluate(node => getComputedStyle(node).maskImage.startsWith('url(')), `${id} must be clipped`);
    assert(await fill.locator('svg').count() > 0);
  }
  const count = await page.locator('[data-pattern-clip]').count();
  await sendDrag('drop', .001, .001);
  assert.equal(await page.locator('[data-pattern-clip]').count(), count, 'Outside drops must not add artwork');
  // The builder records selection separately from artwork changes.
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.waitForFunction(expected => document.querySelectorAll('[data-pattern-clip]').length === expected, count - 1);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.waitForFunction(expected => document.querySelectorAll('[data-pattern-clip]').length === expected, count);
  await page.getByRole('button', { name: /^back$/i }).last().click();
  assert.equal(await page.locator('[data-pattern-clip]').count(), 0);
  await page.getByRole('button', { name: /^front$/i }).last().click();
  await page.waitForFunction(expected => document.querySelectorAll('[data-pattern-clip]').length === expected, count);
  await page.getByRole('button', { name: 'Patterns', exact: true }).click();
  const body = candidates.base;
  const box = await zone.boundingBox();
  await page.getByRole('button', { name: 'Dots', exact: true }).dragTo(zone, { targetPosition: { x: box.width * body.x, y: box.height * body.y } });
  await page.locator('[data-pattern-clip="base"] svg[data-pattern="dots"]').waitFor();
  const dotsFill = page.locator('[data-pattern-clip="base"]').last();
  const initialBounds = await dotsFill.boundingBox();
  const initialMask = await dotsFill.evaluate(node => node.style.maskImage);
  const setRange = async (label, value) => {
    const control = page.getByRole('slider', { name: label, exact: true });
    await control.evaluate((input, next) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(next));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await page.waitForFunction(({ label, value }) => document.querySelector(`input[aria-label="${label}"]`)?.value === String(value), { label, value });
  };
  await page.getByRole('switch', { name: 'Randomise dots', exact: true }).click();
  const dotPositions = () => dotsFill.locator('circle').evaluateAll(nodes => nodes.map(node => [node.getAttribute('cx'), node.getAttribute('cy')]));
  const randomPositions = await dotPositions();
  assert(randomPositions.length > 4);
  assert(new Set(randomPositions.map(point => point[0])).size > 8, 'Random dots must not stay in grid columns');
  for (const axis of ['horizontally', 'vertically']) {
    await page.locator('[data-pattern-controls]').getByRole('button', { name: `Flip ${axis}` }).click();
    assert.deepEqual(await dotsFill.boundingBox(), initialBounds, 'Flips must leave garment-part bounds fixed');
    assert.equal(await dotsFill.evaluate(node => node.style.maskImage), initialMask, 'Flips must not mirror the garment mask');
    assert.deepEqual(await dotPositions(), randomPositions, 'Flips must not reshuffle seeded dots');
  }
  assert.equal(await dotsFill.locator('svg[data-pattern]').evaluate(node => node.style.transform), 'scale(-1, -1)');
  await setRange('Pattern opacity', 65);
  assert.deepEqual(await dotPositions(), randomPositions, 'Opacity edits must not reshuffle dots');
  await setRange('Pattern amount', 12);
  await setRange('Pattern scale', 125);
  await setRange('Pattern spacing', 9);
  await setRange('Pattern rotation', 27);
  assert.deepEqual(await dotsFill.boundingBox(), initialBounds, 'Pattern edits must leave section bounds fixed');
  assert.equal(await dotsFill.evaluate(node => node.style.maskImage), initialMask, 'Pattern edits must not rotate or resize the clipping boundary');

  await page.getByRole('button', { name: 'Shapes and lines', exact: true }).click();
  await page.getByRole('button', { name: 'Custom Area', exact: true }).click();
  const areaBox = await zone.boundingBox();
  const points = [[body.x - .04, body.y - .04], [body.x + .04, body.y - .04], [body.x, body.y + .04]];
  for (let i = 0; i < points.length; i++) {
    await page.mouse.click(areaBox.x + points[i][0] * areaBox.width, areaBox.y + points[i][1] * areaBox.height);
    await page.locator(`svg[aria-label="Custom Area in progress"] circle:nth-of-type(${i + 1})`).waitFor();
  }
  await page.mouse.click(areaBox.x + points[0][0] * areaBox.width, areaBox.y + points[0][1] * areaBox.height);
  await page.locator('[data-custom-area-svg]').waitFor();
  const area = page.locator('[data-custom-area-svg]');
  const polygonPath = await area.locator('clipPath path').getAttribute('d');
  await page.getByLabel('Point Type', { exact: true }).selectOption('smooth');
  const anchorPoints = await area.locator('clipPath path').getAttribute('d');
  assert(anchorPoints.includes(' C '));
  const changedRegion = await area.evaluate((svg, original) => {
    const curve = new Path2D(svg.querySelector('clipPath path').getAttribute('d'));
    const polygon = new Path2D(original);
    const context = document.createElement('canvas').getContext('2d');
    const { width, height } = svg.viewBox.baseVal;
    const matrix = svg.querySelector('[data-custom-area-transform]').getScreenCTM();
    const frame = svg.closest('[data-print-design-zone]').getBoundingClientRect();
    for (let y = 2; y < height - 2; y += 1) for (let x = 2; x < width - 2; x += 1) {
      const inside = context.isPointInPath(curve, x, y);
      if (inside === context.isPointInPath(polygon, x, y)) continue;
      const p = new DOMPoint(x, y).matrixTransform(matrix);
      return { x: (p.x - frame.x) / frame.width, y: (p.y - frame.y) / frame.height, inside };
    }
    return null;
  }, polygonPath);
  assert(changedRegion, 'Smooth conversion must create a region differing from the original polygon');
  await sendDrag('dragover', changedRegion.x, changedRegion.y);
  const curvedAreaId = await area.locator('xpath=ancestor::*[@data-print-id]').getAttribute('data-print-id');
  assert.equal(await page.locator('[data-pattern-drop-target]').getAttribute('data-pattern-drop-target') === curvedAreaId, changedRegion.inside,
    'Drop targeting follows the cubic curve rather than the original polygon');
  await page.getByRole('button', { name: 'Patterns', exact: true }).click();
  await sendDrag('dragover', body.x, body.y);
  const areaId = await area.locator('xpath=ancestor::*[@data-print-id]').getAttribute('data-print-id');
  assert.equal(await page.locator('[data-pattern-drop-target]').getAttribute('data-pattern-drop-target'), areaId);
  await sendDrag('drop', body.x, body.y, 'diagonal');
  await area.locator('svg[data-pattern="diagonal"]').waitFor();
  assert.equal(await area.locator('clipPath path').getAttribute('d'), anchorPoints);
  assert(await area.locator('g[clip-path]').count() > 0, 'Custom Area pattern must remain inside cubic clipping');
  await setRange('Pattern rotation', 63);
  await setRange('Line thickness', 2);
  await setRange('Pattern spacing', 6);
  assert.equal(await area.locator('clipPath path').getAttribute('d'), anchorPoints);
  const masks = await page.locator('[data-pattern-clip]').evaluateAll(async nodes => {
    const unique = new Map();
    for (const node of nodes) {
      const wrapper = decodeURIComponent(node.style.maskImage.slice(5, -2).split(',').slice(1).join(','));
      const document = new DOMParser().parseFromString(wrapper, 'image/svg+xml');
      const image = new Image();
      image.src = document.querySelector('image').getAttribute('href');
      await image.decode();
      const canvas = window.document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
      unique.set(node.dataset.patternClip, context.getImageData(0, 0, image.width, image.height).data);
    }
    const entries = [...unique];
    let overlaps = 0;
    for (let a = 0; a < entries.length; a++) for (let b = a + 1; b < entries.length; b++) {
      for (let index = 3; index < entries[a][1].length; index += 4) {
        if (entries[a][1][index] > 128 && entries[b][1][index] > 128) overlaps++;
      }
    }
    return { count: unique.size, overlaps };
  });
  assert.equal(masks.count, 8);
  assert.equal(masks.overlaps, 0, 'Visible part masks must not paint into adjacent or overlapping garment sections');
  const saved = await zone.evaluate(node => {
    let fiber = node[Object.keys(node).find(key => key.startsWith('__reactFiber$'))];
    while (fiber && !Array.isArray(fiber.memoizedProps?.elements)) fiber = fiber.return;
    return JSON.parse(JSON.stringify(fiber.memoizedProps.elements));
  });
  assert(saved.some(element => element.patternTarget === 'base' && element.patternRandomise && element.patternRotation === 27
    && element.patternScale === 125 && element.patternCount === 12 && element.patternSpacing === 9 && element.opacity === 65 && Number.isFinite(element.patternSeed)),
    'Editable pattern parameters and target association must survive design-state JSON serialization');
  assert(saved.some(element => element.type === 'customArea' && element.customAreaPattern === 'diagonal' && element.patternRotation === 63));
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.waitForFunction(() => document.querySelectorAll('[data-pattern-clip]').length === 9);
  await sendDrag('dragover', body.x, body.y);
  assert(await page.locator('[data-pattern-drop-target]').count() > 0, 'Hover must survive preview resizing');
  assert.deepEqual(errors, []);
  console.log('Passed: eight section fills and disjoint masks, real panel drag/drop, seeded dots, live controls, fixed clipping boundaries, Custom Area drops/anchors, undo/redo, side isolation, resize and JSON persistence.');
} finally { await browser.close(); }
