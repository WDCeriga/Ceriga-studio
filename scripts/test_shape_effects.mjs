import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle = await build({ stdin: { loader: 'ts', resolveDir: process.cwd(), contents: `export * from './src/app/lib/textEffects'; export { shapeArtworkPadding, artworkEffectPadding } from './src/app/lib/textEffectRendering';` }, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent' });
const { SHAPE_EFFECTS, createShapeEffect, shapeEffectControls, applyTextEffects, shapeArtworkPadding, artworkEffectPadding } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const width = 160, height = 140, source = new Uint8ClampedArray(width * height * 4);
for (let y = 25; y < 115; y++) for (let x = 25; x < 135; x++) {
  if (x > 60 && x < 95 && y > 55 && y < 85) continue;
  const i = (y * width + x) * 4;
  source.set([x + 40, y + 50, 135, 255], i);
}
const image = new Uint8ClampedArray(24 * 24 * 4);
for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) image.set([x * 10, y * 10, (x + y) % 2 ? 240 : 40, 255], (y * 24 + x) * 4);
const assets = { image: { data: image, width: 24, height: 24 } };
const effect = type => ({ ...createShapeEffect(type), seed: 13, source: ['image-fill', 'texture-fill'].includes(type) ? 'image' : undefined });
const apply = effects => applyTextEffects(source, width, height, effects, assets);
const differs = (a, b) => a.some((value, i) => value !== b[i]);

test('All 26 shape effects are deterministic, reversible and source-preserving', () => {
  assert.equal(SHAPE_EFFECTS.length, 26);
  const original = source.slice();
  for (const { id } of SHAPE_EFFECTS) {
    const fx = effect(id), output = apply([fx]);
    assert(differs(output, source), `${id} changes artwork`);
    assert.deepEqual(output, apply([fx]), `${id} is deterministic`);
    assert.deepEqual(apply([{ ...fx, intensity: 0 }]), original, `${id} zero intensity`);
    assert.deepEqual(apply([{ ...fx, enabled: false }]), original, `${id} disabled`);
    assert.deepEqual(source, original, `${id} keeps the editable source`);
  }
});

test('Every shape-specific control changes the output', () => {
  for (const { id } of SHAPE_EFFECTS) for (const control of shapeEffectControls(id)) {
    const fx = effect(id);
    let low, high;
    if (control.type === 'range') {
      low = control.min;
      high = ['angle', 'direction', 'rotation', 'offsetX', 'offsetY'].includes(control.key) ? control.max * 0.37 : control.max;
    } else if (control.type === 'color') { low = '#ff0011'; high = '#00ffff'; }
    else { low = control.options[0].value; high = control.options.at(-1).value; }
    if (control.key === 'tertiaryColor') fx.settings.tertiaryAmount = 100;
    if (id === 'gradient' && control.key.startsWith('position')) fx.settings.angle = 35;
    const output = value => apply([{ ...fx, settings: { ...fx.settings, [control.key]: value } }]);
    assert(differs(output(low), output(high)), `${id}.${control.key} changes pixels`);
  }
});

test('Interior treatments and cutouts respect shape boundaries and holes', () => {
  for (const id of ['distressed', 'grunge', 'rough-edges', 'grain', 'noise', 'halftone', 'screen-print', 'photocopy', 'cracked', 'inner-shadow', 'inner-glow', 'chrome', 'metallic', 'bevel', 'texture-fill', 'image-fill', 'gradient']) {
    const output = apply([effect(id)]);
    for (let i = 3; i < source.length; i += 4) if (!source[i]) assert.equal(output[i], 0, `${id} stays inside the shape`);
  }
  const cut = apply([effect('distressed')]);
  assert(cut.some((v, i) => i % 4 === 3 && v < source[i]), 'Distress removes actual alpha');
  for (const id of ['distressed', 'grunge', 'rough-edges', 'cracked', 'glitch']) {
    const fx = effect(id);
    assert(differs(apply([fx]), apply([{ ...fx, seed: fx.seed + 1 }])), `${id} randomises geometry/texture`);
  }
});

test('Order, serialization and overflow padding preserve editable shapes', () => {
  const effects = [effect('shadow'), effect('distressed')];
  assert(differs(apply(effects), apply([...effects].reverse())));
  assert.deepEqual(apply(effects), apply(JSON.parse(JSON.stringify(effects))));
  const el = { type: 'shape', content: 'custom-polygon', width: 200, height: 100, borderWidth: 0, shapePath: { closed: true, nodes: [{ x: -40, y: 0 }, { x: 150, y: 0 }, { x: 50, y: 100, out: { x: 50, y: 180 } }] } };
  assert.equal(shapeArtworkPadding(el), 100);
  assert.equal(artworkEffectPadding({ ...el, shapeEffects: [effect('shadow')] }), 164);
  assert.equal(artworkEffectPadding({ type: 'group', width: 400, height: 200, groupSourceWidth: 200, groupSourceHeight: 100, children: [el] }), 200);
});
