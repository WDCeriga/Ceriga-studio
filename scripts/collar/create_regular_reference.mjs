import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { DOMParser } from '@xmldom/xmldom';
import { traceAlpha } from './replace_scuba_from_lineart.mjs';
import { parsePart, sha256, workspaceRoot } from './validate_hoodie_pack.mjs';

const output = path.join(workspaceRoot, 'src/assets/studio-hoodie/hoods/regular-reference-v1');
const canvasSize = 2048;
const definitions = [
  {
    id: 'front-lowered', center: 215, top: 75,
    silhouette: 'M104 182 C106 137 119 110 150 94 C172 82 195 75 215 75 C237 75 264 86 288 101 C315 118 327 146 329 182 Q276 204 215 201 Q153 201 104 182 Z',
    seams: [
      'M126 124 C145 107 185 90 215 90 C245 90 285 108 305 125 C289 153 252 180 215 201 C178 183 141 152 126 124 Z',
      'M118 129 C124 158 163 190 193 200',
      'M312 129 C306 158 267 190 237 200',
      'M215 75 L215 160',
      'M175 167 Q214 156 255 167',
      'M181 171 Q214 163 249 171',
    ],
    stitches: ['M122 121 Q214 52 310 122', 'M114 138 Q139 174 178 192', 'M317 138 Q292 174 254 192'],
    cords: [
      'M176 188 C171 219 172 266 171 307 L171 323 L175 323 L176 307 C176 269 177 220 180 190 Z',
      'M252 188 C255 218 258 266 258 307 L260 323 L264 323 L263 307 C263 265 261 218 256 190 Z',
    ],
    exits: [[178, 189], [254, 189]],
    shoulders: 'M54 202 Q82 186 104 182 M329 182 Q353 187 375 202',
  },
  {
    id: 'back-lowered', center: 563, top: 75,
    silhouette: 'M454 182 C455 144 462 119 484 104 C511 84 541 75 563 75 C590 75 621 86 644 103 C669 120 677 150 677 182 Q621 205 563 207 Q506 205 454 182 Z',
    seams: ['M563 75 L563 207'],
    stitches: ['M460 134 C482 111 528 88 563 88 C601 88 646 112 667 134'],
    cords: [], exits: [],
    shoulders: 'M404 202 Q430 187 454 182 M677 182 Q701 187 724 202',
  },
  {
    id: 'front-raised', center: 214, top: 405,
    silhouette: 'M148 604 C143 578 126 554 119 534 C110 505 129 477 144 452 C162 422 186 405 214 405 C242 405 265 425 281 452 C297 478 318 505 309 534 C302 554 284 579 281 604 Q256 631 214 643 Q173 629 148 604 Z',
    seams: [
      'M120 500 C146 477 177 464 214 464 C248 464 280 477 306 500',
      'M155 477 C145 505 142 535 150 557 C164 591 190 622 214 643 C239 622 265 591 278 557 C286 535 282 504 272 477',
      'M124 497 C110 543 151 586 171 612',
      'M302 497 C316 543 278 586 256 612',
      'M214 405 L214 597',
      'M177 601 Q214 590 251 601',
      'M182 606 Q214 597 246 606',
    ],
    stitches: ['M136 474 Q214 433 292 474', 'M129 499 C119 542 151 580 177 608', 'M298 499 C309 542 278 580 252 608'],
    cords: [
      'M174 613 C169 642 169 687 168 733 L168 749 L172 749 L173 733 C174 687 174 643 178 615 Z',
      'M251 613 C255 643 256 687 256 733 L257 749 L261 749 L261 733 C262 685 260 640 255 615 Z',
    ],
    exits: [[176, 614], [253, 614]],
    shoulders: 'M64 633 Q106 613 148 604 M281 604 Q327 616 364 634',
  },
  {
    id: 'back-raised', center: 563, top: 405,
    silhouette: 'M505 599 C494 575 474 552 468 531 C460 507 474 482 490 457 C510 425 536 405 563 405 C591 405 615 425 636 457 C651 482 666 508 658 532 C652 554 632 576 622 599 Q564 595 505 599 Z',
    seams: ['M563 405 L563 597'],
    stitches: ['M479 487 C466 526 482 552 497 574', 'M647 487 C660 526 644 552 630 574'],
    cords: [], exits: [],
    shoulders: 'M413 633 Q463 608 505 599 M622 599 Q670 611 713 633',
  },
];

function wrap(title, coordinates) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048"><title>${title}</title>${coordinates.map((geometry, index) => `<g transform="translate(0,2048) scale(0.1,-0.1)" fill="${index ? '#141414' : '#000000'}" stroke="none"><path d="${geometry}" fill-rule="evenodd"/></g>`).join('')}</svg>\n`;
}

async function trace(png) {
  const mask = await sharp(png).extractChannel('alpha').raw().toBuffer();
  const svg = await traceAlpha(mask, canvasSize, canvasSize, 1);
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const geometry = document.getElementsByTagName('path')[0].getAttribute('d');
  assert(!/[^MLCZ\d\s.,-]/i.test(geometry));
  return geometry.replace(/([MLC])([^MLCZ]*)/gi, (_, command, numbers) => {
    const values = numbers.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    return command + values.map((value, index) => (index % 2 ? (canvasSize - value / 3) * 10 : value / 3 * 10).toFixed(2)).join(' ');
  });
}

async function generate() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const assets = [];
  try {
    const page = await browser.newPage();
    for (const definition of definitions) {
      const layers = await page.evaluate((definition) => {
        const make = () => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 2048;
          const context = canvas.getContext('2d');
          context.translate(1024, 300);
          context.scale(3.5, 3.5);
          context.translate(-definition.center, -definition.top);
          context.lineJoin = context.lineCap = 'round';
          context.lineWidth = 1.9;
          return { canvas, context };
        };
        const fabric = make();
        fabric.context.fillStyle = '#000000';
        fabric.context.fill(new Path2D(definition.silhouette));
        for (const cord of definition.cords) fabric.context.fill(new Path2D(cord));
        const ink = make();
        ink.context.strokeStyle = '#141414';
        for (const geometry of [definition.silhouette, ...definition.seams]) ink.context.stroke(new Path2D(geometry));
        ink.context.lineWidth = 1.05;
        ink.context.setLineDash([4, 2.5]);
        for (const geometry of definition.stitches) ink.context.stroke(new Path2D(geometry));
        ink.context.setLineDash([]);
        ink.context.lineWidth = 1.4;
        for (const [horizontal, vertical] of definition.exits) {
          ink.context.beginPath();
          ink.context.ellipse(horizontal, vertical, 3.4, 5, -0.4, 0, Math.PI * 2);
          ink.context.stroke();
        }
        for (const cord of definition.cords) {
          ink.context.save();
          ink.context.globalCompositeOperation = 'destination-out';
          ink.context.fill(new Path2D(cord));
          ink.context.restore();
          ink.context.stroke(new Path2D(cord));
        }
        if (definition.id === 'front-lowered') {
          ink.context.stroke(new Path2D('M171 307 L176 307 M258 307 L263 307'));
        } else if (definition.id === 'front-raised') {
          ink.context.stroke(new Path2D('M168 733 L173 733 M256 733 L261 733'));
        }
        return [fabric.canvas, ink.canvas].map(canvas => canvas.toDataURL('image/png').split(',')[1]);
      }, definition);
      const coordinates = await Promise.all(layers.map(bytes => trace(Buffer.from(bytes, 'base64'))));
      const svg = wrap(`Ceriga Regular Hood - ${definition.id} - construction reference`, coordinates);
      parsePart(svg);
      const file = `${definition.id}.svg`;
      fs.writeFileSync(path.join(output, file), svg);
      await sharp(Buffer.from(svg.replace('fill="#000000"', 'fill="#ffffff"')))
        .flatten({ background: 'white' }).resize(640, 640).png().toFile(path.join(output, `${definition.id}.png`));
      assets.push({ file, sha256: sha256(svg), view: definition.id.split('-')[0], pose: definition.id.split('-')[1] });
    }
  } finally {
    await browser.close();
  }
  const tiles = assets.map((asset, index) => ({ input: path.join(output, asset.file.replace('.svg', '.png')), left: index % 2 * 640, top: Math.floor(index / 2) * 640 }));
  await sharp({ create: { width: 1280, height: 1280, channels: 4, background: 'white' } })
    .composite(tiles).png().toFile(path.join(output, 'construction-proof.png'));
  fs.writeFileSync(path.join(output, 'construction.json'), JSON.stringify({
    schemaVersion: 1, style: 'regular', canvas: [2048, 2048],
    status: 'construction-reference-only', registered: false,
    reference: 'User-supplied four-view regular hood drawing; manually reconstructed from visible contours, then rasterized and Potrace traced. Original attachment bytes unavailable.',
    poses: 'Lowered and raised views of the same normal-depth hood, not separate hood styles.',
    fabric: 'Single tintable fabric group; lining uses the same fabric color. Fixed technical ink.',
    attachment: 'Reference attachment contour retained. No fit-specific registration, rear body validation or live installation performed.',
    sourceToCanvas: { scale: 3.5, crownTop: 300, centerX: 1024 },
    generatorSha256: sha256(fs.readFileSync(new URL(import.meta.url))), assets,
  }, null, 2) + '\n');
}

async function validate() {
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'construction.json'), 'utf8'));
  assert.equal(manifest.registered, false);
  assert.equal(manifest.generatorSha256, sha256(fs.readFileSync(new URL(import.meta.url))));
  assert.deepEqual(manifest.assets.map(asset => asset.file), definitions.map(definition => `${definition.id}.svg`));
  for (const asset of manifest.assets) {
    const svg = fs.readFileSync(path.join(output, asset.file), 'utf8');
    assert.equal(sha256(svg), asset.sha256);
    parsePart(svg);
    const raster = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
    let pixels = 0;
    for (let row = 0; row < canvasSize; row++) for (let column = 0; column < canvasSize; column++) {
      if (raster[(row * canvasSize + column) * 4 + 3] < 128) continue;
      assert(column > 8 && column < canvasSize - 9 && row > 8 && row < canvasSize - 9, `${asset.file}: clipped geometry`);
      pixels++;
    }
    assert(pixels > 100000, `${asset.file}: empty geometry`);
    console.log(`${asset.file}: strict two-group SVG, nonempty, unclipped, hash verified`);
  }
}

if (!process.argv.includes('--validate')) await generate();
await validate();