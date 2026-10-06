export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];
export const UNIT_QUAD: Quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
export type Bounds = { x: number; y: number; width: number; height: number };

export function validQuad(points: Point[]): points is Quad {
  return points.length === 4 && points.every((point, index) => {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.max(Math.abs(point.x), Math.abs(point.y)) > 10) return false;
    const next = points[(index + 1) % 4];
    const after = points[(index + 2) % 4];
    return (next.x - point.x) * (after.y - next.y) - (next.y - point.y) * (after.x - next.x) > 0.00001;
  });
}

export function quadMap(input?: Quad) {
  const points = input && validQuad(input) ? input : UNIT_QUAD;
  const [topLeft, topRight, bottomRight, bottomLeft] = points;
  const deltaX = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
  const deltaY = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;
  const edgeX = topRight.x - bottomRight.x;
  const edgeY = topRight.y - bottomRight.y;
  const otherX = bottomLeft.x - bottomRight.x;
  const otherY = bottomLeft.y - bottomRight.y;
  const determinant = edgeX * otherY - otherX * edgeY;
  const horizontal = (deltaX * otherY - otherX * deltaY) / determinant;
  const vertical = (edgeX * deltaY - deltaX * edgeY) / determinant;
  const matrix = [topRight.x - topLeft.x + horizontal * topRight.x, bottomLeft.x - topLeft.x + vertical * bottomLeft.x, topLeft.x,
    topRight.y - topLeft.y + horizontal * topRight.y, bottomLeft.y - topLeft.y + vertical * bottomLeft.y, topLeft.y, horizontal, vertical, 1];
  const project = (point: Point): Point => {
    const denominator = matrix[6] * point.x + matrix[7] * point.y + 1;
    return { x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / denominator, y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / denominator };
  };
  const inverse = (point: Point): Point => {
    const first = matrix[0] - point.x * matrix[6];
    const second = matrix[1] - point.x * matrix[7];
    const third = matrix[3] - point.y * matrix[6];
    const fourth = matrix[4] - point.y * matrix[7];
    const targetX = point.x - matrix[2];
    const targetY = point.y - matrix[5];
    const divisor = first * fourth - second * third;
    return { x: (targetX * fourth - second * targetY) / divisor, y: (first * targetY - targetX * third) / divisor };
  };
  const css = (width: number, height: number) => `matrix3d(${[matrix[0], matrix[3] * height / width, 0, matrix[6] / width, matrix[1] * width / height, matrix[4], 0, matrix[7] / height, 0, 0, 1, 0, matrix[2] * width, matrix[5] * height, 0, 1].join(',')})`;
  return { project, inverse, css };
}

export function boundsQuad(bounds: Bounds): Quad {
  return [{ x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, { x: bounds.x, y: bounds.y + bounds.height }];
}

export function alphaBounds(image: ImageData): Bounds | null {
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let row = 0; row < image.height; row++) for (let column = 0; column < image.width; column++) {
    if (image.data[(row * image.width + column) * 4 + 3] < 8) continue;
    left = Math.min(left, column); top = Math.min(top, row);
    right = Math.max(right, column); bottom = Math.max(bottom, row);
  }
  return right < left ? null : { x: left / image.width, y: top / image.height, width: (right - left + 1) / image.width, height: (bottom - top + 1) / image.height };
}

export function zoneToAsset(point: Point, element: { x: number; y: number; width: number; height: number; rotation: number; perspective?: Quad; flipHorizontal?: boolean }): Point {
  const angle = element.rotation * Math.PI / 180;
  const deltaX = point.x - element.x;
  const deltaY = point.y - element.y;
  const local = quadMap(element.perspective).inverse({ x: (deltaX * Math.cos(angle) + deltaY * Math.sin(angle)) / element.width + 0.5, y: (-deltaX * Math.sin(angle) + deltaY * Math.cos(angle)) / element.height + 0.5 });
  return { x: element.flipHorizontal ? 1 - local.x : local.x, y: local.y };
}