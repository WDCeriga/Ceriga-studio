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
