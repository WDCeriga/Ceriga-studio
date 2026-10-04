import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5184 } });
await server.listen();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  await page.goto(server.resolvedUrls.local[0]);
  const calibration = await page.evaluate(async () => {
    const catalog = await import('/src/app/data/garmentSvgCatalog.ts');
    const neck = await import('/src/app/data/hoodieNecklines.ts');
    for (const fit of ['slim', 'regular', 'boxy', 'cropped', 'baggy']) {
      const selection = catalog.getDefaultGarmentSelection('hoodie', fit);
      const normal = catalog.resolveGarmentLayers({ garmentType: 'hoodie', selection, fit });
      for (const construction of ['', 'Raglan ', 'Dropped Shoulder ']) {
        const name = `${construction}Body${fit === 'boxy' ? '' : ` (${fit})`}.svg`;
        const raw = await fetch(`/src/assets/hoodie-test/Body/${encodeURIComponent(name)}?raw`).then(response => response.text());
        if (!raw.startsWith('<svg') && !raw.includes('<?xml')) throw new Error(`Missing body: ${name}`);
        const layers = normal.map(layer => layer.id === 'base' ? { ...layer, svgRaw: raw } : layer);
        for (const option of neck.SWEATSHIRT_NECKLINES) neck.withSweatshirtNeckline(layers, neck.selectSweatshirtConstruction(selection, option.id), fit);
      }
    }
    return neck.sweatshirtCalibration();
  });
  await writeFile('src/assets/studio-hoodie/neckline-donors/calibration.json', JSON.stringify(calibration));
  console.log(`Calibrated ${Object.keys(calibration.profiles).length} donor profiles and ${Object.keys(calibration.sockets).length} body sockets.`);
} finally {
  await browser.close();
  await server.close();
}