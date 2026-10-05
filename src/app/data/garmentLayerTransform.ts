import type { TshirtLayerTransform } from './tshirtLayerAssets';

// Keep this value independent of the asset-catalog barrel to avoid an initialization cycle.
export const DEFAULT_TSHIRT_LAYER_TRANSFORM: TshirtLayerTransform = {
  x: 0,
  y: 0,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};
