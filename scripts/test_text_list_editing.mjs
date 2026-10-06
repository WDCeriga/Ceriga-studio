import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const bundle = await build({
  entryPoints: ['src/app/lib/textListEditing.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
});
const {
  applyTextListEnter,
  detectTextListMarker,
  normalizeTextListLineStyles,
  reconcileTextListLineStyles,
  parseTextListInput,
  formatTextListInput,
  completeTextListInputMarker,
  continueTextListInput,
} = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('list defaults and explicit plain rows survive normalization', () => {
  assert.deepEqual(normalizeTextListLineStyles('First\n\nLast', undefined, 'numbered'), [
    'numbered', 'numbered', 'numbered',
  ]);
  assert.deepEqual(normalizeTextListLineStyles('First\nPlain', ['bulleted', 'none'], 'numbered'), [
    'bulleted', 'none',
  ]);
});

const markers = [['-', 'bulleted'], ['- ', 'bulleted'], ['1.', 'numbered'], ['1. ', 'numbered'], ['12.', 'numbered'], ['12. ', 'numbered']];

for (const [marker, kind] of markers) {
  test(`${JSON.stringify(marker)} marker converts immediately without changing adjacent text or styles`, () => {
    assert.deepEqual(detectTextListMarker(`Intro\n${marker}\nLast`, 6 + marker.length, ['none', 'none', 'numbered']), {
      content: 'Intro\n\nLast',
      lineStyles: ['none', kind, 'numbered'],
      caret: 6,
      kind,
    });
  });

  test(`${kind} Enter continues, empty Enter exits, and later plain text stays plain`, () => {
    const continued = applyTextListEnter('First', 5, 5, [kind]);
    assert.deepEqual(continued, {
      content: 'First\n', lineStyles: [kind, kind], caret: 6, exited: false,
    });
    const exited = applyTextListEnter(continued.content, continued.caret, continued.caret, continued.lineStyles);
    assert.deepEqual(exited, {
      content: 'First\n', lineStyles: [kind, 'none'], caret: 6, exited: true,
    });
    const edited = reconcileTextListLineStyles(exited.content, 'First\nPlain', exited.lineStyles);
    assert.deepEqual(edited, [kind, 'none']);
    assert.equal(applyTextListEnter('First\nPlain', 11, 11, edited), null);
  });
}

test('ordinary text and incomplete markers do not become lists', () => {
  for (const content of ['', '1', '12', '.', '--', '1..', 'A - ', 'A 1. ', ' - ', ' ']) {
    assert.equal(detectTextListMarker(content, content.length, ['none']), null);
  }
  assert.equal(detectTextListMarker('- ', 1, ['none']).caret, 0);
});

test('optional separator space is consumed only on an empty list row', () => {
  for (const kind of ['bulleted', 'numbered']) {
    assert.deepEqual(detectTextListMarker('Intro\n \nLast', 7, ['none', kind, 'numbered']), {
      content: 'Intro\n\nLast', lineStyles: ['none', kind, 'numbered'], caret: 6, kind,
    });
    for (const content of ['Item ', ' Item', 'Item two', '  ']) {
      assert.equal(detectTextListMarker(content, content.length, [kind]), null);
    }
  }
  assert.equal(detectTextListMarker('Intro\n ', 7, ['numbered', 'none']), null);
});

test('Enter on an empty first item exits even when later rows have content', () => {
  assert.deepEqual(applyTextListEnter('\nNext', 0, 0, ['bulleted', 'numbered']), {
    content: '\nNext', lineStyles: ['none', 'numbered'], caret: 0, exited: true,
  });
});

test('Enter splits an item and retains neighboring list kinds', () => {
  assert.deepEqual(applyTextListEnter('Intro\nFirstSecond\nLast', 11, 11, ['none', 'numbered', 'bulleted']), {
    content: 'Intro\nFirst\nSecond\nLast',
    lineStyles: ['none', 'numbered', 'numbered', 'bulleted'],
    caret: 12,
    exited: false,
  });
});

test('Enter replaces a selection spanning items and retains the untouched suffix', () => {
  assert.deepEqual(applyTextListEnter('First\nSecond\nLast', 2, 9, ['numbered', 'bulleted', 'none']), {
    content: 'Fi\nond\nLast',
    lineStyles: ['numbered', 'numbered', 'none'],
    caret: 3,
    exited: false,
  });
});

test('editing list text retains mixed per-line metadata', () => {
  assert.deepEqual(reconcileTextListLineStyles('First\nSecond\nPlain', 'First\nUpdated\nPlain', [
    'numbered', 'bulleted', 'none',
  ]), ['numbered', 'bulleted', 'none']);
});

test('deleting an entire row preserves the untouched following row kind', () => {
  assert.deepEqual(reconcileTextListLineStyles('First\nSecond', 'Second', ['numbered', 'bulleted']), ['bulleted']);
  assert.deepEqual(reconcileTextListLineStyles('Intro\nFirst\nSecond', 'Intro\nSecond', ['none', 'numbered', 'bulleted']), [
    'none', 'bulleted',
  ]);
});

test('removing only a newline keeps the merged row original kind', () => {
  assert.deepEqual(reconcileTextListLineStyles('First\nSecond', 'FirstSecond', ['numbered', 'bulleted']), ['numbered']);
});

test('settings markers display immediately and Enter continues and exits lists', () => {
  for (const [marker, kind] of markers) {
    const bare = marker.trim();
    const completed = completeTextListInputMarker(bare, bare.length);
    assert.equal(completed.content, kind === 'bulleted' ? '• ' : `${bare} `);
    const first = `${completed.content}First`;
    const next = continueTextListInput(first, first.length, first.length);
    assert.equal(next.content, `${first}\n${kind === 'bulleted' ? '• ' : `${Number.parseInt(bare, 10) + 1}. `}`);
    const second = `${next.content}Second`;
    const empty = continueTextListInput(second, second.length, second.length);
    const exited = continueTextListInput(empty.content, empty.caret, empty.caret);
    assert.equal(exited.content, `${second}\n`);
    const parsed = parseTextListInput(`${exited.content}Plain`);
    assert.equal(parsed.content, 'First\nSecond\nPlain');
    assert.deepEqual(parsed.lineStyles, [kind, kind, 'none']);
  }
});

test('settings ordinary Enter remains a normal newline and selections split list items', () => {
  assert.equal(continueTextListInput('Paragraph', 9, 9), null);
  assert.equal(completeTextListInputMarker('Version 1.', 10), null);
  assert.deepEqual(continueTextListInput('1. FirstSecond', 8, 8), { content: '1. First\n2. Second', caret: 12 });
});

test('pasted settings lists become per-line metadata, not literal garment markers', () => {
  assert.deepEqual(parseTextListInput('Intro\n- First\n• Second\n1. Third\n2. Fourth'), {
    content: 'Intro\nFirst\nSecond\nThird\nFourth',
    lineStyles: ['none', 'bulleted', 'bulleted', 'numbered', 'numbered'],
    caret: 'Intro\nFirst\nSecond\nThird\nFourth'.length,
  });
});

test('canvas editing detects pasted markers and prefixes inserted before existing wording', () => {
  for (const [marker, kind] of markers) {
    const result = detectTextListMarker(`${marker.trim()}Existing`, marker.trim().length, ['none']);
    assert.equal(result.content, 'Existing');
    assert.equal(result.caret, 0);
    assert.deepEqual(result.lineStyles, [kind]);
  }
  const pasted = detectTextListMarker('- First\n- Second', 16, ['none', 'none']);
  assert.equal(pasted.content, 'First\nSecond');
  assert.deepEqual(pasted.lineStyles, ['bulleted', 'bulleted']);
});

// Execute the production textarea handlers without mounting the garment editor.
const source = readFileSync('src/app/components/builder/PrintsDesignStep.tsx', 'utf8');
const textareaStart = source.lastIndexOf('<textarea', source.indexOf('ref={editAreaRef}'));
const textareaEnd = source.indexOf('/>', textareaStart) + 2;
assert.ok(textareaStart >= 0 && textareaEnd > textareaStart);
const editorBundle = await build({
  stdin: {
    contents: `export const renderEditor = ({
      editAreaRef, editDraft, editDraftRef, setEditDraft,
      setEditingTextId, element, removeElement, updateElement,
      completeTextListInputMarker, continueTextListInput, formatTextListInput,
      parseTextListInput, flushSync,
    }) => {
      const h = (_, props) => props;
      const solidPaint = (value) => value;
      const editFontSize = 30;
      return (${source.slice(textareaStart, textareaEnd)});
    };`,
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  jsx: 'transform',
  jsxFactory: 'h',
});
const { renderEditor } = await import(`data:text/javascript;base64,${Buffer.from(editorBundle.outputFiles[0].text).toString('base64')}`);

function createEditor(content, lineStyles) {
  const updates = [];
  const removed = [];
  const context = {
    editAreaRef: { current: { setSelectionRange() {} } },
    editDraft: formatTextListInput(content, lineStyles),
    editDraftRef: { current: formatTextListInput(content, lineStyles) },
    setEditDraft(value) { context.editDraft = value; },
    setEditingTextId(value) { context.editingTextId = value; },
    editingTextId: 'text-list',
    element: { id: 'text-list', content, textListLineStyles: lineStyles },
    removeElement(id) { removed.push(id); },
    updateElement(id, patch) { updates.push({ id, ...patch }); },
    completeTextListInputMarker,
    continueTextListInput,
    formatTextListInput,
    parseTextListInput,
    flushSync(callback) { callback(); },
  };
  return { context, updates, removed, props: () => renderEditor(context) };
}

function pressKey(editor, key, caret, extra = {}) {
  let prevented = false;
  let stopped = false;
  editor.props().onKeyDown({
    key,
    shiftKey: false,
    nativeEvent: { isComposing: false },
    currentTarget: {
      value: editor.context.editDraftRef.current,
      selectionStart: caret,
      selectionEnd: caret,
      blur() { editor.props().onBlur(); },
    },
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; },
    ...extra,
  });
  return { prevented, stopped };
}

function changeDraft(editor, value, caret = value.length) {
  editor.props().onChange({ target: { value, selectionStart: caret }, nativeEvent: { isComposing: false } });
}

for (const [marker, kind] of markers) {
  test(`${JSON.stringify(marker)} production editor restores original content and metadata on Escape`, () => {
    const editor = createEditor('Intro', ['none']);
    changeDraft(editor, `Intro\n${marker}`);
    assert.match(editor.context.editDraft, kind === 'numbered' ? /\n\d+\.\s*$/ : /\n[•-]\s*$/);
    assert.deepEqual(parseTextListInput(editor.context.editDraft).lineStyles, ['none', kind]);
    assert.deepEqual(pressKey(editor, 'Escape', editor.context.editDraft.length), { prevented: true, stopped: true });
    assert.equal(editor.context.editDraft, 'Intro');
    assert.equal(editor.context.editDraftRef.current, 'Intro');
    assert.deepEqual(editor.updates, []);
    assert.deepEqual(editor.removed, []);
    assert.equal(editor.context.editingTextId, null);
  });
}

for (const [marker, kind] of markers) {
  test(`${JSON.stringify(marker)} production editor handles character-by-character typing and remains editable`, () => {
    const editor = createEditor('Intro\n', ['none', 'none']);
    let caret = editor.context.editDraft.length;
    editor.context.editAreaRef.current.setSelectionRange = start => { caret = start; };
    const type = text => {
      for (const character of text) {
        const draft = editor.context.editDraftRef.current;
        const value = `${draft.slice(0, caret)}${character}${draft.slice(caret)}`;
        caret++;
        changeDraft(editor, value, caret);
      }
    };
    type(marker);
    const firstPrefix = editor.context.editDraft.slice(6);
    assert.match(firstPrefix, kind === 'numbered' ? /^\d+\. +$/ : /^• +$/, 'Converted markers must remain visible');
    assert.equal(caret, 6 + firstPrefix.length);
    assert.deepEqual(parseTextListInput(editor.context.editDraft).lineStyles, ['none', kind]);
    type('First item');
    pressKey(editor, 'Enter', caret);
    type('Second');
    pressKey(editor, 'Enter', caret);
    pressKey(editor, 'Enter', caret);
    type('Plain text');
    const nextPrefix = kind === 'bulleted' ? '• ' : `${Number.parseInt(marker, 10) + 1}. `;
    assert.equal(editor.context.editDraft, `Intro\n${firstPrefix}First item\n${nextPrefix}Second\nPlain text`);
    assert.deepEqual(parseTextListInput(editor.context.editDraft).lineStyles, ['none', kind, kind, 'none']);
    caret = 11 + firstPrefix.length;
    type(' edited');
    editor.props().onBlur();
    assert.equal(editor.updates.at(-1).content, 'Intro\nFirst edited item\nSecond\nPlain text');
    assert.deepEqual(editor.updates.at(-1).textListLineStyles, ['none', kind, kind, 'none']);
  });
}

test('Escape restores existing mixed list metadata after clearing the draft', () => {
  const editor = createEditor('First\nSecond\nPlain', ['numbered', 'bulleted', 'none']);
  changeDraft(editor, '');
  pressKey(editor, 'Escape', 0);
  assert.equal(editor.context.editDraft, '1. First\n• Second\nPlain');
  assert.equal(editor.context.editDraftRef.current, '1. First\n• Second\nPlain');
  assert.deepEqual(editor.updates, []);
  assert.deepEqual(editor.removed, []);
  assert.equal(editor.context.editingTextId, null);
});

test('Escape restores legacy list defaults when per-line metadata is absent', () => {
  const editor = createEditor('First\nSecond', ['numbered', 'numbered']);
  editor.context.element.textList = 'numbered';
  delete editor.context.element.textListLineStyles;
  changeDraft(editor, 'Changed');
  pressKey(editor, 'Escape', 7);
  assert.equal(editor.context.editDraftRef.current, '1. First\n2. Second');
  assert.deepEqual(editor.updates, []);
});

test('production marker conversion preserves metadata when new rows are inserted', () => {
  const editor = createEditor('First\nLast', ['numbered', 'none']);
  changeDraft(editor, '1. First\n-\nLast', 10);
  assert.equal(editor.context.editDraft, '1. First\n• \nLast');
  editor.props().onBlur();
  assert.equal(editor.updates.at(-1).content, 'First\n\nLast');
  assert.deepEqual(editor.updates.at(-1).textListLineStyles, ['numbered', 'bulleted', 'none']);
});

test('Shift+Enter and composition Enter retain native editing behavior', () => {
  const editor = createEditor('First', ['numbered']);
  assert.equal(pressKey(editor, 'Enter', 8, { shiftKey: true }).prevented, false);
  assert.equal(pressKey(editor, 'Enter', 8, { nativeEvent: { isComposing: true } }).prevented, false);
  assert.equal(editor.context.editDraft, '1. First');
});

test('reopening and saving lists does not duplicate markers or change wording', () => {
  const content = 'First\nSecond\nPlain\nBullet\nAgain';
  const styles = ['numbered', 'numbered', 'none', 'bulleted', 'numbered'];
  const editor = createEditor(content, styles);
  assert.equal(editor.context.editDraft, '1. First\n2. Second\nPlain\n• Bullet\n1. Again');
  editor.props().onBlur();
  assert.equal(editor.updates.at(-1).content, content);
  assert.deepEqual(editor.updates.at(-1).textListLineStyles, styles);
});

test('deleting a visible marker removes the list style', () => {
  const editor = createEditor('First\nSecond', ['numbered', 'numbered']);
  changeDraft(editor, 'First\n2. Second');
  editor.props().onBlur();
  assert.equal(editor.updates.at(-1).content, 'First\nSecond');
  assert.deepEqual(editor.updates.at(-1).textListLineStyles, ['none', 'numbered']);
});
