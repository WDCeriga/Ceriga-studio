import type { DistressMark, DistressMarkKind } from './distressScatter';

export interface DistressPath {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  dash?: number[];
}

function ellipsePath(rx: number, ry: number) {
  return `M${-rx},0 a${rx},${ry} 0 1,0 ${rx * 2},0 a${rx},${ry} 0 1,0 ${-rx * 2},0`;
}

// Both the settings swatches and garment paint use these exact paths and colours.
export function distressPaths(mark: DistressMark, kind: DistressMarkKind): DistressPath[] {
  const { width: w, height: h } = mark;
  if (kind === 'holes') {
    const edge = Array.from({ length: 28 }, (_, point) => {
      const angle = point / 28 * Math.PI * 2;
      const radius = .46 + Math.sin(point * 7.3) * mark.roughness * .1;
      return `${point ? 'L' : 'M'}${Math.cos(angle) * w * radius},${Math.sin(angle) * h * radius}`;
    }).join(' ') + ' Z';
    return [
      { d: edge, fill: '#242b29', stroke: '#c2c3ad', strokeWidth: 2.8 },
      { d: edge, stroke: '#f0e8ce', strokeWidth: 1.4, dash: [1, 2.4] },
      ...Array.from({ length: 10 }, (_, thread) => {
        const angle = thread / 10 * Math.PI * 2;
        return {
          d: `M${Math.cos(angle) * w * .42},${Math.sin(angle) * h * .42} l${Math.cos(angle) * 3},${Math.sin(angle) * 3}`,
          stroke: '#e4dfc8', strokeWidth: .7,
        };
      }),
    ];
  }
  if (kind === 'abrasion') {
    return [
      { d: ellipsePath(w * .55, h * .65), fill: '#d8d8bf', opacity: .16 },
      { d: ellipsePath(w * .42, h * .48), fill: '#e4e0c8', opacity: .22 },
      ...Array.from({ length: 18 }, (_, line) => {
        const y = (line / 17 - .5) * h;
        const width = w * Math.sqrt(Math.max(0, 1 - (line / 17 * 2 - 1) ** 2));
        return {
          d: `M${-width / 2},${y} l${width},${Math.sin(line * 2.7) * 1.4}`,
          stroke: line % 3 ? '#eee9d5' : '#bfc5b6', opacity: .4 + line % 3 * .2,
          strokeWidth: .9, dash: [2 + line % 4, 1 + line % 3],
        };
      }),
    ];
  }
  return [
    {
      d: `M${-w / 2},0 Q${-w * .18},${-h} 0,${-h * .35} L${w / 2},0 Q${w * .15},${h * .8} ${-w * .12},${h * .35} Z`,
      fill: '#242b29', stroke: '#d7d2b9', strokeWidth: 1.8,
    },
    ...Array.from({ length: 12 }, (_, thread) => {
      const x = (thread / 11 - .5) * w * .8;
      return {
        d: `M${x},${-h * .55 - 1} q${1 + thread % 3},${h * .65} ${thread % 2 ? -1 : 2},${h * 1.1 + 2}`,
        stroke: '#ece5cc', strokeWidth: thread % 3 ? .6 : 1, opacity: .85,
      };
    }),
  ];
}

export function renderDistressMarks(
  context: CanvasRenderingContext2D,
  marks: DistressMark[],
  kind: DistressMarkKind,
  pixelScale = 1,
) {
  context.save();
  context.scale(pixelScale, pixelScale);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  for (const mark of marks) {
    context.save();
    context.translate(mark.x / pixelScale, mark.y / pixelScale);
    context.rotate(mark.rotation);
    const paths = distressPaths({ ...mark, width: mark.width / pixelScale, height: mark.height / pixelScale }, kind);
    for (const primitive of paths) {
      const path = new Path2D(primitive.d);
      context.globalAlpha = mark.opacity * (primitive.opacity ?? 1);
      if (primitive.fill) {
        context.fillStyle = primitive.fill;
        context.fill(path);
      }
      if (primitive.stroke) {
        context.strokeStyle = primitive.stroke;
        context.lineWidth = primitive.strokeWidth ?? 1;
        context.setLineDash(primitive.dash ?? []);
        context.stroke(path);
      }
    }
    context.restore();
  }
  context.restore();
}
