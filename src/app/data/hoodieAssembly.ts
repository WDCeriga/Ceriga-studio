import type { TshirtLayerTransform } from './tshirtLayerAssets';

export const HOODIE_ASSEMBLY_VERSION = 1;

export const HOODIE_STRUCTURAL_PARTS = [
  'base', 'sleeveLeft', 'sleeveRight', 'hood',
  'sleeveHemLeft', 'sleeveHemRight', 'bodyHem', 'pocket',
] as const;

export const HOODIE_PHASE_ONE = {
  fit: 'boxy',
  canvas: 2048,
  attachments: [
    ['base', 'sleeveLeft'], ['base', 'sleeveRight'], ['base', 'hood'],
    ['sleeveLeft', 'sleeveHemLeft'], ['sleeveRight', 'sleeveHemRight'],
    ['base', 'bodyHem'],
  ],
} as const;

export function isHoodieStructuralPart(id: string): boolean {
  return HOODIE_STRUCTURAL_PARTS.some(part => part === id);
}

export function usesHoodieAssembly(
  garmentType: string,
  version: number | undefined,
  _transforms?: Partial<Record<string, TshirtLayerTransform>>,
): boolean {
  return garmentType === 'hoodie' && version === HOODIE_ASSEMBLY_VERSION;
}