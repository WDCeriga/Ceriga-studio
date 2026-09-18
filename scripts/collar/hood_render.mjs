import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const sharp = process.env.CERIGA_NODE_MODULES
  ? require(path.join(process.env.CERIGA_NODE_MODULES, 'sharp'))
  : require('sharp');
export const fits = ['boxy', 'cropped', 'baggy', 'regular', 'slim'];
export const suffix = (fit) => fit === 'boxy' ? '' : ` (${fit})`;
export const assetPath = (part, fit, name = part) =>
  `src/assets/hoodie-test/${part}/${name}${suffix(fit)}.svg`;
export const readAsset = (part, fit, name) => fs.readFileSync(assetPath(part, fit, name), 'utf8');
export function tint(svg, colour) {
  return svg.replace('fill="#000000"', `fill="${colour}"`);
}
export function inner(svg) {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}
export function composite(fit, hood = 'Scuba hood', coloured = true) {
  const parts = ['Left sleeve', 'Right sleeve', 'Body', 'Rib hem', 'Left cuff', 'Right cuff', 'Hood', 'Kangaroo pocket'];
  const colours = ['#94c9ed', '#94c9ed', '#eee6d7', '#81989a', '#b5a4d7', '#b5a4d7', '#e97766', '#eee6d7'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">${parts.map((part, i) => inner(tint(readAsset(part, fit, part === 'Hood' ? hood : part), coloured ? colours[i] : '#ffffff'))).join('')}</svg>`;
}
export async function rawSvg(svg, size = 1024) {
  return sharp(Buffer.from(svg)).resize(size, size).ensureAlpha().raw().toBuffer();
}
export async function proofs(directory, hood = 'Scuba hood') {
  fs.mkdirSync(directory, { recursive: true });
  const tiles = [];
  for (const fit of fits) {
    const svg = composite(fit, hood);
    await sharp(Buffer.from(svg)).png().toFile(`${directory}/${fit}.png`);
    const tile = await sharp(Buffer.from(svg)).resize(410, 410).flatten({ background: 'white' }).png().toBuffer();
    tiles.push({ input: tile, left: fits.indexOf(fit) * 410, top: 0 });
  }
  await sharp({ create: { width: 2050, height: 410, channels: 4, background: 'white' } }).composite(tiles).png().toFile(`${directory}/all-fits.png`);
}
