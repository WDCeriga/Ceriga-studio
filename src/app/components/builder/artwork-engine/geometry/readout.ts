/** The live chip shown while transforming: physical size in cm (garments think in cm) or the angle. Pure. */
export function formatTransformReadout(kind: 'resize' | 'rotate' | string, box: { width: number; height: number; rotation: number }, unitsPerCm?: number): string {
  if (kind === 'rotate') {
    const angle = ((Math.round(box.rotation) % 360) + 540) % 360 - 180; // −180…180, 0 = upright
    return `${angle}°`;
  }
  if (unitsPerCm && unitsPerCm > 0) return `${(box.width / unitsPerCm).toFixed(1)} × ${(box.height / unitsPerCm).toFixed(1)} cm`;
  return `${Math.round(box.width)} × ${Math.round(box.height)} px`;
}
