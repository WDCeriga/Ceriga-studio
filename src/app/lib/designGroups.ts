import type { DesignElement } from '../components/builder/PrintsDesignStep';

export function canGroupLayer(element: DesignElement) {
  return !element.locked && !element.hidden && !element.customAreaOpen && !element.patternTarget
    && element.id !== 'print-drawing-layer' && element.id !== 'print-distress-layer';
}

export function groupLayersIssue(elements: DesignElement[], ids: string[]) {
  if (new Set(ids).size < 2) return 'Select at least two adjacent layers to group.';
  const selected = elements.filter(element => ids.includes(element.id));
  if (selected.length !== ids.length || selected.some(element => !canGroupLayer(element))) return 'Choose visible, unlocked artwork. Garment-bound and system layers cannot be grouped.';
  const first = selected[0]!;
  if (selected.some(element => (element.side ?? 'front') !== (first.side ?? 'front'))) return 'Choose layers on the same side.';
  if (selected.some(element => (element.printMethod ?? 'DTG') !== (first.printMethod ?? 'DTG'))) return 'Choose layers with the same print method.';
  const sameSide = elements.filter(element => (element.side ?? 'front') === (first.side ?? 'front'));
  const positions = selected.map(element => sameSide.indexOf(element));
  if (Math.max(...positions) - Math.min(...positions) + 1 !== selected.length) return 'Choose adjacent layers to preserve their stacking appearance.';
  return null;
}

export function groupDesignLayers(elements: DesignElement[], ids: string[], id: string): DesignElement[] {
  const issue = groupLayersIssue(elements, ids);
  if (issue) throw new Error(issue);
  const selected = elements.filter(element => ids.includes(element.id));
  const boxes = selected.map(element => {
    const angle = element.rotation * Math.PI / 180;
    const halfWidth = (Math.abs(Math.cos(angle)) * element.width + Math.abs(Math.sin(angle)) * element.height) / 2;
    const halfHeight = (Math.abs(Math.sin(angle)) * element.width + Math.abs(Math.cos(angle)) * element.height) / 2;
    return { left: element.x - halfWidth, right: element.x + halfWidth, top: element.y - halfHeight, bottom: element.y + halfHeight };
  });
  const left = Math.min(...boxes.map(box => box.left));
  const top = Math.min(...boxes.map(box => box.top));
  const width = Math.max(1, Math.max(...boxes.map(box => box.right)) - left);
  const height = Math.max(1, Math.max(...boxes.map(box => box.bottom)) - top);
  const group: DesignElement = {
    id, type: 'group', content: '', layerName: 'Group', x: left + width / 2, y: top + height / 2,
    width, height, rotation: 0, groupSourceWidth: width, groupSourceHeight: height,
    children: selected.map(element => ({ ...element, x: element.x - left, y: element.y - top })),
    side: selected[0]!.side, printMethod: selected[0]!.printMethod, aspectLocked: true,
  };
  return elements.flatMap(element => element.id === selected[0]!.id ? [group] : ids.includes(element.id) ? [] : [element]);
}

function needsTransformEnvelope(group: DesignElement) {
  return group.width !== (group.groupSourceWidth ?? group.width) || group.height !== (group.groupSourceHeight ?? group.height) || group.warp || group.perspective
    || group.flipHorizontal || group.flipVertical || group.cropTop || group.cropRight || group.cropBottom || group.cropLeft || group.cornerRadius
    || Object.keys(group).some(key => key.startsWith('filter') && group[key as keyof DesignElement] !== undefined);
}

export function ungroupLayersIssue(group: DesignElement | null | undefined) {
  if (!group || group.type !== 'group' || !group.children?.length) return 'Select a group to ungroup.';
  if (group.locked) return 'Unlock the group first.';
  if (group.children.length === 1 && group.groupTransformEnvelope && needsTransformEnvelope(group)) return 'This editable source retains its transform envelope. Edit its source below, or reset the group transform before ungrouping.';
  if ((group.opacity ?? 100) !== 100 || group.shadowBlur || group.shadowOffsetX || group.shadowOffsetY || group.filterBlur || group.filterNoise || group.filterGrain || group.filterSharpen) {
    return 'Reset group opacity, shadow and spatial filters before ungrouping to preserve overlapping artwork.';
  }
  return null;
}

export function ungroupDesignLayer(elements: DesignElement[], id: string, makeId: () => string): DesignElement[] {
  const group = elements.find(element => element.id === id);
  const issue = ungroupLayersIssue(group);
  if (issue) throw new Error(issue);
  const sourceWidth = group!.groupSourceWidth ?? group!.width;
  const sourceHeight = group!.groupSourceHeight ?? group!.height;
  const requiresEnvelope = needsTransformEnvelope(group!);
  const angle = group!.rotation * Math.PI / 180;
  const children = group!.children!.map(child => {
    if (requiresEnvelope) return {
      ...group!, id: makeId(), layerName: `${child.layerName ?? child.type} (transformed)`, children: [child], groupTransformEnvelope: true,
    };
    const x = child.x - sourceWidth / 2;
    const y = child.y - sourceHeight / 2;
    return { ...child, x: group!.x + x * Math.cos(angle) - y * Math.sin(angle), y: group!.y + x * Math.sin(angle) + y * Math.cos(angle), rotation: child.rotation + group!.rotation,
      ...(group!.side !== undefined ? { side: group!.side } : {}),
      ...(group!.printMethod !== undefined ? { printMethod: group!.printMethod } : {}),
      ...(group!.hidden ? { hidden: true } : {}),
    };
  });
  return elements.flatMap(element => element.id === id ? children : [element]);
}

export function toggleLayerSelection(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id];
}
