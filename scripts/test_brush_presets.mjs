import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
const bundle = await build({ entryPoints: ['src/app/lib/drawingBrush.ts'], bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'brush' });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 320;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const points = [{ x: 60, y: 120, p: .5, tilt: 0 }, { x: 320, y: 160, p: 1, tilt: .1 }];
    const render = (preset, patch = {}, path = points) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      brush.renderBrushStroke(ctx, path, { ...brush.DEFAULT_BRUSH_SETTINGS, ...preset.settings, brushPreset: preset.id,
        brushSize: 32, color: '#6a205f', pressure: true, grain: 0, pencil: { tiltShading: true }, ...patch }, 1, 77);
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261, ink = 0;
      for (let i = 0; i < pixels.length; i++) { hash = Math.imul(hash ^ pixels[i], 16777619); if (i % 4 === 3) ink += pixels[i]; }
      return { hash, ink };
    };
    const presets = brush.BRUSH_PRESETS.map(preset => {
      const normal = render(preset);
      const controls = brush.brushPresetControls(preset.id).map(control => ({ key: control.key,
        low: render(preset, { [control.key]: control.min }).hash,
        high: render(preset, { [control.key]: control.key.includes('Direction') || control.key.includes('Angle') ? 37 : control.max }).hash,
      }));
      return { id: preset.id, normal, repeat: render(preset), controls,
        texture: render(preset, { texture: 'canvas' }),
        pressure: render(preset, { pressure: false }),
        taper: render(preset, { taperStart: 80, taperEnd: 80 }),
        scattered: render(preset, { scatterEnabled: true, scatterCount: 3, scatterSpread: 120 }),
      };
    });
    const special = ['distress-brush', 'drip-paint', 'splatter'].map(id => {
      const preset = brush.BRUSH_PRESETS.find(p => p.id === id);
      return { id, first: render(preset).hash, next: render(preset, { brushSeed: 10 }).hash };
    });
    const thread = brush.BRUSH_PRESETS.filter(p => /stitch|embroidery|chenille/.test(p.id)).map(preset => ({ id: preset.id,
      horizontal: render(preset, {}, [{ x: 80, y: 80, p: 1, tilt: 0 }, { x: 240, y: 80, p: 1, tilt: 0 }]).hash,
      vertical: render(preset, {}, [{ x: 80, y: 80, p: 1, tilt: 0 }, { x: 80, y: 240, p: 1, tilt: 0 }]).hash,
    }));
    return { presets, special, thread };
  });
  assert.equal(result.presets.length, 41);
  assert.equal(new Set(result.presets.map(p => p.normal.hash)).size, 41, 'All brush behaviours should be distinct');
  for (const preset of result.presets) {
    assert(preset.normal.ink > 0, `${preset.id}: visible`);
    assert.deepEqual(preset.repeat, preset.normal, `${preset.id}: deterministic`);
    for (const key of ['texture', 'pressure', 'taper', 'scattered']) assert.notEqual(preset[key].hash, preset.normal.hash, `${preset.id}: ${key} must work`);
    for (const control of preset.controls) assert.notEqual(control.low, control.high, `${preset.id}: ${control.key} must change rendering`);
  }
  for (const preset of result.special) assert.notEqual(preset.first, preset.next, `${preset.id}: randomise`);
  for (const preset of result.thread) assert.notEqual(preset.horizontal, preset.vertical);
  console.log('41 distinct brush presets: controls, textures, pressure, taper, scatter, deterministic seeds and thread orientation passed.');
} finally { await browser.close(); }
