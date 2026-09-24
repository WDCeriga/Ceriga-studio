import fs from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { hash, rebuildHoods } from './rebuild_hood_variants.mjs';
import { validateRebuiltHoods } from './validate_rebuilt_hoods.mjs';

const root = 'src/assets/studio-hoodie/hoods/refined-funnel-20260922';
const directory = `${root}/funnel-hood-hybrid`;
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
    context.lineWidth = 4;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.beginPath();
    context.moveTo(512, 100);
    context.bezierCurveTo(355, 100, 238, 200, 220, 350);
    context.bezierCurveTo(203, 476, 238, 551, 222, 638);
    context.bezierCurveTo(215, 698, 190, 759, 184, 802);
    context.bezierCurveTo(285, 848, 400, 875, 512, 878);
    context.bezierCurveTo(624, 875, 739, 848, 840, 802);
    context.bezierCurveTo(834, 759, 809, 698, 802, 638);
    context.bezierCurveTo(786, 551, 821, 476, 804, 350);
    context.bezierCurveTo(786, 200, 669, 100, 512, 100);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.moveTo(331, 624);
    context.bezierCurveTo(303, 551, 289, 468, 303, 382);
    context.bezierCurveTo(319, 267, 402, 202, 512, 202);
    context.bezierCurveTo(622, 202, 705, 267, 721, 382);
    context.bezierCurveTo(735, 468, 721, 551, 693, 624);
    context.stroke();

    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(348, 629);
    context.bezierCurveTo(321, 551, 307, 469, 321, 385);
    context.bezierCurveTo(337, 282, 413, 221, 512, 221);
    context.bezierCurveTo(611, 221, 687, 282, 703, 385);
    context.bezierCurveTo(717, 469, 703, 551, 676, 629);
    context.moveTo(512, 104);
    context.lineTo(512, 202);
    context.stroke();

    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(226, 611);
    context.bezierCurveTo(309, 611, 401, 651, 512, 651);
    context.bezierCurveTo(623, 651, 715, 611, 798, 611);
    context.stroke();

    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(224, 627);
    context.bezierCurveTo(313, 629, 406, 670, 512, 670);
    context.bezierCurveTo(618, 670, 711, 629, 800, 627);
    context.moveTo(311, 662);
    context.bezierCurveTo(309, 727, 291, 777, 277, 820);
    context.moveTo(713, 662);
    context.bezierCurveTo(715, 727, 733, 777, 747, 820);
    context.moveTo(349, 696);
    context.bezierCurveTo(355, 725, 368, 748, 382, 764);
    context.moveTo(675, 696);
    context.bezierCurveTo(669, 725, 656, 748, 642, 764);
    context.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await sharp(Buffer.from(png, 'base64')).greyscale().png().toFile(`${directory}/source.png`);
  fs.writeFileSync(`${directory}/provenance.json`, JSON.stringify({
    reference: null,
    sourceSha256: hash(fs.readFileSync(`${directory}/source.png`)),
    method: 'Original 4096px Canvas raster: full crown, tapered side panels, recessed face opening and turned funnel edge. Potrace-only SVG geometry. Regular Hood supplies attachment and total height, not design geometry.',
    reusedRejectedGeometry: false,
  }, null, 2) + '\n');
  console.log(`New funnel raster: ${directory}/source.png`);
} finally {
  await browser.close();
}

if (process.argv.includes('--build')) {
  const options = {
    root,
    variantDefinitions: [{ id: 'funnel-hood-hybrid', file: 'Funnel-hood hybrid', label: 'Funnel Hybrid Hood', matchRegularHeight: true, traceSmoothing: 0.5 }],
  };
  await rebuildHoods('funnel-hood-hybrid', options);
  await validateRebuiltHoods(false, options);
}