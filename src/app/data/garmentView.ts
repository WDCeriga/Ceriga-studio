export type GarmentView = 'front' | 'back';

export interface ViewDecoration {
  view?: GarmentView;
}

export function decorationsForView<Item extends ViewDecoration>(items: Item[], view: GarmentView): Item[] {
  return items.filter(item => (item.view ?? 'front') === view);
}

export function replaceViewDecorations<Item extends ViewDecoration>(items: Item[], view: GarmentView, next: Item[]): Item[] {
  return [...items.filter(item => (item.view ?? 'front') !== view), ...next.map(item => ({ ...item, view }))];
}