import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/app/lib/customAreaGeometry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  write: false,
});
const geometry = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 80 }, { x: 0, y: 80 }];
const inserted = geometry.insertCustomAreaPoint(square, { x: 50, y: 8 });
assert.equal(inserted.length, 5);
assert(Math.abs(inserted[1].x - 50) < 0.001);
assert.equal(inserted[1].y, 0, 'Insertion projects onto the path rather than changing its shape');

const area = { x: 300, y: 200, width: 100, height: 80, rotation: 31 };
const expanded = geometry.rebaseCustomAreaGeometry([...square, { x: -20, y: 110 }], area);
const expandedArea = { ...area, ...expanded };
assert(expanded.width > area.width);
assert(expanded.height > area.height);
assert(expanded.points.every((point) => point.x >= 0 && point.x <= expanded.width && point.y >= 0 && point.y <= expanded.height));

function worldPoint(element, point) {
  const radians = element.rotation * Math.PI / 180;
  const dx = point.x - element.width / 2;
  const dy = point.y - element.height / 2;
  return {
    x: element.x + dx * Math.cos(radians) - dy * Math.sin(radians),
    y: element.y + dx * Math.sin(radians) + dy * Math.cos(radians),
  };
}

for (const [index, point] of square.entries()) {
  const before = worldPoint(area, point);
  const after = worldPoint(expandedArea, expanded.points[index]);
  assert(Math.abs(before.x - after.x) < 1e-8);
  assert(Math.abs(before.y - after.y) < 1e-8);
}

console.log('Passed: nearest-edge insertion and rotation-preserving custom-area rebasing.');