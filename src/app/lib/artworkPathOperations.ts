import ClipperLib from 'clipper-lib';
import {selectionChangesStacking} from './designGroups';
import clipping, { type MultiPolygon, type Pair } from 'polygon-clipping';
import type { DesignElement } from '../components/builder/PrintStudioEditor';
import { shapeToEditablePath, type ShapePath } from './shapeGeometry';
import { shapePointMapping } from './shapePathEditing';
import { stablePolygonDifference, stablePolygonUnion } from './stablePolygonUnion';

export type PathOperation = 'join' | 'subtract' | 'intersect' | 'exclude';
type Point = { x: number; y: number };
const mix = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export function mapShapePath(path: ShapePath, fn: (point: Point) => Point): ShapePath {
  return { ...path, nodes: path.nodes.map(n => ({ ...fn(n), ...(n.in ? { in: fn(n.in) } : {}), ...(n.out ? { out: fn(n.out) } : {}) })), subpaths: path.subpaths?.map(p => mapShapePath(p, fn)) };
}
/** Tight control-hull bounds keep both straight strokes and overshooting handles editable. */
export function fitPenPath(path: ShapePath, padding = 0) {
  const points: Point[] = [];
  const visit = (p: ShapePath) => { p.nodes.forEach(n => { points.push(n); if (n.in) points.push(n.in); if (n.out) points.push(n.out); }); p.subpaths?.forEach(visit); };
  visit(path);
  const left = Math.min(...points.map(p => p.x)) - padding, top = Math.min(...points.map(p => p.y)) - padding;
  const width = Math.max(1, Math.max(...points.map(p => p.x)) - left + padding), height = Math.max(1, Math.max(...points.map(p => p.y)) - top + padding);
  return { x: left + width / 2, y: top + height / 2, width, height, shapePath: mapShapePath(path, p => ({ x: (p.x - left) / width * 100, y: (p.y - top) / height * 100 })) };
}
export function shapeWorldPath(element: DesignElement): ShapePath {
  const mapping = shapePointMapping(element), angle = element.rotation * Math.PI / 180;
  return mapShapePath({...shapeToEditablePath(element),fillRule:element.shapeFillRule??'evenodd'}, point => {
    const p = mapping.project(point), x = (p.x / 100 - .5) * element.width, y = (p.y / 100 - .5) * element.height;
    return { x: element.x + x * Math.cos(angle) - y * Math.sin(angle), y: element.y + x * Math.sin(angle) + y * Math.cos(angle) };
  });
}
/** Adaptive subdivision in garment coordinates: at most 0.06 units from each cubic's control hull. */
export function pathPolygons(path: ShapePath): MultiPolygon {
  const distance = (p: Point, a: Point, b: Point) => {
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    return d ? Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / d : Math.hypot(p.x - a.x, p.y - a.y);
  };
  const contours: MultiPolygon[] = [];
  const visit = (part: ShapePath) => {
    if (part.closed && part.nodes.length >= 3) {
      const ring: Pair[] = [[part.nodes[0].x, part.nodes[0].y]];
      const curve = (a: Point, b: Point, c: Point, d: Point, depth = 0) => {
        const excess = Math.hypot(b.x-a.x,b.y-a.y)+Math.hypot(c.x-b.x,c.y-b.y)+Math.hypot(d.x-c.x,d.y-c.y)-Math.hypot(d.x-a.x,d.y-a.y);
        if (depth >= 16 || (Math.max(distance(b,a,d),distance(c,a,d)) < .06 && excess < .06)) { ring.push([d.x,d.y]); return; }
        const ab=mix(a,b),bc=mix(b,c),cd=mix(c,d),abc=mix(ab,bc),bcd=mix(bc,cd),middle=mix(abc,bcd);
        curve(a,ab,abc,middle,depth+1); curve(middle,bcd,cd,d,depth+1);
      };
      part.nodes.forEach((a,i) => { const b=part.nodes[(i+1)%part.nodes.length]; if (!a.out&&!b.in) ring.push([b.x,b.y]); else curve(a,a.out??a,b.in??b,b); });
      contours.push([[ring]]);
    }
    part.subpaths?.forEach(visit);
  };
  visit(path);
  if(!contours.length)return [];
  const scale=10000,engine=new ClipperLib.Clipper(),tree=new ClipperLib.PolyTree();
  engine.AddPaths(contours.flatMap(polygons=>polygons.flatMap(polygon=>polygon.map(ring=>ring.slice(0,-1).map(([X,Y])=>({X:Math.round(X*scale),Y:Math.round(Y*scale)}))))),ClipperLib.PolyType.ptSubject,true);
  const rule=path.fillRule==='nonzero'?ClipperLib.PolyFillType.pftNonZero:ClipperLib.PolyFillType.pftEvenOdd;engine.Execute(ClipperLib.ClipType.ctUnion,tree,rule,rule);
  return ClipperLib.JS.PolyTreeToExPolygons(tree).map((polygon:any)=>[polygon.outer,...polygon.holes].map((ring:any[])=>{const points=ring.map(p=>[p.X/scale,p.Y/scale] as Pair);return [...points,points[0]];}));
}
export function pathOperationIssue(elements: DesignElement[], ids: string[]) {
  const selected=elements.filter(e=>ids.includes(e.id));
  if(selected.length<2)return 'Select two or more filled shapes or outlined letters.';
  if(selected.some(e=>e.type!=='shape'||e.locked||e.hidden||e.shapeBrush||!shapeToEditablePath(e).closed))return 'Choose unlocked, closed vector shapes. Convert text to editable lettering first.';
  if(selected.some(e=>(e.side??'front')!==(selected[0].side??'front')))return 'Choose shapes on the same garment side.';
  if(selected.some(e=>e.warp||e.perspective||e.eraseContours?.length||e.paintStain))return 'Reset warp, perspective or erasing before combining paths.';
  if(selectionChangesStacking(elements,ids))return 'Choose neighbouring layers to preserve the stacking order.';
  return null;
}
export function combineArtworkPaths(elements: DesignElement[], ids: string[], operation: PathOperation, id: string): DesignElement[] {
  const issue=pathOperationIssue(elements,ids); if(issue)throw new Error(issue);
  const selected=elements.filter(e=>ids.includes(e.id)), geometries=selected.map(e=>pathPolygons(shapeWorldPath(e)));
  const result=operation==='join'?stablePolygonUnion(...geometries):operation==='subtract'?stablePolygonDifference(geometries[0],...geometries.slice(1)):operation==='intersect'?clipping.intersection(geometries[0],...geometries.slice(1)):clipping.xor(geometries[0],...geometries.slice(1));
  if(!result.length)throw new Error('These shapes leave no visible area. Move them to overlap and try again.');
  const contours=result.flatMap(poly=>poly.map(ring=>({closed:true,nodes:ring.slice(0,-1).map(([x,y])=>({x,y}))} as ShapePath)));
  const fitted=fitPenPath({...contours[0],subpaths:contours.slice(1)}), base=selected[0];
  const next:DesignElement={...base,...fitted,id,type:'shape',content:'custom-path',shapeGeometry:'bounds',rotation:0,flipHorizontal:false,flipVertical:false,drawingVectorSource:undefined,shapeBrush:undefined,letteringParts:undefined,letteringPaints:undefined,shapeOperationSources:selected,shapeOperationFrame:{x:fitted.x,y:fitted.y,width:fitted.width,height:fitted.height,rotation:0},layerName:operation==='subtract'?'Cutout design':operation==='join'?'Joined shape':'Combined shape'};
  return elements.flatMap(e=>e.id===base.id?[next]:ids.includes(e.id)?[]:[e]);
}
export function cutOrAddPenPath(element:DesignElement,worldPath:ShapePath,operation:'subtract'|'join'):DesignElement {
  if(!worldPath.closed)throw new Error('Close the pen path to create a cutout or add a region.');
  // An enclosed hand-drawn hole can remain a true cubic contour: keep the
  // original letter curves and their handles instead of re-tracing the glyph.
  if(operation==='subtract'&&!element.warp&&!element.perspective){
    const cut=pathPolygons(worldPath),body=pathPolygons(shapeWorldPath(element));
    if(cut.length&&!stablePolygonDifference(cut,body).length){
      const angle=-element.rotation*Math.PI/180,mapping=shapePointMapping(element);
      const local=mapShapePath(worldPath,p=>{const dx=p.x-element.x,dy=p.y-element.y;return mapping.inverse({x:((dx*Math.cos(angle)-dy*Math.sin(angle))/element.width+.5)*100,y:((dx*Math.sin(angle)+dy*Math.cos(angle))/element.height+.5)*100});});
      const path=shapeToEditablePath(element);
      if(element.letteringParts){const world=shapeWorldPath(element),all=[{...world,subpaths:undefined},...(world.subpaths??[])];for(const part of element.letteringParts){const contours=all.filter(p=>p.letterKey===part.key);if(contours.length&&!stablePolygonDifference(cut,pathPolygons({...contours[0],subpaths:contours.slice(1)})).length){local.letterKey=part.key;break;}}}

      return {...element,shapePath:{...path,subpaths:[...(path.subpaths??[]),local]},shapeOperationSources:element.shapeOperationSources??[element],shapeOperationFrame:element.shapeOperationFrame??{x:element.x,y:element.y,width:element.width,height:element.height,rotation:element.rotation}};
    }
  }
  const cutter:DesignElement={...element,...fitPenPath(worldPath),id:'pen-region',rotation:0,shapePath:fitPenPath(worldPath).shapePath,shapeEffects:[],flipHorizontal:false,flipVertical:false,letteringSource:undefined,shapeOperationSources:undefined};
  const result=combineArtworkPaths([element,cutter],[element.id,cutter.id],operation,element.id)[0];
  return {...result,layerName:element.layerName,shapeOperationSources:element.shapeOperationSources??[element]};
}

/** Release a join into an editable group, retaining subsequent movement and scaling. */
export function restorePathSources(element:DesignElement):DesignElement {
  const sources=element.shapeOperationSources;if(!sources?.length)throw new Error('No original shapes are saved.');
  const frame=element.shapeOperationFrame??element,angle=-frame.rotation*Math.PI/180;
  return {id:element.id,type:'group',content:'',layerName:'Restored source shapes',x:element.x,y:element.y,width:element.width,height:element.height,rotation:element.rotation,side:element.side,groupSourceWidth:frame.width,groupSourceHeight:frame.height,aspectLocked:true,
    children:sources.map(source=>{const x=source.x-frame.x,y=source.y-frame.y;return {...source,x:frame.width/2+x*Math.cos(angle)-y*Math.sin(angle),y:frame.height/2+x*Math.sin(angle)+y*Math.cos(angle),rotation:source.rotation-frame.rotation};}),
    printMethod:sources.every(source=>(source.printMethod??'DTG')===(sources[0].printMethod??'DTG'))?sources[0].printMethod:undefined,
    shapeOperationSources:undefined,shapeOperationFrame:undefined,shapePath:undefined,shapeEffects:undefined,letteringSource:undefined};
}

/** Keep edited curves and their stroke inside the mask's element bounds. */
export function reframeEditedPath(element:DesignElement,path:ShapePath):Partial<DesignElement>{
  if(element.warp||element.perspective)return {shapePath:path};
  const local=mapShapePath(path,p=>({x:p.x/100*element.width,y:p.y/100*element.height}));
  const fitted=fitPenPath(local,Math.max(1,(element.borderWidth??2)/2+1));
  const dx=(fitted.x-element.width/2)*(element.flipHorizontal?-1:1),dy=(fitted.y-element.height/2)*(element.flipVertical?-1:1),angle=element.rotation*Math.PI/180;
  return {...fitted,x:element.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:element.y+dx*Math.sin(angle)+dy*Math.cos(angle)};
}
