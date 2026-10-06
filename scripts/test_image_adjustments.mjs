import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/app/lib/imageAdjustments.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { DEFAULT_IMAGE_ADJUSTMENTS, IMAGE_ADJUSTMENTS, imageAdjustmentValues, imageAdjustmentFilter, highlightMaskTable, imageTextureSeed, snapImageRotation } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`,
);

test('neutral settings bypass all filters and reset legacy values', () => {
  assert.equal(imageAdjustmentFilter({ id: 'photo' }), undefined);
  assert.equal(imageAdjustmentFilter({ id: 'photo', ...DEFAULT_IMAGE_ADJUSTMENTS }), undefined);
  assert.equal(imageAdjustmentFilter({ id: 'photo', filterBlur: 60, filterExposure: 1, ...DEFAULT_IMAGE_ADJUSTMENTS }), undefined);
});

test('image blur increases continuously without adding shadow effects', () => {
  assert.equal(imageAdjustmentFilter({ filterBlur: 0 }), undefined);
  assert.equal(imageAdjustmentFilter({ filterBlur: 25 }), 'blur(0.5px)');
  assert.equal(imageAdjustmentFilter({ filterBlur: 50 }), 'blur(2px)');
  assert.equal(imageAdjustmentFilter({ filterBlur: 100 }), 'blur(8px)');
});

test('every adjustment has bounded neutral defaults and invalid input is safe', () => {
  for (const setting of IMAGE_ADJUSTMENTS) {
    assert.ok(setting.min <= setting.default && setting.default <= setting.max);
    assert.equal(imageAdjustmentValues({ [setting.key]: Infinity })[setting.key], setting.default);
    assert.equal(imageAdjustmentValues({ [setting.key]: -9999 })[setting.key], setting.min);
    assert.equal(imageAdjustmentValues({ [setting.key]: 9999 })[setting.key], setting.max);
  }
});

test('advanced filters combine with blur without modifying source data', () => {
  const element = { id: 'photo', content: 'data:image/png;original', filterHue: 90, filterBlur: 25 };
  const snapshot = structuredClone(element);
  assert.equal(imageAdjustmentFilter(element), 'url(#adjust-photo) blur(0.5px)');
  assert.deepEqual(element, snapshot);
  assert.equal(imageAdjustmentFilter(JSON.parse(JSON.stringify(element))), imageAdjustmentFilter(element));
});

test('highlight mask protects shadows and ramps smoothly through lighter areas', () => {
  const mask = highlightMaskTable().split(' ').map(Number);
  assert.equal(mask[0], 0);
  assert.equal(mask[12], 0);
  assert.ok(mask[24] > 0 && mask[24] < 1);
  assert.equal(mask[32], 1);
  for (let index = 1; index < mask.length; index++) assert.ok(mask[index] >= mask[index - 1]);
});

test('noise and grain seeds stay deterministic per layer', () => {
  assert.equal(imageTextureSeed('photo'), imageTextureSeed('photo'));
  assert.notEqual(imageTextureSeed('photo'), imageTextureSeed('copy'));
});

test('upright snap wraps at zero and leaves all other angles free', () => {
  for (const angle of [0, 1, -1, 3, -3, 357, 359, 360, 361, -361, 720]) assert.equal(snapImageRotation(angle), 0);
  for (const angle of [3.1, 45.2, 89, 90, 179, 180, 270.7, 356.9]) assert.ok(Math.abs(snapImageRotation(angle) - angle) < 1e-10);
  assert.equal(snapImageRotation(-45), 315);
});