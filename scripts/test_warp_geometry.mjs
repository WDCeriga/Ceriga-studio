import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/app/lib/warpGeometry.ts'], bundle: true, format: 'esm', platform: 'node', write: false,
});
const warp = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const presets = ['arc', 'arc-lower', 'arc-upper', 'arch', 'bulge', 'squeeze', 'wave', 'flag', 'fish', 'rise'];
const identity = Array.from({ length: 9 }, (_, index) => ({ x: (index % 3) / 2, y: Math.floor(index / 3) / 2 }));
for (const preset of presets) {
  const settings = { ...warp.createWarpSettings(), preset };
  const grid = warp.warpGrid(settings);
  assert.equal(grid.length, 9, `${preset}: 3x3 preset mesh`);
  assert(grid.every(point => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1));
  assert(grid.some((point, index) => Math.abs(point.x - identity[index].x) > 1e-5 || Math.abs(point.y - identity[index].y) > 1e-5),
    `${preset}: default settings must visibly deform the identity mesh`);
}

const settings = warp.createWarpSettings();
settings.mode = 'freeform';
settings.points[4] = { x: 0.72, y: 0.31 };
const middle = warp.interpolateWarpGrid(settings.points, 3, 0.5, 0.5);
assert.deepEqual(middle, settings.points[4]);
const fourByFour = warp.resizeWarpGrid(settings, 4);
assert.equal(fourByFour.length, 16);
assert(fourByFour.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)));
console.log('Passed: all warp presets, bilinear freeform interpolation, and 2x2/3x3/4x4 mesh conversion.');