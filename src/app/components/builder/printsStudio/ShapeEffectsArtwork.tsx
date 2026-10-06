import type { ReactNode } from 'react';
import type { DesignElement } from '../PrintsDesignStep';
import { TextEffectsArtwork } from './TextEffectsArtwork';
import { shapeArtworkPadding } from '../../../lib/textEffectRendering';

/** Rasterise only the presentation; the vector source and its editable parameters remain intact. */
export function ShapeEffectsArtwork({ element, children }: { element: DesignElement; children: ReactNode }) {
  const effects = element.shapeEffects ?? [];
  if (!effects.some(effect => effect.enabled && effect.intensity > 0)) return <>{children}</>;
  const { shapeEffects: _effects, ...source } = element;
  return <TextEffectsArtwork effects={effects} sourceKey={JSON.stringify(source)} width={element.width} height={element.height}
    target="shape" sourcePadding={shapeArtworkPadding(element)} text={element.layerName || 'Shape artwork'} style={{ height: '100%' }}>{children}</TextEffectsArtwork>;
}
