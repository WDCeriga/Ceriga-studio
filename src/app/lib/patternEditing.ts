import type { DesignElement } from '../components/builder/PrintStudioEditor';
import { patternDefaultColors, patternDefinition } from './patternCatalog';
import { newPatternSeed, patternKind } from './patternGeometry';

export type CustomPatternSource = { src: string; name: string; width: number; height: number };
export type PatternPatch = Partial<DesignElement>;

const numericBounds: Record<string, [number, number]> = {
  patternCount: [1, 32], patternScale: [10, 400], patternSpacing: [0, 200],
  patternSpacingX: [0, 200], patternSpacingY: [0, 200], patternRotation: [-360, 360],
  patternThickness: [.1, 1000], patternSeed: [0, 0xffffffff], patternRoughness: [0, 100],
  patternVariation: [0, 100], patternSourceWidth: [1, 100000], patternSourceHeight: [1, 100000],
  patternRandomPosition: [0, 100], patternRandomRotation: [0, 180],
  patternMinScale: [10, 300], patternMaxScale: [10, 300],   opacity: [0, 100],
};
export function safePatternSource(source: unknown): source is string {
  return typeof source === 'string' && /^(data:image\/[a-z0-9.+-]+[;,]|https?:\/\/)/i.test(source);
}

/** A drag transfers appearance only, never identity, transforms or clipping targets. */
export function patternAppearance(value: unknown): PatternPatch {
  if (!value || typeof value !== 'object') return {};
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, [min, max]] of Object.entries(numericBounds)) {
    if (typeof input[key] === 'number' && Number.isFinite(input[key])) output[key] = Math.max(min, Math.min(max, input[key] as number));
  }
  if (typeof input.color === 'string') output.color = input.color;
  if (Array.isArray(input.patternColors)) output.patternColors = input.patternColors.filter(color => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color)).slice(0, 8);
  for (const key of ['patternRandomise', 'flipHorizontal', 'flipVertical']) {
    if (typeof input[key] === 'boolean') output[key] = input[key];
  }
  if (safePatternSource(input.patternSource)) output.patternSource = input.patternSource;
  if (input.patternOptions && typeof input.patternOptions === 'object') {
    const options: Record<string, number | string> = {};
    for (const [key, item] of Object.entries(input.patternOptions as Record<string, unknown>).slice(0, 40)) {
      if (/^\w{1,24}$/.test(key) && (typeof item === 'string' || (typeof item === 'number' && Number.isFinite(item)))) options[key] = typeof item === 'string' ? item.slice(0, 24) : item;
    }
    output.patternOptions = options;
  }
  if (input.patternAlignment === 'independent' || input.patternAlignment === 'continuous') output.patternAlignment = input.patternAlignment;
  if (typeof input.patternSourceName === 'string') output.patternSourceName = input.patternSourceName.slice(0, 120);
  if (['grid', 'brick', 'half-drop', 'mirror', 'random'].includes(String(input.patternRepeat))) output.patternRepeat = input.patternRepeat;
  return output as PatternPatch;
}

export function initialPatternSettings(id: string, color?: string): PatternPatch {
  const definition = patternDefinition(id);
  const palette = patternDefaultColors(id).slice(0, definition?.fashion ? definition.colors?.length : undefined);
  const multicolor = (definition?.colors?.length ?? 0) > 1;
  return {
    color: multicolor ? palette[0] : color ?? palette[0] ?? '#FFFFFF',
    patternColors: multicolor ? palette : undefined,
    patternSeed: newPatternSeed(),
    patternCount: definition?.defaultCount ?? (id === 'checks' || id === 'dots' ? 4 : 5),
    patternOptions: undefined, patternOffsetX: 0, patternOffsetY: 0, patternAlignment: 'independent',
    opacity: 100, patternScale: 100, patternSpacing: 0, patternSpacingX: 0, patternSpacingY: 0,
    patternRotation: 0, patternThickness: undefined, patternRandomise: false, flipHorizontal: false, flipVertical: false,
    patternRoughness: 50, patternVariation: 50, patternSource: undefined, patternSourceName: undefined,
    patternSourceWidth: undefined, patternSourceHeight: undefined, patternRepeat: 'grid',
    patternRandomPosition: 70, patternRandomRotation: 0, patternMinScale: 70, patternMaxScale: 130,
  };
}

export function changePatternType(element: DesignElement, id: string): PatternPatch {
  const initial = initialPatternSettings(id, element.color);
  return {
    ...(element.type === 'customArea' ? { customAreaPattern: id, customAreaImage: undefined, customAreaTexture: undefined } : { content: id }),
    color: initial.color, patternColors: initial.patternColors, patternThickness: undefined,
    patternSeed: element.patternSeed ?? initial.patternSeed, patternOptions: undefined,
    ...(patternDefinition(id)?.fashion || patternDefinition(patternKind(element))?.fashion ? { patternCount: initial.patternCount } : {}),
  };
}

export function customPatternSettings(source: CustomPatternSource): PatternPatch {
  return { patternSource: source.src, patternSourceName: source.name, patternSourceWidth: source.width, patternSourceHeight: source.height };
}

export function isSelectedPattern(element?: DesignElement | null) {
  return !!element && (element.type === 'pattern' || (element.type === 'customArea' && !!element.customAreaPattern));
}

export function selectedPatternKind(element?: DesignElement | null) {
  return element && isSelectedPattern(element) ? patternKind(element) : undefined;
}
