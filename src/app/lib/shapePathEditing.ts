import type { ShapePath, ShapePathNode } from './shapeGeometry';
import type { DesignElement } from '../components/builder/PrintStudioEditor';
import { quadMap } from './designGeometry';
import { interpolateWarpGrid, warpGrid } from './warpGeometry';

type Point = { x: number; y: number };
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export function pathSegmentPoint(a: ShapePathNode, b: ShapePathNode, t: number) {
  const p = mix(a, a.out ?? a, t), q = mix(a.out ?? a, b.in ?? b, t), r = mix(b.in ?? b, b, t);
  return mix(mix(p, q, t), mix(q, r, t), t);
}
export function splitShapeSegment(path: ShapePath, index: number, t = 0.5): ShapePath {
  const nodes = path.nodes.map(node => ({ ...node }));
  const next = (index + 1) % nodes.length;
  if (!nodes[index] || !nodes[next] || (!path.closed && next === 0)) return path;
  t = Math.max(0.000001, Math.min(0.999999, t));
  const a = nodes[index], b = nodes[next];
  const p = mix(a, a.out ?? a, t), q = mix(a.out ?? a, b.in ?? b, t), r = mix(b.in ?? b, b, t);
  const s = mix(p, q, t), u = mix(q, r, t);
  nodes[index] = { ...a, out: p }; nodes[next] = { ...b, in: r };
  nodes.splice(index + 1, 0, { ...mix(s, u, t), in: s, out: u });
  return { ...path, nodes };
}
export function moveShapePoints(path: ShapePath, indices: number[], delta: Point): ShapePath {
  const moved = new Set(indices);
  return { ...path, nodes: path.nodes.map((node, index) => !moved.has(index) ? node : ({
    ...node, x: node.x + delta.x, y: node.y + delta.y,
    in: node.in ? { x: node.in.x + delta.x, y: node.in.y + delta.y } : undefined,
    out: node.out ? { x: node.out.x + delta.x, y: node.out.y + delta.y } : undefined,
  })) };
}
export function deleteShapePoints(path: ShapePath, indices: number[]): ShapePath {
  const remove=[...new Set(indices)].filter(i=>i>=0&&i<path.nodes.length).sort((a,b)=>b-a);
  if(path.nodes.length-remove.length<(path.closed?3:2))return path;
  const nodes=path.nodes.map(n=>({...n}));
  for(const index of remove){
    if(path.closed||(index>0&&index<nodes.length-1)){
      const before=(index-1+nodes.length)%nodes.length,after=(index+1)%nodes.length,a=nodes[before],m=nodes[index],b=nodes[after];
      if(m.in&&m.out){
        const l=Math.hypot(m.x-m.in.x,m.y-m.in.y),r=Math.hypot(m.out.x-m.x,m.out.y-m.y),t=l/(l+r);
        if(t>1e-6&&t<1-1e-6){
          const first=a.out??a,last=b.in??b,c1={x:a.x+(first.x-a.x)/t,y:a.y+(first.y-a.y)/t},c2={x:b.x+(last.x-b.x)/(1-t),y:b.y+(last.y-b.y)/(1-t)},left={...a,out:c1},right={...b,in:c2};
          const matches=[0,.25,.5,.75,1].every(u=>{const p=pathSegmentPoint(a,m,u),q=pathSegmentPoint(left,right,u*t),v=pathSegmentPoint(m,b,u),w=pathSegmentPoint(left,right,t+u*(1-t));return Math.hypot(p.x-q.x,p.y-q.y)<1e-5&&Math.hypot(v.x-w.x,v.y-w.y)<1e-5;});
          if(matches){nodes[before]=left;nodes[after]=right;}
        }
      }
    }
    nodes.splice(index,1);
  }
  return {...path,nodes};
}
export function smoothShapePoints(path: ShapePath, indices: number[], smooth: boolean): ShapePath {
  return { ...path, nodes: path.nodes.map((node, index, nodes) => {
    if (!indices.includes(index)) return node;
    if (!smooth) return { ...node, in: undefined, out: undefined };
    if(!path.closed&&index===0){const next=nodes[1];return {...node,in:undefined,out:{x:node.x+(next.x-node.x)/3,y:node.y+(next.y-node.y)/3}};}
    if(!path.closed&&index===nodes.length-1){const prev=nodes[index-1];return {...node,out:undefined,in:{x:node.x-(node.x-prev.x)/3,y:node.y-(node.y-prev.y)/3}};}
    const prev = nodes[(index - 1 + nodes.length) % nodes.length], next = nodes[(index + 1) % nodes.length];
    const dx = (next.x - prev.x) / 6, dy = (next.y - prev.y) / 6;
    return { ...node, in: { x: node.x - dx, y: node.y - dy }, out: { x: node.x + dx, y: node.y + dy } };
  }) };
}
export function shapePointMapping(element: DesignElement) {
  const settings = element.warp;
  const grid = settings ? warpGrid(settings) : null;
  const gridSize = settings?.mode === 'freeform' ? settings.gridSize : 3;
  const warp = (p: Point) => grid ? interpolateWarpGrid(grid, gridSize, p.x, p.y) : p;
  const flip = (p: Point) => ({ x: element.flipHorizontal ? 1 - p.x : p.x, y: element.flipVertical ? 1 - p.y : p.y });
  const projection = quadMap(element.perspective);
  return {
    project(point: Point): Point {
      const p = projection.project(warp(flip({ x: point.x / 100, y: point.y / 100 })));
      return { x: p.x * 100, y: p.y * 100 };
    },
    inverse(point: Point): Point {
      const target = projection.inverse({ x: point.x / 100, y: point.y / 100 });
      let p = { ...target };
      // Solve the bilinear warp locally rather than moving anchors in the unwarped screen plane.
      if (grid) for (let i = 0; i < 18; i++) {
        const a = warp(p), ex = a.x - target.x, ey = a.y - target.y;
        if (Math.hypot(ex, ey) < 0.000001) break;
        const h = 0.0001, sx = p.x > 0.999 ? -h : h, sy = p.y > 0.999 ? -h : h;
        const b = warp({ x: p.x + sx, y: p.y }), c = warp({ x: p.x, y: p.y + sy });
        const xx = (b.x - a.x) / sx, xy = (c.x - a.x) / sy, yx = (b.y - a.y) / sx, yy = (c.y - a.y) / sy;
        const det = xx * yy - xy * yx;
        if (Math.abs(det) < 1e-8) break;
        p = { x: Math.max(0, Math.min(1, p.x - (yy * ex - xy * ey) / det)), y: Math.max(0, Math.min(1, p.y - (xx * ey - yx * ex) / det)) };
      }
      p = flip(p);
      return { x: p.x * 100, y: p.y * 100 };
    },
  };
}
