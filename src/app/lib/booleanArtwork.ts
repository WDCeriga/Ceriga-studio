import clipping,{type MultiPolygon} from 'polygon-clipping';
import type {DesignElement} from '../components/builder/PrintStudioEditor';
import {combineArtworkPaths,fitPenPath,mapShapePath,pathPolygons,shapeWorldPath,type PathOperation} from './artworkPathOperations';
import type {ShapePath} from './shapeGeometry';
export type BooleanOperation=PathOperation|'divide';
const paintKeys=['color','shapeFilled','shapeFillColor','shapeStrokeColor','borderWidth','shapeStrokeCap','shapeStrokeJoin','shapeStrokeAlign','shapeStrokeStyle','shapeOutlineAccent','shapeFillReference','shapeStrokeReference','shapeEffects','opacity','printMethod'] as const;
const paint=(source:DesignElement)=>Object.fromEntries(paintKeys.map(key=>[key,source[key]]));
function divide(geometries:MultiPolygon[]):MultiPolygon{
 let pieces:MultiPolygon[]=[];
 for(const geometry of geometries){const covered=pieces.length?clipping.union(...pieces):[],next:MultiPolygon[]=[];for(const piece of pieces){const outside=clipping.difference(piece,geometry),inside=clipping.intersection(piece,geometry);if(outside.length)next.push(outside);if(inside.length)next.push(inside);}const extra=covered.length?clipping.difference(geometry,covered):geometry;if(extra.length)next.push(extra);pieces=next;}
 return pieces.flat();
}
function resultPath(children:DesignElement[],operation:BooleanOperation):ShapePath|null{
 const shapes=children.filter(child=>!child.hidden).map(child=>pathPolygons(shapeWorldPath(child)));if(!shapes.length)return null;
 const result=operation==='join'?clipping.union(...shapes):operation==='subtract'?clipping.difference(shapes[0],...shapes.slice(1)):operation==='intersect'?clipping.intersection(...shapes):operation==='exclude'?clipping.xor(...shapes):divide(shapes);
 const paths=result.flatMap(polygon=>polygon.map(ring=>({closed:true,nodes:ring.slice(0,-1).map(([x,y])=>({x,y}))} as ShapePath)));return paths.length?{...paths[0],subpaths:paths.slice(1)}:null;
}
/** Rebase children and result together; child edits cannot drift the world-space result. */
export function refreshBoolean(element:DesignElement):DesignElement{
 if(!element.booleanOperation||!element.children?.length)return element;
 const children=element.children.map(refreshBoolean),key=JSON.stringify([element.booleanOperation,children]),styleKey=JSON.stringify(paint(children[0]));if(element.booleanSourceKey===key&&element.booleanStyleKey===styleKey)return element;
 const sourceWidth=element.groupSourceWidth??element.width,sourceHeight=element.groupSourceHeight??element.height,path=resultPath(children,element.booleanOperation);
 const previous=element.booleanStyleKey?JSON.parse(element.booleanStyleKey):{},next=paint(children[0]),style=Object.fromEntries(paintKeys.filter(key=>JSON.stringify(previous[key])!==JSON.stringify(next[key])).map(key=>[key,next[key]]));
 if(!path)return {...element,...style,children,shapePath:{closed:true,nodes:[]},booleanSourceKey:key,booleanStyleKey:styleKey};
 const fit=fitPenPath(path),left=fit.x-fit.width/2,top=fit.y-fit.height/2,angle=element.rotation*Math.PI/180;
 const dx=(fit.x-sourceWidth/2)*element.width/sourceWidth*(element.flipHorizontal?-1:1),dy=(fit.y-sourceHeight/2)*element.height/sourceHeight*(element.flipVertical?-1:1);
 const rebased=children.map(child=>({...child,x:child.x-left,y:child.y-top}));
 return {...element,...style,x:element.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:element.y+dx*Math.sin(angle)+dy*Math.cos(angle),width:fit.width*element.width/sourceWidth,height:fit.height*element.height/sourceHeight,groupSourceWidth:fit.width,groupSourceHeight:fit.height,shapePath:fit.shapePath,shapeFillRule:'evenodd',children:rebased,booleanSourceKey:JSON.stringify([element.booleanOperation,rebased]),booleanStyleKey:styleKey};
}
export function createBoolean(elements:DesignElement[],ids:string[],operation:BooleanOperation,id:string){
 const selected=elements.filter(e=>ids.includes(e.id));const seed=combineArtworkPaths(elements,ids,'join',id).find(e=>e.id===id)!;
 const left=seed.x-seed.width/2,top=seed.y-seed.height/2,children=selected.map(child=>({...child,x:child.x-left,y:child.y-top}));
 const group=refreshBoolean({...seed,booleanOperation:operation,booleanSourceKey:undefined,booleanStyleKey:undefined,children,groupSourceWidth:seed.width,groupSourceHeight:seed.height,shapeOperationSources:undefined,shapeOperationFrame:undefined,layerName:operation==='divide'?'Divided shapes':'Boolean shapes'});
 return elements.flatMap(element=>element.id===selected[0].id?[group]:ids.includes(element.id)?[]:[element]);
}
export function flattenBoolean(element:DesignElement):DesignElement{
 const resolved=refreshBoolean(element);return {...resolved,children:undefined,booleanOperation:undefined,booleanSourceKey:undefined,booleanStyleKey:undefined,groupSourceWidth:undefined,groupSourceHeight:undefined};
}
export function releaseBoolean(element:DesignElement):DesignElement{
 const {shapePath,booleanOperation,booleanSourceKey,booleanStyleKey,...source}=refreshBoolean(element);return {...source,type:'group',content:'',layerName:'Boolean source shapes'};
}
