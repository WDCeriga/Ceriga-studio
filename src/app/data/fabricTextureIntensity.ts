export const DEFAULT_FABRIC_TEXTURE_INTENSITY = 40;

export interface FabricTextureIntensity {
  garment?: number;
  parts?: Record<string, number>;
}

export function clampFabricTextureIntensity(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FABRIC_TEXTURE_INTENSITY;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function garmentTextureIntensity(settings?: FabricTextureIntensity): number {
  return clampFabricTextureIntensity(settings?.garment ?? DEFAULT_FABRIC_TEXTURE_INTENSITY);
}

export function partTextureIntensity(settings: FabricTextureIntensity | undefined, partId: string): number {
  return clampFabricTextureIntensity(settings?.parts?.[partId] ?? garmentTextureIntensity(settings));
}

export function setGarmentTextureIntensity(
  settings: FabricTextureIntensity | undefined,
  value: number,
): FabricTextureIntensity {
  return { ...settings, garment: clampFabricTextureIntensity(value), parts: { ...settings?.parts } };
}

export function setPartTextureIntensity(
  settings: FabricTextureIntensity | undefined,
  partId: string,
  value: number | undefined,
): FabricTextureIntensity {
  const parts = { ...settings?.parts };
  if (value === undefined) delete parts[partId];
  else parts[partId] = clampFabricTextureIntensity(value);
  return { ...settings, parts };
}

export function resetFabricTextureIntensity(): FabricTextureIntensity {
  return { garment: DEFAULT_FABRIC_TEXTURE_INTENSITY, parts: {} };
}
