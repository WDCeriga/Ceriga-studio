import type { PodPlacement } from '../data/userOrders';

/** Human-readable summary of a POD print placement, e.g. "+5% down · 120% size · 15°". */
export function podPlacementSummary(p: PodPlacement | undefined | null): string | null {
  if (!p) return null;
  const parts: string[] = [];
  if (p.offsetX !== 0 || p.offsetY !== 0) {
    const bits: string[] = [];
    if (p.offsetX > 0) bits.push(`${p.offsetX}% right`);
    else if (p.offsetX < 0) bits.push(`${Math.abs(p.offsetX)}% left`);
    if (p.offsetY > 0) bits.push(`${p.offsetY}% down`);
    else if (p.offsetY < 0) bits.push(`${Math.abs(p.offsetY)}% up`);
    parts.push(`Offset ${bits.join(', ')}`);
  }
  if (p.scale !== 100) {
    parts.push(p.scale > 100 ? `Enlarged ${p.scale - 100}%` : `Reduced ${100 - p.scale}%`);
  }
  if (p.rotation !== 0) {
    parts.push(
      p.rotation > 0
        ? `Rotated ${p.rotation}° CW`
        : `Rotated ${Math.abs(p.rotation)}° CCW`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : 'Centered';
}
