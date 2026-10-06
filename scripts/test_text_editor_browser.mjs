import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5176';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${baseUrl}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  for (let step = 0; step < 10 && !await page.getByRole('button', { name: 'Continue to Review', exact: true }).isVisible(); step++) {
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  }
  await page.getByRole('button', { name: 'Typography', exact: true }).click();
  const box = page.locator('[data-print-id]').first();
  const editor = box.locator('textarea');
  const settingsInput = page.getByRole('textbox', { name: 'Type, then add', exact: true });
  assert.equal(await page.getByText('Start a list with - or 1.', { exact: false }).count(), 0, 'List instructions should not appear below the input');
  for (const marker of ['1.', '-']) {
    await settingsInput.fill('');
    await settingsInput.pressSequentially(marker);
    assert.equal(await settingsInput.inputValue(), marker === '-' ? '• ' : '1. ');
    await settingsInput.pressSequentially('First');
    await settingsInput.press('Enter');
    assert.equal(await page.locator('[data-print-id]').count(), 0, 'Enter in settings must continue editing, not add an asset');
    assert.match(await settingsInput.inputValue(), marker === '-' ? /\n• $/ : /\n2\. $/);
    await settingsInput.pressSequentially('Second');
    await settingsInput.press('Enter');
    await settingsInput.press('Enter');
    await settingsInput.pressSequentially('Plain');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    assert.deepEqual(await box.locator('[data-text-body] span[aria-hidden]').allTextContents(), marker === '-' ? ['•', '•'] : ['1.', '2.']);
    await box.locator('[data-text-body]').dblclick();
    const savedDraft = marker === '-' ? '• First\n• Second\nPlain' : '1. First\n2. Second\nPlain';
    assert.equal(await editor.inputValue(), savedDraft);
    await editor.press('Control+End');
    await editor.press('Home');
    await editor.pressSequentially(marker);
    assert.equal(await editor.inputValue(), savedDraft.replace('Plain', `${marker === '-' ? '•' : '1.'} Plain`), 'Typing a marker before existing wording must show the marker');
    await editor.press('Control+End');
    await editor.press('Enter');
    await editor.pressSequentially('Third');
    await editor.press('Tab');
    assert.deepEqual(await box.locator('[data-text-body] span[aria-hidden]').allTextContents(), marker === '-' ? ['•', '•', '•', '•'] : ['1.', '2.', '3.', '4.']);
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
  }
  await settingsInput.fill('Intro\n- Pasted first\n- Pasted second\n1. Numbered');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  assert.deepEqual(await box.locator('[data-text-body] span[aria-hidden]').allTextContents(), ['•', '•', '1.']);
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
  for (const marker of ['1.', '-', '1. ', '- ', '12.', '12. ']) {
    console.log(`Checking editor marker ${JSON.stringify(marker)}`);
    await page.getByRole('textbox', { name: 'Type, then add', exact: true }).fill('Original');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await box.locator('[data-text-body]').dblclick();
    await editor.fill('');
    await editor.pressSequentially(marker);
    const firstPrefix = await editor.inputValue();
    assert.match(firstPrefix, marker.startsWith('-') ? /^• +$/ : /^\d+\. +$/, 'List marker must remain visible while editing');
    await editor.pressSequentially('First');
    await editor.press('Enter');
    await editor.pressSequentially('Second');
    await editor.press('Enter');
    await editor.press('Enter');
    await editor.pressSequentially('Plain');
    const nextPrefix = marker.startsWith('-') ? '• ' : `${Number.parseInt(marker, 10) + 1}. `;
    assert.equal(await editor.inputValue(), `${firstPrefix}First\n${nextPrefix}Second\nPlain`, 'Rapid list typing must preserve visible markers, caret and wording');
    await editor.press('Tab');
    assert.deepEqual(await box.locator('[data-text-body] span[aria-hidden]').allTextContents(), marker.startsWith('-') ? ['•', '•'] : ['1.', '2.']);

    await box.locator('[data-text-body]').dblclick();
    await editor.fill('Discard these edits');
    await editor.press('Escape');
    assert.match(await box.innerText(), /Second/);
    assert.doesNotMatch(await box.innerText(), /Discard/);

    const before = await box.boundingBox();
    for (const name of ['Align left', 'Align center', 'Align right']) {
      await page.getByRole('button', { name, exact: true }).first().click();
      assert.deepEqual(await box.boundingBox(), before, 'Alignment must keep the existing box anchored');
    }
    await page.getByRole('slider', { name: 'Curve amount', exact: true }).fill('70');
    await page.waitForFunction(() => document.querySelectorAll('[data-text-body] textPath').length >= 3);
    assert.match((await box.locator('textPath').allTextContents()).join(''), /First.*Second.*Plain/);
    await box.locator('[data-text-body]').dblclick();
    assert.equal(await editor.inputValue(), marker.startsWith('-') ? '• First\n• Second\nPlain' : '1. First\n2. Second\nPlain');
    await editor.fill('Changed\nStill editable');
    await editor.press('Tab');
    await page.waitForFunction(() => document.querySelector('[data-text-body] svg')?.getAttribute('aria-label') === 'Changed\nStill editable');
    assert.match((await box.locator('textPath').allTextContents()).join(''), /Changed.*Still editable/);
    const arcBox = await box.boundingBox();
    const anchor = await box.evaluate(node => ({ left: node.style.left, top: node.style.top }));
    await page.getByRole('combobox', { name: 'Curve shape', exact: true }).first().selectOption('circle');
    await page.waitForFunction(() => document.querySelector('[data-text-body] textPath')?.getAttribute('lengthAdjust') === 'spacing');
    await box.locator('[data-text-body]').dblclick();
    assert.equal(await editor.inputValue(), 'Changed\nStill editable', 'Circle text retains its original editable wording');
    await editor.press('Tab');
    await page.waitForFunction(() => document.querySelector('[data-text-body] textPath')?.getAttribute('lengthAdjust') === 'spacing');
    const circleBox = await box.boundingBox();
    assert(circleBox.width < 400, 'Switching to circle should use a practical size, not an oversized default');
    await page.getByRole('slider', { name: 'Curve amount', exact: true }).fill('55');
    assert.equal((await box.boundingBox()).width, circleBox.width, 'Amount should not reset circle dimensions');
    await page.getByRole('combobox', { name: 'Curve shape', exact: true }).first().selectOption('arc');
    await page.waitForFunction(width => Math.abs(document.querySelector('[data-print-id]').getBoundingClientRect().width - width) < 0.1, arcBox.width);
    assert.deepEqual(await box.evaluate(node => ({ left: node.style.left, top: node.style.top })), anchor, 'Curve mode switches retain the placed anchor');
    await page.getByRole('button', { name: 'Delete', exact: true }).first().click();
    assert.equal(await page.locator('[data-print-id]').count(), 0);
  }
  assert.deepEqual(errors, []);
  console.log('Typography editor checks passed: settings-to-garment lists, pasted lists, markers before existing wording, continuation/exit, cancellation, anchored alignment, and editable multiline curves.');
} finally {
  await browser.close();
}
