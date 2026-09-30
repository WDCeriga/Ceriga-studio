export const STITCH_OPTIONS = [
  { value: 'standard', label: 'Standard Stitch' },
  { value: 'double', label: 'Double Stitch' },
  { value: 'triple', label: 'Triple Stitch' },
  { value: 'zigzag', label: 'Zigzag Stitch' },
  { value: 'overlock', label: 'Overlock Stitch' },
  { value: 'coverstitch', label: 'Coverstitch' },
  { value: 'none', label: 'No Stitching' },
] as const;

export const HOODIE_STITCH_REGIONS = {
  hoodOpening: 'Hood opening', hoodCenter: 'Hood center', neckline: 'Hood attachment',
  shoulder: 'Shoulders', armhole: 'Sleeve attachment', sleeve: 'Sleeve seams',
  cuffs: 'Cuffs', hem: 'Hem / waistband', pocket: 'Kangaroo pocket', zip: 'Zip seam',
} as const;

export const STITCH_THREAD_OPTIONS = { fine: 'Fine', regular: 'Regular', heavy: 'Heavy' } as const;
export const STITCH_WIDTHS = { fine: 2.1, regular: 2.7, heavy: 3.4 } as const;
export type StitchRegion = keyof typeof HOODIE_STITCH_REGIONS;
export type StitchStyle = typeof STITCH_OPTIONS[number]['value'];
export type StitchSettings = { style?: StitchStyle; color?: string; thread?: keyof typeof STITCH_THREAD_OPTIONS; visible?: boolean };
export type HoodieStitching = Partial<Record<StitchRegion, StitchSettings>> & { global?: StitchSettings };
export type StitchPoint = { x: number; y: number };

export function resolveStitchSettings(settings: HoodieStitching, region?: StitchRegion): StitchSettings {
  return { style: 'standard', color: '#B0B0B0', thread: 'regular', visible: true, ...settings.global, ...(region ? settings[region] : undefined) };
}

export function updateStitchSettings(settings: HoodieStitching, patch: StitchSettings, region?: StitchRegion): HoodieStitching {
  const key = region ?? 'global';
  const next = { ...settings[key], ...patch };
  for (const field of Object.keys(next) as Array<keyof StitchSettings>) {
    if (next[field] === undefined) delete next[field];
  }
  return { ...settings, [key]: next };
}

export function clearStitchOverride(settings: HoodieStitching, region: StitchRegion): HoodieStitching {
  const next = { ...settings };
  delete next[region];
  return next;
}

export function stitchPatternPath(curve: SVGPathElement, style: StitchStyle): string {
  if (style === 'none') return '';
  const length = curve.getTotalLength();
  if (length < .1) return '';
  const at = (along: number, offset: number) => {
    const position = curve.getPointAtLength(Math.max(0, Math.min(length, along)));
    const before = curve.getPointAtLength(Math.max(0, along - .5));
    const after = curve.getPointAtLength(Math.min(length, along + .5));
    const magnitude = Math.hypot(after.x - before.x, after.y - before.y) || 1;
    return `${(position.x - (after.y - before.y) / magnitude * offset).toFixed(2)},${(position.y + (after.x - before.x) / magnitude * offset).toFixed(2)}`;
  };
  const line = (offset: number, dashed: boolean) => {
    let path = '';
    const count = dashed ? Math.max(1, Math.floor((length + 9) / 18)) : 1;
    const dashLength = dashed ? Math.min(9, length) : length;
    const margin = dashed ? (length - (count * dashLength + (count - 1) * 9)) / 2 : 0;
    for (let index = 0; index < count; index++) {
      const along = margin + index * (dashLength + 9);
      const end = along + dashLength;
      path += `M${at(along, offset)}`;
      for (let step = along + 2; step < end; step += 2) path += `L${at(step, offset)}`;
      path += `L${at(end, offset)}`;
    }
    return path;
  };
  if (style === 'standard') return line(0, true);
  if (style === 'double') return line(-2.8, true) + line(2.8, true);
  if (style === 'triple') return line(-4, true) + line(0, true) + line(4, true);
  const count = Math.max(1, Math.floor(length / 20));
  const pitch = length / count;
  if (style === 'zigzag') {
    let path = `M${at(0, -3)}`;
    for (let index = 1; index <= count * 2; index++) path += `L${at(index * pitch / 2, index % 2 ? 3 : -3)}`;
    return path;
  }
  if (style === 'coverstitch') return line(-3, false) + line(3, false);
  let path = line(-3, false);
  for (let index = 0; index < count; index++) {
    const along = index * pitch;
    path += `M${at(along + pitch * .2, -3)}L${at(along + pitch * .65, 3)}L${at(along + pitch * .8, -3)}`;
  }
  return path;
}