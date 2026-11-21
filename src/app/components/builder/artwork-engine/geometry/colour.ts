/** Pure colour helpers for the Artwork engine (no React). */

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

/** Parses #RGB / #RRGGBB; returns null for anything else. */
export function parseHex(hex: string | undefined | null): [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const v = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1];
  return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)) as [number, number, number];
}

export function relativeLuminance(hex: string): number | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1–21), or null when either colour can't be parsed. */
export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  if (la == null || lb == null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export const INK_DARK = '#171717';
export const INK_LIGHT = '#FFFFFF';

/**
 * The ink a new object should start with on a given surface: keeps `preferred` when it reads
 * (≥ 3:1, the large-graphics threshold), otherwise picks whichever of light/dark ink reads better.
 */
export function readableInk(preferred: string, surface: string | undefined | null, minimum = 3): string {
  if (!surface) return preferred;
  const current = contrastRatio(preferred, surface);
  if (current == null || current >= minimum) return preferred;
  const light = contrastRatio(INK_LIGHT, surface) ?? 0, dark = contrastRatio(INK_DARK, surface) ?? 0;
  return light >= dark ? INK_LIGHT : INK_DARK;
}
