import { bezierSplit, closestBoundaryPoint, distance, flattenSeam, projectToSegment } from './panellingGeometry';
import type { BoundaryLoop, PanellingPoint, PanellingSeam, SeamAnchor } from './panellingTypes';

export function snapAnchor(point: PanellingPoint, boundaries: BoundaryLoop[], seams: PanellingSeam[], radius = 28): SeamAnchor {
  let nearest: { point: PanellingPoint; distance: number; boundaryId?: string } | undefined = closestBoundaryPoint(point, boundaries);
  for (const seam of seams) {
    const line = flattenSeam(seam);
    for (let index = 0; index < line.length - 1; index++) {
      const projected = projectToSegment(point, line[index], line[index + 1]).point;
      const candidateDistance = distance(point, projected);
      if (!nearest || candidateDistance < nearest.distance) nearest = { point: projected, distance: candidateDistance };
    }
  }
  if (nearest && nearest.distance <= radius) return { id: crypto.randomUUID(), ...nearest.point, boundaryId: nearest.boundaryId };
  return { id: crypto.randomUUID(), ...point };
}

export function insertSeamAnchor(seam: PanellingSeam, point: PanellingPoint): PanellingSeam {
  let closest = { distance: Infinity, segment: 0, t: .5, point };
  for (let segment = 0; segment < seam.anchors.length - 1; segment++) {
    const start = seam.anchors[segment], end = seam.anchors[segment + 1];
    const curved = Boolean(start.outgoing || end.incoming);
    const steps = curved ? 48 : 1;
    for (let step = 0; step < steps; step++) {
      const t0 = step / steps, t1 = (step + 1) / steps;
      const first = curved ? pointOnCurve(start, end, t0) : start;
      const second = curved ? pointOnCurve(start, end, t1) : end;
      const projected = projectToSegment(point, first, second).point;
      const candidateDistance = distance(point, projected);
      if (candidateDistance < closest.distance) {
        const local = distance(first, second) ? distance(first, projected) / distance(first, second) : 0;
        closest = { distance: candidateDistance, segment, t: t0 + (t1 - t0) * local, point: projected };
      }
    }
  }
  if(closest.t<=.00001||closest.t>=.99999)return seam;
  const segmentIndex = closest.segment, t = closest.t;
  const start = seam.anchors[segmentIndex], end = seam.anchors[segmentIndex + 1];
  const anchor: SeamAnchor = { id: crypto.randomUUID(), handleMode: start.outgoing || end.incoming ? 'smooth' : 'corner', ...closest.point };
  const anchors = [...seam.anchors];
  if (start.outgoing || end.incoming) {
    const split = bezierSplit(start, end, t);
    anchors[segmentIndex] = split.start;
    anchors[segmentIndex + 1] = split.end;
    anchors.splice(segmentIndex + 1, 0, { ...anchor, incoming: split.inserted.incoming, outgoing: split.inserted.outgoing });
  } else anchors.splice(segmentIndex + 1, 0, anchor);
  return { ...seam, anchors };
}

export function pointOnCurve(start: SeamAnchor, end: SeamAnchor, t: number): PanellingPoint {
  const p0 = { x: start.x, y: start.y }, p1 = start.outgoing ?? p0, p3 = { x: end.x, y: end.y }, p2 = end.incoming ?? p3;
  const u = 1 - t;
  return { x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
    y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y };
}

export function moveSeamAnchor(seam: PanellingSeam, anchorId: string, point: PanellingPoint): PanellingSeam {
  return { ...seam, anchors: seam.anchors.map(anchor => {
    if (anchor.id !== anchorId) return anchor;
    const dx = point.x - anchor.x, dy = point.y - anchor.y;
    return { ...anchor, x: point.x, y: point.y,
      incoming: anchor.incoming ? { x: anchor.incoming.x + dx, y: anchor.incoming.y + dy } : undefined,
      outgoing: anchor.outgoing ? { x: anchor.outgoing.x + dx, y: anchor.outgoing.y + dy } : undefined };
  }) };
}

export function setAnchorMode(seam: PanellingSeam, anchorId: string, mode: NonNullable<SeamAnchor['handleMode']>): PanellingSeam {
  return { ...seam, anchors: seam.anchors.map((anchor, index) => {
    if (anchor.id !== anchorId) return anchor;
    if (mode === 'independent'&&(anchor.incoming||anchor.outgoing))return {...anchor,handleMode:mode};
    if (mode === 'corner') return { ...anchor, handleMode: mode, incoming: undefined, outgoing: undefined };
    const previous = seam.anchors[index - 1], next = seam.anchors[index + 1];
    const incomingLength = anchor.incoming?distance(anchor.incoming,anchor):previous ? distance(previous, anchor) / 3 : 0;
    const outgoingLength = anchor.outgoing?distance(anchor.outgoing,anchor):next ? distance(anchor, next) / 3 : 0;
    let dx = (next?.x ?? anchor.x) - (previous?.x ?? anchor.x), dy = (next?.y ?? anchor.y) - (previous?.y ?? anchor.y);
    if(anchor.outgoing&&distance(anchor,anchor.outgoing)>.001){dx=anchor.outgoing.x-anchor.x;dy=anchor.outgoing.y-anchor.y}else if(anchor.incoming&&distance(anchor,anchor.incoming)>.001){dx=anchor.x-anchor.incoming.x;dy=anchor.y-anchor.incoming.y}
    const magnitude = Math.hypot(dx, dy) || 1;
    dx /= magnitude; dy /= magnitude;
    const incoming = previous ? { x: anchor.x - dx * incomingLength, y: anchor.y - dy * incomingLength } : anchor.incoming;
    const outgoing = next ? { x: anchor.x + dx * outgoingLength, y: anchor.y + dy * outgoingLength } : anchor.outgoing;
    return { ...anchor, handleMode: mode, incoming, outgoing };
  }) };
}

export function convertSeamToCurve(seam: PanellingSeam, segmentIndex: number): PanellingSeam {
  if (segmentIndex < 0 || segmentIndex >= seam.anchors.length - 1) return seam;
  const start = seam.anchors[segmentIndex], end = seam.anchors[segmentIndex + 1];
  if (start.outgoing || end.incoming) return seam;
  const dx = (end.x - start.x) / 3, dy = (end.y - start.y) / 3;
  const anchors = [...seam.anchors];
  anchors[segmentIndex] = { ...start, handleMode: start.handleMode === 'independent' ? 'independent' : 'smooth', outgoing: { x: start.x + dx, y: start.y + dy } };
  anchors[segmentIndex + 1] = { ...end, handleMode: end.handleMode === 'independent' ? 'independent' : 'smooth', incoming: { x: end.x - dx, y: end.y - dy } };
  return { ...seam, anchors };
}
export function closestSeamLocation(seam:PanellingSeam,point:PanellingPoint){
 let best:{segmentIndex:number;t:number;point:PanellingPoint;distance:number}|undefined;
 for(let index=0;index<seam.anchors.length-1;index++){
  const a=seam.anchors[index],b=seam.anchors[index+1],steps=a.outgoing||b.incoming?64:1;
  for(let step=0;step<steps;step++){
   const t0=step/steps,t1=(step+1)/steps;
   const first=steps===1?a:pointOnCurve(a,b,t0),second=steps===1?b:pointOnCurve(a,b,t1);
   const projected=projectToSegment(point,first,second),d=distance(point,projected.point);
   if(!best||d<best.distance){const ratio=distance(first,second)?distance(first,projected.point)/distance(first,second):0;const t=t0+(t1-t0)*ratio;best={segmentIndex:index,t,point:steps===1?projected.point:pointOnCurve(a,b,t),distance:d};}
  }
 }
 return best;
}

/** Pull a cubic at the grab parameter while keeping both endpoints fixed. */
export function bendSeamSegment(seam:PanellingSeam,index:number,t:number,target:PanellingPoint):PanellingSeam{
 if(index<0||index>=seam.anchors.length-1)return seam;
 const next=convertSeamToCurve(seam,index),a=next.anchors[index],b=next.anchors[index+1];
 const u=Math.max(.05,Math.min(.95,t)),at=pointOnCurve(a,b,u),w1=3*(1-u)**2*u,w2=3*(1-u)*u**2,denominator=w1*w1+w2*w2;
 const dx=target.x-at.x,dy=target.y-at.y,c1=a.outgoing??a,c2=b.incoming??b;
 return {...next,anchors:next.anchors.map((anchor,i)=>i===index?{...anchor,handleMode:'independent',outgoing:{x:c1.x+dx*w1/denominator,y:c1.y+dy*w1/denominator}}:i===index+1?{...anchor,handleMode:'independent',incoming:{x:c2.x+dx*w2/denominator,y:c2.y+dy*w2/denominator}}:anchor)};
}

export function straightenSeamSegment(seam:PanellingSeam,index:number):PanellingSeam{
 if(index<0||index>=seam.anchors.length-1)return seam;
 return {...seam,anchors:seam.anchors.map((anchor,i)=>i===index?{...anchor,outgoing:undefined}:i===index+1?{...anchor,incoming:undefined}:anchor)};
}

export function removeSeamAnchor(seam:PanellingSeam,id:string):PanellingSeam{
 const index=seam.anchors.findIndex(anchor=>anchor.id===id);
 if(index<=0||index>=seam.anchors.length-1)return seam;
 return {...seam,anchors:seam.anchors.filter(anchor=>anchor.id!==id)};
}
