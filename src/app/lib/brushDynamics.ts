/**
 * Pro stroke response: pressure curve, speed and natural size variation. These reshape the recorded pressure,
 * so every brush family benefits and a stroke can be retuned after it is drawn.
 */
export type BrushDynamics = { pressureCurve?: number; velocityResponse?: number; sizeJitter?: number; opacityJitter?: number; angleJitter?: number };
export const DYNAMICS_DEFAULTS: Required<BrushDynamics> = { pressureCurve: 0, velocityResponse: 0, sizeJitter: 0, opacityJitter: 0, angleJitter: 0 };

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : 0;
function hash(i: number, seed: number) {
  let n = Math.imul(i | 0, 374761393) ^ Math.imul(seed | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function wave(x: number, seed: number) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, seed) * (1 - u) + hash(i + 1, seed) * u; }

/** True when width must respond to the reshaped pressure, even for a mouse or a path. */
export const brushDynamicsActive = (settings: BrushDynamics) => Boolean(num(settings.pressureCurve) || num(settings.velocityResponse) || num(settings.sizeJitter));

/** Returns the same array when nothing is switched on, so existing artwork is untouched. */
export function applyBrushDynamics<T extends { x: number; y: number; p: number }>(points: T[], settings: BrushDynamics & { brushSize?: number; brushSeed?: number }, scale: number, seed = 0): T[] {
  if (!brushDynamicsActive(settings) || !points.length) return points;
  const curve = clamp(num(settings.pressureCurve), -100, 100), speed = clamp(num(settings.velocityResponse) / 100), jitter = clamp(num(settings.sizeJitter) / 100), size = Math.max(1, num(settings.brushSize) || 14) * scale, gamma = 2 ** (curve / 50), salt = (seed | 0) ^ Math.imul(num(settings.brushSeed) | 0, 0x9e3779b1);
  const steps = points.map((point, i) => i ? Math.hypot(point.x - points[i - 1].x, point.y - points[i - 1].y) : 0);
  if (points.length > 1) steps[0] = steps[1];
  let travelled = 0, smooth = steps[0] ?? 0;
  return points.map((point, i) => {
    travelled += steps[i]; smooth += (steps[i] - smooth) * .25;
    let p = clamp(point.p) ** gamma;
    if (speed) p *= 1 - speed * .82 * clamp(smooth / (size * .42));
    if (jitter) p *= 1 - jitter * .75 + wave(travelled / (size * 1.1), salt) * jitter * 1.5;
    return { ...point, p: clamp(p, .03, 1) };
  });
}
