import { mirrorSeam } from './panellingGeometry';
import type { PanellingSeam } from './panellingTypes';

export function linkedMirrorSeams(seams: PanellingSeam[], axis: number, legacyMirror = false): PanellingSeam[] {
  const ids = new Set(seams.map(seam => seam.id));
  const mirrored = seams.flatMap(seam => {
    if (!(seam.mirrorLinked ?? legacyMirror) || seam.id.endsWith(':mirror') || ids.has(seam.id + ':mirror')) return [];
    const partner = mirrorSeam(seam, axis);
    const samePoint = (a: {x: number; y: number}, b: {x: number; y: number}) =>
      Math.abs(a.x - b.x) < .001 && Math.abs(a.y - b.y) < .001;
    const matches = (reversed: boolean) => seam.anchors.every((anchor, index) => {
      const other = partner.anchors[reversed ? partner.anchors.length - 1 - index : index];
      return samePoint(anchor, other)
        && samePoint(anchor.incoming ?? anchor, (reversed ? other.outgoing : other.incoming) ?? other)
        && samePoint(anchor.outgoing ?? anchor, (reversed ? other.incoming : other.outgoing) ?? other);
    });
    return matches(false) || matches(true) ? [] : [partner];
  });
  return mirrored.length ? [...seams, ...mirrored] : seams;
}

export function unlinkMirrorGroup(seams: PanellingSeam[], mirrorGroupId: string): PanellingSeam[] {
  const source = seams.find(seam => seam.mirrorGroupId === mirrorGroupId || seam.id === mirrorGroupId);
  const partner = seams.find(seam => seam.id === `${source?.id}:mirror`);
  return seams.flatMap(seam => seam === source
    ? [{ ...seam, mirrorLinked: false, mirrorGroupId: undefined }, ...(partner ? [{ ...partner, id: crypto.randomUUID(), mirrorLinked: false, mirrorGroupId: undefined }] : [])]
    : seam === partner ? [] : [seam]);
}