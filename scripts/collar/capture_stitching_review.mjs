import fs from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright';
import sharp from 'sharp';

const source = process.argv.includes('--source');
const directory = '.tmp-hoodie-assembly/stitching-review';
fs.mkdirSync(directory, { recursive: true });
const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const fits = ['slim', 'regular', 'boxy', 'cropped', 'baggy'];
  const ids = source ? ['regular', 'set-in', 'pocket', 'waistband-cuff', 'scuba']
    : ['regular', 'deep-crossover', 'scuba', 'set-in', 'raglan', 'pocket', 'waistband-cuff', 'regular-crossover', 'deep-standard'];
  for (const fit of fits) {
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/scripts/collar/stitching-review.html?fit=${fit}${source ? '&grid' : ''}`);
    await page.locator('body[data-ready=true]').waitFor();
    await page.locator('#regular svg.proof').evaluate(element => element.setAttribute('viewBox', '780 80 490 650'));
    await page.locator('#scuba svg.proof').evaluate(element => element.setAttribute('viewBox', '760 110 540 600'));
    if (source || fit !== 'boxy') await page.locator('#waistband-cuff svg.proof').evaluate(element => {
      element.setAttribute('viewBox', '400 1340 1250 560');
      element.style.aspectRatio = '1250 / 560';
    });
    for (const id of ids) {
      await page.locator(`#${id}`).screenshot({ path: `${directory}/${source ? 'source-' : ''}${fit}-${id}.png` });
    }
  }
  if (fits.length > 1) {
    for (const id of ids) {
      const images = await Promise.all(fits.map(async (fit, index) => ({
        input: await sharp(`${directory}/${source ? 'source-' : ''}${fit}-${id}.png`).resize({ width: 500, height: 530, fit: 'contain', background: '#ffffff' }).png().toBuffer(),
        left: index * 500, top: 0,
      })));
      await sharp({ create: { width: 2500, height: 530, channels: 4, background: '#ffffff' } })
        .composite(images).png().toFile(`${directory}/${source ? 'source-' : ''}${id}-fits.png`);
    }
  }
  console.log(`Captured ${fits.length * ids.length} ${source ? 'source' : 'stitched'} close-ups in ${directory}`);
} finally {
  await browser?.close();
  await server.close();
}