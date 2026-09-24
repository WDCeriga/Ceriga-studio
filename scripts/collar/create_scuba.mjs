import fs from 'node:fs';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { hash, rebuildHoods } from './rebuild_hood_variants.mjs';
import { validateRebuiltHoods } from './validate_rebuilt_hoods.mjs';

const root = 'src/assets/studio-hoodie/hoods/original-scuba-20260922';
const directory = `${root}/scuba`;
fs.mkdirSync(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 1024, 1024);
    context.strokeStyle = '#000000';
    context.lineWidth = 4;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.beginPath();
    context.moveTo(512, 120);
    context.bezierCurveTo(370, 120, 286, 218, 268, 374);
    context.bezierCurveTo(252, 518, 259, 668, 226, 778);
    context.bezierCurveTo(302, 846, 418, 882, 512, 888);
    context.bezierCurveTo(606, 882, 722, 846, 798, 778);
    context.bezierCurveTo(765, 668, 772, 518, 756, 374);
    context.bezierCurveTo(738, 218, 654, 120, 512, 120);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.moveTo(512, 238);
    context.bezierCurveTo(413, 238, 362, 323, 354, 424);
    context.bezierCurveTo(348, 492, 361, 557, 387, 602);
    context.bezierCurveTo(423, 639, 475, 654, 512, 656);
    context.bezierCurveTo(549, 654, 601, 639, 637, 602);
    context.bezierCurveTo(663, 557, 676, 492, 670, 424);
    context.bezierCurveTo(662, 323, 611, 238, 512, 238);
    context.closePath();
    context.stroke();

    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(372, 612);
    context.bezierCurveTo(332, 549, 329, 483, 336, 420);
    context.bezierCurveTo(347, 302, 407, 219, 512, 219);
    context.bezierCurveTo(617, 219, 677, 302, 688, 420);
    context.bezierCurveTo(695, 483, 692, 549, 652, 612);
    context.stroke();

    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(254, 661);
    context.bezierCurveTo(339, 672, 419, 725, 512, 748);
    context.bezierCurveTo(605, 725, 685, 672, 770, 661);
    context.moveTo(512, 748);
    context.bezierCurveTo(507, 793, 508, 843, 512, 884);
    context.stroke();

    context.lineWidth = 2.5;
    context.beginPath();
    context.moveTo(251, 683);
    context.bezierCurveTo(336, 696, 417, 747, 497, 767);
    context.moveTo(773, 683);
    context.bezierCurveTo(688, 696, 607, 747, 527, 767);
    context.moveTo(512, 124);
    context.lineTo(512, 211);
    context.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const source = Buffer.from(png, 'base64');
  await sharp(source).greyscale().png().toFile(`${directory}/source.png`);
  fs.writeFileSync(`${directory}/provenance.json`, JSON.stringify({
    reference: null,
    sourceSha256: hash(fs.readFileSync(`${directory}/source.png`)),
    method: 'Original Canvas raster construction: rounded crown, close face opening, raised wrap collar. No reference image or previous hood geometry used; SVG paths come only from Potrace.',
    reusedRejectedGeometry: false,
  }, null, 2) + '\n');
  console.log(`Original reference-free raster: ${directory}/source.png`);
} finally {
  await browser.close();
}

if (process.argv.includes('--build')) {
  const options = {
    root,
    variantDefinitions: [{ id: 'scuba', file: 'Scuba hood', label: 'Scuba Hood', matchRegularHeight: true }],
  };
  await rebuildHoods('scuba', options);
  await validateRebuiltHoods(false, options);
}