import type { CSSProperties } from 'react';

type FlipSettings = { flipHorizontal?: boolean; flipVertical?: boolean };

export function artworkFlipStyle(element: FlipSettings): CSSProperties | undefined {
  if (!element.flipHorizontal && !element.flipVertical) return undefined;
  return {
    transform: `scale(${element.flipHorizontal ? -1 : 1}, ${element.flipVertical ? -1 : 1})`,
    transformOrigin: 'center',
  };
}
