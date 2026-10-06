import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

// In-memory bundling leaves no generated files or dependencies behind.
const bundle = await build({ entryPoints: ['src/app/lib/imageFilters.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { IMAGE_FILTERS, imageFilterControls, applyImageFilter } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`,
);
const expected = 'none bw high-contrast-bw grayscale vintage sepia washed faded film disposable polaroid cold warm muted vibrant dark soft dreamy retro y2k posterize duotone tritone threshold invert halftone comic photocopy newsprint pixelate glitch chromatic thermal emboss screen-print'.split(' ');
const fixture = (width, height, getPixel = (x, y) => [(x * 19 + y * 13) % 256, (x * 7 + y * 31) % 256, (x * 37 + y * 3) % 256, (x + y) % 9 === 0 ? 0 : (x + y) % 7 === 0 ? 96 : 255]) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(getPixel(x, y), (y * width + x) * 4);
  return data;
};
const filter = (data, width, height, id, options = {}) => applyImageFilter(data, width, height, { id, ...options });
const rgb = (data, width, x, y) => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 3)];
const mix = (source, full, intensity) => new Uint8ClampedArray(source.map((value, i) => i % 4 === 3 ? value : value + (full[i] - value) * intensity / 100));

test('catalog contains Original first and all 34 distinct, labeled filters', () => {
  assert.deepEqual(IMAGE_FILTERS.map(f => f.id), expected);
  assert.equal(new Set(IMAGE_FILTERS.map(f => f.label)).size, 35);
  assert.equal(IMAGE_FILTERS.find(f => f.id === 'bw').label, 'B&W');
});

test('all control descriptors are valid, isolated, and match omitted defaults', () => {
  const data = fixture(48, 36);
  for (const { id } of IMAGE_FILTERS) {
    const controls = imageFilterControls(id);
    assert.equal(new Set(controls.map(c => c.key)).size, controls.length);
    const defaults = {};
    for (const c of controls) {
      assert.ok(c.key && c.label);
      if (c.type === 'range') {
        assert.ok(c.min <= c.default && c.default <= c.max && c.step > 0);
      } else {
        assert.equal(c.type, 'color');
        assert.equal(c.label, { shadowColor: 'Shadow Colour', midtoneColor: 'Midtone Colour', highlightColor: 'Highlight Colour' }[c.key]);
        assert.match(c.default, /^#[\da-f]{6}$/i);
      }
      defaults[c.key] = c.default;
    }
    assert.deepEqual(filter(data, 48, 36, id, defaults), filter(data, 48, 36, id), id);
    if (controls.length) {
      controls[0].default = 'changed';
      assert.notEqual(imageFilterControls(id)[0].default, 'changed');
    }
  }
});

test('Film contrast preserves the original default and meaningfully changes tone', () => {
  assert.deepEqual(imageFilterControls('film').map(c => c.label), ['Grain', 'Fade', 'Contrast']);
  const contrast = imageFilterControls('film').find(c => c.key === 'contrast');
  assert.equal(contrast.default, 22);
  const source = new Uint8ClampedArray([32, 64, 96, 255, 128, 128, 128, 127, 180, 120, 60, 255, 255, 220, 180, 255]);
  const originalDefault = new Uint8ClampedArray([28, 63, 83, 255, 127, 129, 117, 127, 191, 131, 57, 255, 255, 236, 183, 255]);
  assert.deepEqual(filter(source, 4, 1, 'film'), originalDefault);
  assert.deepEqual(filter(source, 4, 1, 'film', { contrast: contrast.default }), originalDefault);
  const ramp = fixture(600, 1, x => { const v = x < 300 ? 70 : 180; return [v, v, v, 255]; });
  const low = filter(ramp, 600, 1, 'film', { contrast: 0, grain: 0, fade: 0 });
  const high = filter(ramp, 600, 1, 'film', { contrast: 100, grain: 0, fade: 0 });
  assert.ok(high[0] < low[0], 'Contrast must deepen shadows');
  assert.ok(high[300 * 4] > low[300 * 4], 'Contrast must brighten highlights');
});

test('requested screen-print and glitch control labels match the UI', () => {
  assert.equal(imageFilterControls('screen-print').find(c => c.key === 'colors').label, 'Number of Colours');
  assert.equal(imageFilterControls('glitch').find(c => c.key === 'amount').label, 'Amount');
});

test('every exposed effect control changes rendering, not just metadata', () => {
  const source = fixture(120, 90);
  for (const { id } of IMAGE_FILTERS) for (const control of imageFilterControls(id)) {
    const low = control.type === 'range' ? control.min : '#00ff00';
    const high = control.type === 'range' ? (control.key === 'angle' || control.key === 'direction' ? 45 : control.max) : '#ff00ff';
    assert.notDeepEqual(filter(source, 120, 90, id, { [control.key]: low }), filter(source, 120, 90, id, { [control.key]: high }), `${id}.${control.key}`);
  }
});

test('every effect is deterministic, non-destructive, nontrivial, and blends cached bytes exactly', () => {
  const width = 96, height = 72, source = fixture(width, height), before = source.slice();
  for (const { id } of IMAGE_FILTERS) {
    const settings = Object.freeze({ id, intensity: 100 });
    const full = applyImageFilter(source, width, height, settings);
    assert.ok(full instanceof Uint8ClampedArray);
    assert.notEqual(full, source);
    assert.deepEqual(source, before, `${id}: source changed`);
    assert.deepEqual(full, applyImageFilter(source, width, height, settings), `${id}: nondeterministic`);
    assert.deepEqual(filter(source, width, height, id, { intensity: 0 }), source);
    if (id !== 'none') assert.notDeepEqual(full, source, `${id}: no effect`);
    for (const intensity of [1, 25, 50, 77, 99]) {
      assert.deepEqual(filter(source, width, height, id, { intensity }), mix(source, full, intensity), `${id}: blend ${intensity}`);
    }
    for (let i = 0; i < source.length; i += 4) {
      assert.equal(full[i + 3], source[i + 3], `${id}: alpha changed`);
      if (source[i + 3] === 0) assert.deepEqual(full.slice(i, i + 4), source.slice(i, i + 4), `${id}: hidden RGB changed`);
    }
  }
});

test('invalid dimensions reject; empty, singleton, unknown IDs and nonfinite settings are safe', () => {
  for (const [width, height, length] of [[-1, 1, 4], [1.5, 1, 4], [1, Infinity, 4], [2, 2, 4], [NaN, 1, 4], [Number.MAX_SAFE_INTEGER, 2, 0]]) {
    assert.throws(() => filter(new Uint8ClampedArray(length), width, height, 'none'), RangeError);
  }
  const single = new Uint8ClampedArray([40, 100, 180, 90]);
  for (const { id } of IMAGE_FILTERS) {
    assert.equal(filter(new Uint8ClampedArray(), 0, 0, id).length, 0);
    const result = filter(single, 1, 1, id);
    assert.equal(result[3], 90);
    assert.deepEqual(filter(single, 1, 1, id, { intensity: NaN }), result);
    assert.deepEqual(filter(single, 1, 1, id, { intensity: -5 }), single);
    assert.deepEqual(filter(single, 1, 1, id, { intensity: 500 }), result);
    for (const c of imageFilterControls(id)) {
      if (c.type === 'range') {
        assert.deepEqual(filter(single, 1, 1, id, { [c.key]: Infinity }), result);
        assert.deepEqual(filter(single, 1, 1, id, { [c.key]: -1e9 }), filter(single, 1, 1, id, { [c.key]: c.min }));
        assert.deepEqual(filter(single, 1, 1, id, { [c.key]: 1e9 }), filter(single, 1, 1, id, { [c.key]: c.max }));
      } else assert.deepEqual(filter(single, 1, 1, id, { [c.key]: 'invalid' }), result);
    }
  }
  assert.deepEqual(filter(single, 1, 1, 'unrecognized'), single);
  assert.deepEqual(filter(single, 1, 1, 'none', { intensity: 53 }), single);
});

test('transparent RGB cannot leak into any visible filtered pixel', () => {
  const a = fixture(60, 45), b = a.slice();
  for (let i = 0; i < b.length; i += 4) if (!b[i + 3]) { b[i] = 255 - b[i]; b[i + 1] = 255 - b[i + 1]; b[i + 2] = 255 - b[i + 2]; }
  for (const { id } of IMAGE_FILTERS) {
    const fa = filter(a, 60, 45, id), fb = filter(b, 60, 45, id);
    for (let i = 0; i < a.length; i += 4) if (a[i + 3]) assert.deepEqual(fa.slice(i, i + 4), fb.slice(i, i + 4), id);
    const transparent = fixture(2, 2, () => [250, 40, 170, 0]);
    assert.deepEqual(filter(transparent, 2, 2, id), transparent);
  }
});

test('grayscale, threshold, inversion and posterization have known numerical outputs', () => {
  const data = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 127]);
  assert.deepEqual([...filter(data, 3, 1, 'grayscale')], [54, 54, 54, 255, 182, 182, 182, 255, 18, 18, 18, 127]);
  assert.deepEqual([...filter(data, 3, 1, 'threshold')], [0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 127]);
  assert.deepEqual([...filter(data, 3, 1, 'invert')], [0, 255, 255, 255, 255, 0, 255, 255, 255, 255, 0, 127]);
  const quantized = filter(new Uint8ClampedArray([30, 100, 200, 255]), 1, 1, 'posterize', { colors: 3 });
  assert.deepEqual([...quantized], [0, 128, 255, 255]);
});

test('duotone/tritone honor custom endpoints, midpoint and short hex colors', () => {
  const data = new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
  const options = { shadowColor: '#123', midtoneColor: '#ff0000', highlightColor: '#abcdef' };
  for (const id of ['duotone', 'tritone']) {
    const result = filter(data, 3, 1, id, options);
    assert.deepEqual(rgb(result, 3, 0, 0), [17, 34, 51]);
    assert.deepEqual(rgb(result, 3, 2, 0), [171, 205, 239]);
  }
  const middle = rgb(filter(data, 3, 1, 'tritone', options), 3, 1, 0);
  assert.ok(middle[0] >= 254 && middle[1] <= 1 && middle[2] <= 1);
});

test('pixelation averages whole blocks with alpha weights rather than sampling a corner', () => {
  const source = fixture(600, 2, (x, y) => x < 2 ? (x === 0 ? [255, 0, 0, 255] : [0, 0, 255, y === 0 ? 255 : 0]) : [0, 255, 0, 255]);
  const result = filter(source, 600, 2, 'pixelate', { pixelSize: 2 });
  assert.deepEqual(rgb(result, 600, 0, 0), [170, 0, 85]);
  assert.deepEqual(rgb(result, 600, 1, 0), [170, 0, 85]);
  assert.deepEqual(rgb(result, 600, 1, 1), [0, 0, 255]);
  const partial = fixture(600, 5, () => [42, 90, 130, 127]);
  assert.deepEqual(filter(partial, 600, 5, 'pixelate', { pixelSize: 7 }), partial);
});

test('screen-print produces at most the selected ink count and responds to contrast/detail', () => {
  const source = fixture(600, 8, (x, y) => { const v = (x * 7 + y * 13) % 256; return [v, v, v, 255]; });
  for (const colors of [2, 4, 8]) {
    const result = filter(source, 600, 8, 'screen-print', { colors });
    const unique = new Set();
    for (let i = 0; i < result.length; i += 4) unique.add([...result.slice(i, i + 3)].join(','));
    assert.ok(unique.size <= colors);
    assert.equal(unique.size, colors);
  }
  assert.notDeepEqual(filter(source, 600, 8, 'screen-print', { detail: 0 }), filter(source, 600, 8, 'screen-print', { detail: 100 }));
  assert.notDeepEqual(filter(source, 600, 8, 'screen-print', { contrast: 0 }), filter(source, 600, 8, 'screen-print', { contrast: 100 }));
});

test('halftone uses sampled cell tone, rotated dots and adjustable dot geometry', () => {
  const options = { spacing: 20, dotSize: 20, angle: 0, shadowColor: '#000', highlightColor: '#fff' };
  const gray = fixture(600, 60, () => [128, 128, 128, 255]);
  const dots = filter(gray, 600, 60, 'halftone', options);
  assert.deepEqual(rgb(dots, 600, 9, 9), [0, 0, 0]);
  assert.deepEqual(rgb(dots, 600, 0, 0), [255, 255, 255]);
  assert.deepEqual(rgb(dots, 600, 29, 9), [0, 0, 0]);
  assert.notDeepEqual(dots, filter(gray, 600, 60, 'halftone', { ...options, angle: 45 }));
  assert.notDeepEqual(dots, filter(gray, 600, 60, 'halftone', { ...options, dotSize: 8 }));
  assert.notDeepEqual(dots, filter(gray, 600, 60, 'halftone', { ...options, spacing: 30 }));
  const white = fixture(600, 20, () => [255, 255, 255, 255]);
  assert.deepEqual(filter(white, 600, 20, 'halftone', options), white);
  const darkCell = fixture(600, 20, (x, y) => x === 9 && y === 9 ? [255, 255, 255, 255] : [0, 0, 0, 255]);
  assert.deepEqual(rgb(filter(darkCell, 600, 20, 'halftone', options), 600, 9, 9), [0, 0, 0]);
});

test('chromatic separation is directional, bilinear and scales with longest edge', () => {
  for (const width of [96, 600, 1200]) {
    const source = fixture(width, 10, x => { const v = (x + 0.5) / width * 240; return [v, v, v, 255]; });
    const x = Math.floor(width / 2);
    const shifted = filter(source, width, 10, 'chromatic', { separation: 30, direction: 0 });
    const center = rgb(source, width, x, 5), result = rgb(shifted, width, x, 5);
    assert.ok(Math.abs(result[0] - center[0] - 12) <= 1);
    assert.equal(result[1], center[1]);
    assert.ok(Math.abs(result[2] - center[2] + 12) <= 1);
    assert.deepEqual(filter(source, width, 10, 'chromatic', { separation: 0 }), source);
    assert.deepEqual(filter(source, width, 10, 'chromatic', { separation: 30, direction: 90 }), source);
  }
  const vertical = fixture(20, 600, (_, y) => [y % 256, y % 256, y % 256, 255]);
  assert.deepEqual(rgb(filter(vertical, 20, 600, 'chromatic', { separation: 10, direction: 90 }), 20, 10, 120), [130, 120, 110]);
});

test('pixelate and halftone preserve reference-space pattern layouts at preview and full size', () => {
  const make = width => fixture(width, width / 2, x => { const v = x < width / 2 ? 70 : 180; return [v, v, v, 255]; });
  for (const id of ['pixelate', 'halftone']) {
    const preview = filter(make(96), 96, 48, id, { pixelSize: 50, dotSize: 50, spacing: 50, angle: 0 });
    const full = filter(make(600), 600, 300, id, { pixelSize: 50, dotSize: 50, spacing: 50, angle: 0 });
    let error = 0;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 96; x++) {
      const reference = rgb(full, 600, Math.floor((x + 0.5) * 6.25), Math.floor((y + 0.5) * 6.25))[0];
      error += Math.abs(rgb(preview, 96, x, y)[0] - reference);
    }
    assert.ok(error / (96 * 48) < (id === 'pixelate' ? 1 : 18), `${id}: normalized mean error ${error / (96 * 48)}`);
  }
});

test('comic edges and emboss convolution react to boundaries, not flat interiors', () => {
  const source = fixture(600, 20, x => x < 300 ? [70, 70, 70, 255] : [190, 190, 190, 255]);
  const comic = filter(source, 600, 20, 'comic', { detail: 100 });
  assert.ok(rgb(comic, 600, 299, 10)[0] < rgb(comic, 600, 200, 10)[0]);
  assert.notDeepEqual(comic, filter(source, 600, 20, 'comic', { detail: 0 }));
  const emboss = filter(source, 600, 20, 'emboss', { direction: 0 });
  assert.deepEqual(rgb(emboss, 600, 200, 10), [128, 128, 128]);
  assert.ok(rgb(emboss, 600, 299, 10)[0] > 128);
  assert.ok(rgb(filter(source, 600, 20, 'emboss', { direction: 180 }), 600, 299, 10)[0] < 128);
});

test('glitch displaces strips and textures honor seeds without global randomness', () => {
  const source = fixture(96, 96);
  for (const id of ['film', 'disposable', 'vintage', 'newsprint', 'glitch']) {
    const a = filter(source, 96, 96, id, { seed: 7 });
    assert.deepEqual(a, filter(source, 96, 96, id, { seed: 7 }));
    assert.notDeepEqual(a, filter(source, 96, 96, id, { seed: 19 }), id);
  }
  assert.deepEqual(filter(source, 96, 96, 'glitch', { amount: 0, separation: 0 }), source);
  assert.notDeepEqual(filter(source, 96, 96, 'glitch', { amount: 100, separation: 0 }), source);
});

test('all filters handle thin images and representative editing dimensions', () => {
  for (const [width, height] of [[1, 23], [23, 1]]) {
    const source = fixture(width, height);
    for (const { id } of IMAGE_FILTERS) assert.equal(filter(source, width, height, id).length, source.length);
  }
  const source = fixture(1600, 900);
  for (const id of ['halftone', 'pixelate', 'comic', 'emboss', 'glitch', 'chromatic', 'soft', 'screen-print']) {
    const result = filter(source, 1600, 900, id);
    assert.equal(result.length, source.length);
    assert.equal(result.at(-1), source.at(-1));
  }
});
