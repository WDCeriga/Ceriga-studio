import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import sharp from 'sharp';

const bundle = await build({
  stdin: {
    contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { flushSync } from 'react-dom';
      import { TextArtwork } from './src/app/components/builder/printsStudio/TextArtwork';
      import { ImageFxDefs } from './src/app/components/builder/PrintsDesignStep';
      const root = createRoot(document.getElementById('fixture'));
      window.renderText = (patch) => {
        const element = { id: 'browser-text', type: 'text', content: 'First\\nSecond', x: 200, y: 200,
          width: 260, height: 60, rotation: 0, fontSize: 30, fontFamily: 'Arial', color: '#ff0000', ...patch };
        flushSync(() => root.render(<div data-box style={{ position: 'absolute', left: element.x, top: element.y,
          width: element.width, transform: 'translate(-50%, -50%)' }}>
          <ImageFxDefs element={element} />
          <TextArtwork element={element} fontSize={element.fontSize} />
        </div>));
      };
    `,
    resolveDir: process.cwd(),
    loader: 'tsx',
  },
  bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl' },
  logLevel: 'silent',
});

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<div id="fixture"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const render = async patch => {
    await page.evaluate(patch => window.renderText(patch), patch);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
  };
  const geometry = () => page.locator('[data-box]').boundingBox();
  for (const curved of [false, true]) {
    const patch = curved ? { textCurveAmount: 70 } : {};
    await render({ ...patch, textAlign: 'left' });
    const before = await geometry();
    for (const textAlign of ['center', 'right']) {
      await render({ ...patch, textAlign });
      assert.deepEqual(await geometry(), before, 'Alignment must not move or resize the placed box');
    }
  }

  const content = 'WWW iii WWW iii a long line that must never disappear\nSecond editable line';
  await render({ content, width: 150, textCurveAmount: 80, textCurveSpacing: 3 });
  const layout = await page.locator('textPath').evaluateAll(nodes => nodes.map(node => {
    const text = node.parentElement;
    const path = document.getElementById(node.getAttribute('href').slice(1));
    return { content: node.textContent, width: text.getComputedTextLength(), capacity: path.getTotalLength(),
      extent: text.getBBox().width };
  }));
  assert.equal(layout.map(row => row.content).join(''), content.replaceAll('\n', ''));
  assert(layout.length > 2, 'Long curved lines must wrap rather than lose characters');
  assert(layout.every(row => row.width < row.capacity && row.extent > 0), 'Every wrapped row fits its native path');

  for (const textCurveDirection of ['up', 'down']) {
    await render({ content: 'An arc with a clearly visible bend\nSecond editable line', width: 600, textCurveAmount: 100, textCurveRadius: 80, textCurveDirection });
    const arc = await page.locator('[data-text-body] svg').evaluate(svg => {
      const path = svg.querySelector('path');
      const start = path.getPointAtLength(0);
      const middle = path.getPointAtLength(path.getTotalLength() / 2);
      return { bend: middle.y - start.y, height: svg.viewBox.baseVal.height,
        bounds: Array.from(svg.querySelectorAll('text'), text => { const box = text.getBBox(); return { y: box.y, bottom: box.y + box.height }; }) };
    });
    assert(textCurveDirection === 'up' ? arc.bend < -100 : arc.bend > 100, 'Arc direction and amount must produce the requested visible bend');
    assert(arc.bounds.every(box => box.y >= 0 && box.bottom <= arc.height), 'Strong arcs must fit their SVG viewport without clipping');
  }

  for (const textAlign of ['left', 'center', 'right']) {
    await render({ content: 'Circle\nSecond\nThird', width: 300, textCurveAmount: 100, textCurveShape: 'circle', textCurveRadius: 80, textAlign });
    const extents = await page.locator('textPath').evaluateAll(nodes => nodes.map(node => {
      const text = node.parentElement;
      return { width: text.getBBox().width, count: text.getNumberOfChars(), expected: node.textContent.length };
    }));
    assert.equal(extents.length, 3);
    assert(extents.every(row => row.width > 0 && row.count === row.expected), 'All circle rows and alignments remain visible');
  }
  await render({ content: 'FULL CIRCLE', width: 220, textCurveAmount: 100, textCurveShape: 'circle', textCurveRadius: 80 });
  const circleCoverage = await page.locator('textPath').evaluate(node => {
    const text = node.parentElement;
    const path = document.getElementById(node.getAttribute('href').slice(1));
    const box = text.getBBox();
    const first = text.getStartPositionOfChar(0);
    const last = text.getEndPositionOfChar(text.getNumberOfChars() - 1);
    const points = Array.from({ length: text.getNumberOfChars() }, (_, index) => text.getStartPositionOfChar(index)).concat(last);
    const angles = points.map(point => Math.atan2(point.y - 110, point.x - 110));
    const sweep = angles.slice(1).reduce((total, angle, index) => {
      const delta = angle - angles[index];
      return total + Math.abs(Math.atan2(Math.sin(delta), Math.cos(delta)));
    }, 0);
    return { width: box.width, height: box.height, length: sweep * 80,
      capacity: path.getTotalLength(), seam: Math.hypot(last.x - first.x, last.y - first.y),
      adjustment: node.getAttribute('lengthAdjust') };
  });
  assert(circleCoverage.width > 140 && circleCoverage.height > 140, 'Short circle text must cover all quadrants');
  assert(circleCoverage.length > circleCoverage.capacity * 0.8 && circleCoverage.length < circleCoverage.capacity, `Circle spacing fills the circumference with a seam gap: ${JSON.stringify(circleCoverage)}`);
  assert(circleCoverage.seam > 20, 'First and last glyphs must not collide at the seam');
  assert.equal(circleCoverage.adjustment, 'spacing', 'Circle distribution must not stretch glyphs');
  const fullCircle = await page.locator('defs path').first().getAttribute('d');
  await render({ content: 'Circle', width: 300, textCurveAmount: 50, textCurveShape: 'circle', textCurveRadius: 80 });
  assert.notEqual(await page.locator('defs path').first().getAttribute('d'), fullCircle);

  await render({ content: 'AB', width: 220, textCurveAmount: 100, textCurveShape: 'circle', textCurveRadius: 80 });
  const separation = await page.locator('text').evaluate(text => {
    const a = text.getStartPositionOfChar(0);
    const b = text.getStartPositionOfChar(1);
    return Math.hypot(a.x - b.x, a.y - b.y);
  });
  assert(separation > 140, 'Two letters must be distributed opposite one another, not clustered at the seam');
  await render({ content: 'Wide WWW text', width: 124, textCurveAmount: 1, textCurveShape: 'circle', textCurveRadius: 32 });
  const tinyArc = await page.locator('text').evaluateAll(nodes => nodes.every(text =>
    Array.from({ length: text.getNumberOfChars() }, (_, index) => text.getExtentOfChar(index).width).every(width => width > 0)));
  assert(tinyArc, 'Low circle amount must leave enough path length for every glyph');

  await render({ content: 'Editable', letterSpacing: 2, textCurveSpacing: 8 });
  assert.equal(await page.locator('[data-text-body] > div > div').evaluate(node => getComputedStyle(node).letterSpacing), '2px');
  await render({ content: 'Editable', textCurveAmount: 70, textCurveSide: 'inside' });
  const inside = await page.locator('text').getAttribute('dy');
  await render({ content: 'Editable', textCurveAmount: 70, textCurveSide: 'outside' });
  assert.notEqual(await page.locator('text').getAttribute('dy'), inside);

  for (const textCurveAmount of [0, 70]) {
    await render({ content: 'Outline', textCurveAmount, textFillMode: 'outline', borderWidth: 1, borderColor: '#0000ff',
      textUnderline: true, textStrikethrough: true, color: '#00aa00', textLineColor: '#ff00ff' });
    const style = await page.locator(textCurveAmount ? 'textPath' : '[data-text-body] > div > div').evaluate(node => {
      const style = getComputedStyle(node);
      return { fill: style.fill, webkitFill: style.webkitTextFillColor, decoration: style.textDecorationColor };
    });
    assert.equal(textCurveAmount ? style.fill : style.webkitFill, 'rgba(0, 0, 0, 0)');
    assert.equal(style.decoration, 'rgb(0, 170, 0)');
    const { data, info } = await sharp(await page.locator('[data-box]').screenshot({ omitBackground: true }))
      .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let decorationPixels = 0;
    for (let index = 0; index < data.length; index += info.channels) {
      if (data[index + 3] > 128 && data[index] < 80 && data[index + 1] > 120 && data[index + 2] < 80) decorationPixels++;
    }
    assert(decorationPixels > 10, `Decorations must visibly use the text colour with transparent glyph fill (curve ${textCurveAmount}, pixels ${decorationPixels})`);
  }

  for (const textCurveAmount of [0, 70]) {
    const pixels = async mode => {
      await render({ content: 'OO', fontSize: 60, width: 400, textCurveAmount,
        textFillMode: mode, borderWidth: 1, color: '#ff0000', borderColor: '#0000ff' });
      const screenshot = await page.locator('[data-box]').screenshot({ omitBackground: true });
      const { data, info } = await sharp(screenshot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let red = 0;
      let blue = 0;
      for (let index = 0; index < data.length; index += info.channels) {
        if (data[index + 3] < 128) continue;
        if (data[index] > 160 && data[index + 2] < 80) red++;
        if (data[index + 2] > 160 && data[index] < 80) blue++;
      }
      return { red, blue };
    };
    const hollow = await pixels('outline');
    const filled = await pixels('fill-outline');
    assert.equal(hollow.red, 0, 'Outline-only must not draw the fill');
    assert(hollow.blue > 0, 'Outline-only must retain the stroke');
    assert(filled.red > 100 && filled.blue > 0, 'Fill and outline must both be visible in separate colours');
  }

  await render({ textShadowEnabled: true, shadowOffsetX: 100, shadowOffsetY: -100, shadowBlur: 0, shadowOpacity: 40 });
  assert.equal(await page.locator('feOffset').getAttribute('dx'), '8');
  assert.equal(await page.locator('feOffset').getAttribute('dy'), '-8');
  assert.equal(await page.locator('feFuncA').getAttribute('slope'), '0.4');
  await render({ textShadowEnabled: false, shadowBlur: 10 });
  assert.equal(await page.locator('filter').count(), 0);

  await render({ content: 'iiii', textCurveAmount: 70 });
  const narrow = await page.locator('text').evaluate(node => node.getComputedTextLength());
  await render({ content: 'WWWW', textCurveAmount: 70 });
  const wide = await page.locator('text').evaluate(node => node.getComputedTextLength());
  assert(wide > narrow * 2, 'Native glyph widths must determine spacing');
  await render({ content: 'WWWW', textCurveAmount: 70, fontSize: 45, fontFamily: 'Georgia' });
  assert.notEqual(await page.locator('text').evaluateAll(nodes => nodes.reduce((sum, node) => sum + node.getComputedTextLength(), 0)), wide);
  assert.deepEqual(errors, []);
  console.log('Typography browser checks passed: anchored alignment, complete curves/circles, glyph metrics, outlines, decorations, and shadows.');
} finally {
  await browser.close();
}
