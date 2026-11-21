import clipping from 'polygon-clipping';
import type { DesignElement } from '../../PrintStudioEditor';
import { fitPenPath, pathPolygons, shapeWorldPath } from '../../../../lib/artworkPathOperations';
import { offsetArtwork } from '../../../../lib/artworkPathCommands';
import type { ShapePath } from '../../../../lib/shapeGeometry';

/**
 * Live repeat (plan E / ref 15). A repeat is a group: child 0 is the hidden master (the editable source),
 * the rest are generated copies. Changing the settings or the master regenerates the copies (R8, source-linked).
 * Coordinates are the group's source space (children's x/y), as for ordinary groups.
 */
export type RepeatMode = 'radial' | 'mirror-x' | 'mirror-y' | 'mirror-4' | 'turn';
export type RepeatSettings = {
  mode: RepeatMode;
  /** Radial: number of copies including the first. */
  count: number;
  /** Radial: degrees covered (360 = full circle). */
  span: number;
  /** Radial: copies turn with the circle. */
  rotateCopies: boolean;
  /** Centre of the repeat in source space. */
  centre: { x: number; y: number };
  /** Knockout gap (px) where a copy passes under the next; 0 = off. Shapes only. */
  gap: number;
};
export const REPEAT_MODES: { mode: RepeatMode; label: string }[] = [
  { mode: 'radial', label: 'Around' },
  { mode: 'mirror-x', label: 'Mirror' },
  { mode: 'mirror-y', label: 'Flip down' },
  { mode: 'mirror-4', label: '4-way' },
  { mode: 'turn', label: 'Turn 180°' },
];

const rotateAbout = (p: { x: number; y: number }, c: { x: number; y: number }, degrees: number) => {
  const a = degrees * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
};

/** Pure: the copies of `master` for the settings (copy 0 sits where the master is). */
export function repeatCopies(master: DesignElement, s: RepeatSettings): Partial<DesignElement>[] {
  const c = s.centre, at = { x: master.x, y: master.y };
  const mirrorX = (): Partial<DesignElement> => ({ x: 2 * c.x - at.x, y: at.y, rotation: -master.rotation, flipHorizontal: !master.flipHorizontal });
  const mirrorY = (): Partial<DesignElement> => ({ x: at.x, y: 2 * c.y - at.y, rotation: -master.rotation, flipVertical: !master.flipVertical });
  const turn = (): Partial<DesignElement> => ({ ...rotateAbout(at, c, 180), rotation: master.rotation + 180 });
  switch (s.mode) {
    case 'mirror-x': return [{}, mirrorX()];
    case 'mirror-y': return [{}, mirrorY()];
    case 'mirror-4': return [{}, mirrorX(), mirrorY(), turn()];
    case 'turn': return [{}, turn()];
    default: {
      const count = Math.max(2, Math.min(36, Math.round(s.count)));
      const full = Math.abs(s.span) >= 359.5, step = s.span / (full ? count : Math.max(1, count - 1));
      return Array.from({ length: count }, (_, i) => {
        const angle = step * i;
        return i === 0 ? {} : { ...rotateAbout(at, c, angle), rotation: master.rotation + (s.rotateCopies ? angle : 0) };
      });
    }
  }
}

/** Default centre: a little below/left of the object so "Around" reads as a flower, not a stack. */
export function defaultRepeatCentre(master: DesignElement, mode: RepeatMode) {
  if (mode === 'mirror-x') return { x: master.x + master.width * .5 + 4, y: master.y };
  if (mode === 'mirror-y') return { x: master.x, y: master.y + master.height * .5 + 4 };
  if (mode === 'radial') return { x: master.x, y: master.y + master.height * .5 };
  return { x: master.x + master.width * .5 + 4, y: master.y + master.height * .5 + 4 };
}

function knockout(copies: DesignElement[], gap: number, cyclic: boolean): DesignElement[] {
  if (!(gap > 0) || copies.length < 2 || copies.some(copy => copy.type !== 'shape')) return copies;
  const cutters = copies.map(copy => { try { return pathPolygons(shapeWorldPath(offsetArtwork(copy, gap))); } catch { return null; } });
  return copies.map((copy, i) => {
    const next = i + 1 < copies.length ? i + 1 : cyclic ? 0 : -1, cutter = next >= 0 ? cutters[next] : null;
    if (!cutter) return copy;
    try {
      const rest = clipping.difference(pathPolygons(shapeWorldPath(copy)), cutter);
      if (!rest.length) return copy;
      const rings: ShapePath[] = rest.flatMap(polygon => polygon.map(ring => ({ closed: true, nodes: ring.slice(0, -1).map(([x, y]) => ({ x, y })) })));
      const fitted = fitPenPath({ ...rings[0], subpaths: rings.slice(1) });
      return { ...copy, ...fitted, content: 'custom-path', shapeGeometry: 'bounds', shapeFillRule: 'evenodd', rotation: 0, flipHorizontal: false, flipVertical: false, shapeParameters: undefined, shapeCornerRadius: 0 } as DesignElement;
    } catch { return copy; }
  });
}

const settingsKey = (group: DesignElement) => JSON.stringify([group.artworkRepeat, group.children?.[0]]);

/** Regenerate copies when the settings or the master changed; keeps the group's on-garment centre steady. */
export function refreshRepeat(group: DesignElement): DesignElement {
  const s = group.artworkRepeat, master = group.children?.[0];
  if (!s || !master || group.repeatKey === settingsKey(group)) return group;
  const placed = repeatCopies(master, s).map((patch, i) => ({ ...master, ...patch, id: `${group.id}~${i}`, hidden: false, repeatMaster: undefined, repeatCopy: true, layerName: `${master.layerName ?? 'Copy'} ${i + 1}` } as DesignElement));
  const copies = knockout(placed, s.gap, s.mode === 'radial' ? Math.abs(s.span) >= 359.5 : s.mode !== 'mirror-x' && s.mode !== 'mirror-y');
  // New source box around every copy.
  const boxes = copies.map(e => { const a = e.rotation * Math.PI / 180, hw = (Math.abs(Math.cos(a)) * e.width + Math.abs(Math.sin(a)) * e.height) / 2, hh = (Math.abs(Math.sin(a)) * e.width + Math.abs(Math.cos(a)) * e.height) / 2; return { l: e.x - hw, r: e.x + hw, t: e.y - hh, b: e.y + hh }; });
  const left = Math.min(...boxes.map(b => b.l)), top = Math.min(...boxes.map(b => b.t));
  const width = Math.max(1, Math.max(...boxes.map(b => b.r)) - left), height = Math.max(1, Math.max(...boxes.map(b => b.b)) - top);
  const sourceW = group.groupSourceWidth ?? group.width, sourceH = group.groupSourceHeight ?? group.height;
  const sx = group.width / Math.max(1, sourceW), sy = group.height / Math.max(1, sourceH);
  // Shift of the box centre in source space → garment space (scale, flip, rotation of the envelope).
  const dx = (left + width / 2 - sourceW / 2) * sx * (group.flipHorizontal ? -1 : 1), dy = (top + height / 2 - sourceH / 2) * sy * (group.flipVertical ? -1 : 1);
  const angle = group.rotation * Math.PI / 180;
  const shift = (e: DesignElement) => ({ ...e, x: e.x - left, y: e.y - top });
  const next: DesignElement = {
    ...group,
    x: group.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: group.y + dx * Math.sin(angle) + dy * Math.cos(angle),
    width: width * sx, height: height * sy, groupSourceWidth: width, groupSourceHeight: height,
    artworkRepeat: { ...s, centre: { x: s.centre.x - left, y: s.centre.y - top } },
    children: [{ ...shift(master), hidden: true, repeatMaster: true }, ...copies.map(shift)],
  };
  return { ...next, repeatKey: settingsKey(next) };
}

/** Turn one object into a live repeat group (it becomes the hidden master). */
export function createRepeat(elements: DesignElement[], id: string, mode: RepeatMode, groupId: string): DesignElement[] {
  const original = elements.find(element => element.id === id);
  if (!original) return elements;
  // Keep roughly the original footprint: the copies share the space the single object used.
  const factor = mode === 'radial' || mode === 'mirror-4' ? .5 : .65;
  const master: DesignElement = { ...original, width: original.width * factor, height: original.height * factor, ...(original.type === 'text' && original.fontSize ? { fontSize: original.fontSize * factor } : {}) };
  const settings: RepeatSettings = { mode, count: mode === 'radial' ? 4 : 2, span: 360, rotateCopies: true, centre: defaultRepeatCentre(master, mode), gap: 0 };
  // Start in garment space (source box = the garment), then refresh normalises it.
  const seed: DesignElement = {
    id: groupId, type: 'group', content: '', layerName: 'Repeat', x: 0, y: 0, width: 1, height: 1, rotation: 0,
    groupSourceWidth: 1, groupSourceHeight: 1, side: master.side, printMethod: master.printMethod, locked: false,
    children: [{ ...master, repeatMaster: true, hidden: true }], artworkRepeat: settings, repeatKey: undefined,
  };
  // With a 1×1 source and 0,0 centre, refresh's shift math places the group at the copies' true centre.
  const group = refreshRepeat({ ...seed, x: .5, y: .5 });
  return elements.map(element => element.id === id ? group : element);
}

/** Patch the settings or the master, then regenerate. */
export function updateRepeat(group: DesignElement, patch: { settings?: Partial<RepeatSettings>; master?: Partial<DesignElement> }): DesignElement {
  const s = group.artworkRepeat, master = group.children?.[0];
  if (!s || !master) return group;
  return refreshRepeat({ ...group, artworkRepeat: { ...s, ...patch.settings }, children: [{ ...master, ...patch.master }, ...(group.children ?? []).slice(1)] });
}

/** Release: copies become ordinary objects in a normal group; the hidden master is dropped. */
export function releaseRepeat(group: DesignElement): DesignElement {
  return { ...group, artworkRepeat: undefined, repeatKey: undefined, layerName: 'Group', children: (group.children ?? []).filter(child => !child.repeatMaster).map(child => ({ ...child, repeatCopy: undefined, id: crypto.randomUUID() })) };
}
