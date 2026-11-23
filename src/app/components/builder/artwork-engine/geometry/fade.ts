import type { CSSProperties } from 'react';
import type { DesignElement } from '../../PrintStudioEditor';

/**
 * Finishing controls from reference 17, all live and editable on any object:
 * a gradient fade (Illustrator's opacity mask), blend modes, and a linked reflection.
 */
export type ArtworkFade = {
  type: 'linear' | 'radial';
  /** Direction of a linear fade, degrees (180 = top to bottom). */
  angle: number;
  /** Where the fade begins and ends, % across the object. */
  start: number; end: number;
  /** Visibility at each end, %. */
  startOpacity: number; endOpacity: number;
};
export const DEFAULT_FADE: ArtworkFade = { type: 'linear', angle: 180, start: 0, end: 100, startOpacity: 100, endOpacity: 0 };

export const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'] as const;
export type ArtworkBlendMode = typeof BLEND_MODES[number];
export const blendModeLabel = (mode: string) => mode.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join(' ');

const stop = (opacity: number) => `rgba(0,0,0,${Math.max(0, Math.min(100, opacity)) / 100})`;

export function fadeGradient(fade: ArtworkFade) {
  const stops = `${stop(fade.startOpacity)} ${fade.start}%, ${stop(fade.endOpacity)} ${fade.end}%`;
  return fade.type === 'radial' ? `radial-gradient(closest-side, ${stops})` : `linear-gradient(${fade.angle}deg, ${stops})`;
}

/** CSS mask for the on-canvas fade. */
export function fadeStyle(element: DesignElement): CSSProperties | undefined {
  if (!element.artworkFade) return undefined;
  const image = fadeGradient(element.artworkFade);
  return { maskImage: image, WebkitMaskImage: image, maskRepeat: 'no-repeat', maskSize: '100% 100%' };
}

/** SVG mask definition for print files. Coordinates are the object's own box. */
export function fadeSvgDefinition(id: string, fade: ArtworkFade, width: number, height: number) {
  const white = (opacity: number) => `stop-color="#fff" stop-opacity="${Math.max(0, Math.min(100, opacity)) / 100}"`;
  const stops = `<stop offset="${fade.start / 100}" ${white(fade.startOpacity)}/><stop offset="${fade.end / 100}" ${white(fade.endOpacity)}/>`;
  let gradient: string;
  if (fade.type === 'radial') {
    gradient = `<radialGradient id="${id}-g" gradientUnits="userSpaceOnUse" cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) / 2}">${stops}</radialGradient>`;
  } else {
    // CSS gradient line: 0deg points up, and its length reaches the corners.
    const a = fade.angle * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a), half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
    gradient = `<linearGradient id="${id}-g" gradientUnits="userSpaceOnUse" x1="${width / 2 - dx * half}" y1="${height / 2 - dy * half}" x2="${width / 2 + dx * half}" y2="${height / 2 + dy * half}">${stops}</linearGradient>`;
  }
  return `${gradient}<mask id="${id}" maskUnits="userSpaceOnUse" x="${-width}" y="${-height}" width="${width * 3}" height="${height * 3}"><rect x="${-width}" y="${-height}" width="${width * 3}" height="${height * 3}" fill="url(#${id}-g)"/></mask>`;
}

export type ReflectionLink = { of: string; /** Space between object and reflection, artwork units. */ gap: number; /** Length of the reflection, % of the object. */ length: number };

/** The reflection's current form, generated from its source. Its own fade and opacity are kept. */
export function reflectionFrom(source: DesignElement, own: Pick<DesignElement, 'id' | 'opacity' | 'artworkFade' | 'artworkBlendMode' | 'layerName'> & { reflectionOf: ReflectionLink }): DesignElement {
  const k = Math.max(.05, own.reflectionOf.length / 100), height = source.height * k;
  const scaled = source.type === 'text' ? { textScaleY: (source.textScaleY ?? 100) * k, height: source.height } : { height };
  const drawn = source.type === 'text' ? source.height * k : height;
  return {
    ...source, ...scaled, id: own.id, y: source.y + source.height / 2 + own.reflectionOf.gap + drawn / 2, rotation: -source.rotation,
    flipVertical: !source.flipVertical, opacity: own.opacity, artworkFade: own.artworkFade, artworkBlendMode: own.artworkBlendMode,
    layerName: own.layerName, reflectionOf: own.reflectionOf, locked: false, textEdge: undefined, overlapOf: undefined,
  } as DesignElement;
}

export function createReflection(elements: DesignElement[], sourceId: string, id: string, gap: number): DesignElement[] {
  const source = elements.find(element => element.id === sourceId);
  if (!source || source.reflectionOf) return elements;
  const reflection = reflectionFrom(source, { id, opacity: 45, artworkFade: { ...DEFAULT_FADE, startOpacity: 90 }, layerName: 'Reflection', reflectionOf: { of: sourceId, gap, length: 60 } });
  const at = elements.indexOf(source);
  return [...elements.slice(0, at), reflection, ...elements.slice(at)];
}

/** Keep every reflection matching its source; one whose source was deleted is removed. */
export function refreshReflections(elements: DesignElement[]): DesignElement[] {
  if (!elements.some(element => element.reflectionOf)) return elements;
  let changed = false;
  const next = elements.flatMap(element => {
    if (!element.reflectionOf) return [element];
    const source = elements.find(item => item.id === element.reflectionOf!.of);
    if (!source) { changed = true; return []; }
    const built = reflectionFrom(source, element as DesignElement & { reflectionOf: ReflectionLink });
    if (JSON.stringify(built) === JSON.stringify(element)) return [element];
    changed = true;
    return [built];
  });
  return changed ? next : elements;
}
