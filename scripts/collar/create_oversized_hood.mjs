import fs from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { candidate, hash, rebuildHoods } from './rebuild_hood_variants.mjs';
import { validateRebuiltHoods } from './validate_rebuilt_hoods.mjs';
import { assetPath, fits } from './hood_render.mjs';

const root = 'src/assets/studio-hoodie/hoods/original-oversized-20260922';
const variant = { id: 'oversized', file: 'Oversized Hood', label: 'Oversized Hood', regularHeightScale: 1.18, crownWidthScale: 1.2, traceSmoothing: 0.5 };
const options = { root, variantDefinitions: [variant] };
const directory = `${root}/${variant.id}`;
fs.mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 4096;
    canvas.height = 4096;
    const context = canvas.getContext('2d');
    context.scale(4, 4);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 1024, 1024);
    context.strokeStyle = '#000000';
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.beginPath();
    context.moveTo(512, 100);
    context.bezierCurveTo(338, 100, 218, 166, 191, 315);
    context.bezierCurveTo(164, 467, 167, 653, 184, 780);
    context.bezierCurveTo(264, 850, 409, 898, 512, 900);
    context.bezierCurveTo(615, 898, 760, 850, 840, 780);
    context.bezierCurveTo(857, 653, 860, 467, 833, 315);
    context.bezierCurveTo(806, 166, 686, 100, 512, 100);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.moveTo(512, 216);
    context.bezierCurveTo(390, 216, 301, 283, 293, 413);
    context.bezierCurveTo(282, 555, 330, 687, 410, 777);
    context.bezierCurveTo(444, 819, 480, 851, 512, 870);
    context.bezierCurveTo(544, 851, 580, 819, 614, 777);
    context.bezierCurveTo(694, 687, 742, 555, 731, 413);
    context.bezierCurveTo(723, 283, 634, 216, 512, 216);
    context.closePath();
    context.stroke();

    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(491, 865);
    context.bezierCurveTo(345, 755, 261, 570, 274, 412);
    context.bezierCurveTo(283, 271, 378, 197, 512, 197);
    context.bezierCurveTo(646, 197, 741, 271, 750, 412);
    context.bezierCurveTo(763, 570, 679, 755, 533, 865);
    context.moveTo(512, 105);
    context.lineTo(512, 189);
    context.moveTo(220, 671);
    context.bezierCurveTo(232, 757, 309, 818, 382, 841);
    context.moveTo(804, 671);
    context.bezierCurveTo(792, 757, 715, 818, 642, 841);
    context.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await sharp(Buffer.from(png, 'base64')).greyscale().png().toFile(`${directory}/source.png`);
  fs.writeFileSync(`${directory}/provenance.json`, JSON.stringify({
    reference: null,
    sourceSha256: hash(fs.readFileSync(`${directory}/source.png`)),
    method: 'Original 4096px Canvas raster: broad rounded crown, roomy deep opening, turned edge and relaxed side folds. No previous hood artwork used; SVG paths generated only by Potrace.',
    reusedRejectedGeometry: false,
  }, null, 2) + '\n');
} finally {
  await browser.close();
}

if (process.argv.includes('--build') || process.argv.includes('--publish')) {
  await rebuildHoods(variant.id, options);
  await validateRebuiltHoods(false, options);
}
if (process.argv.includes('--publish')) {
  const targets = fits.map((fit) => ({ source: candidate(variant, fit, root), destination: assetPath('Hood', fit, variant.file) }));
  for (const target of targets) {
    if (fs.existsSync(target.destination)) throw new Error(`Refusing to overwrite existing hood: ${target.destination}`);
  }
  const created = [];
  try {
    for (const target of targets) {
      fs.copyFileSync(target.source, target.destination, fs.constants.COPYFILE_EXCL);
      created.push(target.destination);
    }
    await validateRebuiltHoods(true, options);
  } catch (error) {
    for (const destination of created) fs.unlinkSync(destination);
    throw error;
  }
  console.log(`Added ${created.length} Oversized Hood assets; existing hoods unchanged.`);
}