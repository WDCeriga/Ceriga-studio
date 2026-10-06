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
const [catalog, engine, renderer, legacy] = await Promise.all([
  load('src/app/lib/patternCatalog.ts'), load('src/app/lib/generatedPatterns.ts'),
  load('src/app/components/builder/printsStudio/PatternGraphic.tsx'), load('src/app/lib/patternGeometry.ts'),
]);
const source = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="#ff0000"/><path d="M0 0 H40 V40Z" fill="#0000ff"/></svg>').toString('base64')}`;
const base = { type: 'pattern', content: 'grid', width: 512, height: 512, patternCount: 16, color: '#1b293c', patternSource: source, patternSourceWidth: 80, patternSourceHeight: 40 };
const expected = 'pinstripes grid diamonds triangles honeycomb crosses stars waves chevron spiral concentric sunburst halftone tartan houndstooth argyle camo digital-camo cow leopard zebra snake flames lightning barbed-wire chain tribal graffiti topographic organic-blob cracked distressed noise grain dither pixel-grid custom'.split(' ');
const near = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
assert.equal(catalog.PATTERN_CATALOG.length, 42);
assert.equal(new Set(catalog.PATTERN_CATALOG.map(item => item.id)).size, 42);
assert.deepEqual(catalog.PATTERN_CATALOG.filter(item => item.category !== 'Classic').map(item => item.id), expected);
assert.equal(catalog.patternDefinition('missing'), undefined);
const fresh = catalog.patternDefaultColors('camo'); fresh[0] = '#000';
assert.notEqual(catalog.patternDefaultColors('camo')[0], '#000');

function render(settings) {
  return renderToStaticMarkup(createElement(renderer.PatternGraphic, { element: settings }));
}
async function raster(settings) {
  const svg = render(settings).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace('width="100%"', `width="${settings.width}"`).replace('height="100%"', `height="${settings.height}"`);
  return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}
const signatures = new Set();
for (const content of expected) {
  const settings = { ...base, content };
  const geometry = engine.generatedPatternGeometry(settings);
  assert(geometry.motifs.length > 0, `${content}: empty geometry`);
  assert.deepEqual(geometry, engine.generatedPatternGeometry(settings), `${content}: nondeterministic`);
  assert.equal(geometry.colors[0], base.color);
  assert.deepEqual(engine.generatedPatternGeometry({ ...settings, patternRandomise: true }), geometry, 'legacy dots toggle must not affect new kinds');
  assert.equal(engine.generatedPatternGeometry({ ...settings, type: 'customArea', customAreaPattern: content }).kind, content);
  const primitives = geometry.motifs.flatMap(motif => motif.primitives);
  assert(primitives.length <= 1024, `${content}: unbounded primitives`);
  assert(geometry.replicas.length <= 512, `${content}: unbounded replicas`);
  assert(!/NaN|Infinity|undefined/.test(JSON.stringify(geometry)));
  for (const primitive of primitives) {
    if (typeof primitive.fill === 'number') assert(primitive.fill < geometry.colors.length);
    if (primitive.stroke !== undefined) assert(primitive.stroke < geometry.colors.length);
  }
  if (catalog.patternDefinition(content).randomise && content !== 'custom') {
    assert.notDeepEqual(geometry.motifs, engine.generatedPatternGeometry({ ...settings, patternSeed: 24 }).motifs, `${content}: seed does not vary elements`);
    assert.notDeepEqual(geometry.motifs, engine.generatedPatternGeometry({ ...settings, patternVariation: 0 }).motifs, `${content}: variation ignored`);
  }
  if (catalog.patternDefinition(content).roughness) {
    assert.notDeepEqual(geometry.motifs, engine.generatedPatternGeometry({ ...settings, patternRoughness: 0 }).motifs, `${content}: roughness ignored`);
  }
  if (catalog.patternDefinition(content).thickness) {
    assert.notDeepEqual(geometry.motifs, engine.generatedPatternGeometry({ ...settings, patternThickness: 8 }).motifs, `${content}: thickness ignored`);
  }
  const spaced = engine.generatedPatternGeometry({ ...settings, patternSpacingX: 10, patternSpacingY: 20 });
  const columns = geometry.tileWidth / 32;
  near(spaced.tileWidth, geometry.tileWidth + columns * 10);
  near(spaced.tileHeight, geometry.tileHeight + columns * 20);
  assert.deepEqual(engine.generatedPatternGeometry({ ...settings, patternSpacing: 8 }),
    engine.generatedPatternGeometry({ ...settings, patternSpacingX: 8, patternSpacingY: 8 }), 'old spacing fallback');
  const scaled = engine.generatedPatternGeometry({ ...settings, patternScale: 200 });
  near(scaled.tileWidth, geometry.tileWidth * 2);
  near(engine.generatedPatternGeometry({ ...settings, patternCount: 8 }).tileWidth, geometry.tileWidth * 2);
  near(engine.generatedPatternGeometry({ ...settings, patternRotation: 40 }).angle, 40);
  const { data, info } = await raster(settings);
  assert(data.some((value, index) => index % 4 === 3 && value > 0), `${content}: blank SVG`);
  const fingerprint = Buffer.from(data).toString('base64');
  assert(!signatures.has(fingerprint), `${content}: duplicated visual`); signatures.add(fingerprint);
  // Pixel-equivalent periods prove paths/images and their boundary replicas survive SVG rendering.
  const dx = Math.round(geometry.tileWidth), dy = Math.round(geometry.tileHeight);
  for (let y = 0; y < info.height - dy; y += 7) for (let x = 0; x < info.width - dx; x += 7) {
    for (let channel = 0; channel < 4; channel++) {
      const value = data[(y * info.width + x) * 4 + channel];
      assert(Math.abs(value - data[(y * info.width + x + dx) * 4 + channel]) <= 2, `${content}: horizontal periodicity`);
      assert(Math.abs(value - data[((y + dy) * info.width + x) * 4 + channel]) <= 2, `${content}: vertical periodicity`);
    }
  }
}

const motif = { id: 0, x: 0, y: 0, radius: 3, scaleX: 1, scaleY: 1, rotation: 0, primitives: [] };
assert.deepEqual(engine.periodicReplicas([motif], 10, 20), [
  { motif: 0, dx: 0, dy: 0 }, { motif: 0, dx: 10, dy: 0 },
  { motif: 0, dx: 0, dy: 20 }, { motif: 0, dx: 10, dy: 20 },
], 'corner-crossing motifs have four periodic replicas');
assert.equal(engine.periodicReplicas([{ ...motif, radius: 22 }], 10, 20).length, 24, 'oversized motifs wrap through multiple periods');

for (const repeat of ['grid', 'brick', 'half-drop', 'mirror', 'random']) {
  const settings = { ...base, content: 'custom', patternRepeat: repeat };
  const g = engine.generatedPatternGeometry(settings);
  const byId = id => g.motifs[id];
  const rotated = engine.generatedPatternGeometry({ ...settings, patternRotation: 37 });
  near(rotated.angle, 37);
  assert.deepEqual(rotated.motifs, g.motifs, 'global rotation preserves per-image seeded transforms');
  const rotatedMarkup = render({ ...settings, patternRotation: 37 });
  assert(rotatedMarkup.includes('patternTransform="rotate(37)"'));
  assert(rotatedMarkup.includes(`rotate(${byId(0).rotation}) scale(`), 'per-image rotation composes with global rotation');
  const spaced = engine.generatedPatternGeometry({ ...settings, patternSpacingX: 12, patternSpacingY: 7 });
  near(spaced.tileWidth / g.tileWidth, 44 / 32);
  near(spaced.tileHeight / g.tileHeight, 39 / 32);
  assert.deepEqual(spaced.motifs.map(item => [item.scaleX, item.scaleY]), g.motifs.map(item => [item.scaleX, item.scaleY]), 'XY gaps do not resize source images');
  assert.equal(byId(0).primitives[0].href, source, 'source image is never rewritten');
  near(byId(0).primitives[0].width / byId(0).primitives[0].height, 2);
  assert.deepEqual(g, engine.generatedPatternGeometry(settings));
  if (repeat === 'grid') { near(byId(0).x, byId(2).x); near(byId(0).y, byId(1).y); }
  if (repeat === 'brick') near(byId(2).x - byId(0).x, 16);
  if (repeat === 'half-drop') near(byId(1).y - byId(0).y, 16);
  if (repeat === 'mirror') { assert(byId(1).scaleX < 0); assert(byId(2).scaleY < 0); assert(byId(3).scaleX < 0 && byId(3).scaleY < 0); }
  if (repeat === 'random') {
    assert.notDeepEqual(g.motifs, engine.generatedPatternGeometry({ ...settings, patternSeed: 100 }).motifs);
    assert(new Set(g.motifs.map(item => item.rotation)).size > 8);
    assert(new Set(g.motifs.map(item => item.scaleX)).size > 8);
    assert(g.motifs.every(item => item.scaleX >= 32 * .7 && item.scaleX <= 32 * 1.3));
    const fixed = engine.generatedPatternGeometry({ ...settings, patternRandomPosition: 0, patternRandomRotation: 0, patternMinScale: 100, patternMaxScale: 100 });
    for (const item of fixed.motifs) { near(item.rotation, 0); near(item.scaleX, 32); near((item.x - 16) % 32, 0); near((item.y - 16) % 32, 0); }
    const reversed = engine.generatedPatternGeometry({ ...settings, patternMinScale: 160, patternMaxScale: 40 });
    assert.deepEqual(reversed, engine.generatedPatternGeometry({ ...settings, patternMinScale: 40, patternMaxScale: 160 }));
  }
  const pixels = await raster(settings);
  assert(pixels.data.some((value, index) => index % 4 === 3 && value));
}
for (const value of ['javascript:alert(1)', 'data:text/html,<script/>', 'file:///secret', '<svg onload="alert(1)"/>']) {
  assert.equal(engine.safePatternSource(value), undefined);
  assert.equal(engine.generatedPatternGeometry({ ...base, content: 'custom', patternSource: value }).motifs.length, 0);
  assert(!render({ ...base, content: 'custom', patternSource: value }).includes('<image'));
}
assert.equal(engine.generatedPatternGeometry({ ...base, content: 'custom', patternSource: undefined }).motifs.length, 0);
const gradient = 'paint:' + JSON.stringify({ kind: 'linear', angle: 90, x: .5, y: .5, stops: [{ color: '#FF0000', offset: 0 }, { color: '#0000FF', offset: 1 }] });
assert(render({ ...base, color: gradient }).includes('<linearGradient'));
assert(!render({ ...base, color: gradient }).includes('paint:'));
assert.equal(engine.generatedPatternGeometry({ ...base, content: 'camo', patternColors: ['#123456', '#654321'] }).colors[0], base.color);
assert.equal(engine.generatedPatternGeometry({ ...base, content: 'camo', color: undefined, patternColors: ['#123456', '#654321'] }).colors[0], '#123456');
assert.equal(engine.generatedPatternGeometry({ ...base, content: 'camo', color: undefined }).colors[0], catalog.patternDefaultColors('camo')[0]);
assert.equal(engine.generatedPatternGeometry({ ...base, content: 'camo', patternColors: ['#123456', '#654321'] }).colors[1], '#654321');
assert.equal(engine.generatedPatternGeometry({ ...base, content: 'camo', patternColors: [] }).colors[0], base.color);

for (const value of [NaN, Infinity, -Infinity, -100, 0, 1e9]) {
  for (const content of ['noise', 'camo', 'custom']) {
    const g = engine.generatedPatternGeometry({ ...base, content, width: value, height: value, patternCount: value,
      patternScale: value, patternSpacingX: value, patternSpacingY: value, patternThickness: value, patternRoughness: value,
      patternVariation: value, patternRotation: value, patternMinScale: value, patternMaxScale: value, patternRepeat: 'random',
      patternSourceWidth: value, patternSourceHeight: value, patternRandomPosition: value, patternRandomRotation: value });
    assert(g.tileWidth > 0 && g.tileHeight > 0);
    assert(!/NaN|Infinity/.test(JSON.stringify(g)));
    assert(g.motifs.length <= 192 && g.replicas.length <= 512);
  }
}
for (const content of ['stripes', 'stripes-h', 'diagonal', 'checks', 'dots']) {
  const settings = { ...base, content };
  assert.deepEqual(legacy.patternGeometry(settings), legacy.patternGeometry({ ...settings, patternSpacingX: 23, patternSpacingY: 44, patternColors: ['red'], patternVariation: 99 }));
  assert.equal(render(settings), render({ ...settings, patternSpacingX: 23, patternSpacingY: 44, patternColors: ['red'], patternVariation: 99 }), 'legacy output unchanged by new fields');
}
console.log('PASS: 42 catalog entries; 37 generated patterns rasterized; periodic replicas; deterministic variation; custom repeat geometry; safe images; bounds; legacy isolation.');
