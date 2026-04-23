/**
 * Drop index while dragging a vertical layer list. Uses **vertical distance** from
 * drag start (not DOM hit-boxes), so the target slot updates from any pointer path
 * as long as it moves up/down — no need to "reach" the other row's static rect
 * (which breaks when the grabbed row is transformed) or a magic threshold region.
 */
export function listDragTargetIndexFromDelta(
  sourceIndex: number,
  deltaY: number,
  rowHeight: number,
  listLength: number,
): number {
  if (listLength <= 0) return 0;
  if (sourceIndex < 0 || sourceIndex >= listLength) return 0;
  const h = rowHeight;
  if (h <= 0) return sourceIndex;
  const steps = Math.round(deltaY / h);
  return Math.max(0, Math.min(sourceIndex + steps, listLength - 1));
}

/**
 * Reorder a list by moving one item from `fromIndex` to `toIndex`.
 * Used for layer stacks: later items render on top in the design preview.
 */
export function reorderDesignElements<T>(elements: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= elements.length ||
    toIndex >= elements.length
  ) {
    return elements;
  }
  const next = [...elements];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/**
 * Y offset (px) for a list row while dragging another row, so neighbours slide
 * smoothly with pointer movement instead of jumping only when the hover target changes.
 *
 * @param index - row index (not the dragged row; that row uses pointer delta separately)
 * @param sourceIndex - index of the row being dragged
 * @param targetIndex - row under the pointer from hit-testing (may equal source)
 * @param deltaY - pointer clientY minus drag start (positive = dragging down)
 * @param rowHeight - measured row height + list gap
 * @param listLength - element count
 */
export function getListReorderRowOffsetY(
  index: number,
  sourceIndex: number,
  targetIndex: number,
  deltaY: number,
  rowHeight: number,
  listLength: number,
): number {
  const h = rowHeight;
  if (h <= 0 || index === sourceIndex) return 0;
  const s = sourceIndex;
  const t = targetIndex;
  const d = deltaY;

  if (d > 0) {
    if (index <= s) return 0;
    if (t > s) {
      if (index > t) return 0;
      const k = index - s - 1;
      return -Math.min(Math.max(0, d - k * h), h);
    }
    if (t === s && s < listLength - 1 && index === s + 1) {
      return -Math.min(d, h);
    }
    return 0;
  }

  if (d < 0) {
    if (index >= s) return 0;
    if (t < s) {
      if (index < t || index >= s) return 0;
      const k = index - t;
      return Math.min(Math.max(0, -d - k * h), h);
    }
    if (t === s && s > 0 && index === s - 1) {
      return Math.min(-d, h);
    }
    return 0;
  }

  return 0;
}
