/**
 * Asset Studio drawing guides. They are plain line geometry drawn beside the artboard,
 * so they can never reach a saved asset or print file.
 */
export type SymmetryMode = 'off' | 'vertical' | 'horizontal' | 'quadrant' | 'radial';
export type StudioGuides = {
  grid: { on: boolean; size: number; divisions: number };
  isometric: { on: boolean; size: number; angle: number };
  lettering: { on: boolean; rows: number; xHeight: number; capHeight: number; slant: number };
  symmetry: { mode: SymmetryMode; segments: number };
  colour: string;
  opacity: number;
};
export const DEFAULT_GUIDES: StudioGuides = {
  grid: { on: false, size: 60, divisions: 4 },
  isometric: { on: false, size: 40, angle: 30 },
  lettering: { on: false, rows: 3, xHeight: 55, capHeight: 78, slant: 0 },
  symmetry: { mode: 'off', segments: 8 },
  colour: '#2f6fed',
  opacity: 45,
};
export const guidesActive = (g: StudioGuides) => g.grid.on || g.isometric.on || g.lettering.on || g.symmetry.mode !== 'off';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
const f = (v: number) => Math.round(v * 100) / 100;
const seg = (x1: number, y1: number, x2: number, y2: number) => `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;

/** The part of an endless line through (x, y) at this angle that lies on the artboard. */
function across(x: number, y: number, angle: number, w: number, h: number) {
  const dx = Math.cos(angle), dy = Math.sin(angle);
  let low = -Infinity, high = Infinity;
  for (const [p, d, max] of [[x, dx, w], [y, dy, h]] as const) {
    if (Math.abs(d) < 1e-9) { if (p < 0 || p > max) return ''; continue; }
    const a = (0 - p) / d, b = (max - p) / d;
    low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
  }
  return high > low ? seg(x + dx * low, y + dy * low, x + dx * high, y + dy * high) : '';
}

/** Three weights of line: fine, main and the strong axis lines. */
export function guidePaths(g: StudioGuides, w: number, h: number) {
  const minor: string[] = [], major: string[] = [], axis: string[] = [];
  if (g.grid.on) {
    const size = clamp(g.grid.size, 4, 1000), divisions = Math.round(clamp(g.grid.divisions, 1, 12)), step = size / divisions, cols = Math.ceil(w / step), rows = Math.ceil(h / step);
    for (let i = 0; i <= cols; i++) { const x = i * step; if (x > w) break; (i % divisions ? minor : major).push(seg(x, 0, x, h)); }
    for (let i = 0; i <= rows; i++) { const y = i * step; if (y > h) break; (i % divisions ? minor : major).push(seg(0, y, w, y)); }
  }
  if (g.isometric.on) {
    const size = clamp(g.isometric.size, 6, 1000), angle = clamp(g.isometric.angle, 10, 70) * Math.PI / 180, gap = size / Math.cos(angle), rise = Math.tan(angle) * w;
    for (let x = 0; x <= w; x += size) minor.push(seg(x, 0, x, h));
    for (let y = -rise - gap; y <= h + rise + gap; y += gap) { const up = across(0, y, -angle, w, h), down = across(0, y, angle, w, h); if (up) major.push(up); if (down) major.push(down); }
  }
  if (g.lettering.on) {
    const rows = Math.round(clamp(g.lettering.rows, 1, 12)), rowHeight = h / rows, band = rowHeight * .72, x = clamp(g.lettering.xHeight, 20, 90) / 100, cap = clamp(g.lettering.capHeight, 30, 100) / 100, slant = clamp(g.lettering.slant, -45, 45);
    for (let r = 0; r < rows; r++) {
      const base = r * rowHeight + rowHeight * .82;
      axis.push(seg(0, base, w, base));
      major.push(seg(0, base - band * x, w, base - band * x), seg(0, base - band * cap, w, base - band * cap));
      minor.push(seg(0, base - band, w, base - band), seg(0, base + rowHeight * .14, w, base + rowHeight * .14));
    }
    if (slant) { const angle = (90 + slant) * Math.PI / 180, spacing = rowHeight * .5, reach = Math.abs(Math.tan(slant * Math.PI / 180)) * h; for (let px = -reach; px <= w + reach; px += spacing) { const line = across(px, 0, angle, w, h); if (line) minor.push(line); } }
  }
  const cx = w / 2, cy = h / 2, mode = g.symmetry.mode;
  if (mode === 'vertical' || mode === 'quadrant') axis.push(seg(cx, 0, cx, h));
  if (mode === 'horizontal' || mode === 'quadrant') axis.push(seg(0, cy, w, cy));
  if (mode === 'radial') {
    const count = Math.round(clamp(g.symmetry.segments, 2, 32));
    for (let i = 0; i < count; i++) { const a = -Math.PI / 2 + i / count * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a), t = Math.min(Math.abs(dx) > 1e-9 ? (dx > 0 ? w - cx : cx) / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-9 ? (dy > 0 ? h - cy : cy) / Math.abs(dy) : Infinity); axis.push(seg(cx, cy, cx + dx * t, cy + dy * t)); }
  }
  return { minor: minor.join(''), major: major.join(''), axis: axis.join('') };
}

export function readGuides(raw: string | null): StudioGuides {
  try {
    const v = JSON.parse(raw ?? 'null');
    if (!v || typeof v !== 'object') return DEFAULT_GUIDES;
    const mode = ['off', 'vertical', 'horizontal', 'quadrant', 'radial'].includes(v.symmetry?.mode) ? v.symmetry.mode as SymmetryMode : 'off';
    return { grid: { ...DEFAULT_GUIDES.grid, ...v.grid }, isometric: { ...DEFAULT_GUIDES.isometric, ...v.isometric }, lettering: { ...DEFAULT_GUIDES.lettering, ...v.lettering }, symmetry: { segments: Number.isFinite(v.symmetry?.segments) ? v.symmetry.segments : DEFAULT_GUIDES.symmetry.segments, mode }, colour: /^#[\da-f]{6}$/i.test(v.colour) ? v.colour : DEFAULT_GUIDES.colour, opacity: Number.isFinite(v.opacity) ? clamp(v.opacity, 10, 100) : DEFAULT_GUIDES.opacity };
  } catch { return DEFAULT_GUIDES; }
}
