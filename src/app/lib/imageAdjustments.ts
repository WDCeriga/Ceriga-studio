export const IMAGE_ADJUSTMENTS = [
  { key: 'filterBlur', label: 'Blur', min: 0, default: 0, max: 100, step: 1, suffix: '%' },
  { key: 'filterExposure', label: 'Exposure', min: -2, default: 0, max: 2, step: 0.1, suffix: ' EV' },
  { key: 'filterBrightness', label: 'Brightness', min: 40, default: 100, max: 160, step: 1, suffix: '%' },
  { key: 'filterContrast', label: 'Contrast', min: 40, default: 100, max: 160, step: 1, suffix: '%' },
  { key: 'filterSaturate', label: 'Saturation', min: 0, default: 100, max: 200, step: 1, suffix: '%' },
  { key: 'filterTemperature', label: 'Temperature', min: -100, default: 0, max: 100, step: 1, suffix: '' },
  { key: 'filterTint', label: 'Tint', min: -100, default: 0, max: 100, step: 1, suffix: '' },
  { key: 'filterHighlights', label: 'Highlights', min: -100, default: 0, max: 100, step: 1, suffix: '' },
  { key: 'filterHue', label: 'Hue', min: -180, default: 0, max: 180, step: 1, suffix: ' deg' },
  { key: 'filterNoise', label: 'Noise', min: 0, default: 0, max: 100, step: 1, suffix: '%' },
  { key: 'filterGrain', label: 'Grain', min: 0, default: 0, max: 100, step: 1, suffix: '%' },
  { key: 'filterSharpen', label: 'Sharpen', min: 0, default: 0, max: 100, step: 1, suffix: '%' },
] as const;

export type ImageAdjustmentKey = typeof IMAGE_ADJUSTMENTS[number]['key'];
export type ImageAdjustmentValues = Partial<Record<ImageAdjustmentKey, number>>;

export const DEFAULT_IMAGE_ADJUSTMENTS = Object.fromEntries(
  IMAGE_ADJUSTMENTS.map(setting => [setting.key, setting.default]),
) as Record<ImageAdjustmentKey, number>;

export function imageAdjustmentValues(values: ImageAdjustmentValues) {
  return Object.fromEntries(IMAGE_ADJUSTMENTS.map(setting => {
    const value = values[setting.key];
    return [setting.key, typeof value === 'number' && Number.isFinite(value)
      ? Math.max(setting.min, Math.min(setting.max, value)) : setting.default];
  })) as Record<ImageAdjustmentKey, number>;
}

export function hasAdvancedImageAdjustments(values: ImageAdjustmentValues) {
  const settings = imageAdjustmentValues(values);
  return IMAGE_ADJUSTMENTS.some(setting => !['filterBlur', 'filterBrightness', 'filterContrast', 'filterSaturate'].includes(setting.key)
    && settings[setting.key] !== setting.default);
}

export function imageAdjustmentFilter(values: ImageAdjustmentValues & { id?: string }): string | undefined {
  const settings = imageAdjustmentValues(values);
  const filters: string[] = [];
  if (values.id && hasAdvancedImageAdjustments(settings)) filters.push(`url(#adjust-${values.id})`);
  if (settings.filterBrightness !== 100) filters.push(`brightness(${settings.filterBrightness}%)`);
  if (settings.filterContrast !== 100) filters.push(`contrast(${settings.filterContrast}%)`);
  if (settings.filterSaturate !== 100) filters.push(`saturate(${settings.filterSaturate}%)`);
  if (settings.filterBlur > 0) filters.push(`blur(${8 * (settings.filterBlur / 100) ** 2}px)`);
  return filters.length ? filters.join(' ') : undefined;
}

export function highlightMaskTable() {
  return Array.from({ length: 33 }, (_, index) => {
    const level = Math.max(0, Math.min(1, (index / 32 - 0.45) / 0.55));
    return level * level * (3 - 2 * level);
  }).join(' ');
}

export function imageTextureSeed(id: string) {
  let seed = 17;
  for (const character of id) seed = (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0;
  return seed % 1000 + 1;
}

export function snapImageRotation(angle: number) {
  if (!Number.isFinite(angle)) return 0;
  const normalized = ((angle % 360) + 360) % 360;
  return normalized <= 3 || normalized >= 357 ? 0 : normalized;
}