import type { DesignElement } from '../../PrintStudioEditor';
import { textAppearance } from '../../../../lib/textAppearance';

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

/** One colour an object uses: its fill, outline, offset, shadow and so on. */
export type ColourSlot = { key: string; label: string; colour: string };
const TEXT_LAYER_NAMES: Record<string, string> = { fill: 'Fill', stroke: 'Outline', offset: 'Offset', shadow: 'Shadow', extrude: 'Depth', interlock: 'Interlock' };
export function colourSlots(element: DesignElement): ColourSlot[] {
  if (element.type === 'text') {
    const slots = textAppearance(element).filter(item => item.enabled).map(item => ({ key: 'ta:' + item.id, label: TEXT_LAYER_NAMES[item.type] ?? 'Colour', colour: item.colour }));
    if (element.textShadowEnabled && element.shadowColor && /^#/.test(element.shadowColor)) slots.push({ key: 'shadow', label: 'Shadow', colour: element.shadowColor });
    return slots.length ? slots : [{ key: 'colour', label: 'Colour', colour: element.color ?? '#171717' }];
  }
  if (element.type === 'shape') {
    const slots: ColourSlot[] = [];
    if (element.shapeFilled) slots.push({ key: 'fill', label: 'Fill', colour: element.shapeFillColor ?? element.color ?? '#171717' });
    if ((element.borderWidth ?? 0) > 0 || !element.shapeFilled) slots.push({ key: 'stroke', label: 'Outline', colour: element.shapeStrokeColor ?? element.color ?? '#171717' });
    return slots;
  }
  if (element.type === 'drawing') return [{ key: 'colour', label: 'Colour', colour: element.color ?? '#171717' }];
  return [];
}
export function slotPatch(element: DesignElement, key: string, colour: string): Partial<DesignElement> {
  if (key.startsWith('ta:')) {
    const id = key.slice(3), items = (element.textAppearance ?? textAppearance(element)).map(item => item.id === id ? { ...item, colour, preserveCharacterColours: item.type === 'fill' ? false : item.preserveCharacterColours } : item);
    const fill = items.find(item => item.id === id)?.type === 'fill';
    return { textAppearance: items, ...(fill ? { color: colour } : {}) };
  }
  if (key === 'shadow') return { shadowColor: colour };
  if (key === 'fill') return { shapeFillColor: colour, color: colour };
  if (key === 'stroke') return { shapeStrokeColor: colour, ...(element.shapeFilled ? {} : { color: colour }) };
  return { color: colour };
}
const sameColour = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
/** Every distinct colour across the selection, each with the places it is used, like Illustrator's selection colours. */
export function selectionColours(elements: DesignElement[]) {
  const groups: { colour: string; labels: string[]; uses: { id: string; key: string }[] }[] = [];
  for (const element of elements) if (!element.locked) for (const slot of colourSlots(element)) {
    const group = groups.find(item => sameColour(item.colour, slot.colour));
    if (group) { group.uses.push({ id: element.id, key: slot.key }); if (!group.labels.includes(slot.label)) group.labels.push(slot.label); }
    else groups.push({ colour: slot.colour, labels: [slot.label], uses: [{ id: element.id, key: slot.key }] });
  }
  return groups;
}
/** Changes one selection colour everywhere it is used. */
export function recolourSelection(all: DesignElement[], uses: { id: string; key: string }[], colour: string) {
  return all.map(element => { const mine = uses.filter(use => use.id === element.id); return mine.length ? mine.reduce((next, use) => ({ ...next, ...slotPatch(next, use.key, colour) }), element) : element; });
}
