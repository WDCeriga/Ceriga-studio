import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({ entryPoints: ['src/app/lib/brushRemoval.ts'], bundle: true, write: false, format: 'iife', globalName: 'removal', platform: 'browser' });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const results = await page.evaluate(() => {
    const source = document.createElement('canvas'); source.width = source.height = 100;
    const ctx = source.getContext('2d', { willReadFrequently: true });
    const mask = new ImageData(200, 200);
    for (let y = 50; y < 150; y++) for (let x = 50; x < 100; x++) mask.data[(y * 200 + x) * 4 + 3] = 255;
    const render = (patch = {}, opacity = 1) => {
      ctx.clearRect(0, 0, 100, 100); ctx.fillStyle = '#cb2345'; ctx.fillRect(0, 0, 100, 100);
      const changed = removal.removeBrushMask(source, mask, { x: 100, y: 100, width: 100, height: 100, rotation: 0, ...patch }, 1, 1, opacity);
      const a = (x, y) => ctx.getImageData(x, y, 1, 1).data[3];
      return { changed, left: a(10, 50), right: a(90, 50), top: a(50, 10), bottom: a(50, 90), color: [...ctx.getImageData(90, 50, 1, 1).data].slice(0, 3) };
    };
    return { normal: render(), flipped: render({ flipHorizontal: true }), rotated: render({ rotation: 90 }), faded: render({}, .5), zero: render({}, 0), crop: render({ cropLeft: 50 }), outside: render({ x: 500 }) };
  });
  assert.equal(results.normal.left, 0); assert.equal(results.normal.right, 255);
  assert.deepEqual(results.normal.color, [203, 35, 69]);
  assert.equal(results.flipped.left, 255); assert.equal(results.flipped.right, 0);
  assert.equal(results.rotated.top, 255); assert.equal(results.rotated.bottom, 0);
  assert.equal(results.faded.left, 128); assert.equal(results.zero.changed, false);
  assert.equal(results.crop.changed, false); assert.equal(results.outside.changed, false);
  console.log('Brush removal: alpha-only clipping, transformed placement, opacity and crop passed.');
} finally { await browser.close(); }
