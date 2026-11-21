/**
 * Transform pivot (plan R7, Illustrator's reference point). Pure.
 * `pivot` is a point in the object's own box: u, v ∈ [-0.5, 0.5] (0,0 = centre, -0.5,-0.5 = top-left).
 * Rotating about it keeps that point fixed on the canvas and moves the centre accordingly.
 */
export type Pivot = { u: number; v: number };
export const PIVOT_CENTRE: Pivot = { u: 0, v: 0 };

/** The nine reference points, row by row (top-left … bottom-right). */
export const PIVOT_GRID: { id: string; label: string; pivot: Pivot }[] = [-.5, 0, .5].flatMap(v => [-.5, 0, .5].map(u => ({
  id: `${u}:${v}`,
  label: `${v < 0 ? 'Top' : v > 0 ? 'Bottom' : 'Middle'} ${u < 0 ? 'left' : u > 0 ? 'right' : 'centre'}`.replace('Middle centre', 'Centre'),
  pivot: { u, v },
})));

const rotate = (x: number, y: number, degrees: number) => {
  const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: x * c - y * s, y: x * s + y * c };
};

export function rotateAboutPivot(box: { x: number; y: number; width: number; height: number; rotation: number }, nextRotation: number, pivot: Pivot): { x: number; y: number; rotation: number } {
  const local = { x: pivot.u * box.width, y: pivot.v * box.height };
  const before = rotate(local.x, local.y, box.rotation), after = rotate(local.x, local.y, nextRotation);
  const fixed = { x: box.x + before.x, y: box.y + before.y };
  return { x: fixed.x - after.x, y: fixed.y - after.y, rotation: nextRotation };
}
