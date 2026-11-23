import { renderToStaticMarkup } from 'react-dom/server';
import type { DesignElement } from '../components/builder/PrintStudioEditor';
import { ImageAdjustmentDefs } from '../components/builder/printsStudio/ImageAdjustmentDefs';
import { gradeIsActive } from '../components/builder/artwork-engine/image/grade';
import { DEFAULT_IMAGE_ADJUSTMENTS, imageAdjustmentFilter } from './imageAdjustments';
import { filteredImagePixels, paintFilteredImage } from './imageFilterRendering';
import { canvasPaint } from './studioPaint';

/** Print files must match the canvas: image looks, grades, ink colour and adjustments are baked into a copy. */
export async function bakeImageForPrint(element: DesignElement): Promise<DesignElement> {
  const filter = element.imageFilter && element.imageFilter.id !== 'none' ? element.imageFilter : undefined, grade = gradeIsActive(element.imageGrade) ? element.imageGrade : undefined, adjust = imageAdjustmentFilter(element);
  if (!filter && !grade && !element.color && !adjust) return element;
  try {
    const pixels = await filteredImagePixels(element.content, filter ?? { id: 'none' }, 8192, grade), canvas = document.createElement('canvas');
    paintFilteredImage(canvas, pixels, filter?.intensity ?? 100);
    if (element.color) {
      const context = canvas.getContext('2d')!;
      context.globalCompositeOperation = 'source-in'; context.fillStyle = canvasPaint(context, element.color, canvas.width, canvas.height); context.fillRect(0, 0, canvas.width, canvas.height);
    }
    let content = canvas.toDataURL('image/png');
    if (adjust) {
      const ratio = canvas.width / Math.max(1, element.width), css = adjust.replace(/blur\(([\d.]+)px\)/, (_, value) => `blur(${Number(value) * ratio}px)`);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">${renderToStaticMarkup(<ImageAdjustmentDefs element={element} />)}<image href="${content}" width="${canvas.width}" height="${canvas.height}" style="filter:${css}"/></svg>`;
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      try {
        const image = new Image(); image.src = url; await image.decode();
        const output = document.createElement('canvas'); output.width = canvas.width; output.height = canvas.height;
        output.getContext('2d')!.drawImage(image, 0, 0);
        content = output.toDataURL('image/png');
      } finally { URL.revokeObjectURL(url); }
    }
    return { ...element, ...DEFAULT_IMAGE_ADJUSTMENTS, content, imageFilter: undefined, imageGrade: undefined, color: undefined };
  } catch {
    throw new Error(`Could not prepare ${element.layerName ?? 'this image'} for print. Re-upload it, then export again.`);
  }
}
