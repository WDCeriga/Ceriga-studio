import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
const bundle = await build({ entryPoints: ['src/app/lib/brushTextures.ts'], bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'textures' });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const result = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 180;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const render = (texture, patch = {}, grain = 0) => {
      ctx.clearRect(0, 0, 180, 180); ctx.fillStyle = '#b43267'; ctx.fillRect(16, 16, 148, 148);
      textures.applyBrushTexture(ctx, { texture, ...patch }, grain, 1);
      const data = ctx.getImageData(0, 0, 180, 180).data;
      let hash = 2166136261, ink = 0, outside = 0;
      for (let i = 3; i < data.length; i += 4) {
        hash = Math.imul(hash ^ data[i], 16777619); ink += data[i];
        const x = (i >> 2) % 180, y = Math.floor((i >> 2) / 180);
        if (x < 16 || x >= 164 || y < 16 || y >= 164) outside += data[i];
      }
      return { hash, ink, outside };
    };
    const plain = render('smooth');
    const builtins = textures.BRUSH_TEXTURES.filter(t => !['custom', 'smooth'].includes(t.id)).map(texture => ({
      id: texture.id, normal: render(texture.id), repeat: render(texture.id),
      scale: render(texture.id, { textureScale: 175 }), strength: render(texture.id, { textureStrength: 35 }),
      density: render(texture.id, { textureDensity: 65 }), rotation: render(texture.id, { textureRotation: 37 }),
      contrast: render(texture.id, { textureContrast: 80 }), zero: render(texture.id, { textureStrength: 0 }),
    }));
    const image = document.createElement('canvas'); image.width = image.height = 32;
    const imageCtx = image.getContext('2d');
    imageCtx.fillStyle = 'white'; imageCtx.fillRect(0, 0, 32, 32);
    imageCtx.fillStyle = 'black'; imageCtx.fillRect(0, 0, 10, 32);
    imageCtx.clearRect(28, 0, 4, 32);
    const source = image.toDataURL(); await textures.loadBrushTexture(source);
    const settings = { texture: 'custom', customTextureSource: source };
    const mask = textures.createBrushTextureMask(settings);
    const invert = textures.createBrushTextureMask({ ...settings, textureInvert: true });
    const custom = render('custom', settings);
    let rejected = false; try { await textures.loadBrushTexture('data:image/png;base64,AAAA'); } catch { rejected = true; }
    return { plain, builtins, custom, customInvert: render('custom', { ...settings, textureInvert: true }),
      samples: [mask.data[0], mask.data[15], mask.data[31], invert.data[0], invert.data[15], invert.data[31]],
      missing: render('custom'), grain: render('smooth', {}, 50), rejected };
  });
  assert.equal(result.builtins.length, 45);
  assert.equal(new Set(result.builtins.map(t => t.normal.hash)).size, 45, 'Procedural textures must differ');
  for (const texture of result.builtins) {
    assert.equal(texture.normal.outside, 0, texture.id);
    assert(texture.normal.ink > 0 && texture.normal.ink < result.plain.ink, `${texture.id}: texture must affect ink`);
    assert.deepEqual(texture.normal, texture.repeat);
    assert.deepEqual(texture.zero, result.plain);
    for (const control of ['scale', 'strength', 'density', 'rotation', 'contrast']) assert.notEqual(texture[control].hash, texture.normal.hash, `${texture.id}: ${control}`);
  }
  assert.deepEqual(result.samples, [255, 0, 0, 0, 255, 0], 'Custom black/white/transparency and invert are alpha masks');
  assert.notEqual(result.custom.hash, result.customInvert.hash);
  assert.deepEqual(result.missing, result.plain);
  assert.notEqual(result.grain.hash, result.plain.hash);
  assert(result.rejected);
  console.log('47 textures: distinct structural masks, five controls, clipping, custom luminance/invert, fallback and grain passed.');
} finally { await browser.close(); }
