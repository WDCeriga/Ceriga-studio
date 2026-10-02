import { defaultGarmentWash, type GarmentWash } from './garmentWash';

export const HOODIE_WASH_REGIONS = { body: 'Body', hood: 'Hood', sleeves: 'Sleeves', cuffs: 'Cuffs', waistband: 'Waistband / Rib Hem', pocket: 'Kangaroo Pocket' } as const;
export type HoodieWashRegion = keyof typeof HOODIE_WASH_REGIONS;
export type HoodieWashTarget = 'global' | HoodieWashRegion;
export type HoodieWash = { global: GarmentWash; regions: Partial<Record<HoodieWashRegion, GarmentWash>> };

export function defaultHoodieWash(): HoodieWash {
  return { global: defaultGarmentWash(), regions: {} };
}

export function hoodieWashRegion(layer: string): HoodieWashRegion | undefined {
  if (layer === 'base') return 'body';
  if (layer === 'hood') return 'hood';
  if (/cuff|sleeveHem/i.test(layer)) return 'cuffs';
  if (/sleeve/i.test(layer)) return 'sleeves';
  if (layer === 'bodyHem' || layer === 'hem') return 'waistband';
  if (layer === 'pocket') return 'pocket';
}

export function resolveHoodieWash(settings: HoodieWash | undefined, target: HoodieWashTarget): GarmentWash {
  return (target === 'global' ? settings?.global : settings?.regions[target] ?? settings?.global) ?? defaultGarmentWash();
}

export function updateHoodieWash(settings: HoodieWash | undefined, target: HoodieWashTarget, wash: GarmentWash): HoodieWash {
  const current = settings ?? defaultHoodieWash();
  return target === 'global' ? { ...current, global: wash } : { ...current, regions: { ...current.regions, [target]: wash } };
}

export function clearHoodieWashOverride(settings: HoodieWash, target: HoodieWashRegion): HoodieWash {
  const regions = { ...settings.regions };
  delete regions[target];
  return { ...settings, regions };
}