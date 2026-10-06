import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.CERIGA_BASE_URL || 'http://127.0.0.1:5189'}/builder/hd-001`);
  await page.getByRole('button', { name: 'Continue', exact: true }).waitFor();
  for (let step = 0; step < 10 && !await page.getByRole('button', { name: 'Continue to Review', exact: true }).isVisible(); step++) {
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  }
  await page.getByRole('button', { name: 'Continue to Review', exact: true }).waitFor();
  const zone = page.locator('[data-print-design-zone]');
  const drop = async id => zone.evaluate((node,id) => {
    const box = node.getBoundingClientRect();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('application/x-ceriga-asset', JSON.stringify({kind:'shape',id}));
    node.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer,clientX:box.x+box.width*.5,clientY:box.y+box.height*.5}));
  },id);
  await drop('rect');
  await drop('ellipse');
  const ids = await zone.locator('[data-print-id]').evaluateAll(nodes=>nodes.map(node=>node.dataset.printId));
  assert.equal(ids.length,2);
  await page.getByRole('checkbox',{name:'Select layer 1 for group or merge',exact:true}).check();
  assert.equal(await page.getByRole('button',{name:/^Merge Layers/}).isDisabled(),true);
  await page.getByRole('checkbox',{name:'Select layer 2 for group or merge',exact:true}).check();
  await page.getByRole('button',{name:/^Merge Layers/}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-print-design-zone] [data-print-id]').length===1);
  const merged = zone.locator('[data-print-id]');
  const mergedId = await merged.getAttribute('data-print-id');
  const content = await merged.locator('img').getAttribute('src');
  assert(content.startsWith('data:image/png;base64,'));
  assert(!ids.includes(mergedId));
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  assert.equal(await zone.locator('[data-print-id]').count(),2);
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('[data-print-design-zone] [data-print-id]').length===1);
  await page.evaluate(async () => { window.artworkAtPoint = (await import('/src/app/lib/artworkHitTesting.ts')).artworkAtPoint; });
  const paintedPoint = await page.waitForFunction(id => {
    const artworkAtPoint = window.artworkAtPoint;
    const zone = document.querySelector('[data-print-design-zone]');
    const bounds = zone.querySelector('[data-visible-bounds]').getBoundingClientRect();
    for (let y = bounds.top + 1; y < bounds.bottom; y += 3) for (let x = bounds.left + 1; x < bounds.right; x += 3) {
      if (artworkAtPoint(zone, x, y)?.dataset.printId === id) return { x, y };
    }
    return false;
  }, mergedId);
  const clickPoint = await paintedPoint.jsonValue();
  await page.mouse.click(clickPoint.x, clickPoint.y);
  await page.getByTitle('Crop',{exact:true}).click();
  await page.getByRole('button',{name:'Resize crop left',exact:true}).press('Shift+ArrowRight');
  await page.getByRole('button',{name:'Apply crop',exact:true}).click();
  assert.equal(await merged.locator('[data-asset-content]').evaluate(node=>node.style.clipPath),'inset(0% 0% 0% 5%)');
  assert.equal(await merged.locator('img').getAttribute('src'),content);
  await page.getByRole('button',{name:'Undo',exact:true}).click();
  assert.equal(await merged.locator('[data-asset-content]').evaluate(node=>node.style.clipPath),'');
  await page.getByRole('button',{name:'Redo',exact:true}).click();
  assert.equal(await merged.locator('[data-asset-content]').evaluate(node=>node.style.clipPath),'inset(0% 0% 0% 5%)');
  await page.getByRole('button',{name:/^back$/i}).last().click();
  await drop('triangle');
  const backId = await zone.locator('[data-print-id]').getAttribute('data-print-id');
  await page.getByRole('button',{name:'Continue to Review',exact:true}).click();
  for (let step = 0; step < 2; step++) {
    await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  }
  await page.getByRole('button', { name: /Reset size split|One per size/ }).first().click();
  await page.getByRole('button', { name: 'Continue', exact: true }).first().click();
  await page.getByRole('button', { name: 'Order', exact: true }).waitFor();
  assert.equal(await zone.locator(`[data-print-id="${backId}"]`).count(), 1);
  await page.getByRole('button', { name: /^front$/i }).last().click();
  assert.equal(await zone.locator(`[data-print-id="${mergedId}"]`).count(), 1);
  assert.equal(await zone.locator('[data-asset-content]').evaluate(node => node.style.clipPath), 'inset(0% 0% 0% 5%)');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-project-garment-side="front"]').first().waitFor();
  assert(await page.locator(`[data-project-garment-side="front"] [data-print-id="${mergedId}"]`).count()>0);
  assert(await page.locator(`[data-project-garment-side="back"] [data-print-id="${backId}"]`).count()>0);
  assert.equal(await page.locator(`[data-project-garment-side="front"] [data-print-id="${backId}"]`).count(),0);
  assert.equal(await page.locator('[data-project-garment-side] [data-crop-editor]').count(),0);
  const frames = await page.locator('[data-design-canvas]').evaluateAll(nodes=>nodes.map(node=>[node.offsetWidth,node.offsetHeight]));
  assert(frames.every(size=>size[0]===frames[0][0] && size[1]===frames[0][1]),JSON.stringify(frames));
  await page.getByRole('button', { name: 'Order', exact: true }).click();
  await page.waitForURL('**/delivery');
  await page.locator('[data-project-garment-side="front"]').waitFor();
  assert.equal(await page.locator(`[data-project-garment-side="front"] [data-print-id="${mergedId}"] img`).getAttribute('src'), content);
  assert.equal(await page.locator(`[data-project-garment-side="back"] [data-print-id="${backId}"]`).count(), 1);
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForURL('**/builder/hd-001');
  await page.locator(`[data-project-garment-side="front"] [data-print-id="${mergedId}"]`).waitFor();
  assert.equal(await page.locator(`[data-project-garment-side="back"] [data-print-id="${backId}"]`).count(), 1);
  assert.deepEqual(errors,[]);
  console.log('Real editor passed: atomic merge undo/redo, non-destructive crop undo/redo, desktop/mobile Review, front/back Delivery continuity and return-to-editor restoration. No order submitted.');
} finally { await browser.close(); }
