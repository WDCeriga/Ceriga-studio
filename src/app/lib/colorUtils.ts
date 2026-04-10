/** Normalise user or API input to `#RRGGBB` uppercase, or return fallback. */
export function normalizeHex6(input: string | undefined, fallback = '#FFFFFF'): string {
  let h = (input ?? fallback).trim();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9A-Fa-f]{3}$/i.test(h)) {
    const a = h.slice(1);
    h = `#${a[0]}${a[0]}${a[1]}${a[1]}${a[2]}${a[2]}`;
  }
  if (/^#[0-9A-Fa-f]{6}$/i.test(h)) return h.toUpperCase();
  return fallback.toUpperCase();
}
