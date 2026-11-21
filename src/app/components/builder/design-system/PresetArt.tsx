/**
 * Every preset generates its preview art differently (black-filled trouser fits, grey tank bodies,
 * near-white hoodies). PresetArt normalises generated SVG previews to the shared Ceriga preview
 * language — white garment body, ink outline, ink details — so all four presets read as one system.
 * Non-SVG sources pass through unchanged. Results are cached per source string.
 */
const cache = new Map<string, string>();
// Body fills to whiten: solid black silhouettes, and any light neutral grey (lightness >= 78%, low saturation).
const BLACK_FILL = /fill="(#000000|#000)"/gi;
const HEX_FILL = /fill="#([0-9a-f]{6})"/gi;
const isLightNeutral = (hex: string) => { const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16)); return Math.min(r, g, b) >= 200 && Math.max(r, g, b) - Math.min(r, g, b) <= 24; };
const LIGHT_STROKES = /stroke="(#fff|#ffffff)"/gi;

export function harmonisePreviewArt(src: string): string {
  if (!src.startsWith('data:image/svg+xml')) return src;
  const hit = cache.get(src); if (hit) return hit;
  const comma = src.indexOf(',');
  const head = src.slice(0, comma + 1), body = src.slice(comma + 1);
  const base64 = /;base64,$/.test(head);
  let svg = base64 ? atob(body) : decodeURIComponent(body);
  svg = svg.replace(BLACK_FILL, 'fill="#ffffff"').replace(HEX_FILL, (m, hex) => isLightNeutral(hex) ? 'fill="#ffffff"' : m).replace(LIGHT_STROKES, 'stroke="#2b2b2e"');
  const out = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  if (cache.size > 200) cache.clear();
  cache.set(src, out);
  return out;
}

export function PresetArt({ src, className }: { src: string; className?: string }) {
  return <img className={className} src={harmonisePreviewArt(src)} alt="" draggable={false} />;
}
