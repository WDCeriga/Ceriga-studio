/**
 * Garment-aware placement (plan §16, Adobe parity A.3). Pure: given the garment's print area (the body
 * panel bounds, in canvas units) and the canvas scale, returns where a piece of artwork should go.
 * Sizes follow common apparel placement conventions; artwork keeps its proportions and stays inside the body.
 */
export type Area = { x: number; y: number; width: number; height: number };
export type PlacementId = 'left-chest' | 'centre-chest' | 'full-front' | 'upper-back' | 'full-back' | 'centre';

type Spec = { label: string; side: 'front' | 'back' | 'both'; widthCm: number | null; maxShare: number; cx: number; top?: number; cy?: number };

/** cx / top / cy are fractions of the print area. Left chest is the wearer's left, i.e. the viewer's right on the front. */
const SPECS: Record<PlacementId, Spec> = {
  'left-chest':   { label: 'Left chest',   side: 'front', widthCm: 9,  maxShare: .32, cx: .72, top: .17 },
  'centre-chest': { label: 'Centre chest', side: 'front', widthCm: 25, maxShare: .62, cx: .5,  top: .16 },
  'full-front':   { label: 'Full front',   side: 'front', widthCm: 28, maxShare: .78, cx: .5,  cy: .42 },
  'upper-back':   { label: 'Upper back',   side: 'back',  widthCm: 28, maxShare: .72, cx: .5,  top: .08 },
  'full-back':    { label: 'Full back',    side: 'back',  widthCm: 32, maxShare: .82, cx: .5,  cy: .42 },
  'centre':       { label: 'Centre',       side: 'both',  widthCm: null, maxShare: .9, cx: .5,  cy: .45 },
};

export function garmentPlacements(side: 'front' | 'back'): { id: PlacementId; label: string }[] {
  return (Object.keys(SPECS) as PlacementId[]).filter(id => SPECS[id].side === side || SPECS[id].side === 'both').map(id => ({ id, label: SPECS[id].label }));
}

/** Centre-based box (the editor stores x/y as the object's centre). */
export function placeOnGarment(element: { width: number; height: number }, id: PlacementId, area: Area, unitsPerCm: number): { x: number; y: number; width: number; height: number } {
  const spec = SPECS[id];
  const aspect = element.width > 0 ? element.height / element.width : 1;
  let width = spec.widthCm == null ? element.width : spec.widthCm * unitsPerCm;
  width = Math.min(width, area.width * spec.maxShare);
  let height = width * aspect;
  const maxHeight = area.height * (spec.cy != null ? .8 : .45);
  if (height > maxHeight) { height = maxHeight; width = height / aspect; }
  const x = area.x + area.width * spec.cx;
  const y = spec.top != null ? area.y + area.height * spec.top + height / 2 : area.y + area.height * (spec.cy ?? .45);
  return { x, y, width, height };
}
