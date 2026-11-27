/**
 * Touch and Apple Pencil hygiene for the Builder on iPad.
 *
 * - Palm rejection: while the Pencil is on the glass, and for a short moment after it lifts,
 *   finger touches on the canvas are ignored, so a resting hand never adds points, moves art or undoes.
 * - No text selection: long presses and drags never start a blue page selection, except in fields.
 * - Shared sizes: tools read `pointerSlop` and `pointerHitScale` so a Pencil tap stays a tap
 *   and points are easy to hit with a finger.
 */
const PALM_WINDOW = 500;
let penDown = false, lastPenAt = -Infinity, pencilSeen = false, installed = 0;

/** True while the Pencil is touching, or lifted less than half a second ago. */
export function penRecentlyActive(window = PALM_WINDOW) {
  return penDown || performance.now() - lastPenAt < window;
}

/** True once an Apple Pencil has been used in this session. */
export function pencilInUse() { return pencilSeen; }

/** How far, in screen pixels, a press can wander and still count as a tap. */
export function pointerSlop(type: string) { return type === 'touch' ? 10 : type === 'pen' ? 6 : 3; }

/** How much bigger hit areas should be for this input. */
export function pointerHitScale(type: string) { return type === 'touch' ? 1.9 : type === 'pen' ? 1.4 : 1; }

const editable = (target: EventTarget | null) => target instanceof Element
  && Boolean(target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [data-allow-select]'));

/** Areas a resting palm can land on. Panels and the section rail stay usable with a finger. */
const CANVAS = '.ceriga-builder-shell :is(.builder-workspace, .builder-canvas, main, [data-print-design-zone], .print-design-canvas, .packaging-studio-canvas, .label-studio, .builder-panelling-canvas, .canvas-dock)';
const PANELS = '.builder-inspector, .builder-sidebar, header, button, [role="button"], [role="toolbar"], [role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]';

function onPointer(event: PointerEvent) {
  if (event.pointerType === 'pen') {
    pencilSeen = true; lastPenAt = performance.now();
    if (event.type === 'pointerdown') {
      penDown = true;
      // A stray selection left by a finger would follow the Pencil around.
      if (!editable(event.target)) getSelection()?.removeAllRanges();
    }
    else if (event.type === 'pointerup' || event.type === 'pointercancel') penDown = false;
    return;
  }
  if (event.pointerType !== 'touch' || !penRecentlyActive()) return;
  const target = event.target as Element | null;
  if (!target?.closest?.(CANVAS) || target.closest(PANELS)) return;
  event.stopImmediatePropagation();
  if (event.cancelable) event.preventDefault();
}

function onTouch(event: TouchEvent) {
  // Touch events drive two-finger undo; a palm next to the Pencil must not trigger it.
  if (!penRecentlyActive()) return;
  const target = event.target as Element | null;
  if (!target?.closest?.(CANVAS) || target.closest(PANELS)) return;
  event.stopImmediatePropagation();
}

function onSelectStart(event: Event) {
  if (editable(event.target)) return;
  const target = event.target instanceof Element ? event.target : (event.target as Node | null)?.parentElement;
  if (target?.closest('.ceriga-builder-shell, [data-radix-popper-content-wrapper], [role="dialog"]')) event.preventDefault();
}

/** Images and SVG inside the Builder are never dragged out as files or shown in a callout. */
function onDragStart(event: DragEvent) {
  const target = event.target as Element | null;
  if (target instanceof Element && target.matches('img, svg, svg *') && target.closest('.ceriga-builder-shell') && !target.closest('[draggable="true"]')) event.preventDefault();
}

export function installTabletInput() {
  installed++;
  if (installed === 1) {
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) document.addEventListener(type, onPointer, { capture: true, passive: false });
    for (const type of ['touchstart', 'touchmove', 'touchend'] as const) document.addEventListener(type, onTouch, { capture: true, passive: true });
    document.addEventListener('selectstart', onSelectStart, true);
    document.addEventListener('dragstart', onDragStart, true);
  }
  return () => {
    installed--;
    if (installed) return;
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) document.removeEventListener(type, onPointer, true);
    for (const type of ['touchstart', 'touchmove', 'touchend'] as const) document.removeEventListener(type, onTouch, true);
    document.removeEventListener('selectstart', onSelectStart, true);
    document.removeEventListener('dragstart', onDragStart, true);
  };
}
