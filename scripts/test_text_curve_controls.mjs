import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/app/lib/textCurveControls.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { updateTextCurve, textCurveRadius } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const original = { id: 'text', type: 'text', content: 'Editable', width: 220, height: 40, x: 150, y: 180,
  fontSize: 30, autoWidth: true, autoHeight: true, aspectLocked: false, textCurveRadius: 260, textCurveAmount: 65, textCurveShape: 'arc' };

test('circle uses a practical radius and restores the original box when switching to arc', () => {
  const circle = { ...original, ...updateTextCurve(original, { textCurveShape: 'circle', textCurveAmount: 100 }) };
  assert.equal(circle.textCurveRadius, 80);
  const enlarged = { ...circle, ...updateTextCurve(circle, { textCurveRadius: 120 }) };
  assert.equal(enlarged.width, 300);
  const arc = { ...enlarged, ...updateTextCurve(enlarged, { textCurveShape: 'arc' }) };
  for (const key of ['width', 'height', 'x', 'y', 'autoWidth', 'autoHeight', 'aspectLocked', 'textCurveRadius', 'content']) assert.equal(arc[key], original[key], key);
  assert.equal(arc.textCurveOriginalBox, undefined);
});

test('amount does not reset a resized circle; turning off restores the box', () => {
  const circle = { ...original, ...updateTextCurve(original, { textCurveShape: 'circle', textCurveAmount: 100 }), width: 275, height: 275 };
  const partial = { ...circle, ...updateTextCurve(circle, { textCurveAmount: 50 }) };
  assert.equal(partial.width, 275);
  const off = { ...partial, ...updateTextCurve(partial, { textCurveAmount: 0 }) };
  assert.equal(off.width, original.width);
  assert.equal(off.height, original.height);
  assert.equal(off.textCurveAmount, 0);
  assert.equal(off.x, original.x);
  assert.equal(off.y, original.y);
});

test('radius controls use separate smooth practical ranges', () => {
  assert.equal(textCurveRadius({ textCurveShape: 'circle' }), 80);
  assert.equal(textCurveRadius({ textCurveShape: 'circle', textCurveRadius: 500 }), 160);
  assert.equal(textCurveRadius({ textCurveShape: 'circle', textCurveRadius: 20 }), 32);
  assert.equal(textCurveRadius({ textCurveShape: 'arc' }), 260);
});
