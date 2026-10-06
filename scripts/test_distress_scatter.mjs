import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/app/lib/distressScatter.ts'], bundle: true, format: 'esm', platform: 'node', write: false,
});
const scatter = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const settings = { ...scatter.DEFAULT_DISTRESS_SCATTER, count: 32, size: 12, opacity: 68 };
const center = { x: 160, y: 120 };
const first = scatter.createDistressScatter(center, 40, settings, 'holes', 123456);
const replay = scatter.createDistressScatter(center, 40, settings, 'holes', 123456);
const nextStroke = scatter.createDistressScatter(center, 40, settings, 'holes', 654321);
assert.equal(first.length, 32);
assert.deepEqual(first, replay, 'A live stroke should redraw its existing marks consistently');
assert.notDeepEqual(first, nextStroke, 'Separate brush passes should generate fresh organic marks');
assert(first.every(mark => Math.hypot(mark.x - center.x, mark.y - center.y) <= 40));
assert(new Set(first.map(mark => `${mark.x.toFixed(2)},${mark.y.toFixed(2)}`)).size > 28);
assert(new Set(first.map(mark => mark.width.toFixed(2))).size > 20, 'Individual mark sizes should vary');
assert(first.every(mark => mark.opacity > 0 && mark.opacity <= 0.68));

const abrasion = scatter.createDistressScatter(center, 40, settings, 'abrasion', 123456);
const rips = scatter.createDistressScatter(center, 40, settings, 'rips', 123456);
assert(abrasion.some(mark => mark.width > mark.height * 1.4), 'Abrasion marks should form wider fibrous clusters');
assert(rips.some(mark => mark.width > mark.height * 5), 'Rip marks should be long and narrow');
assert(first.some(mark => mark.width / mark.height > 0.65 && mark.width / mark.height < 1.55), 'Hole marks should remain rounded');
for (const kind of ['holes', 'abrasion', 'rips']) {
  for (const size of [1, 12, 48]) {
    const options = { ...settings, size };
    const stamp = scatter.createDistressStamp(center, 40, options, kind);
    assert.deepEqual(stamp, scatter.createDistressStamp(center, 40, options, kind), 'Settings and placement must use the same stamp');
    const moved = scatter.createDistressStamp({ x: center.x + 80, y: center.y + 60 }, 40, options, kind);
    stamp.forEach((mark, index) => {
      assert(Math.abs(moved[index].x - mark.x - 80) < 1e-10);
      assert(Math.abs(moved[index].y - mark.y - 60) < 1e-10);
      assert.deepEqual({ ...moved[index], x: mark.x, y: mark.y }, mark, 'Placement must not change texture geometry');
    });
    const retina = scatter.createDistressStamp({ x: center.x * 2, y: center.y * 2 }, 80, { ...options, size: size * 2 }, kind, 2);
    assert.deepEqual(retina.map(mark => ({ ...mark, x: mark.x / 2, y: mark.y / 2, width: mark.width / 2, height: mark.height / 2 })), stamp,
      'Device pixel ratio must not change the displayed texture or minimum mark size');
  }
}
console.log('Passed: scatter geometry, opacity, deterministic stamp placement, translation, and DPR invariance.');