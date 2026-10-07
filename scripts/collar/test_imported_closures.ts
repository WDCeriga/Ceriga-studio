import { isolatedZipSvg, maskImportedZipInk, type ImportedZipClosure } from '../../src/app/data/importedClosures';
import { tintPotraceSvg } from '../../src/app/lib/tshirtSvgUtils';

export async function verifyImportedZipPixels(ink: string, zip: ImportedZipClosure) {
  const pixels = async (svg: string) => {
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1024;
      const context = canvas.getContext('2d')!;
      context.drawImage(image, 0, 0, 1024, 1024);
      return context.getImageData(0, 0, 1024, 1024).data;
    } finally { URL.revokeObjectURL(url); }
  };
  const svg = (content: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">${content}</svg>`;
  const original = await pixels(svg(ink));
  const isolated = isolatedZipSvg(ink, zip);
  const recoloured = await pixels(svg(maskImportedZipInk(ink, [zip]) + tintPotraceSvg(isolated, '#ff0000')));
  const mask = await pixels(svg(`<path fill="black" fill-rule="evenodd" d="${zip.maskPath}"/>`));
  const converted = await pixels(svg(maskImportedZipInk(ink, [zip])));
  let changedInside = 0, changedOutside = 0, removedInside = 0;
  for (let i = 0; i < original.length; i += 4) {
    const changed = Math.max(...[0, 1, 2, 3].map(c => Math.abs(original[i + c] - recoloured[i + c]))) > 3;
    if (mask[i + 3] === 0 && changed) changedOutside++;
    if (mask[i + 3] > 0 && changed && recoloured[i] > 100) changedInside++;
    if (mask[i + 3] === 255 && original[i + 3] > 100 && converted[i + 3] < 4) removedInside++;
  }
  if (!changedInside || !removedInside || changedOutside) throw new Error(`Zip pixel isolation failed: ${JSON.stringify({ changedInside, removedInside, changedOutside })}`);
  return { changedInside, removedInside, changedOutside };
}
