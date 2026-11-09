import assert from 'node:assert/strict';
import { createCanvas, Path2D } from '@napi-rs/canvas';
import { surfaceRuntime } from '../scripts/surface-test-runtime.mjs';

globalThis.Path2D = Path2D;
const { api } = await surfaceRuntime(`
  export { detectArtworkRegions, insertArtworkRegionLayers } from './src/app/lib/artworkFillRegions';
  export { createPenArtwork } from './src/app/lib/penArtwork';
  export { shapeWorldPath } from './src/app/lib/artworkPathOperations';
  export { shapePathData } from './src/app/lib/shapeGeometry';
`);
const { detectArtworkRegions, insertArtworkRegionLayers, createPenArtwork, shapeWorldPath, shapePathData } = api;
const path = (points, closed = false) => ({ nodes: points.map(([x,y]) => ({ x, y })), closed });
const ink = (points, closed = false) => createPenArtwork(path(points, closed), '#000000', 'front');
const outer = ink([[10,10],[210,10],[210,210],[10,210],[10,14]]);
const inner = ink([[70,70],[150,70],[150,150],[70,150],[70,74]]);
const context = createCanvas(240,240).getContext('2d');
const contains = (shape, x, y) => context.isPointInPath(new Path2D(shapePathData(shape)), x, y, 'evenodd');

const sketch = createPenArtwork({ ...shapeWorldPath(outer), subpaths:[shapeWorldPath(inner)] }, '#000000', 'front');
const nested = detectArtworkRegions([sketch]);
assert.equal(nested.length, 2);
assert(contains(nested[0], 110, 110));
assert(!contains(nested[1], 110, 110));
assert(contains(nested[1], 40, 110));
assert(!contains(nested[1], 2, 2));

const crossed = ink([[10,10],[210,210],[10,210],[210,10]], true);
const lobes = detectArtworkRegions([crossed]);
assert.equal(lobes.length, 2);
assert.equal(lobes.filter(shape => contains(shape, 100, 40)).length, 1);
assert.equal(lobes.filter(shape => contains(shape, 100, 185)).length, 1);
assert.equal(lobes.filter(shape => contains(shape, 35, 110)).length, 0);

assert.equal(detectArtworkRegions([ink([[10,10],[210,10],[210,210],[10,210]])]).length, 0);
const divider = ink([[110,10],[110,210]]);
const original = ink([[10,10],[210,10],[210,210],[10,210]], true);
const result = insertArtworkRegionLayers([original, divider], [original, divider]);
assert.equal(result.elements.length, 4);
assert.equal(result.firstId, result.elements[0].id);
assert.equal(result.elements[2], original);
assert.equal(result.elements[3], divider);
assert.notEqual(result.elements[0].shapeFillColor, result.elements[1].shapeFillColor);
assert(result.elements.slice(0,2).every(element => element.borderWidth === 0 && element.opacity === 100));
console.log('Passed: small gaps, nested regions, crossing strokes, open outlines, and editable layers.');
