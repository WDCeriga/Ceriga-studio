/**
 * Colour fields (references 16 and 17): soft multi-point colour, like Illustrator's freeform gradient.
 * Every point is editable and it stays vector, so the same markup draws on the canvas and in print files.
 */
export type ColourFieldPoint = {
  id: string;
  /** Position, % of the object. */
  x: number; y: number;
  colour: string;
  /** Reach, % of the object's longer side. */
  size: number;
  /** 0 = hard edge, 100 = melts away from the centre. */
  softness: number;
  opacity: number;
};
export type ColourField = { base: string; points: ColourFieldPoint[] };

const point = (id: string, x: number, y: number, colour: string, size = 60, softness = 100, opacity = 100): ColourFieldPoint => ({ id, x, y, colour, size, softness, opacity });

export const COLOUR_FIELD_PRESETS: { id: string; label: string; field: ColourField }[] = [
  { id: 'teal-paper', label: 'Teal paper', field: { base: '#f4efd2', points: [point('a', 22, 18, '#2f7f9c', 62), point('b', 74, 78, '#1f6f8b', 66), point('c', 62, 40, '#6fb1bd', 42, 100, 80)] } },
  { id: 'peach-bloom', label: 'Peach bloom', field: { base: '#f7a8c4', points: [point('a', 50, 62, '#f7e84e', 34), point('b', 50, 44, '#ff9d84', 50, 100, 90), point('c', 50, 18, '#fbe9c6', 42, 100, 80)] } },
  { id: 'sunset', label: 'Sunset', field: { base: '#2b1b4d', points: [point('a', 50, 96, '#ffb347', 62), point('b', 18, 66, '#e8467c', 52), point('c', 84, 58, '#7b3ff2', 52)] } },
  { id: 'aurora', label: 'Aurora', field: { base: '#071a2c', points: [point('a', 22, 30, '#26e6a6', 48), point('b', 62, 22, '#2aa7ff', 46), point('c', 84, 66, '#a44bff', 50)] } },
  { id: 'chrome-mist', label: 'Mist', field: { base: '#e9edf1', points: [point('a', 24, 26, '#9fb2c6', 50), point('b', 78, 72, '#6e8197', 52), point('c', 58, 30, '#ffffff', 34)] } },
  { id: 'ember', label: 'Ember', field: { base: '#190b08', points: [point('a', 50, 74, '#ff5a1f', 52), point('b', 44, 88, '#ffd166', 30), point('c', 78, 26, '#7a1420', 46)] } },
];

const esc = (value: string) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]!));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
/** Smooth falloff, so points melt without a visible ring. */
const falloff = (t: number) => 1 - t * t * (3 - 2 * t);

/** SVG for a field filling a width × height box: `defs` for gradients and `layers` for the paint. */
export function colourFieldSvg(id: string, field: ColourField, width: number, height: number) {
  const reach = Math.max(width, height), defs: string[] = [], layers = [`<rect width="${width}" height="${height}" fill="${esc(field.base)}"/>`];
  field.points.forEach((item, index) => {
    const gradient = `${id}-p${index}`, solid = 1 - clamp(item.softness, 0, 100) / 100, alpha = clamp(item.opacity, 0, 100) / 100, stops: string[] = [];
    for (let step = 0; step <= 8; step++) {
      const offset = step / 8, t = offset <= solid ? 0 : (offset - solid) / Math.max(.0001, 1 - solid);
      stops.push(`<stop offset="${offset}" stop-color="${esc(item.colour)}" stop-opacity="${(falloff(t) * alpha).toFixed(4)}"/>`);
    }
    defs.push(`<radialGradient id="${gradient}" gradientUnits="userSpaceOnUse" cx="${item.x / 100 * width}" cy="${item.y / 100 * height}" r="${Math.max(.01, item.size / 100 * reach)}">${stops.join('')}</radialGradient>`);
    layers.push(`<rect width="${width}" height="${height}" fill="url(#${gradient})"/>`);
  });
  return { defs: defs.join(''), layers: layers.join('') };
}

/** CSS preview of a field, for tiles. */
export function colourFieldCss(field: ColourField) {
  const toRgba = (hex: string, alpha: number) => /^#[0-9a-f]{6}$/i.test(hex) ? `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})` : hex;
  const layers = [...field.points].reverse().map(item => `radial-gradient(circle at ${item.x}% ${item.y}%, ${toRgba(item.colour, item.opacity / 100)} 0%, ${toRgba(item.colour, 0)} ${Math.min(100, item.size * 1.2)}%)`);
  return [...layers, `linear-gradient(${field.base}, ${field.base})`].join(',');
}

export const newFieldPoint = (field: ColourField, id: string): ColourFieldPoint => {
  const count = field.points.length, angle = count * 2.4;
  return point(id, clamp(50 + Math.cos(angle) * 26, 5, 95), clamp(50 + Math.sin(angle) * 26, 5, 95), field.points[count - 1]?.colour ?? '#2f7f9c', 45);
};
