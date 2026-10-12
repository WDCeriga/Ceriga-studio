import { mirrorSeam } from './panellingGeometry';
import type { PanellingSeam } from './panellingTypes';

export function linkedMirrorSeams(seams: PanellingSeam[], axis: number, enabled: boolean): PanellingSeam[] {
  if (!enabled) return seams;
  const mirrored = seams.filter(seam => seam.mirrorLinked !== false && !seam.id.endsWith(':mirror'))
    .map(seam => mirrorSeam(seam, axis));
  return [...seams, ...mirrored];
}

export function unlinkMirrorGroup(seams: PanellingSeam[], mirrorGroupId: string): PanellingSeam[] {
  const source = seams.find(seam => seam.mirrorGroupId === mirrorGroupId || seam.id === mirrorGroupId);
  const partner = seams.find(seam => seam.id === `${source?.id}:mirror`);
  return seams.flatMap(seam => seam === source
    ? [{ ...seam, mirrorLinked: false, mirrorGroupId: undefined }, ...(partner ? [{ ...partner, id: crypto.randomUUID(), mirrorLinked: false, mirrorGroupId: undefined }] : [])]
    : seam === partner ? [] : [seam]);
}