/** Pure maths for the Asset Studio overview map. Boxes are on-screen rectangles. */
export type OverviewBox = { left: number; top: number; width: number; height: number };

/** The visible part of the artboard, as fractions of it. */
export function overviewViewport(artboard: OverviewBox, stage: OverviewBox) {
  if (!artboard.width || !artboard.height) return { x: 0, y: 0, width: 1, height: 1 };
  const left = Math.max(0, Math.min(1, (stage.left - artboard.left) / artboard.width)), top = Math.max(0, Math.min(1, (stage.top - artboard.top) / artboard.height));
  const right = Math.max(0, Math.min(1, (stage.left + stage.width - artboard.left) / artboard.width)), bottom = Math.max(0, Math.min(1, (stage.top + stage.height - artboard.top) / artboard.height));
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/** The pan that brings a chosen point of the artboard to the centre of the view. */
export function overviewPan(pan: { x: number; y: number }, artboard: OverviewBox, stage: OverviewBox, fx: number, fy: number, uiScale = 1) {
  const x = Math.max(0, Math.min(1, fx)), y = Math.max(0, Math.min(1, fy)), scale = uiScale || 1;
  return { x: pan.x + (stage.left + stage.width / 2 - (artboard.left + x * artboard.width)) / scale, y: pan.y + (stage.top + stage.height / 2 - (artboard.top + y * artboard.height)) / scale };
}
