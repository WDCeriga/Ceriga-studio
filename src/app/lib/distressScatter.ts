export type DistressMarkKind = 'holes' | 'abrasion' | 'rips';

export interface DistressScatterSettings {
  count: number;
  size: number;
  opacity: number;
  spread: number;
  roughness: number;
  ripLength: number;
}

export interface DistressMark {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  roughness: number;
  seed: number;
}

export const DEFAULT_DISTRESS_SCATTER: DistressScatterSettings = {
  count: 14,
  size: 9,
  opacity: 76,
  spread: 82,
  roughness: 42,
  ripLength: 100,
};

export function createDistressStamp(
  center: { x: number; y: number },
  brushRadius: number,
  settings: DistressScatterSettings,
  kind: DistressMarkKind,
  pixelScale = 1,
): DistressMark[] {
  return createDistressScatter(
    { x: center.x / pixelScale, y: center.y / pixelScale }, brushRadius / pixelScale,
    { ...settings, size: settings.size / pixelScale }, kind,
    kind === 'holes' ? 847 : kind === 'abrasion' ? 2391 : 4617,
  ).map(mark => ({ ...mark,
    x: mark.x * pixelScale, y: mark.y * pixelScale,
    width: mark.width * pixelScale, height: mark.height * pixelScale,
  }));
}

export function createDistressScatter(
  center: { x: number; y: number },
  brushRadius: number,
  settings: DistressScatterSettings,
  kind: DistressMarkKind,
  seed: number,
): DistressMark[] {
  let state = seed >>> 0 || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const count = Math.max(1, Math.min(80, Math.round(settings.count)));
  const radius = Math.max(1, brushRadius * (kind === 'abrasion' ? settings.spread / 100 : 0.82));
  return Array.from({ length: count }, () => {
    const angle = random() * Math.PI * 2;
    const distance = Math.sqrt(random()) * radius;
    const size = Math.max(1, settings.size * (0.48 + random() * 1.12));
    const shapeScale = kind === 'abrasion' ? 1.15 + random() * 1.3
      : kind === 'rips' ? 1.8 + settings.ripLength / 100 * (1.2 + random() * 2.4)
        : 0.72 + random() * 0.72;
    const holeAspect = 0.62 + random() * 0.58;
    const thickness = kind === 'rips' ? 0.12 + random() * 0.2
      : kind === 'abrasion' ? 0.35 + random() * 0.75
        : 0.6 + random() * 0.45;
    return {
      x: center.x + Math.cos(angle) * distance,
      y: center.y + Math.sin(angle) * distance,
      width: size * shapeScale,
      height: kind === 'holes' ? size * shapeScale * holeAspect : size * thickness,
      rotation: (random() - 0.5) * Math.PI,
      opacity: Math.max(0, Math.min(100, settings.opacity)) / 100 * (0.58 + random() * 0.42),
      roughness: settings.roughness / 100,
      seed: Math.floor(random() * 0xffffffff),
    };
  });
}