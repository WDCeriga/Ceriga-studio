import { toCanvas } from 'html-to-image';
import { waitForImageFilters } from './imageFilterRendering';
import type { DesignElement } from '../components/builder/PrintsDesignStep';
import { sourceSignature } from '../components/builder/printsStudio/WarpedArtwork';

export async function exportAssetArtboard(width: number, height: number, elements: DesignElement[]): Promise<string> {
  const zone = document.querySelector<HTMLElement>('[data-asset-artboard]');
  if (!zone || !zone.getBoundingClientRect().width) throw new Error('The asset artboard must be visible before saving.');
  await waitForImageFilters(zone);
  const deadline = performance.now() + 10000;
  const visible = elements.filter(element => !element.hidden && !element.customAreaOpen);
  const ready = (items: DesignElement[], root: HTMLElement, nested = false): boolean => items.filter(item => !item.hidden).every(element => {
    const node = [...root.querySelectorAll<HTMLElement>(nested ? '[data-group-child]' : ':scope > [data-print-id]')]
      .find(node => (nested ? node.dataset.groupChild : node.dataset.printId) === element.id);
    if (!node || getComputedStyle(node).visibility === 'hidden') return false;
    if (element.warp) return [...node.querySelectorAll<HTMLCanvasElement>('[data-warp-canvas]')].some(canvas => canvas.dataset.warpReady === sourceSignature(element) + JSON.stringify(element.warp));
    return !element.children || ready(element.children, node, true);
  });
  while (!ready(visible, zone)) {
    if (performance.now() > deadline) throw new Error('Artwork is still rendering. Wait, then retry saving.');
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  await Promise.race([
    Promise.all([document.fonts.ready, ...[...zone.querySelectorAll('img')].map(image => image.decode())]),
    new Promise((_, reject) => setTimeout(() => reject(new Error('An image or font did not finish loading. Retry saving.')), 10000)),
  ]);
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  const nodes = [...zone.querySelectorAll(':scope > [data-print-id]')];
  const canvas = await toCanvas(zone, {
    width, height, pixelRatio: 1, backgroundColor: 'transparent',
    style: { position: 'relative', left: '0', top: '0', right: 'auto', bottom: 'auto', margin: '0', width: `${width}px`, height: `${height}px`, overflow: 'hidden', transform: 'none', border: 'none', boxShadow: 'none', background: 'transparent' },
    filter: node => {
      if (!(node instanceof Element)) return true;
      if (node.matches('[data-editor-chrome], [data-handles], [data-visible-bounds], [data-inline-toolbar], [data-crop-editor]')) return false;
      return node.parentElement !== zone || nodes.includes(node);
    },
  });
  if (canvas.width !== width || canvas.height !== height) throw new Error('The rendered asset size is incorrect.');
  return canvas.toDataURL('image/png');
}
