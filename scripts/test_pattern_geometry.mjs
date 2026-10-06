import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
async function load(entry) {
  const bundle = await build({ entryPoints: [entry], bundle: true, packages: 'external',
    format: 'cjs', platform: 'node', jsx: 'automatic', write: false });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, module, module.exports);
  return module.exports;
}
const [geometry, renderer, customArea, studio, controls, warp] = await Promise.all([
  load('src/app/lib/patternGeometry.ts'),
  load('src/app/components/builder/printsStudio/PatternGraphic.tsx'),
  load('src/app/components/builder/printsStudio/CustomAreaGraphic.tsx'),
  load('src/app/components/builder/printsStudio/StudioGraphic.tsx'),
  load('src/app/components/builder/printsStudio/PatternControls.tsx'),
  load('src/app/components/builder/printsStudio/WarpedArtwork.tsx'),
]);
const base = { id: 'test', type: 'pattern', content: 'checks', width: 160, height: 80, x: 0, y: 0, rotation: 0, color: '#ffffff' };
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
for (const content of ['stripes', 'stripes-h', 'diagonal', 'checks', 'dots']) {
  const current = { ...base, content };
  const original = geometry.patternGeometry(current);
  const scaled = geometry.patternGeometry({ ...current, patternScale: 200 });
  near(scaled.cell, original.cell * 2);
  near(scaled.thickness, original.thickness * 2);
  near(geometry.patternMetrics({ ...current, patternSpacing: 8 }).pitch, original.pitch + 8);
  near(geometry.patternMetrics({ ...current, patternRotation: 30 }).angle, original.angle + 30);
  assert(geometry.patternMetrics({ ...current, patternCount: 16 }).pitch < original.pitch);
  const area = geometry.patternGeometry({ ...current, type: 'customArea', customAreaPattern: content });
  assert.equal(area.kind, content);
  near(area.angle, original.angle);
}
near(geometry.patternMetrics({ ...base, content: 'diagonal' }).angle, 45);
near(geometry.patternMetrics({ ...base, content: 'diagonal', width: 800, height: 20 }).angle, 45);
near(geometry.patternMetrics({ ...base, content: 'stripes' }).defaultThickness, 160 / 5 * .45);
assert.equal(geometry.patternGeometry({ ...base, content: 'dots' }).dots.length, 1);
assert.equal(geometry.patternGeometry({ ...base, type: 'customArea', customAreaPattern: 'dots' }).dots[0].radius, 3);

const randomElement = { ...base, content: 'dots', patternRandomise: true, patternSeed: 123 };
const randomDots = geometry.patternGeometry(randomElement);
assert.equal(randomDots.dots.length, 64);
assert.deepEqual(randomDots, geometry.patternGeometry(randomElement), 'seed is deterministic');
assert.deepEqual(randomDots, geometry.patternGeometry({ ...randomElement, color: '#f00', opacity: 30, patternTarget: 'front' }), 'unrelated edits preserve distribution');
assert.notDeepEqual(randomDots.dots, geometry.patternGeometry({ ...randomElement, patternSeed: 124 }).dots);
assert(new Set(randomDots.dots.map(dot => dot.radius)).size > 50, 'natural size variation');
for (const [index, dot] of randomDots.dots.entries()) {
  const cellX = (index % 8) * randomDots.pitch;
  const cellY = Math.floor(index / 8) * randomDots.pitch;
  assert(dot.x - dot.radius >= cellX && dot.x + dot.radius <= cellX + randomDots.pitch);
  assert(dot.y - dot.radius >= cellY && dot.y + dot.radius <= cellY + randomDots.pitch);
  for (const other of randomDots.dots.slice(index + 1)) {
    const dx = Math.abs(dot.x - other.x), dy = Math.abs(dot.y - other.y);
    assert(Math.hypot(Math.min(dx, randomDots.tileSize - dx), Math.min(dy, randomDots.tileSize - dy)) >= dot.radius + other.radius,
      'dots must not overlap across periodic tile boundaries');
  }
}
const denser = geometry.patternGeometry({ ...randomElement, patternCount: 8 });
assert(denser.dots.length / denser.tileSize ** 2 > randomDots.dots.length / randomDots.tileSize ** 2);
for (const value of [NaN, Infinity, -Infinity, -100, 0, 1e9]) {
  const result = geometry.patternGeometry({ ...base, width: value, height: value, patternCount: value,
    patternScale: value, patternSpacing: value, patternRotation: value, patternThickness: value });
  for (const metric of ['width', 'height', 'count', 'cell', 'pitch', 'tileSize', 'angle', 'thickness']) assert(Number.isFinite(result[metric]));
  assert(result.tileSize > 0);
}

function render(element, Component = renderer.PatternGraphic) {
  return renderToStaticMarkup(createElement(Component, { element }));
}
async function pixels(svg) {
  const standalone = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace('width="100%"', 'width="160"').replace('height="100%"', 'height="80"');
  const { data, info } = await sharp(Buffer.from(standalone)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return (x, y) => data[(y * info.width + x) * info.channels + 3];
}
const checks = geometry.patternGeometry(base);
assert.equal(checks.rectangles[0].width, checks.pitch, 'zero spacing checks touch their cell boundaries');
assert.equal(checks.rectangles[1].x, checks.pitch);
const alpha = await pixels(render(base));
for (let y = 0; y < 80; y++) for (let x = 0; x < 160; x++) {
  assert.equal(alpha(x, y), (Math.floor(x / 20) + Math.floor(y / 20)) % 2 === 0 ? 255 : 0,
    `seam-free checkerboard pixel ${x},${y}`);
}
const spacedAlpha = await pixels(render({ ...base, patternSpacing: 8 }));
assert.equal(spacedAlpha(2, 10), 0);
assert.equal(spacedAlpha(10, 10), 255);
const diagonalAlpha = await pixels(render({ ...base, content: 'diagonal', patternThickness: 4 }));
for (let y = 3; y < 65; y++) for (let x = 3; x < 140; x++) {
  assert(Math.abs(diagonalAlpha(x, y) - diagonalAlpha(x + 12, y + 12)) <= 2, '45 degree lines are continuous across the full rectangle');
}
const dotAlpha = await pixels(render({ ...base, content: 'dots', patternThickness: 8 }));
for (let distance = 0; distance <= 8; distance++) {
  assert(Math.abs(dotAlpha(10 + distance, 10) - dotAlpha(10, 10 + distance)) <= 2, 'non-square artwork preserves circular dots');
}
assert(!render(base).includes('preserveAspectRatio="none"'));
assert(render(base, studio.StudioGraphic).includes('data-pattern="checks"'));
const areaMarkup = renderToStaticMarkup(createElement(customArea.CustomAreaGraphic, {
  element: { ...base, type: 'customArea', customAreaPattern: 'diagonal' },
  points: [{ x: 0, y: 0 }, { x: 160, y: 0 }, { x: 80, y: 80 }], selectedPoint: null, editing: false,
  onSelectPoint() {}, onPointPointerDown() {},
}));
assert(areaMarkup.includes('data-pattern="diagonal"') && areaMarkup.includes('clip-path='));

function flatten(element) {
  if (!element || typeof element !== 'object') return [];
  return [element, ...[element.props?.children].flat(Infinity).flatMap(flatten)];
}
let patch;
const controlTree = controls.PatternControls({ element: { ...base, content: 'dots' }, onChange: next => { patch = next; } });
const nodes = flatten(controlTree);
for (const content of ['diagonal', 'dots']) {
  const markup = renderToStaticMarkup(createElement(controls.PatternControls, { element: { ...base, content }, onChange() {} }));
  for (const label of ['Pattern amount', 'Pattern scale', 'Pattern spacing', 'Pattern rotation', 'Pattern opacity',
    content === 'dots' ? 'Randomise dots' : 'Line thickness']) {
    assert(markup.includes(`aria-label="${label}"`), `${content}: explicit ${label} accessible label`);
  }
}
for (const [label, field, value] of [
  ['Dot density', 'patternCount', 12], ['Pattern scale', 'patternScale', 175], ['Pattern spacing', 'patternSpacing', 8],
  ['Pattern rotation', 'patternRotation', 35], ['Dot size', 'patternThickness', 3], ['Pattern opacity', 'opacity', 40],
]) {
  nodes.find(node => node.props?.label === label).props.onChange(value);
  assert.deepEqual(patch, { [field]: value });
}
nodes.find(node => node.props?.mainLabel === 'Pattern colour').props.onChange('#123456');
assert.deepEqual(patch, { color: '#123456' });
nodes.find(node => node.props?.['aria-label'] === 'Randomise dots').props.onCheckedChange(true);
assert.equal(patch.patternRandomise, true);
assert(Number.isInteger(patch.patternSeed));
const persistedSeed = patch.patternSeed;
const enabledNodes = flatten(controls.PatternControls({ element: { ...base, content: 'dots', patternSeed: persistedSeed }, onChange: next => { patch = next; } }));
enabledNodes.find(node => node.props?.['aria-label'] === 'Randomise dots').props.onCheckedChange(true);
assert.deepEqual(patch, { patternRandomise: true }, 'enabling again preserves saved seed');
for (const [field, value] of Object.entries({ patternCount: 8, patternScale: 200, patternSpacing: 8,
  patternRotation: 30, patternThickness: 2, patternRandomise: true, patternSeed: 42, color: '#123456' })) {
  assert.notEqual(warp.sourceSignature(base), warp.sourceSignature({ ...base, [field]: value }), `${field} invalidates warped rendering`);
}
console.log('Passed: shared pattern rendering, uniform angles/circles, seam-free checks, seeded stratified dots, live controls, warp invalidation, and safe defaults.');
