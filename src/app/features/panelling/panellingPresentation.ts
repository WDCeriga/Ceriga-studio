import type { BoundaryLoop } from './panellingTypes';

/** Measure the traced body-outline ribbon in the garment's own 2048-unit coordinate system. */
export function measureGarmentOutline(svg: SVGSVGElement, boundaries: BoundaryLoop[]): number | undefined {
  const root = svg.getScreenCTM();
  if (!root) return;
  const paths = [...svg.querySelectorAll<SVGPathElement>('[data-panelling-parent="outline"] path')].filter(path=>!path.closest('defs,mask,clipPath')).map(path => ({ path, inverse: path.getScreenCTM()?.inverse().multiply(root) }));
  const loops = boundaries.filter(loop => loop.surfaceId === 'base' || !loop.surfaceId);
  const body = loops.flatMap(loop => loop.points);
  if (!body.length || !paths.length) return;
  const minY = Math.min(...body.map(p => p.y)), maxY = Math.max(...body.map(p => p.y));
  const weights: number[] = [];
  // Torso sides avoid neckline, armholes and hem intersections.
  const samples = loops.flatMap(loop => loop.points.map((point, i, all) => {
    const before = all[(i+all.length-1)%all.length], after = all[(i+1)%all.length];
    const dx=after.x-before.x, dy=after.y-before.y, length=Math.hypot(dx,dy)||1;
    return {point, nx:-dy/length, ny:dx/length};
  })).filter(({point}) => point.y > minY + (maxY-minY)*.5 && point.y < minY + (maxY-minY)*.8).filter((_, i) => i % 8 === 0);
  for (const {point,nx,ny} of samples) {
    let run = 0, longest = 0;
    for (let dx = -16; dx <= 16; dx += .25) {
      const ink = paths.some(({ path, inverse }) => inverse && path.isPointInFill(new DOMPoint(point.x+dx*nx, point.y+dx*ny).matrixTransform(inverse)));
      if (ink) { run += .25; longest = Math.max(longest, run); } else run = 0;
    }
    if (longest > 0 && longest < 30) weights.push(longest);
  }
  if (weights.length) return weights.sort((a,b) => a-b)[Math.floor(weights.length/2)];
}

export function constructionInk(markup: string): string {
  const svg = new DOMParser().parseFromString(markup, 'image/svg+xml').documentElement;
  return [...svg.querySelectorAll('[data-technical-ink="true"]')].map(group => new XMLSerializer().serializeToString(group)).join('');
}
