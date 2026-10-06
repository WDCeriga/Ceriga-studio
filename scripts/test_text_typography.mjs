import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const sharedReact = {
  name: 'shared-react',
  setup(builder) {
    builder.onResolve({ filter: /^react(?:\/.*)?$/ }, args => ({
      path: pathToFileURL(require.resolve(args.path)).href,
      external: true,
    }));
  },
};

const [artworkBundle, listBundle] = await Promise.all([
  build({
    entryPoints: ['src/app/components/builder/printsStudio/TextArtwork.tsx'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    plugins: [sharedReact],
  }),
  build({
    entryPoints: ['src/app/lib/textListEditing.ts'],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  }),
]);
const { TextArtwork } = await import(
  `data:text/javascript;base64,${Buffer.from(artworkBundle.outputFiles[0].text).toString('base64')}`
);
const { applyTextListEnter, detectTextListMarker, reconcileTextListLineStyles } = await import(
  `data:text/javascript;base64,${Buffer.from(listBundle.outputFiles[0].text).toString('base64')}`
);

const base = {
  id: 'typography-test',
  type: 'text',
  content: 'A wide line\nA second line',
  x: 24,
  y: 38,
  width: 200,
  height: 60,
  rotation: 0,
  fontSize: 30,
  color: '#ff0000',
  textAlign: 'center',
};
const render = (patch = {}) => renderToStaticMarkup(React.createElement(TextArtwork, {
  element: { ...base, ...patch },
  fontSize: 30,
}));

test('alignment is rendered inside a full-width text box', () => {
  const left = render({ textAlign: 'left' });
  const right = render({ textAlign: 'right' });
  assert.match(left, /text-align:left/);
  assert.match(right, /text-align:right/);
  assert.match(left, /width:100%/);
  assert.doesNotMatch(left, /left:.*x:|top:.*y:/);
});

test('underline and strikethrough follow the text fill colour', () => {
  const output = render({
    textUnderline: true,
    textStrikethrough: true,
    textLineColor: '#0000ff',
  });
  assert.match(output, /text-decoration-color:#ff0000/);
  assert.doesNotMatch(output, /text-decoration-color:#0000ff/);
});

test('outline-only text has transparent fill; fill plus outline keeps separate paints', () => {
  const outlineOnly = render({
    textFillMode: 'outline',
    borderWidth: 1,
    borderColor: '#0000ff',
  });
  assert.match(outlineOnly, /-webkit-text-fill-color:transparent/);
  assert.match(outlineOnly, /-webkit-text-stroke:1px #0000ff/);

  const filledOutline = render({
    textFillMode: 'fill-outline',
    borderWidth: 1,
    borderColor: '#0000ff',
  });
  assert.match(filledOutline, /color:#ff0000/);
  assert.match(filledOutline, /-webkit-text-stroke:1px #0000ff/);
});

test('text outline and decoration defaults are thin without overriding saved widths', () => {
  for (const textFillMode of ['outline', 'fill-outline']) {
    const output = render({ textFillMode, textUnderline: true, textLinePosition: 'bottom' });
    assert.match(output, /-webkit-text-stroke:0\.25px /);
    assert.match(output, /text-decoration-thickness:0\.5px/);
    assert.match(output, /height:0\.5px/);
    for (const width of [0, 0.1, 1, 6]) {
      const saved = render({ textFillMode, borderWidth: width, textLineThickness: width, textUnderline: true, textLinePosition: 'bottom' });
      if (width > 0) assert.ok(saved.includes(`-webkit-text-stroke:${width}px `));
      else assert.doesNotMatch(saved, /-webkit-text-stroke:/);
      assert.ok(saved.includes(`text-decoration-thickness:${width}px`));
      assert.ok(saved.includes(`height:${width === 0 ? '0;' : `${width}px`}`));
    }
  }
});

test('curved text uses the same thin outline and custom line defaults', () => {
  const output = render({ textFillMode: 'outline', textCurveAmount: 100, textUnderline: true, textLinePosition: 'bottom' });
  assert.match(output, /stroke-width="0\.25"/);
  assert.match(output, /stroke-width="0\.5"/);
  assert.match(output, /text-decoration-thickness:0\.5px/);
  const saved = render({ textFillMode: 'outline', textCurveAmount: 100, textLinePosition: 'bottom', borderWidth: 6, textLineThickness: 7 });
  assert.match(saved, /stroke-width="6"/);
  assert.match(saved, /stroke-width="7"/);
});

test('desktop, mobile and sidebar text thickness controls share thin defaults and ranges', () => {
  const toolbar = readFileSync('src/app/components/builder/InlineElementToolbar.tsx', 'utf8');
  const sidebar = readFileSync('src/app/components/builder/PrintsDesignStep.tsx', 'utf8');
  const textOutlineControls = [...toolbar.matchAll(/<input\s+type="range"\s+min=\{0\}\s+max=\{(\d+)\}\s+step=\{([\d.]+)\}\s+value=\{outline\}\s+onChange=\{\(e\) => \{\s+const width/g)];
  assert.equal(textOutlineControls.length, 2);
  for (const [, max, step] of textOutlineControls) {
    assert.equal(max, '4');
    assert.equal(step, '0.05');
  }
  assert.match(toolbar, /borderWidth: \(element\.borderWidth \?\? 0\) \|\| 0\.25/);
  assert.match(toolbar, /\? element\.borderWidth \?\? 0\.25/);
  assert.match(sidebar, /borderWidth: \(selected\.borderWidth \?\? 0\) \|\| 0\.25/);
  assert.match(sidebar, /label="Outline thickness"\s+value=\{selected\.borderWidth \?\? 0\.25\}\s+min=\{0\}\s+max=\{4\}\s+suffix="px"\s+step=\{0\.05\}/);
  assert.match(sidebar, /textLineThickness: 0\.5,/);
  assert.match(sidebar, /label="Line thickness"\s+value=\{selected\.textLineThickness \?\? 0\.5\}\s+min=\{0\.1\}\s+max=\{4\}\s+step=\{0\.1\}/);
});

test('curved rendering retains every line and native glyph advance', () => {
  const output = render({ content: 'First\nSecond', textCurveAmount: 100, textCurveRadius: 260 });
  assert.equal((output.match(/<textPath /g) ?? []).length, 2);
  assert.match(output, />First<\/textPath>/);
  assert.match(output, />Second<\/textPath>/);
  assert.doesNotMatch(output, /textLength=/);
});

test('curve radius and character spacing stay in their usable range', () => {
  const output = render({
    content: 'Curve',
    textCurveAmount: 100,
    textCurveRadius: 1000,
    textCurveSpacing: 24,
  });
  assert.equal(output, render({
    content: 'Curve', textCurveAmount: 100, textCurveRadius: 500, textCurveSpacing: 8,
  }));
  assert.match(output, /letter-spacing="8"/);
  assert.notEqual(
    render({ width: 600, textCurveAmount: 100, textCurveRadius: 80 }),
    render({ width: 600, textCurveAmount: 100, textCurveRadius: 100 }),
  );
});

test('list markers convert, continue, and exit while preserving prior rows', () => {
  const bullet = detectTextListMarker('- ', 2, ['none']);
  assert.deepEqual(bullet, {
    content: '',
    lineStyles: ['bulleted'],
    caret: 0,
    kind: 'bulleted',
  });

  const numbered = detectTextListMarker('1. ', 3, ['none']);
  assert.equal(numbered?.kind, 'numbered');
  assert.deepEqual(numbered?.lineStyles, ['numbered']);

  const continued = applyTextListEnter('First', 5, 5, ['numbered']);
  assert.equal(continued?.content, 'First\n');
  assert.deepEqual(continued?.lineStyles, ['numbered', 'numbered']);

  const exited = applyTextListEnter('First\n', 6, 6, continued?.lineStyles ?? []);
  assert.equal(exited?.exited, true);
  assert.deepEqual(exited?.lineStyles, ['numbered', 'none']);
  assert.deepEqual(
    reconcileTextListLineStyles('First\nSecond', 'First\n\nSecond', ['numbered', 'bulleted']),
    ['numbered', 'bulleted', 'bulleted'],
  );
});

test('per-line list styles render without replacing text content', () => {
  const output = render({
    content: 'First\nSecond\nThird',
    textListLineStyles: ['numbered', 'numbered', 'none'],
  });
  assert.match(output, />1\.<\/span>/);
  assert.match(output, />2\.<\/span>/);
  assert.match(output, />Third<\/div>/);
});
