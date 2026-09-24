import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import sharp from 'sharp';

const reference = process.argv[2];
if (!reference || !fs.existsSync(reference)) throw new Error('Supply the scuba reference photo path.');
const root = 'src/assets/studio-hoodie/hoods/photo-scuba-20260922';
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
    context.scale(5.6, 5.6);
    context.translate(512 / 5.6 - 181, 18);
    context.strokeStyle = '#000000';
    context.lineWidth = 0.7;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.beginPath();
    context.moveTo(181, 14);
    context.bezierCurveTo(164, 14, 156, 12, 148, 24);
    context.bezierCurveTo(134, 42, 128, 61, 123, 80);
    context.bezierCurveTo(125, 84, 129, 86, 132, 90);
    context.bezierCurveTo(136, 102, 133, 114, 137, 125);
    context.bezierCurveTo(150, 134, 167, 142, 181, 144);
    context.bezierCurveTo(195, 142, 212, 134, 225, 125);
    context.bezierCurveTo(229, 114, 226, 102, 230, 90);
    context.bezierCurveTo(233, 86, 237, 84, 239, 80);
    context.bezierCurveTo(234, 61, 228, 42, 214, 24);
    context.bezierCurveTo(206, 12, 198, 14, 181, 14);
    context.closePath();
    context.stroke();

    context.beginPath();
    context.moveTo(123, 80);
    context.bezierCurveTo(154, 76, 208, 76, 239, 80);
    context.moveTo(126, 82);
    context.bezierCurveTo(156, 80, 206, 80, 236, 82);
    context.stroke();

    for (const side of [-1, 1]) {
      context.save();
      context.translate(181, 0);
      context.scale(side, 1);
      context.beginPath();
      context.moveTo(47, 83);
      context.bezierCurveTo(42, 94, 30, 105, 4, 118);
      context.lineTo(4, 141);
      context.moveTo(43, 87);
      context.bezierCurveTo(36, 102, 24, 113, 4, 122);
      context.moveTo(49, 91);
      context.bezierCurveTo(43, 108, 38, 123, 9, 137);
      context.stroke();
      context.lineWidth = 0.4;
      context.beginPath();
      context.moveTo(19, 15);
      context.bezierCurveTo(26, 29, 28, 53, 27, 77);
      context.stroke();
      context.restore();
    }

    context.lineWidth = 0.55;
    context.beginPath();
    context.moveTo(177, 118);
    context.lineTo(177, 110);
    context.quadraticCurveTo(181, 108, 185, 110);
    context.lineTo(185, 118);
    context.moveTo(181, 111);
    context.lineTo(181, 143);
    context.moveTo(162, 100);
    context.quadraticCurveTo(181, 111, 200, 100);
    context.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const source = Buffer.from(png, 'base64');
  await sharp(source).greyscale().threshold(180).png().toFile(`${directory}/source.png`);
  const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
  fs.copyFileSync(reference, `${directory}/reference.png`);
  fs.writeFileSync(`${directory}/provenance.json`, JSON.stringify({
    reference,
    referenceSha256: hash(fs.readFileSync(reference)),
    sourceSha256: hash(fs.readFileSync(`${directory}/source.png`)),
    method: 'Reference-observed construction drawn into Canvas raster; SVG geometry only from subsequent Potrace tracing.',
    reusedRejectedGeometry: false,
  }, null, 2) + '\n');
  console.log(`New raster: ${directory}/source.png`);
} finally {
  await browser.close();
}

if (process.argv.includes('--build')) {
  const { rebuildHoods } = await import('./rebuild_hood_variants.mjs');
  const { validateRebuiltHoods } = await import('./validate_rebuilt_hoods.mjs');
  const options = {
    root,
    variantDefinitions: [{ id: 'scuba', file: 'Scuba hood', label: 'Scuba Hood', aspect: 1.06 }],
  };
  await rebuildHoods('scuba', options);
  await validateRebuiltHoods(false, options);
}