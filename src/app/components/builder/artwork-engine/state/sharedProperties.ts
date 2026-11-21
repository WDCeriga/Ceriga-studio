import type { DesignElement } from '../../PrintStudioEditor';

/** Multi-object property editing (plan C.2): read the value the selection shares, write one value to all. */

export const isInkable = (element: DesignElement) => element.type === 'text' || element.type === 'shape' || element.type === 'drawing';

export function inkOf(element: DesignElement): string {
  if (element.type === 'shape') return (element.shapeFilled ? element.shapeFillColor : element.shapeStrokeColor) ?? element.color ?? '#171717';
  return element.color ?? '#171717';
}

export function inkPatch(element: DesignElement, colour: string): Partial<DesignElement> {
  if (element.type === 'text') return { color: colour, textAppearance: element.textAppearance?.map(item => item.type === 'fill' ? { ...item, colour, preserveCharacterColours: false } : item) };
  if (element.type === 'shape') return { color: colour, ...(element.shapeFilled ? { shapeFillColor: colour } : { shapeStrokeColor: colour }) };
  return { color: colour };
}

/** The shared value, or `null` when the selection is mixed (shown as "Mixed"). */
export function sharedValue<T>(elements: DesignElement[], read: (element: DesignElement) => T): T | null {
  if (!elements.length) return null;
  const first = read(elements[0]);
  return elements.every(element => read(element) === first) ? first : null;
}

/** Applies a patch (or per-element patch) to every selected, unlocked element; returns the new document. */
export function patchSelection(all: DesignElement[], ids: string[], patch: Partial<DesignElement> | ((element: DesignElement) => Partial<DesignElement>)): DesignElement[] {
  return all.map(element => ids.includes(element.id) && !element.locked ? { ...element, ...(typeof patch === 'function' ? patch(element) : patch) } : element);
}
