import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/app/lib/drawingBrush.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const { createBrushStabilizer, smoothBrushPoints } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`
);
const origin = { x: 0, y: 0, p: 0.5, tilt: 0 };
const slowCurve = Array.from({ length: 180 }, (_, index) => ({
  x: index * 1.5,
  y: 35 * Math.sin(index / 65) + (index % 2 ? 3 : -3),
  p: 0.2 + index / 300,
  tilt: index / 200,
}));
function trace(points, strength, interval = 120, scale = 1) {
  const stabilize = createBrushStabilizer(points[0], 0, scale);
  return points.map((point, index) => stabilize(point, strength, index * interval));
}
function roughness(points) {
  return points.slice(2).reduce((total, point, index) => total + Math.abs(
    point.y - 2 * points[index + 1].y + points[index].y,
  ), 0);
}

test('zero strength preserves every raw coordinate, pressure and tilt', () => {
  assert.deepEqual(trace(slowCurve, 0), slowCurve);
});

test('slow shaky curves get progressively cleaner during input', () => {
  const levels = [0, 0.25, 0.5, 1].map(strength => roughness(trace(slowCurve, strength)));
  for (let index = 1; index < levels.length; index++) assert.ok(levels[index] < levels[index - 1]);
  assert.ok(levels[3] < levels[0] * 0.1);
  const strong = trace(slowCurve, 1);
  for (const point of strong.slice(20)) {
    assert.ok(Math.abs(point.y - 35 * Math.sin(point.x / 97.5)) < 9);
  }
});

test('higher strength trails further behind the pointer', () => {
  const line = Array.from({ length: 200 }, (_, index) => ({ ...origin, x: index * 2 }));
  const lag = [0, 0.25, 0.5, 1].map(strength => line.at(-1).x - trace(line, strength, 16).at(-1).x);
  assert.equal(lag[0], 0);
  for (let index = 1; index < lag.length; index++) assert.ok(lag[index] > lag[index - 1]);
  assert.ok(lag[3] > 30);
});

test('tiny slow movements are absorbed even across long event gaps', () => {
  const stabilize = createBrushStabilizer(origin, 0);
  for (let index = 1; index <= 20; index++) {
    const point = stabilize({ ...origin, x: index % 2 ? 3 : -3, y: 2 }, 1, index * 300);
    assert.equal(point.x, 0);
    assert.equal(point.y, 0);
  }
});

test('stabilisation scales with canvas pixel density and resets per stroke', () => {
  const normal = trace(slowCurve, 0.7);
  const doubled = trace(slowCurve.map(point => ({ ...point, x: point.x * 2, y: point.y * 2 })), 0.7, 120, 2);
  doubled.forEach((point, index) => {
    assert.ok(Math.abs(point.x / 2 - normal[index].x) < 1e-8);
    assert.ok(Math.abs(point.y / 2 - normal[index].y) < 1e-8);
  });
  const stabilize = createBrushStabilizer(slowCurve[50], 50);
  assert.deepEqual(stabilize(slowCurve[50], 1, 50), slowCurve[50]);
});

test('post-stroke smoothing is independent and does not mutate live points', () => {
  const live = trace(slowCurve, 0.5);
  const snapshot = structuredClone(live);
  assert.equal(smoothBrushPoints(live, 0, 1), live);
  const finished = smoothBrushPoints(live, 80, 1);
  assert.deepEqual(live, snapshot);
  assert.notDeepEqual(finished, live);
  assert.deepEqual(finished[0], live[0]);
  assert.deepEqual(finished.at(-1), live.at(-1));
});