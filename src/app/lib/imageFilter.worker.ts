import { applyImageFilter, type ImageFilterSettings } from './imageFilters';
import { applyImageGrade, type ImageGrade } from '../components/builder/artwork-engine/image/grade';

self.onmessage = (event: MessageEvent<{ id: number; data: Uint8ClampedArray; width: number; height: number; settings: ImageFilterSettings; grade?: ImageGrade }>) => {
  const { id, data, width, height, settings, grade } = event.data;
  try {
    const pixels = grade ? applyImageGrade(data, width, height, grade) : applyImageFilter(data, width, height, { ...settings, intensity: 100 });
    self.postMessage({ id, pixels }, { transfer: [pixels.buffer] });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Image filter failed.' });
  }
};
