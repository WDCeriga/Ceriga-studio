import { toCanvas } from 'html-to-image';
import { waitForImageFilters } from './imageFilterRendering';
import { artworkEffectPadding } from './textEffectRendering';
import type { DesignElement } from '../components/builder/PrintsDesignStep';
import { sourceSignature } from '../components/builder/printsStudio/WarpedArtwork';

export type FlattenedArtwork = Pick<DesignElement, 'content' | 'x' | 'y' | 'width' | 'height'>;
export type LayerRenderer = (ids: string[]) => Promise<FlattenedArtwork>;

export function canMergeLayer(element: DesignElement) {
  return !element.locked && !element.hidden && !element.customAreaOpen
    && element.id !== 'print-drawing-layer' && element.id !== 'print-distress-layer'
    && ['image', 'text', 'drawing', 'shape', 'pattern', 'customArea', 'group'].includes(element.type);
}

export function mergeLayersIssue(elements: DesignElement[], ids: string[]) {
  if (ids.length < 2) return 'Select at least two adjacent layers to merge.';
  const selected = elements.filter(element => ids.includes(element.id));
  if (selected.length !== ids.length || selected.some(element => !canMergeLayer(element))) {
    return 'Only visible, unlocked design layers can merge. System and distress layers are protected.';
  }
  const side = selected[0]!.side ?? 'front';
  if (selected.some(element => (element.side ?? 'front') !== side)) return 'Choose layers on the same garment side.';
  if (selected.some(element => (element.printMethod ?? 'DTG') !== (selected[0]!.printMethod ?? 'DTG'))) {
    return 'Choose layers with the same print method.';
  }
  const sameSide = elements.filter(element => (element.side ?? 'front') === side);
  const indices = selected.map(element => sameSide.indexOf(element));
  if (Math.max(...indices) - Math.min(...indices) + 1 !== selected.length) {
    return 'Choose adjacent layers to preserve their stacking appearance.';
  }
  return null;
}

export function replaceMergedLayers(elements: DesignElement[], ids: string[], artwork: FlattenedArtwork, id: string): DesignElement[] {
  const issue = mergeLayersIssue(elements, ids);
  if (issue) throw new Error(issue);
  const first = elements.find(element => ids.includes(element.id))!;
  const merged: DesignElement = {
    ...artwork, id, type: 'image', layerName: 'Merged layers', rotation: 0,
    opacity: 100, side: first.side ?? 'front', printMethod: first.printMethod,
    aspectLocked: true,
  };
  return elements.flatMap(element => element.id === first.id ? [merged] : ids.includes(element.id) ? [] : [element]);
}

export async function flattenDesignLayers(zone: HTMLElement, elements: DesignElement[], ids: string[]): Promise<FlattenedArtwork> {
  const selected = elements.filter(element => ids.includes(element.id));
  const nodes = [...zone.querySelectorAll<HTMLElement>(':scope > [data-print-id]')].filter(node => ids.includes(node.dataset.printId!));
  if (nodes.length !== ids.length) throw new Error('Wait for all selected layers to finish rendering, then retry.');
  await document.fonts.ready;
  await Promise.all(nodes.map(node => waitForImageFilters(node)));
  await Promise.all(nodes.flatMap(node => [...node.querySelectorAll('img')]).map(image => image.decode()));
  const deadline = performance.now() + 8000;
  while (true) {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const ready = selected.every(element => {
      const node = nodes.find(item => item.dataset.printId === element.id)!;
      if (getComputedStyle(node.querySelector('[data-pattern-clip]') ?? node).visibility === 'hidden') return false;
      if (!element.warp) return true;
      return [...node.querySelectorAll<HTMLCanvasElement>('[data-warp-canvas]')].some(canvas => canvas.dataset.warpReady === sourceSignature(element) + JSON.stringify(element.warp));
    });
    if (ready) break;
    if (performance.now() > deadline) throw new Error('Artwork is still rendering. Please retry the merge.');
  }
  const rect = zone.getBoundingClientRect();
  const sx = rect.width / zone.clientWidth;
  const sy = rect.height / zone.clientHeight;
  if (!(sx > 0 && sy > 0)) throw new Error('The garment preview must be visible to merge layers.');
  // Include overflow, rotated corners and filter tails before trimming transparent pixels.
  const padding = Math.max(64, ...selected.map(element => artworkEffectPadding(element) + 4 * ((element.shadowBlur ?? 0) + (element.filterBlur ?? 0) + (element.borderWidth ?? 0)) + Math.abs(element.shadowOffsetX ?? 0) + Math.abs(element.shadowOffsetY ?? 0)));
  const boxes = nodes.flatMap(node => [node, ...node.querySelectorAll<HTMLElement>('[data-asset-projection]')]).map(node => node.getBoundingClientRect());
  const left = Math.floor(Math.min(...boxes.map(box => (box.left - rect.left) / sx)) - padding);
  const top = Math.floor(Math.min(...boxes.map(box => (box.top - rect.top) / sy)) - padding);
  const width = Math.ceil(Math.max(...boxes.map(box => (box.right - rect.left) / sx)) + padding - left);
  const height = Math.ceil(Math.max(...boxes.map(box => (box.bottom - rect.top) / sy)) + padding - top);
  const pixelRatio = 2;
  if (width * height * pixelRatio ** 2 > 32_000_000 || Math.max(width, height) * pixelRatio > 8192) {
    throw new Error('These layers are too large to flatten safely. Merge a smaller selection.');
  }
  const canvas = await toCanvas(zone, {
    width, height, pixelRatio, backgroundColor: 'transparent',
    style: { position: 'relative', left: '0', top: '0', right: 'auto', bottom: 'auto', margin: '0', width: `${zone.clientWidth}px`, height: `${zone.clientHeight}px`, transformOrigin: '0 0', transform: `translate(${-left}px, ${-top}px)` },
    filter: node => {
      if (!(node instanceof Element)) return true;
      if (node.matches('[data-editor-chrome], [data-handles], [data-visible-bounds], [data-inline-toolbar], [data-crop-editor]')) return false;
      if (node.parentElement === zone) return nodes.includes(node as HTMLElement);
      return true;
    },
  });
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Cannot create the merged artwork.');
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (!data[(y * canvas.width + x) * 4 + 3]) continue;
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  if (x1 < x0) throw new Error('The selected layers contain no visible artwork.');
  const result = document.createElement('canvas');
  result.width = x1 - x0 + 1; result.height = y1 - y0 + 1;
  result.getContext('2d')!.drawImage(canvas, x0, y0, result.width, result.height, 0, 0, result.width, result.height);
  return { content: result.toDataURL('image/png'), x: left + (x0 + result.width / 2) / pixelRatio, y: top + (y0 + result.height / 2) / pixelRatio, width: result.width / pixelRatio, height: result.height / pixelRatio };
}
