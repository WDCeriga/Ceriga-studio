import { ASSET_EDITOR_CANVAS, type DrawnPoint } from './types';

export interface EditorViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const DEFAULT_EDITOR_VIEWBOX: EditorViewBox = {
  x: 0,
  y: 0,
  width: ASSET_EDITOR_CANVAS,
  height: ASSET_EDITOR_CANVAS,
};

const MIN_VIEWBOX_SIZE = 192;
const MAX_VIEWBOX_SIZE = ASSET_EDITOR_CANVAS * 2;

function clampViewBox(viewBox: EditorViewBox): EditorViewBox {
  const width = Math.min(MAX_VIEWBOX_SIZE, Math.max(MIN_VIEWBOX_SIZE, viewBox.width));
  const height = width;
  const margin = width * 0.35;
  const x = Math.min(ASSET_EDITOR_CANVAS + margin - width, Math.max(-margin, viewBox.x));
  const y = Math.min(ASSET_EDITOR_CANVAS + margin - height, Math.max(-margin, viewBox.y));
  return { x, y, width, height };
}

/** Scroll wheel zoom anchored to cursor position. */
export function zoomViewBoxAtScreenPoint(
  viewBox: EditorViewBox,
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
  deltaY: number,
): EditorViewBox {
  const anchor = screenToCanvas(clientX, clientY, svg);
  const zoomIn = deltaY < 0;
  const factor = zoomIn ? 0.88 : 1.12;
  const rect = svg.getBoundingClientRect();
  const mx = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
  const my = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
  const width = viewBox.width * factor;
  const height = width;

  return clampViewBox({
    x: anchor.x - mx * width,
    y: anchor.y - my * height,
    width,
    height,
  });
}

export function editorZoomPercent(viewBox: EditorViewBox): number {
  return Math.round((ASSET_EDITOR_CANVAS / viewBox.width) * 100);
}

/** Builder viewBox coords (0,0 top-left) → potrace local coords inside the standard group transform. */
export function canvasToPotrace(x: number, y: number): { px: number; py: number } {
  return {
    px: x * 10,
    py: (ASSET_EDITOR_CANVAS - y) * 10,
  };
}

/** Potrace local coords → builder viewBox coords. */
export function potraceToCanvas(px: number, py: number): DrawnPoint {
  return {
    x: px / 10,
    y: ASSET_EDITOR_CANVAS - py / 10,
  };
}

export function screenToCanvas(
  clientX: number,
  clientY: number,
  svg: SVGSVGElement,
): DrawnPoint {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;

  const ctm = svg.getScreenCTM();
  if (ctm) {
    const local = point.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  // Fallback if CTM is unavailable (e.g. during SSR)
  const rect = svg.getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  const width = vb.width || ASSET_EDITOR_CANVAS;
  const height = vb.height || ASSET_EDITOR_CANVAS;
  return {
    x: ((clientX - rect.left) / rect.width) * width + vb.x,
    y: ((clientY - rect.top) / rect.height) * height + vb.y,
  };
}
