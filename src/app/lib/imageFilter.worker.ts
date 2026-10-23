import { applyImageFilter, type ImageFilterSettings } from './imageFilters';

self.onmessage = (event: MessageEvent<{ id: number; data: Uint8ClampedArray; width: number; height: number; settings: ImageFilterSettings }>) => {
  const { id, data, width, height, settings } = event.data;
  try {
    const pixels = applyImageFilter(data, width, height, { ...settings, intensity: 100 });
    self.postMessage({ id, pixels }, { transfer: [pixels.buffer] });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Image filter failed.' });
  }
};
