import { applyTextEffects } from './textEffects';

self.onmessage = event => {
  try {
    const { data, width, height, effects, assets, scale } = event.data;
    const output = applyTextEffects(data, width, height, effects, assets, scale);
    self.postMessage({ data: output }, { transfer: [output.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Text effects could not be rendered.' });
  }
};
